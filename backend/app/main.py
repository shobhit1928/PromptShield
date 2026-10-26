"""
PromptShield — FastAPI Application Entry Point
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.detectors.rule_based import RuleBasedDetector
from app.detectors.ml_classifier import MLClassifier
from app.api.routes import router

settings = get_settings()

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("promptshield")


# ---------------------------------------------------------------------------
# Lifespan — initialise singletons once at startup
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(application: FastAPI):
    """Create shared detector instances and attach to app.state."""
    logger.info("Starting PromptShield backend…")
    application.state.rule_detector = RuleBasedDetector()
    application.state.ml_classifier = MLClassifier(settings.model_dir)
    logger.info(
        "Detectors ready. Rule-based: ✓  ML classifier: %s",
        "✓" if application.state.ml_classifier.is_available else "✗ (model not trained yet)",
    )
    yield
    logger.info("PromptShield backend shutting down.")


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

app = FastAPI(
    title="PromptShield API",
    description=(
        "**PromptShield** — LLM Security & Prompt Injection Detection Platform.\n\n"
        "> ⚠️ **Disclaimer**: This is an experimental security analysis tool. "
        "Detection results are heuristic estimates and do NOT prove that any LLM "
        "application is exploitable. Always validate findings against the actual deployment."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS — restrict to configured origins only
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Accept"],
)

# ---------------------------------------------------------------------------
# Global exception handler — return generic messages, log internally
# ---------------------------------------------------------------------------

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception for %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Please try again."},
    )


# ---------------------------------------------------------------------------
# Register routes
# ---------------------------------------------------------------------------
app.include_router(router, prefix="/api")


# ---------------------------------------------------------------------------
# Convenience run (for `python -m app.main` invocation)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=settings.debug)
