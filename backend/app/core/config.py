"""
PromptShield Backend — Application Configuration
Reads from environment variables (or .env file via pydantic-settings).
"""

from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Absolute path to the backend/models directory, regardless of CWD
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent  # backend/
_DEFAULT_MODEL_DIR = str(_BACKEND_DIR / "models")


class Settings(BaseSettings):
    """Central application settings. All values can be overridden via environment variables."""

    # Server
    host: str = "127.0.0.1"
    port: int = 8000
    debug: bool = False

    # CORS — restrict to specific frontend origins; never use "*" in production.
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Detection limits
    max_input_length: int = 10_000  # characters
    max_batch_size: int = 50        # items per batch request
    max_upload_bytes: int = 1_048_576  # 1 MB

    # Risk score thresholds (0-100)
    low_threshold: int = 25
    medium_threshold: int = 50
    high_threshold: int = 75

    # ML model artifacts directory — defaults to absolute path of backend/models/
    model_dir: str = _DEFAULT_MODEL_DIR

    # Logging
    log_level: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def allowed_origins_list(self) -> list[str]:
        """Parse comma-separated origins into a list."""
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    """Return cached settings singleton."""
    return Settings()
