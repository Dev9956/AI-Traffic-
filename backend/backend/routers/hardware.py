from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from ..services.hardware_gateway import gateway_service
from ..services.simulation_service import sim_manager
from ..services.challan_vault import get_all_challans, insert_challan

router = APIRouter(prefix="/api/hardware", tags=["hardware"])

class PoliceOverrideRequest(BaseModel):
    mode: str  # ALL_RED, FORCE_NORTH_SOUTH, FORCE_EAST_WEST, RESUME_AI_AUTO

class VMSBroadcastRequest(BaseModel):
    vms_id: str
    line1: str
    line2: str
    line3: str
    severity: Optional[str] = "INFO"  # INFO, WARNING, CRITICAL

@router.get("/cabinets")
async def get_all_cabinets():
    """Returns all NTCIP 1202 field controller cabinets telemetry."""
    return gateway_service.get_cabinet_telemetry()

@router.get("/cabinets/{junction_id}")
async def get_single_cabinet(junction_id: str):
    """Returns 4-way signal head aspects and inductive loop data for a junction."""
    res = gateway_service.get_cabinet_telemetry(junction_id)
    if isinstance(res, list):
        raise HTTPException(404, f"Junction {junction_id} cabinet not found.")
    return res

@router.post("/cabinets/{junction_id}/police-override")
async def trigger_police_override(junction_id: str, req: PoliceOverrideRequest):
    """Manual police key override for high-priority junction clearance."""
    # Also forward to SUMO simulation if running
    if sim_manager.is_running and sim_manager._traci_client:
        try:
            import traci
            # Set phase in SUMO directly
            phase_idx = 0 if req.mode == "FORCE_NORTH_SOUTH" else 2 if req.mode == "FORCE_EAST_WEST" else 1
            traci.trafficlight.setPhase(junction_id, phase_idx)
        except Exception:
            pass

    return gateway_service.trigger_police_override(junction_id, req.mode)

@router.get("/vms")
async def get_vms_boards():
    """Returns all Variable Message Signs (VMS) on the network."""
    return gateway_service.vms_boards

@router.post("/vms/broadcast")
async def broadcast_vms_message(req: VMSBroadcastRequest):
    """Broadcast advisory or warning message to city digital LED signboards."""
    board = gateway_service.update_vms_message(
        req.vms_id, req.line1, req.line2, req.line3, req.severity
    )
    if not board:
        raise HTTPException(404, f"VMS board {req.vms_id} not found.")
    return {"status": "broadcast_success", "board": board}

@router.get("/violations")
async def get_anpr_violations():
    """Returns persistent ANPR violations from SQLite e-challan vault."""
    return get_all_challans()
