#!/usr/bin/env python3
"""
scripts/validate_dataset.py
----------------------------
Validates the starter dataset before training.

Checks:
  - Required columns present (text, label)
  - No missing or empty values
  - All labels are valid category names
  - No duplicate records
  - Class distribution / imbalance warning

Run:
    python scripts/validate_dataset.py
    python scripts/validate_dataset.py --dataset data/starter_dataset.csv
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Add project root to path so we can import app schemas
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "backend"))

import pandas as pd
from app.schemas.models import DetectionCategory

VALID_LABELS = {c.value for c in DetectionCategory}
REQUIRED_COLUMNS = {"text", "label"}


def validate(dataset_path: Path) -> bool:
    print(f"\n{'='*60}")
    print(f"  PromptShield Dataset Validator")
    print(f"  File: {dataset_path}")
    print(f"{'='*60}\n")

    # Load
    try:
        df = pd.read_csv(dataset_path)
    except Exception as e:
        print(f"[FAIL] Could not load CSV: {e}")
        return False

    print(f"  Rows loaded : {len(df)}")
    print(f"  Columns     : {list(df.columns)}\n")

    errors: list[str] = []
    warnings: list[str] = []

    # 1. Required columns
    missing_cols = REQUIRED_COLUMNS - set(df.columns)
    if missing_cols:
        errors.append(f"Missing required columns: {missing_cols}")

    if errors:
        for e in errors:
            print(f"[FAIL] {e}")
        return False

    # 2. Missing / empty values
    empty_texts = df["text"].isna() | (df["text"].astype(str).str.strip() == "")
    if empty_texts.any():
        errors.append(f"{empty_texts.sum()} row(s) have empty 'text' values.")

    empty_labels = df["label"].isna() | (df["label"].astype(str).str.strip() == "")
    if empty_labels.any():
        errors.append(f"{empty_labels.sum()} row(s) have empty 'label' values.")

    # 3. Invalid labels
    if not empty_labels.any():
        invalid_mask = ~df["label"].isin(VALID_LABELS)
        if invalid_mask.any():
            bad = df.loc[invalid_mask, "label"].unique().tolist()
            errors.append(f"Invalid label(s) found: {bad}. Valid: {sorted(VALID_LABELS)}")

    # 4. Duplicates (text-only, case-insensitive)
    dupes = df.duplicated(subset=["text"], keep=False)
    if dupes.any():
        warnings.append(f"{dupes.sum()} duplicate 'text' entries found.")

    # 5. Class distribution
    print("  Class distribution:")
    dist = df["label"].value_counts()
    for label, count in dist.items():
        bar = "#" * count
        print(f"    {label:<32} {count:>4}  {bar}")
    print()

    min_count = dist.min()
    max_count = dist.max()
    if max_count > min_count * 5:
        warnings.append(
            f"Significant class imbalance detected (min={min_count}, max={max_count}). "
            "Consider adding more examples for minority classes."
        )

    # Report
    if warnings:
        for w in warnings:
            print(f"[WARN] {w}")
    if errors:
        for e in errors:
            print(f"[FAIL] {e}")
        print("\n  [FAIL] Dataset validation FAILED.\n")
        return False

    print(f"  [PASS] Dataset validation PASSED ({len(df)} rows, {dist.nunique()} classes).\n")
    print(
        "  NOTE: This dataset is synthetic/illustrative and NOT representative\n"
        "  of real-world attack distributions. Do not make production security\n"
        "  claims based on models trained on this data.\n"
    )
    return True


def main():
    parser = argparse.ArgumentParser(description="Validate PromptShield training dataset.")
    parser.add_argument(
        "--dataset",
        default=str(ROOT / "data" / "starter_dataset.csv"),
        help="Path to the CSV dataset file.",
    )
    args = parser.parse_args()
    ok = validate(Path(args.dataset))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
