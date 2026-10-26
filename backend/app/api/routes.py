"""
PromptShield — FastAPI Router
"""

from __future__ import annotations

import io
import json
import csv
import logging
from collections import Counter
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import JSONResponse, StreamingResponse

from app.core.config import get_settings, Settings
from app.detectors.rule_based import RuleBasedDetector
from app.detectors.ml_classifier import MLClassifier
from app.services.analysis import AnalysisService
from app.schemas.models import (
    AnalyzeRequest,
    BatchAnalyzeRequest,
    BatchAnalyzeResponse,
    BatchItemResult,
    BatchAggregateStats,
    HealthResponse,
    RulesResponse,
    ModelInfo,
    AnalysisResult,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# ---------------------------------------------------------------------------
# Module-level singletons — initialized once at import time
# Works correctly with both TestClient and live uvicorn server.
# ---------------------------------------------------------------------------

_settings = get_settings()
_rule_detector = RuleBasedDetector()
_ml_classifier = MLClassifier(_settings.model_dir)


def get_rule_detector() -> RuleBasedDetector:
    return _rule_detector


def get_ml_classifier() -> MLClassifier:
    return _ml_classifier


def get_analysis_service(
    rule_det: Annotated[RuleBasedDetector, Depends(get_rule_detector)],
    ml_cls: Annotated[MLClassifier, Depends(get_ml_classifier)],
) -> AnalysisService:
    return AnalysisService(rule_det, ml_cls)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/health", response_model=HealthResponse, tags=["System"])
async def health(settings: Annotated[Settings, Depends(get_settings)]):
    """Return application health and detector availability."""
    return HealthResponse(
        status="ok",
        rule_based_detector=True,
        ml_classifier=_ml_classifier.is_available,
    )


@router.post("/analyze", response_model=AnalysisResult, tags=["Detection"])
async def analyze(
    request: AnalyzeRequest,
    service: Annotated[AnalysisService, Depends(get_analysis_service)],
    settings: Annotated[Settings, Depends(get_settings)],
):
    """
    Analyze a single text input for prompt injection and related LLM attacks.

    Returns a structured risk assessment including:
    - Risk score (0–100, heuristic)
    - Risk level (Low / Medium / High / Critical)
    - Detected categories
    - Rule evidence with matched snippets
    - ML prediction (when model is available)
    - Recommended defensive actions
    """
    if len(request.text) > settings.max_input_length:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Input exceeds maximum length of {settings.max_input_length} characters.",
        )
    try:
        return service.analyze(request.text)
    except Exception as exc:
        logger.error("Analysis error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred during analysis.",
        )


@router.post("/batch-analyze", response_model=BatchAnalyzeResponse, tags=["Detection"])
async def batch_analyze(
    request: BatchAnalyzeRequest,
    service: Annotated[AnalysisService, Depends(get_analysis_service)],
    settings: Annotated[Settings, Depends(get_settings)],
):
    """
    Analyze multiple text inputs in one request.

    Maximum batch size is controlled by the MAX_BATCH_SIZE environment variable.
    Each item is analyzed independently; results are returned in order.
    """
    if len(request.texts) > settings.max_batch_size:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Batch size exceeds maximum of {settings.max_batch_size}.",
        )

    items: list[BatchItemResult] = []
    risk_level_counts: Counter = Counter()
    category_counts: Counter = Counter()
    total_score = 0.0

    for idx, text in enumerate(request.texts):
        try:
            result = service.analyze(text)
        except Exception as exc:
            logger.error("Batch item %d analysis error: %s", idx, exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Analysis failed for item at index {idx}.",
            )
        items.append(
            BatchItemResult(
                index=idx,
                text_preview=text[:120],
                result=result,
            )
        )
        risk_level_counts[result.risk_level.value] += 1
        for cat in result.detected_categories:
            category_counts[cat.value] += 1
        total_score += result.risk_score

    aggregate = BatchAggregateStats(
        total=len(items),
        by_risk_level=dict(risk_level_counts),
        by_category=dict(category_counts),
        average_risk_score=round(total_score / len(items), 1) if items else 0.0,
    )

    return BatchAnalyzeResponse(items=items, aggregate=aggregate)


@router.get("/rules", response_model=RulesResponse, tags=["Information"])
async def get_rules():
    """
    Return all detection rules with descriptions and examples.

    Does NOT expose any secrets, API keys, or internal configuration.
    """
    from app.detectors.rule_based import RuleBasedDetector
    rules = RuleBasedDetector.get_rules_info()
    return RulesResponse(rules=rules, total=len(rules))


@router.get("/model-info", response_model=ModelInfo, tags=["Information"])
async def model_info():
    """
    Return ML model status, supported classes, and evaluation metrics.

    Metrics are only returned when a model has been trained and evaluated.
    This endpoint NEVER invents metrics.
    """
    return _ml_classifier.get_model_info()


# ---------------------------------------------------------------------------
# File upload for batch analysis
# ---------------------------------------------------------------------------

MAX_UPLOAD_BYTES = 1_048_576  # 1 MB — also enforced via Settings


@router.post("/batch-upload", response_model=BatchAnalyzeResponse, tags=["Detection"])
async def batch_upload(
    file: UploadFile = File(...),
    service: AnalysisService = Depends(get_analysis_service),
    settings: Settings = Depends(get_settings),
):
    """
    Accept a CSV or JSONL file containing text samples for batch analysis.

    CSV format: must have a 'text' column.
    JSONL format: each line must be a JSON object with a 'text' key.

    Security: uploaded content is treated as untrusted text — it is never
    executed or forwarded to external services.
    """
    # Validate file extension / MIME
    allowed_extensions = {".csv", ".jsonl"}
    suffix = "." + (file.filename or "").rsplit(".", 1)[-1].lower()
    if suffix not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only .csv and .jsonl files are supported.",
        )

    raw = await file.read(settings.max_upload_bytes + 1)
    if len(raw) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum size of {settings.max_upload_bytes} bytes.",
        )

    # Decode safely
    try:
        content = raw.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File must be UTF-8 encoded.",
        )

    # Parse texts
    texts: list[str] = []
    try:
        if suffix == ".csv":
            reader = csv.DictReader(io.StringIO(content))
            if reader.fieldnames is None or "text" not in reader.fieldnames:
                raise ValueError("CSV must contain a 'text' column.")
            for row in reader:
                t = (row.get("text") or "").strip()
                if t:
                    texts.append(t)
        else:  # .jsonl
            for line_num, line in enumerate(content.splitlines(), 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError as e:
                    raise ValueError(f"Invalid JSON on line {line_num}: {e}")
                if "text" not in obj:
                    raise ValueError(f"Missing 'text' key on line {line_num}.")
                t = str(obj["text"]).strip()
                if t:
                    texts.append(t)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )

    if not texts:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No valid text items found in the uploaded file.",
        )

    if len(texts) > settings.max_batch_size:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"File contains {len(texts)} items; maximum is {settings.max_batch_size}.",
        )

    # Delegate to batch-analyze logic
    batch_req = BatchAnalyzeRequest(texts=texts)
    return await batch_analyze(batch_req, service, settings)
