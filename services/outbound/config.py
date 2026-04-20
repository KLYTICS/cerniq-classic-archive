"""
CERNIQ Outbound Engine — Configuration

Load from environment variables with sensible defaults for local dev.
"""

import os
from dotenv import load_dotenv

load_dotenv()


def _require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required.")
    return value


class Config:
    """Centralized configuration for the outbound engine."""

    # Database
    DATABASE_URL: str = _require_env("OUTBOUND_DATABASE_URL")

    # SMTP / Email
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    FROM_EMAIL: str = os.getenv("FROM_EMAIL", "erwin@cerniq.com")
    FROM_NAME: str = os.getenv("FROM_NAME", "Erwin Kiess")

    # Enrichment APIs (pluggable)
    HUNTER_API_KEY: str = os.getenv("HUNTER_API_KEY", "")
    APOLLO_API_KEY: str = os.getenv("APOLLO_API_KEY", "")
    CLEARBIT_API_KEY: str = os.getenv("CLEARBIT_API_KEY", "")

    # Outreach volumes
    DAILY_EMAIL_LIMIT: int = int(os.getenv("DAILY_EMAIL_LIMIT", "50"))
    DAILY_LINKEDIN_LIMIT: int = int(os.getenv("DAILY_LINKEDIN_LIMIT", "20"))

    # Follow-up timing (days)
    FOLLOWUP_1_DAYS: int = int(os.getenv("FOLLOWUP_1_DAYS", "3"))
    FOLLOWUP_2_DAYS: int = int(os.getenv("FOLLOWUP_2_DAYS", "7"))

    # FastAPI
    API_HOST: str = os.getenv("OUTBOUND_API_HOST", "0.0.0.0")
    API_PORT: int = int(os.getenv("OUTBOUND_API_PORT", "8099"))

    # Paths
    SEED_CSV_PATH: str = os.getenv(
        "SEED_CSV_PATH",
        os.path.join(os.path.dirname(__file__), "data", "puerto_rico_cooperativas_seed.csv"),
    )


config = Config()
