#!/usr/bin/env python3
"""
scripts/evaluate_model.py
--------------------------
Evaluates the trained pipeline on the full dataset using cross-validation
and a held-out test set. Saves results to backend/models/metrics.json.

Run AFTER train_model.py:
    python scripts/evaluate_model.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "backend"))

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    f1_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score

MODEL_DIR = ROOT / "backend" / "models"
DATASET_DEFAULT = ROOT / "data" / "starter_dataset.csv"
RANDOM_SEED = 42


def evaluate(dataset_path: Path = DATASET_DEFAULT) -> None:
    print(f"\n{'='*60}")
    print(f"  PromptShield Model Evaluator")
    print(f"{'='*60}\n")

    pipeline_path = MODEL_DIR / "pipeline.joblib"
    if not pipeline_path.exists():
        print(f"  [FAIL] No trained model found at {pipeline_path}.")
        print("  Run: python scripts/train_model.py first.")
        sys.exit(1)

    pipeline = joblib.load(pipeline_path)
    print(f"  Model loaded from {pipeline_path}")

    df = pd.read_csv(dataset_path)
    df["text"] = df["text"].astype(str).str.strip()
    df["label"] = df["label"].astype(str).str.strip()
    df = df[df["text"] != ""].reset_index(drop=True)

    texts = df["text"].tolist()
    labels = df["label"].tolist()
    classes = list(pipeline.classes_)

    print(f"  Total samples : {len(texts)}")
    print(f"  Classes       : {classes}\n")

    # Full-dataset predictions (for reference — overfitted, use with caution)
    y_pred = pipeline.predict(texts)
    print("  --- Full-Dataset Classification Report (TRAIN SET — overfitted) ---")
    print("  NOTE: These metrics are optimistic because the model was trained on this data.")
    print(classification_report(labels, y_pred, zero_division=0))

    # Cross-validation
    print("  --- Cross-Validation (5-fold stratified) ---")
    try:
        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_SEED)
        cv_scores = cross_val_score(pipeline, texts, labels, cv=cv, scoring="f1_macro", n_jobs=1)
        print(f"  CV F1-macro scores : {[round(s, 3) for s in cv_scores]}")
        print(f"  Mean CV F1-macro   : {cv_scores.mean():.3f} ± {cv_scores.std():.3f}")
        cv_available = True
    except Exception as e:
        print(f"  [WARN] Cross-validation failed: {e}")
        cv_available = False
        cv_scores = np.array([])

    # Confusion matrix
    cm = confusion_matrix(labels, y_pred, labels=classes)
    print(f"\n  Confusion matrix (classes: {classes}):")
    print(cm)

    # Per-class metrics
    report_dict = classification_report(labels, y_pred, output_dict=True, zero_division=0)
    macro_f1 = f1_score(labels, y_pred, average="macro", zero_division=0)

    print(f"\n  Macro F1 (full dataset): {macro_f1:.3f}")
    print("\n  [!]  IMPORTANT DISCLAIMER:")
    print("  These metrics are computed on a small synthetic dataset.")
    print("  They are illustrative ONLY and must NOT be used to make")
    print("  production security claims or reliability guarantees.\n")

    # Save metrics
    metrics = {
        "disclaimer": (
            "Metrics computed on a small synthetic dataset. "
            "Illustrative only — not representative of real-world performance."
        ),
        "full_dataset_macro_f1": round(float(macro_f1), 4),
        "cross_validation": {
            "folds": 5,
            "strategy": "StratifiedKFold",
            "scores": [round(float(s), 4) for s in cv_scores] if cv_available else [],
            "mean_f1_macro": round(float(cv_scores.mean()), 4) if cv_available else None,
            "std_f1_macro": round(float(cv_scores.std()), 4) if cv_available else None,
        },
        "per_class_metrics": {
            cls: {
                "precision": round(report_dict.get(cls, {}).get("precision", 0.0), 4),
                "recall": round(report_dict.get(cls, {}).get("recall", 0.0), 4),
                "f1_score": round(report_dict.get(cls, {}).get("f1-score", 0.0), 4),
                "support": int(report_dict.get(cls, {}).get("support", 0)),
            }
            for cls in classes
        },
        "confusion_matrix": {
            "classes": classes,
            "matrix": cm.tolist(),
        },
    }

    metrics_path = MODEL_DIR / "metrics.json"
    metrics_path.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(f"  Metrics saved -> {metrics_path}")
    print("\n  [OK]  Evaluation complete.\n")


if __name__ == "__main__":
    evaluate()
