import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from ..services.external_feeds import feed_service
from ..services.simulation_service import sim_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/external", tags=["external"])

class CityConfig(BaseModel):
    city_name: str
    lat: float
    lon: float

class SearchQuery(BaseModel):
    query: str

@router.post("/search")
async def search_and_set_location(body: SearchQuery):
    """
    Search ANY place globally (e.g. 'Dubai', 'Jaipur', 'Berlin', 'Tokyo')
    and set the digital twin telemetry location to it.
    """
    res = await feed_service.search_location(body.query)
    if res.get("status") == "error":
        raise HTTPException(404, res.get("message"))
    return res

@router.get("/weather")
async def get_live_weather():
    """Returns real-world live meteorological data from Open-Meteo."""
    return await feed_service.fetch_live_weather()

@router.get("/air-quality")
async def get_live_air_quality():
    """Returns real-world live air pollution metrics (PM2.5, NO2, CO)."""
    return await feed_service.fetch_live_air_quality()

@router.get("/osm-junctions")
async def get_osm_junctions(bbox: Optional[str] = None):
    """Returns OpenStreetMap live road segments and traffic signals."""
    return await feed_service.fetch_osm_junctions(bbox)

@router.post("/city")
async def set_city(cfg: CityConfig):
    """Dynamically change city origin coordinates (e.g., Delhi, Mumbai, London, New York)."""
    feed_service.set_location(cfg.city_name, cfg.lat, cfg.lon)
    return {
        "status": "updated",
        "city": cfg.city_name,
        "coordinates": {"lat": cfg.lat, "lon": cfg.lon}
    }

@router.post("/sync-environment")
async def sync_live_environment_to_simulation():
    """
    Production Digital Twin Feature:
    Reads live real-world weather and auto-applies physical friction/speed factors
    directly to active simulation vehicles via TraCI.
    """
    weather = await feed_service.fetch_live_weather()
    rec_speed_factor = weather.get("recommended_speed_factor", 1.0)
    cond = weather.get("condition", "clear")

    applied_vehicles = 0
    if sim_manager.is_running and sim_manager._traci_client:
        try:
            import traci as traci_module
            veh_ids = traci_module.vehicle.getIDList()
            for vid in veh_ids:
                traci_module.vehicle.setSpeedFactor(vid, rec_speed_factor)
            applied_vehicles = len(veh_ids)
        except Exception as e:
            logger.warning(f"Failed to adapt vehicles to live environment: {e}")

    return {
        "status": "synced",
        "live_condition": cond,
        "applied_speed_factor": rec_speed_factor,
        "vehicles_adapted": applied_vehicles,
        "weather_data": weather
    }
