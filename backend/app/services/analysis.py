"""
PromptShield — Analysis Service
=================================
Orchestrates rule-based detection and ML classification into a single
structured AnalysisResult.

Scoring methodology (documented)
---------------------------------
The risk score is a HEURISTIC, not a calibrated probability.

Base score (rule-based):
  Each rule match contributes: rule.confidence * 40 points (capped at 80).
  Multiple matches accumulate additively up to the cap.

ML boost:
  If the ML classifier predicts a non-benign class with confidence > 0.6,
  it can add up to 20 additional points (scaled by confidence).

Category multipliers:
  Certain categories (e.g., data exfiltration) apply a 1.15× multiplier
  to reflect higher potential impact.

Thresholds (configurable via Settings):
  Low     : 0–24
  Medium  : 25–49
  High    : 50–74
  Critical: 75–100

This scoring model is intentionally transparent and tunable.  Do not
interpret the score as an exploit probability.
"""

from __future__ import annotations

import logging
from collections import Counter

from app.core.config import get_settings
from app.detectors.rule_based import RuleBasedDetector
from app.detectors.ml_classifier import MLClassifier
from app.schemas.models import (
    AnalysisResult,
    DetectionCategory,
    RiskLevel,
    RuleMatch,
    ModelPrediction,
)

logger = logging.getLogger(__name__)

# Categories considered higher-impact for scoring purposes.
HIGH_IMPACT_CATEGORIES = {
    DetectionCategory.DATA_EXFILTRATION,
    DetectionCategory.SYSTEM_PROMPT_EXTRACTION,
    DetectionCategory.TOOL_MISUSE,
}

# Recommended defensive actions per category.
RECOMMENDED_ACTIONS: dict[DetectionCategory, list[str]] = {
    DetectionCategory.BENIGN: [
        "No action required. Continue monitoring.",
    ],
    DetectionCategory.DIRECT_PROMPT_INJECTION: [
        "Apply input sanitisation and reject inputs containing instruction-override patterns.",
        "Use a separate, hardened system prompt that cannot be overridden by user input.",
        "Consider prompt firewalling (e.g., a secondary LLM check before forwarding to the primary model).",
        "Log and alert on high-confidence injection attempts.",
    ],
    DetectionCategory.INDIRECT_PROMPT_INJECTION: [
        "Treat all externally retrieved content (web pages, documents, tool outputs) as untrusted.",
        "Process external content in a sandboxed context before injecting into the LLM prompt.",
        "Use structured data formats rather than free-text injection from external sources.",
        "Apply the same injection detection pipeline to retrieved content before use.",
    ],
    DetectionCategory.JAILBREAK: [
        "Do not rely solely on model-level safety training; apply application-layer content filtering.",
        "Monitor for unusual response patterns that suggest policy bypass.",
        "Reject or flag inputs containing known jailbreak framing patterns.",
        "Review model output before returning it to the user.",
    ],
    DetectionCategory.SYSTEM_PROMPT_EXTRACTION: [
        "Never include sensitive or secret information in a system prompt accessible to users.",
        "Instruct the model not to repeat system instructions (defence-in-depth, not a guarantee).",
        "Treat the system prompt as potentially leakable by design — design accordingly.",
        "Apply output filtering to detect system prompt leakage in responses.",
    ],
    DetectionCategory.DATA_EXFILTRATION: [
        "Audit what data the LLM has access to and apply least-privilege principles.",
        "Block or proxy all outbound network requests initiated by the LLM agent.",
        "Monitor for unexpected data patterns in model outputs.",
        "Do not expose raw database contents, API keys, or credentials to the LLM context.",
    ],
    DetectionCategory.TOOL_MISUSE: [
        "Apply allowlist-based tool access controls; never allowlist destructive operations.",
        "Require explicit user confirmation for high-impact tool calls.",
        "Validate all tool parameters against strict schemas before execution.",
        "Log every tool invocation with full parameter detail for audit purposes.",
    ],
}


class AnalysisService:
    """
    Coordinates rule-based and ML detection, computes a risk score, and
    constructs an AnalysisResult.
    """

    def __init__(
        self,
        rule_detector: RuleBasedDetector,
        ml_classifier: MLClassifier,
    ) -> None:
        self._rules = rule_detector
        self._ml = ml_classifier
        self._settings = get_settings()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def analyze(self, text: str) -> AnalysisResult:
        """Run the full detection pipeline on a single text."""
        components_used: list[str] = ["rule_based_detector"]

        # 1. Rule-based detection
        rule_matches: list[RuleMatch] = self._rules.analyze(text)

        # 2. ML classification (optional)
        ml_pred: ModelPrediction | None = None
        if self._ml.is_available:
            ml_pred = self._ml.predict(text)
            components_used.append("ml_classifier")

        # 3. Risk scoring
        risk_score = self._compute_risk_score(rule_matches, ml_pred)
        risk_level = self._score_to_level(risk_score)

        # 4. Detected categories (deduplicated, preserving order)
        detected_categories = self._collect_categories(rule_matches, ml_pred, risk_score)

        # 5. Explanation
        explanation = self._build_explanation(rule_matches, ml_pred, risk_score)

        # 6. Recommendations
        recommended = self._collect_recommendations(detected_categories)

        return AnalysisResult(
            input_length=len(text),
            risk_score=round(risk_score, 1),
            risk_level=risk_level,
            detected_categories=detected_categories,
            rule_matches=rule_matches,
            model_prediction=ml_pred,
            explanation=explanation,
            recommended_actions=recommended,
            detection_components_used=components_used,
        )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _compute_risk_score(
        self,
        matches: list[RuleMatch],
        ml_pred: ModelPrediction | None,
    ) -> float:
        """
        Compute a 0–100 risk score from rule matches and ML prediction.
        See module docstring for the documented methodology.
        """
        score = 0.0

        # Rule-based contribution (up to 80 points)
        for m in matches:
            score += m.confidence * 40.0
            if DetectionCategory(m.category) in HIGH_IMPACT_CATEGORIES:
                score *= 1.15
        score = min(score, 80.0)

        # ML boost (up to 20 points)
        if ml_pred and ml_pred.predicted_class != DetectionCategory.BENIGN:
            if ml_pred.confidence > 0.6:
                ml_boost = (ml_pred.confidence - 0.6) / 0.4 * 20.0
                score = min(score + ml_boost, 100.0)

        return score

    def _score_to_level(self, score: float) -> RiskLevel:
        s = self._settings
        if score >= s.high_threshold:
            return RiskLevel.CRITICAL
        if score >= s.medium_threshold:
            return RiskLevel.HIGH
        if score >= s.low_threshold:
            return RiskLevel.MEDIUM
        return RiskLevel.LOW

    def _collect_categories(
        self,
        matches: list[RuleMatch],
        ml_pred: ModelPrediction | None,
        risk_score: float,
    ) -> list[DetectionCategory]:
        """Return deduplicated, ordered list of detected categories."""
        seen: set[DetectionCategory] = set()
        cats: list[DetectionCategory] = []

        for m in matches:
            cat = DetectionCategory(m.category)
            if cat not in seen:
                seen.add(cat)
                cats.append(cat)

        if ml_pred and ml_pred.predicted_class != DetectionCategory.BENIGN:
            if ml_pred.predicted_class not in seen:
                seen.add(ml_pred.predicted_class)
                cats.append(ml_pred.predicted_class)

        if not cats:
            cats = [DetectionCategory.BENIGN]

        return cats

    def _build_explanation(
        self,
        matches: list[RuleMatch],
        ml_pred: ModelPrediction | None,
        risk_score: float,
    ) -> str:
        parts: list[str] = []

        if not matches and (ml_pred is None or ml_pred.predicted_class == DetectionCategory.BENIGN):
            return (
                "No suspicious patterns were detected. "
                "The input appears benign based on current rules and model state. "
                "Note: absence of a detection does not guarantee safety."
            )

        if matches:
            categories_hit = {m.category for m in matches}
            parts.append(
                f"{len(matches)} rule(s) fired, covering category/categories: "
                f"{', '.join(c.value for c in categories_hit)}."
            )
            for m in matches[:3]:  # Summarise top 3 rule matches
                parts.append(f"  • [{m.rule_id}] {m.description}")

        if ml_pred:
            if ml_pred.predicted_class != DetectionCategory.BENIGN:
                parts.append(
                    f"The ML classifier (experimental) predicted "
                    f"'{ml_pred.predicted_class.value}' with "
                    f"{ml_pred.confidence:.0%} confidence."
                )
            else:
                parts.append(
                    f"The ML classifier predicted 'benign' with "
                    f"{ml_pred.confidence:.0%} confidence."
                )

        parts.append(
            f"Computed risk score: {risk_score:.1f}/100. "
            "This is a heuristic estimate — not an exploit confirmation."
        )

        return "  ".join(parts)

    def _collect_recommendations(
        self, categories: list[DetectionCategory]
    ) -> list[str]:
        """Collect deduplicated recommendations for all detected categories."""
        seen: set[str] = set()
        recs: list[str] = []
        for cat in categories:
            for action in RECOMMENDED_ACTIONS.get(cat, []):
                if action not in seen:
                    seen.add(action)
                    recs.append(action)
        return recs
