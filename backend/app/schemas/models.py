"""
PromptShield — Pydantic Schemas
All request / response models used by the API live here.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Enumeration types
# ---------------------------------------------------------------------------

class RiskLevel(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"


class DetectionCategory(str, Enum):
    BENIGN = "benign"
    DIRECT_PROMPT_INJECTION = "direct_prompt_injection"
    INDIRECT_PROMPT_INJECTION = "indirect_prompt_injection"
    JAILBREAK = "jailbreak"
    SYSTEM_PROMPT_EXTRACTION = "system_prompt_extraction"
    DATA_EXFILTRATION = "data_exfiltration"
    TOOL_MISUSE = "tool_misuse"


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class AnalyzeRequest(BaseModel):
    """Single-text analysis request."""
    text: str = Field(..., min_length=1, max_length=10_000, description="Text to analyze.")

    @field_validator("text")
    @classmethod
    def strip_and_require_content(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("text must not be empty or whitespace-only")
        return v


class BatchAnalyzeRequest(BaseModel):
    """Batch analysis request — bounded to prevent resource abuse."""
    texts: list[str] = Field(
        ...,
        min_length=1,
        max_length=50,
        description="List of texts to analyze (max 50).",
    )

    @field_validator("texts")
    @classmethod
    def validate_texts(cls, v: list[str]) -> list[str]:
        stripped = [t.strip() for t in v]
        for i, t in enumerate(stripped):
            if not t:
                raise ValueError(f"Item at index {i} is empty.")
            if len(t) > 10_000:
                raise ValueError(f"Item at index {i} exceeds maximum length of 10,000 characters.")
        return stripped


# ---------------------------------------------------------------------------
# Detection evidence / sub-models
# ---------------------------------------------------------------------------

class RuleMatch(BaseModel):
    """A single rule-based match."""
    rule_id: str
    category: DetectionCategory
    description: str
    matched_snippet: str = Field(..., description="Short excerpt of the matched text (sanitised).")
    confidence: float = Field(..., ge=0.0, le=1.0)


class ModelPrediction(BaseModel):
    """Output of the ML classifier."""
    predicted_class: DetectionCategory
    confidence: float = Field(..., ge=0.0, le=1.0, description="Softmax probability of the top class.")
    class_probabilities: dict[str, float] = Field(default_factory=dict)
    model_version: str = "unknown"


# ---------------------------------------------------------------------------
# Analysis result
# ---------------------------------------------------------------------------

class AnalysisResult(BaseModel):
    """Full analysis result for a single input."""
    input_length: int
    risk_score: float = Field(..., ge=0.0, le=100.0, description="Heuristic risk score 0–100.")
    risk_level: RiskLevel
    detected_categories: list[DetectionCategory]
    rule_matches: list[RuleMatch]
    model_prediction: Optional[ModelPrediction] = None
    explanation: str
    recommended_actions: list[str]
    detection_components_used: list[str] = Field(
        default_factory=list,
        description="Which detectors contributed to this result.",
    )

    # IMPORTANT: this field exists so consumers understand what the score means.
    score_disclaimer: str = (
        "Risk score is a heuristic estimate based on pattern matching and "
        "an experimental ML classifier. It does NOT prove that an LLM application "
        "is exploitable. Always validate findings against the actual deployment."
    )


# ---------------------------------------------------------------------------
# Batch result
# ---------------------------------------------------------------------------

class BatchItemResult(BaseModel):
    """Result for one item in a batch."""
    index: int
    text_preview: str = Field(..., description="First 120 characters of the input (for display).")
    result: AnalysisResult


class BatchAggregateStats(BaseModel):
    total: int
    by_risk_level: dict[str, int]
    by_category: dict[str, int]
    average_risk_score: float


class BatchAnalyzeResponse(BaseModel):
    items: list[BatchItemResult]
    aggregate: BatchAggregateStats


# ---------------------------------------------------------------------------
# Rules / model-info endpoints
# ---------------------------------------------------------------------------

class RuleInfo(BaseModel):
    rule_id: str
    category: DetectionCategory
    description: str
    examples: list[str]
    known_false_positives: str


class RulesResponse(BaseModel):
    rules: list[RuleInfo]
    total: int


class ModelInfo(BaseModel):
    available: bool
    model_type: Optional[str] = None
    supported_classes: list[str] = []
    training_metadata: Optional[dict] = None
    evaluation_metrics: Optional[dict] = None
    disclaimer: str = (
        "This model is trained on a small synthetic dataset and is explicitly "
        "experimental. Metrics should not be used to make production security claims."
    )


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    status: str
    rule_based_detector: bool
    ml_classifier: bool
    version: str = "0.1.0"
