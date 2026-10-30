"""Environment-based configuration loader."""

from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Application settings loaded from environment variables."""

    # Supabase
    supabase_url: str = os.getenv("SUPABASE_URL", "")
    supabase_anon_key: str = os.getenv("SUPABASE_ANON_KEY", "")
    supabase_service_role_key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    # SUMO
    sumo_home: str = os.getenv("SUMO_HOME", "")
    sumo_binary: str = os.getenv("SUMO_BINARY", "sumo-gui")

    # Backend
    backend_host: str = os.getenv("BACKEND_HOST", "0.0.0.0")
    backend_port: int = int(os.getenv("BACKEND_PORT", "8000"))

    # LLM (Universal OpenAI-compatible API)
    openai_api_key: str = os.getenv("OPENAI_API_KEY", os.getenv("NVIDIA_API_KEY", "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"))
    openai_base_url: str = os.getenv("OPENAI_BASE_URL", os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1"))
    openai_model: str = os.getenv("OPENAI_MODEL", os.getenv("NVIDIA_MODEL", "nvidia/nemotron-3.5-lightning-30b-a3b"))

    # Simulation
    sim_tick_rate: int = int(os.getenv("SIM_TICK_RATE", "10"))
    cv_frame_interval: int = int(os.getenv("CV_FRAME_INTERVAL", "10"))
    db_batch_size: int = int(os.getenv("SUPABASE_BATCH_SIZE", "50"))


@lru_cache
def get_settings() -> Settings:
    return Settings()
