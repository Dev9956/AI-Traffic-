import time
import logging
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)

# Real-world NTCIP 1202 Phase mapping definition
# Phases: 1=N Left, 2=N Thru, 3=E Left, 4=E Thru, 5=S Left, 6=S Thru, 7=W Left, 8=W Thru
INTERSECTIONS = ["A0", "A1", "B0", "B1", "C0", "C1"]

class HardwareGatewayService:
    def __init__(self):
        # Physical field controller cabinets state
        self.cabinets: Dict[str, Dict[str, Any]] = {
            iid: {
                "cabinet_id": f"CAB-NTCIP-{iid}",
                "ip_address": f"192.168.10.{100 + idx}",
                "firmware": "Econolite/NTCIP v8.24-PROD",
                "status": "ONLINE",
                "ping_ms": 8.5 + (idx * 1.2),
                "voltage_v": 230.2,
                "current_a": 4.8,
                "mmu_status": "NORMAL_INTERLOCK_OK", # Conflict Monitor Unit
                "active_phase": 2 if idx % 2 == 0 else 6,
                "phase_countdown_s": 24,
                "signal_heads": {
                    "NORTH": {"state": "GREEN", "countdown": 24, "arrow": "OFF", "pedestrian": "WAIT"},
                    "SOUTH": {"state": "GREEN", "countdown": 24, "arrow": "OFF", "pedestrian": "WAIT"},
                    "EAST":  {"state": "RED",   "countdown": 24, "arrow": "OFF", "pedestrian": "CROSS"},
                    "WEST":  {"state": "RED",   "countdown": 24, "arrow": "OFF", "pedestrian": "CROSS"},
                },
                "inductive_loops": [
                    {"lane_id": f"{iid}_N_Lane1", "status": "ACTIVE", "occupancy_pct": 34.5, "vehicles_per_min": 14},
                    {"lane_id": f"{iid}_S_Lane1", "status": "ACTIVE", "occupancy_pct": 28.0, "vehicles_per_min": 11},
                    {"lane_id": f"{iid}_E_Lane1", "status": "ACTIVE", "occupancy_pct": 62.0, "vehicles_per_min": 26},
                    {"lane_id": f"{iid}_W_Lane1", "status": "ACTIVE", "occupancy_pct": 58.5, "vehicles_per_min": 24},
                ],
                "last_packet_time": time.time(),
            }
            for idx, iid in enumerate(INTERSECTIONS)
        }

        # Roadside Variable Message Signs (VMS) Network
        self.vms_boards: List[Dict[str, Any]] = [
            {
                "id": "VMS-01",
                "location": "North Arterial Inflow (Approaching A0)",
                "type": "Full-Matrix RGB LED 3-Line",
                "message_line1": "DELHI-NCR SMART CORRIDOR",
                "message_line2": "TRAFFIC FLOW: NORMAL",
                "message_line3": "SPEED LIMIT: 60 KM/H",
                "severity": "INFO",
                "last_updated": "Just now",
            },
            {
                "id": "VMS-02",
                "location": "Central Hub Express (B0-C0 Connector)",
                "type": "Full-Matrix RGB LED 3-Line",
                "message_line1": "CAUTION: DYNAMIC SIGNALS",
                "message_line2": "AI GREEN WAVE ACTIVE",
                "message_line3": "MAINTAIN 50 KM/H SPEED",
                "severity": "NORMAL",
                "last_updated": "2 mins ago",
            },
            {
                "id": "VMS-03",
                "location": "East Arterial Bypass (Approaching C1)",
                "type": "Full-Matrix RGB LED 3-Line",
                "message_line1": "METROPOLITAN TRANSIT CORRIDOR",
                "message_line2": "EMERGENCY PREEMPTION READY",
                "message_line3": "YIELD TO AMBULANCE / EV",
                "severity": "WARNING",
                "last_updated": "5 mins ago",
            },
        ]

        # Live ANPR Infractions and Speed Radar log
        self.violations: List[Dict[str, Any]] = [
            {
                "id": "VIO-901",
                "license_plate": "DL-01-AX-9942",
                "junction": "A0",
                "violation_type": "RED_LIGHT_JUMP",
                "speed_kmh": 68.4,
                "speed_limit": 50.0,
                "timestamp": "18:24:12",
                "status": "E_CHALLAN_ISSUED",
                "fine_inr": 5000,
            },
            {
                "id": "VIO-902",
                "license_plate": "MH-02-CP-4102",
                "junction": "B1",
                "violation_type": "OVERSPEEDING",
                "speed_kmh": 82.1,
                "speed_limit": 60.0,
                "timestamp": "18:27:45",
                "status": "E_CHALLAN_ISSUED",
                "fine_inr": 2000,
            },
        ]

    def get_cabinet_telemetry(self, junction_id: Optional[str] = None) -> Any:
        if junction_id and junction_id in self.cabinets:
            return self.cabinets[junction_id]
        return list(self.cabinets.values())

    def update_vms_message(self, vms_id: str, line1: str, line2: str, line3: str, severity: str = "INFO"):
        for board in self.vms_boards:
            if board["id"] == vms_id:
                board["message_line1"] = line1.upper()
                board["message_line2"] = line2.upper()
                board["message_line3"] = line3.upper()
                board["severity"] = severity
                board["last_updated"] = "Updated just now"
                return board
        return None

    def trigger_police_override(self, junction_id: str, mode: str) -> Dict[str, Any]:
        """
        Industrial Police Override modes:
        - ALL_RED: Flushes junction, halts all vehicles
        - FORCE_NORTH_SOUTH: Forces North-South Green
        - FORCE_EAST_WEST: Forces East-West Green
        - RESUME_AI_AUTO: Returns control to Reinforcement Learning / Actuated AI
        """
        if junction_id not in self.cabinets:
            return {"status": "error", "message": f"Cabinet for {junction_id} not found."}

        cab = self.cabinets[junction_id]
        if mode == "ALL_RED":
            for approach in cab["signal_heads"].values():
                approach["state"] = "RED"
                approach["countdown"] = 60
                approach["pedestrian"] = "CROSS"
        elif mode == "FORCE_NORTH_SOUTH":
            cab["signal_heads"]["NORTH"]["state"] = "GREEN"
            cab["signal_heads"]["SOUTH"]["state"] = "GREEN"
            cab["signal_heads"]["EAST"]["state"] = "RED"
            cab["signal_heads"]["WEST"]["state"] = "RED"
        elif mode == "FORCE_EAST_WEST":
            cab["signal_heads"]["NORTH"]["state"] = "RED"
            cab["signal_heads"]["SOUTH"]["state"] = "RED"
            cab["signal_heads"]["EAST"]["state"] = "GREEN"
            cab["signal_heads"]["WEST"]["state"] = "GREEN"
        elif mode == "RESUME_AI_AUTO":
            # Normalized auto state
            cab["signal_heads"]["NORTH"]["state"] = "GREEN"
            cab["signal_heads"]["SOUTH"]["state"] = "GREEN"
            cab["signal_heads"]["EAST"]["state"] = "RED"
            cab["signal_heads"]["WEST"]["state"] = "RED"

        return {
            "status": "success",
            "junction": junction_id,
            "mode_applied": mode,
            "cabinet_id": cab["cabinet_id"],
            "signal_heads": cab["signal_heads"],
        }

gateway_service = HardwareGatewayService()
hardware_gw = gateway_service
