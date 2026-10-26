# Architecture — PromptShield

## Overview

PromptShield is a local-first security analysis platform built as three
loosely coupled layers:

```
Browser ──► React Frontend (Vite) ──► FastAPI Backend ──► Detection Pipeline
                                                         ├── Rule-Based Detector
                                                         └── ML Classifier (optional)
```

## Backend

**Framework:** FastAPI 0.115 on Python 3.11+

**Module layout:**

| Module | Responsibility |
|--------|---------------|
| `app/main.py` | App factory, lifespan, CORS, exception handler |
| `app/core/config.py` | Environment-based settings via pydantic-settings |
| `app/api/routes.py` | HTTP endpoints and file upload handling |
| `app/schemas/models.py` | All Pydantic request/response types |
| `app/detectors/rule_based.py` | 14-rule regex catalogue |
| `app/detectors/ml_classifier.py` | sklearn pipeline wrapper |
| `app/services/analysis.py` | Score orchestration and recommendations |

**Detection pipeline:**

```
Input text
    │
    ├─► RuleBasedDetector.analyze(text)
    │       └── for each Rule: compile patterns → search → RuleMatch
    │
    ├─► MLClassifier.predict(text) [if available]
    │       └── pipeline.predict_proba(text) → ModelPrediction
    │
    └─► AnalysisService._compute_risk_score(matches, prediction)
            └── rule contribution (up to 80pts) + ML boost (up to 20pts)
            └── score → RiskLevel → AnalysisResult
```

**Risk scoring (documented heuristic):**

```python
score = 0
for match in rule_matches:
    score += match.confidence * 40          # Each rule adds up to 40pts
    if category in HIGH_IMPACT:
        score *= 1.15                       # 15% boost for high-impact cats
score = min(score, 80)                      # Rule cap

if ml_pred.confidence > 0.6 and not benign:
    ml_boost = (confidence - 0.6) / 0.4 * 20   # Up to 20 more pts
    score = min(score + ml_boost, 100)
```

**Security controls implemented:**
- Input length limit (10,000 chars) enforced at Pydantic + API level
- Batch size limit (50 items) enforced at Pydantic + API level
- File upload size limit (1 MB) enforced before parsing
- MIME type / extension validation for uploads
- CORS restricted to `localhost:5173` by default
- No raw prompt logging
- Generic error messages to clients; detailed logs server-side only
- All submitted content treated as untrusted text; never executed

## Frontend

**Framework:** React 18 + TypeScript + Vite

**State management:** React `useState` (no external state library for MVP)

**Pages:**

| Page | Route (client-side) | Description |
|------|---------------------|-------------|
| Overview | default | Session stats, Recharts charts, recent scans |
| Analyze | analyze | Single-text input, result display |
| Batch | batch | Multi-text, file upload, sortable table, export |
| Rules | rules | Detection rule browser |
| Model | model | ML metrics and confusion matrix |
| History | history | Session scan log |

**API communication:** `src/services/api.ts` — typed `fetch` wrappers, no external HTTP library.

## ML Pipeline

**Algorithm:** TF-IDF (1-2 gram, 20k features, sublinear TF) + Logistic Regression (balanced class weight, lbfgs solver)

**Training script:** `scripts/train_model.py`
- Stratified 80/20 train/test split
- Fixed seed (42) for reproducibility
- Saves `pipeline.joblib`, `metadata.json`

**Evaluation script:** `scripts/evaluate_model.py`
- 5-fold StratifiedKFold cross-validation
- Per-class precision, recall, F1
- Confusion matrix
- Saves `metrics.json` (read by `/api/model-info`)

**Graceful degradation:** If `pipeline.joblib` is absent, `MLClassifier.is_available = False`
and the API continues functioning with rule-based detection only.

## Data Flow — Single Analysis

```
POST /api/analyze {"text": "..."}
    │
    ▼
Pydantic AnalyzeRequest validates length, strips whitespace
    │
    ▼
AnalysisService.analyze(text)
    ├── RuleBasedDetector.analyze(text) → [RuleMatch, ...]
    └── MLClassifier.predict(text) → ModelPrediction | None
    │
    ▼
_compute_risk_score(rule_matches, ml_pred) → float 0–100
_score_to_level(score) → RiskLevel
_collect_categories(...) → [DetectionCategory, ...]
_build_explanation(...) → str
_collect_recommendations(categories) → [str, ...]
    │
    ▼
AnalysisResult (JSON) → HTTP 200 → Frontend
```
