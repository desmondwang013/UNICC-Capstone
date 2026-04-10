"""
Shared data models for the UNICC AI Safety MoE ensemble.
"""
from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
import uuid
from datetime import datetime


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class RiskTier(str, Enum):
    TIER1_LOW        = "Tier 1 - Low Impact"
    TIER2_MODERATE   = "Tier 2 - Moderate Impact"
    TIER3_HIGH       = "Tier 3 - High Impact"
    TIER4_PROHIBITED = "Tier 4 - Prohibited"


class DeploymentVerdict(str, Enum):
    APPROVED                 = "APPROVED"
    APPROVED_WITH_CONDITIONS = "APPROVED WITH CONDITIONS"
    REQUIRES_HUMAN_REVIEW    = "REQUIRES HUMAN REVIEW"
    REJECTED                 = "REJECTED"


class ContentType(str, Enum):
    DOCUMENT     = "document"      # Essay, article, report — evaluate as whole
    CONVERSATION = "conversation"  # User↔AI turns — evaluate AI responses only
    BATCH        = "batch"         # Multiple samples (CSV/JSON rows) — sample + aggregate


# ---------------------------------------------------------------------------
# LLM Configuration
# ---------------------------------------------------------------------------

class LLMProvider(str, Enum):
    ANTHROPIC = "anthropic"
    OPENAI    = "openai"
    LOCAL_SLM = "local_slm"


class LLMConfig(BaseModel):
    provider: LLMProvider = LLMProvider.ANTHROPIC
    model: str = "claude-sonnet-4-6"
    api_key: Optional[str] = Field(None, description="Never stored server-side")
    base_url: Optional[str] = Field(None, description="For local SLM endpoint")

    @classmethod
    def for_anthropic(cls, api_key: str, model: str = "claude-sonnet-4-6") -> "LLMConfig":
        return cls(provider=LLMProvider.ANTHROPIC, model=model, api_key=api_key)

    @classmethod
    def for_openai(cls, api_key: str, model: str = "gpt-4o") -> "LLMConfig":
        return cls(provider=LLMProvider.OPENAI, model=model, api_key=api_key)

    @classmethod
    def for_ollama(cls, model: str = "llama3.2", base_url: str = "http://localhost:11434/v1") -> "LLMConfig":
        return cls(provider=LLMProvider.LOCAL_SLM, model=model, base_url=base_url)


# ---------------------------------------------------------------------------
# Input
# ---------------------------------------------------------------------------

class EvaluationInput(BaseModel):
    # Primary: the actual content to evaluate
    content: str = Field(..., description="Text content to evaluate — AI outputs, interactions, or documents")

    # Optional metadata
    content_type: Optional[ContentType] = Field(
        None, description="Auto-detected if not provided"
    )
    filename: Optional[str] = Field(None, description="Source filename if uploaded")
    context: Optional[str] = Field(
        None, description="Optional: what AI system produced this content? For calibration only."
    )

    # LLM judge config
    llm_config: Optional[LLMConfig] = Field(
        None, description="Judge model. Falls back to server .env if not provided."
    )


# ---------------------------------------------------------------------------
# Deduction points — specific evidence of violations
# ---------------------------------------------------------------------------

class DeductionPoint(BaseModel):
    rank: int
    excerpt: str         = Field(..., description="The specific text that triggered this deduction")
    violation: str       = Field(..., description="What safety rule or dimension was violated")
    severity: str        = Field(..., description="LOW | MEDIUM | HIGH | CRITICAL")
    judges: List[str]    = Field(default_factory=list, description="Which judges flagged this")
    dimension: str       = Field(..., description="Which evaluation dimension this falls under")


# ---------------------------------------------------------------------------
# Per-judge output
# ---------------------------------------------------------------------------

class DimensionScore(BaseModel):
    dimension: str
    score: float         = Field(..., ge=0, le=5, description="0-5, higher = safer")
    weight: float
    reasoning: str
    flags: List[str]     = Field(default_factory=list)
    evidence_excerpts: List[str] = Field(
        default_factory=list, description="Specific text evidence for this dimension"
    )


class JudgeVerdict(BaseModel):
    judge_id: str
    judge_name: str
    judge_role: str
    overall_score: float = Field(..., ge=0, le=100)
    risk_tier: RiskTier
    content_type_detected: ContentType
    dimension_scores: List[DimensionScore]
    top_deductions: List[DeductionPoint] = Field(
        default_factory=list, description="Top 5 specific violations found"
    )
    summary: str
    key_findings: List[str]
    recommendations: List[str]
    confidence: float    = Field(..., ge=0, le=1)


# ---------------------------------------------------------------------------
# Cross-judge critique
# ---------------------------------------------------------------------------

class CritiqueResult(BaseModel):
    from_judge: str
    about_judge: str
    agreements: List[str]
    disagreements: List[str]
    additional_insights: str
    revised_risk_tier: Optional[RiskTier] = None


# ---------------------------------------------------------------------------
# Final ensemble report
# ---------------------------------------------------------------------------

class EnsembleReport(BaseModel):
    evaluation_id: str   = Field(default_factory=lambda: str(uuid.uuid4())[:8].upper())
    filename: Optional[str] = None
    content_type: ContentType
    timestamp: str       = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    content_preview: str = Field(..., description="First 300 chars of evaluated content")

    verdicts: List[JudgeVerdict]
    critiques: List[CritiqueResult]

    # Synthesized
    final_risk_tier: RiskTier
    final_score: float   = Field(..., ge=0, le=100)
    deployment_verdict: DeploymentVerdict

    # Top deductions — aggregated across all judges
    top_deductions: List[DeductionPoint] = Field(
        default_factory=list, description="Top 5 deduction points across all judges"
    )

    consensus_findings: List[str]
    dissenting_views: List[str]
    conditions: List[str]    = Field(default_factory=list)
    final_recommendation: str
    full_synthesis: str
    judge_agreement_level: str
