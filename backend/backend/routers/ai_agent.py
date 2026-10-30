from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from ..services.ai_risk_engine import ai_risk_engine
from ..services.simulation_service import sim_manager
from ..services.external_feeds import feed_service

router = APIRouter(prefix="/api/ai", tags=["ai"])

class MitigateRequest(BaseModel):
    junction_id: str
    incident_type: Optional[str] = "COLLISION"

@router.get("/risk-assessment")
async def get_risk_assessment():
    """
    Returns real-time Smart City AI Risk Score (0-100), hazard level,
    and active network bottlenecks.
    """
    # Fetch live simulation metrics
    last_tick = sim_manager.last_tick_data
    veh_count = last_tick.metrics.total_vehicles if last_tick and last_tick.metrics else 850
    avg_wait = last_tick.metrics.avg_delay_s if last_tick and last_tick.metrics else 28.5

    # Fetch live weather condition
    weather = await feed_service.fetch_live_weather()
    weather_cond = weather.get("condition", "clear")

    return ai_risk_engine.compute_risk_telemetry(veh_count, avg_wait, weather_cond)

@router.get("/forecast-15min")
async def get_15min_forecast():
    """
    Returns Spatio-Temporal 15-minute predictive congestion curve (+3m, +6m, +9m, +12m, +15m).
    """
    last_tick = sim_manager.last_tick_data
    veh_count = last_tick.metrics.total_vehicles if last_tick and last_tick.metrics else 850
    avg_wait = last_tick.metrics.avg_delay_s if last_tick and last_tick.metrics else 28.5

    return ai_risk_engine.generate_15min_forecast(veh_count, avg_wait)

@router.post("/mitigate-emergency")
async def trigger_emergency_mitigation(req: MitigateRequest):
    """
    Executes autonomous multi-junction incident isolation,
    automatic VMS roadside alert, and green corridor rerouting.
    """
    return ai_risk_engine.execute_autonomous_incident_mitigation(req.junction_id, req.incident_type)

@router.get("/emergency-events")
async def get_emergency_events():
    """Returns active and recent emergency mitigation logs."""
    return ai_risk_engine.active_emergencies
