"""Config and Credentials management endpoints — Universal OpenAI Compatible."""

from __future__ import annotations

import os
from pathlib import Path
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/config", tags=["config"])


class CredentialsRequest(BaseModel):
    openai_api_key: str | None = None
    openai_base_url: str | None = None
    openai_model: str | None = None
    supabase_url: str | None = None
    supabase_anon_key: str | None = None
    supabase_service_role_key: str | None = None


class CredentialsStatusResponse(BaseModel):
    openai_configured: bool
    supabase_configured: bool
    openai_preview: str
    openai_model: str
    supabase_url: str
    sumo_home: str


def _get_env_path() -> Path:
    return Path(__file__).resolve().parents[2] / ".env"


@router.get("/credentials", response_model=CredentialsStatusResponse)
async def get_credentials_status():
    from shared.config import get_settings

    settings = get_settings()
    llm_key = os.getenv("OPENAI_API_KEY", "") or settings.openai_api_key or ""
    supa_url = os.getenv("SUPABASE_URL", "") or settings.supabase_url or ""
    sumo_h = os.getenv("SUMO_HOME", "") or settings.sumo_home or ""

    key_preview = (
        f"{llm_key[:6]}...{llm_key[-4:]}"
        if len(llm_key) > 10 and not llm_key.startswith("your-")
        else "NOT CONFIGURED"
    )

    return CredentialsStatusResponse(
        openai_configured=bool(llm_key and not llm_key.startswith("your-")),
        supabase_configured=bool(supa_url and not supa_url.startswith("https://your-")),
        openai_preview=key_preview,
        openai_model=settings.openai_model,
        supabase_url=supa_url if not supa_url.startswith("https://your-") else "NOT CONFIGURED",
        sumo_home=sumo_h,
    )


@router.post("/credentials")
async def save_credentials(req: CredentialsRequest):
    env_path = _get_env_path()
    lines = []
    if env_path.exists():
        lines = env_path.read_text(encoding="utf-8").splitlines()

    env_dict = {}
    for line in lines:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env_dict[k.strip()] = v.strip()

    # Update universal OpenAI LLM settings
    if req.openai_api_key is not None and req.openai_api_key.strip():
        val = req.openai_api_key.strip()
        os.environ["OPENAI_API_KEY"] = val
        env_dict["OPENAI_API_KEY"] = val
    if req.openai_base_url is not None and req.openai_base_url.strip():
        val = req.openai_base_url.strip()
        os.environ["OPENAI_BASE_URL"] = val
        env_dict["OPENAI_BASE_URL"] = val
    if req.openai_model is not None and req.openai_model.strip():
        val = req.openai_model.strip()
        os.environ["OPENAI_MODEL"] = val
        env_dict["OPENAI_MODEL"] = val

    if req.supabase_url is not None and req.supabase_url.strip():
        val = req.supabase_url.strip()
        os.environ["SUPABASE_URL"] = val
        env_dict["SUPABASE_URL"] = val

    if req.supabase_anon_key is not None and req.supabase_anon_key.strip():
        val = req.supabase_anon_key.strip()
        os.environ["SUPABASE_ANON_KEY"] = val
        env_dict["SUPABASE_ANON_KEY"] = val

    if req.supabase_service_role_key is not None and req.supabase_service_role_key.strip():
        val = req.supabase_service_role_key.strip()
        os.environ["SUPABASE_SERVICE_ROLE_KEY"] = val
        env_dict["SUPABASE_SERVICE_ROLE_KEY"] = val

    default_sumo = "C:/Program Files (x86)/SUMO"
    sumo_home_val = env_dict.get("SUMO_HOME", default_sumo)
    sumo_bin_val = env_dict.get("SUMO_BINARY", "sumo-gui")
    host_val = env_dict.get("BACKEND_HOST", "0.0.0.0")
    port_val = env_dict.get("BACKEND_PORT", "8000")
    api_url = env_dict.get("NEXT_PUBLIC_API_URL", "http://localhost:8000/api")
    ws_url = env_dict.get("NEXT_PUBLIC_WS_URL", "ws://localhost:8000/ws/traffic")

    llm_key = env_dict.get("OPENAI_API_KEY", "")
    llm_url = env_dict.get("OPENAI_BASE_URL", "https://integrate.api.nvidia.com/v1")
    llm_model = env_dict.get("OPENAI_MODEL", "nvidia/nemotron-3.5-lightning-30b-a3b")
    supa_u = env_dict.get("SUPABASE_URL", "")
    supa_a = env_dict.get("SUPABASE_ANON_KEY", "")
    supa_s = env_dict.get("SUPABASE_SERVICE_ROLE_KEY", "")

    new_content = f"""# Universal OpenAI-compatible LLM Configuration
OPENAI_API_KEY={llm_key}
OPENAI_BASE_URL={llm_url}
OPENAI_MODEL={llm_model}

# Supabase
SUPABASE_URL={supa_u}
SUPABASE_ANON_KEY={supa_a}
SUPABASE_SERVICE_ROLE_KEY={supa_s}

# SUMO
SUMO_HOME={sumo_home_val}
SUMO_BINARY={sumo_bin_val}

# Backend
BACKEND_HOST={host_val}
BACKEND_PORT={port_val}

# Frontend
NEXT_PUBLIC_API_URL={api_url}
NEXT_PUBLIC_WS_URL={ws_url}

# Simulation
SIM_TICK_RATE=10
CV_FRAME_INTERVAL=10
SUPABASE_BATCH_SIZE=50
"""
    env_path.write_text(new_content, encoding="utf-8")
    return {"status": "ok", "message": "Universal OpenAI LLM credentials saved"}
