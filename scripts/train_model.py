#!/usr/bin/env python3
"""
scripts/train_model.py
-----------------------
Trains a TF-IDF + Logistic Regression pipeline on the starter dataset
and saves artifacts to backend/models/.

Reproducibility guarantees:
  - Fixed RANDOM_SEED for all random processes.
  - Stratified train/test split (falls back to regular split for tiny classes).
  - No data leakage: test set is never used during training.

Saved artifacts:
  - backend/models/pipeline.joblib   — the trained sklearn pipeline
  - backend/models/metadata.json     — training metadata
  - backend/models/metrics.json      — evaluation metrics (written by evaluate_model.py)

Run:
    python scripts/train_model.py
    python scripts/train_model.py --dataset data/starter_dataset.csv --seed 42
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "backend"))

import joblib
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix

RANDOM_SEED = 42
MODEL_DIR = ROOT / "backend" / "models"
DATASET_DEFAULT = ROOT / "data" / "starter_dataset.csv"
TEST_SIZE = 0.2


def load_dataset(path: Path) -> tuple[list[str], list[str]]:
    df = pd.read_csv(path)
    df["text"] = df["text"].astype(str).str.strip()
    df["label"] = df["label"].astype(str).str.strip()
    df = df[df["text"] != ""].reset_index(drop=True)
    print(f"  Loaded {len(df)} samples.")
    print(f"  Class distribution:\n{df['label'].value_counts().to_string()}\n")
    return df["text"].tolist(), df["label"].tolist()


def build_pipeline() -> Pipeline:
    """Return an untrained TF-IDF + Logistic Regression pipeline."""
    return Pipeline([
        ("tfidf", TfidfVectorizer(
            ngram_range=(1, 2),
            max_features=20_000,
            sublinear_tf=True,
            min_df=1,
        )),
        ("clf", LogisticRegression(
            max_iter=1000,
            random_state=RANDOM_SEED,
            class_weight="balanced",
            solver="lbfgs",
        )),
    ])


def train(dataset_path: Path, seed: int = RANDOM_SEED) -> None:
    print(f"\n{'='*60}")
    print(f"  PromptShield Model Trainer")
    print(f"  Dataset : {dataset_path}")
    print(f"  Seed    : {seed}")
    print(f"{'='*60}\n")

    texts, labels = load_dataset(dataset_path)

    # Stratified split — fallback if a class has < 2 samples
    try:
        X_train, X_test, y_train, y_test = train_test_split(
            texts, labels,
            test_size=TEST_SIZE,
            random_state=seed,
            stratify=labels,
        )
        split_type = "stratified"
    except ValueError as e:
        print(f"  [WARN] Stratified split failed ({e}). Using random split.")
        X_train, X_test, y_train, y_test = train_test_split(
            texts, labels,
            test_size=TEST_SIZE,
            random_state=seed,
        )
        split_type = "random"

    print(f"  Train samples : {len(X_train)}")
    print(f"  Test samples  : {len(X_test)}  (split: {split_type})\n")

    # Train
    pipeline = build_pipeline()
    print("  Training TF-IDF + Logistic Regression pipeline…")
    pipeline.fit(X_train, y_train)
    print("  Training complete.\n")

    # Quick evaluation
    y_pred = pipeline.predict(X_test)
    print("  --- Test Set Evaluation ---")
    report = classification_report(y_test, y_pred, zero_division=0)
    print(report)

    cm = confusion_matrix(y_test, y_pred, labels=list(pipeline.classes_))
    print(f"  Confusion matrix (classes: {list(pipeline.classes_)}):")
    print(cm, "\n")

    # Save artifacts
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    pipeline_path = MODEL_DIR / "pipeline.joblib"
    joblib.dump(pipeline, pipeline_path)
    print(f"  Pipeline saved -> {pipeline_path}")

    metadata = {
        "model_type": "TF-IDF + Logistic Regression",
        "model_version": "experimental-v1",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "dataset": str(dataset_path),
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "split_type": split_type,
        "random_seed": seed,
        "classes": list(pipeline.classes_),
        "disclaimer": (
            "Trained on a small synthetic dataset. "
            "Metrics are illustrative and should not be used for production security claims."
        ),
    }
    meta_path = MODEL_DIR / "metadata.json"
    meta_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(f"  Metadata saved -> {meta_path}")

    print("\n  [OK]  Training complete.\n")
    print("  Run `python scripts/evaluate_model.py` for full evaluation metrics.\n")


def main():
    parser = argparse.ArgumentParser(description="Train the PromptShield ML classifier.")
    parser.add_argument("--dataset", default=str(DATASET_DEFAULT))
    parser.add_argument("--seed", type=int, default=RANDOM_SEED)
    args = parser.parse_args()
    train(Path(args.dataset), args.seed)


if __name__ == "__main__":
    main()
