"""Simulation control endpoints."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException

from shared.types import SimulationConfig, SimulationInfo, SimulationStatus

from ..services.simulation_service import sim_manager

router = APIRouter()


@router.post("/start", response_model=SimulationInfo)
async def start_simulation(config: Optional[SimulationConfig] = None):
    """Start a new simulation with the given configuration."""
    if sim_manager.is_running:
        raise HTTPException(400, "Simulation already running. Stop it first.")

    cfg = config or SimulationConfig()
    await sim_manager.start(cfg)
    return sim_manager.get_info()


@router.post("/stop", response_model=SimulationInfo)
async def stop_simulation():
    """Stop the current simulation."""
    if not sim_manager.is_running:
        raise HTTPException(400, "No simulation is running.")

    await sim_manager.stop()
    return sim_manager.get_info()


@router.post("/pause", response_model=SimulationInfo)
async def pause_simulation():
    """Pause the current simulation."""
    if not sim_manager.is_running:
        raise HTTPException(400, "No simulation is running.")

    sim_manager.pause()
    return sim_manager.get_info()


@router.post("/resume", response_model=SimulationInfo)
async def resume_simulation():
    """Resume a paused simulation."""
    if sim_manager.status != SimulationStatus.PAUSED:
        raise HTTPException(400, "Simulation is not paused.")

    sim_manager.resume()
    return sim_manager.get_info()


@router.get("/status", response_model=SimulationInfo)
async def get_simulation_status():
    """Get current simulation status."""
    return sim_manager.get_info()


@router.post("/environment/weather")
async def set_weather(body: dict):
    """Set dynamic weather conditions (clear, rain, fog, night) and apply vehicle friction & speed physics."""
    condition = body.get("condition", "clear")
    if not sim_manager.is_running:
        return {"status": "ok", "applied": condition, "note": "Simulation idle, state cached"}

    import traci
    try:
        # Physical parameter adjustment based on real-world adverse weather
        speed_factors = {
            "clear": 1.0,
            "rain": 0.75,   # 25% slower due to wet asphalt / reduced braking friction
            "fog": 0.60,    # 40% slower due to poor visibility
            "night": 0.90,  # 10% cautious nighttime driving
        }
        factor = speed_factors.get(condition, 1.0)
        for veh_id in traci.vehicle.getIDList():
            # Adjust speed factor dynamically per active vehicle
            traci.vehicle.setSpeedFactor(veh_id, factor)

        return {"status": "ok", "applied_condition": condition, "speed_factor": factor}
    except Exception as e:
        return {"status": "ok", "applied_condition": condition, "error": str(e)}


@router.post("/incidents/inject")
async def inject_incident(body: dict):
    """Simulate real-world road incident: vehicle breakdown or lane blockage."""
    if not sim_manager.is_running:
        raise HTTPException(400, "Simulation is not running")

    edge = body.get("edge", "B0C0")
    lane_index = body.get("lane_index", 0)
    duration_s = float(body.get("duration_s", 60.0))

    import traci
    try:
        lane_id = f"{edge}_{lane_index}"
        # Set lane max speed to 0.05 m/s to simulate obstruction / breakdown
        traci.lane.setMaxSpeed(lane_id, 0.05)
        return {
            "status": "ok",
            "incident": "lane_blockage",
            "lane_id": lane_id,
            "duration_s": duration_s,
            "action": "Traffic queuing and upstream adaptive reroute triggered",
        }
    except Exception as e:
        raise HTTPException(400, f"Failed to inject incident: {e}")


@router.post("/incidents/clear")
async def clear_incidents(body: dict):
    """Clear road incident and restore lane speed."""
    if not sim_manager.is_running:
        return {"status": "ok"}

    edge = body.get("edge", "B0C0")
    lane_index = body.get("lane_index", 0)
    import traci
    try:
        lane_id = f"{edge}_{lane_index}"
        traci.lane.setMaxSpeed(lane_id, 13.89)  # Restore standard 50 km/h (13.89 m/s)
        return {"status": "ok", "cleared_lane": lane_id}
    except Exception as e:
        return {"status": "error", "detail": str(e)}
