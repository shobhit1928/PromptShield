"""
PromptShield — ML Classifier
==============================
Wraps a scikit-learn TF-IDF + Logistic Regression pipeline for text
classification into detection categories.

Design notes
------------
* The classifier is OPTIONAL.  If model artifacts are missing, the detector
  reports its unavailability and falls back to rule-based detection only.
* The model is trained on a small synthetic dataset and is explicitly
  labelled EXPERIMENTAL.  Metrics should not be used for production claims.
* Model artifacts are loaded once at startup.  Hot-reloading is not supported
  in this version.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Optional

import joblib

from app.schemas.models import DetectionCategory, ModelInfo, ModelPrediction

logger = logging.getLogger(__name__)

# Artifact filenames (stored under settings.model_dir)
PIPELINE_FILENAME = "pipeline.joblib"
METADATA_FILENAME = "metadata.json"
METRICS_FILENAME = "metrics.json"


class MLClassifier:
    """
    Loads a pre-trained scikit-learn pipeline and provides inference.

    The pipeline is expected to have been trained by scripts/train_model.py.
    If the artifacts are absent the classifier runs in degraded mode and
    `is_available` returns False.
    """

    def __init__(self, model_dir: str | Path) -> None:
        self.model_dir = Path(model_dir)
        self._pipeline = None
        self._metadata: dict = {}
        self._metrics: dict = {}
        self._classes: list[str] = []
        self._available = False
        self._load()

    # ------------------------------------------------------------------
    # Initialisation
    # ------------------------------------------------------------------

    def _load(self) -> None:
        pipeline_path = self.model_dir / PIPELINE_FILENAME
        metadata_path = self.model_dir / METADATA_FILENAME
        metrics_path = self.model_dir / METRICS_FILENAME

        if not pipeline_path.exists():
            logger.warning(
                "ML model artifact not found at %s. "
                "Running in rule-only mode.  Train the model with: "
                "python scripts/train_model.py",
                pipeline_path,
            )
            return

        try:
            self._pipeline = joblib.load(pipeline_path)
            self._classes = list(self._pipeline.classes_)
            self._available = True
            logger.info("ML classifier loaded from %s (%d classes).", pipeline_path, len(self._classes))
        except Exception as exc:
            logger.error("Failed to load ML pipeline: %s", exc)
            return

        if metadata_path.exists():
            try:
                self._metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            except Exception as exc:
                logger.warning("Could not read model metadata: %s", exc)

        if metrics_path.exists():
            try:
                self._metrics = json.loads(metrics_path.read_text(encoding="utf-8"))
            except Exception as exc:
                logger.warning("Could not read model metrics: %s", exc)

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    @property
    def is_available(self) -> bool:
        return self._available

    def predict(self, text: str) -> Optional[ModelPrediction]:
        """
        Return a ModelPrediction for the given text, or None if unavailable.
        """
        if not self._available or self._pipeline is None:
            return None

        try:
            proba = self._pipeline.predict_proba([text])[0]
            top_idx = int(proba.argmax())
            top_class = self._classes[top_idx]
            class_probs = {cls: float(p) for cls, p in zip(self._classes, proba)}

            # Map the string class label to the enum
            try:
                predicted_category = DetectionCategory(top_class)
            except ValueError:
                predicted_category = DetectionCategory.BENIGN

            return ModelPrediction(
                predicted_class=predicted_category,
                confidence=float(proba[top_idx]),
                class_probabilities=class_probs,
                model_version=self._metadata.get("model_version", "experimental-v1"),
            )
        except Exception as exc:
            logger.error("Prediction failed: %s", exc)
            return None

    def get_model_info(self) -> ModelInfo:
        """Return metadata for the /api/model-info endpoint."""
        return ModelInfo(
            available=self._available,
            model_type=self._metadata.get("model_type") if self._metadata else None,
            supported_classes=self._classes,
            training_metadata=self._metadata if self._metadata else None,
            evaluation_metrics=self._metrics if self._metrics else None,
        )
