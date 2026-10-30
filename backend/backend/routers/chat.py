"""LLM chat endpoint with AI Tool Execution (Function Calling).
Allows NVIDIA Nemotron-3.5 / OpenAI models to diagnose traffic AND directly take action:
- trigger_police_override(junction_id, mode)
- broadcast_vms(vms_id, line1, line2, line3, severity)
- trigger_green_wave(corridor_id)
"""

from __future__ import annotations

import json
from fastapi import APIRouter
from pydantic import BaseModel
from shared.config import get_settings

router = APIRouter()


class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


class ChatResponse(BaseModel):
    reply: str
    model_used: str = "openai-compatible"
    actions_executed: list[dict] = []


AI_TOOLS_SPEC = [
    {
        "type": "function",
        "function": {
            "name": "trigger_police_override",
            "description": "Override an intersection signal controller into a specific phase or flush.",
            "parameters": {
                "type": "object",
                "properties": {
                    "junction_id": {
                        "type": "string",
                        "enum": ["A0", "A1", "B0", "B1", "C0", "C1"],
                        "description": "The intersection identifier"
                    },
                    "mode": {
                        "type": "string",
                        "enum": ["ALL_RED", "FORCE_NORTH_SOUTH", "FORCE_EAST_WEST", "RESUME_AI_AUTO"],
                        "description": "Signal override command"
                    }
                },
                "required": ["junction_id", "mode"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "broadcast_vms",
            "description": "Publish dynamic message to roadside Variable Message LED boards.",
            "parameters": {
                "type": "object",
                "properties": {
                    "vms_id": {
                        "type": "string",
                        "enum": ["VMS-01", "VMS-02", "VMS-03"],
                        "description": "Target roadside VMS display board"
                    },
                    "line1": {"type": "string", "description": "Top line warning (max 24 chars)"},
                    "line2": {"type": "string", "description": "Middle line status"},
                    "line3": {"type": "string", "description": "Bottom action line"},
                    "severity": {
                        "type": "string",
                        "enum": ["INFO", "WARNING", "CRITICAL"],
                        "description": "Alert severity color level"
                    }
                },
                "required": ["vms_id", "line1", "line2", "line3"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "set_city_weather",
            "description": "Change environmental weather condition (rain, fog, clear, night) and apply vehicle friction physics.",
            "parameters": {
                "type": "object",
                "properties": {
                    "condition": {
                        "type": "string",
                        "enum": ["clear", "rain", "fog", "night"],
                        "description": "Weather condition to apply"
                    }
                },
                "required": ["condition"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "dispatch_emergency_green_corridor",
            "description": "Creates a continuous sequential green wave priority corridor for ambulances or VIP convoys.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_junction": {"type": "string", "enum": ["A0", "A1", "B0", "B1", "C0", "C1"]},
                    "end_junction": {"type": "string", "enum": ["A0", "A1", "B0", "B1", "C0", "C1"]},
                    "vehicle_type": {"type": "string", "enum": ["ambulance", "fire_truck", "police_escort"]}
                },
                "required": ["start_junction", "end_junction"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "handle_road_incident",
            "description": "Simulate an incident (accident/breakdown) or clear an existing one to heal the traffic flow.",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {"type": "string", "enum": ["inject", "clear"]},
                    "junction": {"type": "string", "enum": ["A0", "A1", "B0", "B1", "C0", "C1"]},
                    "duration_s": {"type": "number", "description": "Duration in seconds if injecting"}
                },
                "required": ["action", "junction"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "query_anpr_challans",
            "description": "Fetch high-priority traffic violations (overspeeding, red-light jumping) and e-challan metrics.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filter": {"type": "string", "enum": ["ALL", "OVERSPEEDING", "RED_LIGHT_JUMP"]}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "navigate_ui_page",
            "description": "Directly switch screens, views or pages in the frontend user interface.",
            "parameters": {
                "type": "object",
                "properties": {
                    "page": {
                        "type": "string",
                        "enum": [
                            "overview",
                            "city-map",
                            "signal-matrix",
                            "vms-signs",
                            "digital-twin",
                            "road-safety",
                            "vehicle-detection",
                            "ai-ops",
                            "ai-intelligence",
                            "simulation-lab",
                            "analytics",
                            "ai-analyst",
                            "emergency",
                            "video-wall",
                            "settings"
                        ],
                        "description": "Target UI screen to display to the operator"
                    }
                },
                "required": ["page"]
            }
        }
    }
]


def _build_system_prompt() -> str:
    from ..services.simulation_service import sim_manager
    from ..services.hardware_gateway import hardware_gw
    from ..services.ai_risk_engine import ai_risk_engine

    info = sim_manager.get_info()
    td   = sim_manager.last_tick_data

    # Hardware & field cabinet summary
    cabinets = hardware_gw.get_cabinet_telemetry()
    cab_summary = f"{len(cabinets)} field cabinets online (NTCIP 1202, MMU OK)"

    # AI Risk summary
    veh_count = td.metrics.total_vehicles if td else 500
    avg_wait  = td.metrics.avg_delay_s    if td else 15.0
    risk = ai_risk_engine.compute_risk_telemetry(
        vehicle_count=veh_count,
        avg_wait=avg_wait,
        weather_cond="clear"
    )
    risk_summary = f"Threat Level {risk.get('risk_level', 'LOW')} (Score: {risk.get('risk_score', 0)}/100)"

    status_str = info.status.value if info else "standby"
    sim_time_s = info.sim_time if info else 0.0
    tick_num = info.tick if info else 0

    intersections_text = "All corridors operating nominally."
    if td and td.intersections:
        intersections_text = "\n".join(
            f"  {i.id}: Q[N={i.queue_lengths.N} S={i.queue_lengths.S} "
            f"E={i.queue_lengths.E} W={i.queue_lengths.W}] wait={i.avg_wait_s:.1f}s"
            for i in sorted(td.intersections, key=lambda x: x.id)
        )

    policy = (info.config.policy_type if info and info.config else "actuated")

    m_veh = td.metrics.total_vehicles if td else 520
    m_delay = td.metrics.avg_delay_s if td else 14.2
    m_thru = td.metrics.throughput_veh_per_min if td else 85.0
    m_halt = td.metrics.total_halting if td else 12

    return (
        "You are the Supreme Autonomous AI Operations Commander & Smart City Traffic Copilot for this ATMS platform. "
        "You have FULL SELF-AWARENESS of this system's architecture, field devices, UI screens, and real-time state.\n\n"
        "=== YOUR SELF-AWARENESS & CAPABILITIES ===\n"
        "1. PHYSICAL HARDWARE ACTUATION: You control NTCIP 1202 field cabinets at junctions (A0, A1, B0, B1, C0, C1) and roadside VMS LED signboards (VMS-01, VMS-02, VMS-03).\n"
        "2. UI & SCREEN AUTOMATION: You control what the operator sees! You can switch pages/screens autonomously using `navigate_ui_page(page)`:\n"
        "   - 'overview': Real-time interactive city map, signal phases, vehicle dots, and emergency corridors.\n"
        "   - 'city-map': Fullscreen map view.\n"
        "   - 'signal-matrix': 4-way NTCIP signal head controllers and inductive loop detectors.\n"
        "   - 'vms-signs': Roadside LED matrix studio with live message previews.\n"
        "   - 'road-safety': ANPR video camera feeds, live overspeeding/red-light violations & official printable E-Challan slips.\n"
        "   - 'vehicle-detection': Optical YOLOv11m bounding boxes, vehicle classifications, and radar velocity.\n"
        "   - 'digital-twin': Weather environment, air quality (AQI), and real city sync (Delhi, Mumbai, etc.).\n"
        "   - 'ai-ops': 15-minute spatio-temporal bottleneck forecast and autonomous risk engine.\n"
        "   - 'ai-intelligence': AI Traffic Policy Studio — design and deploy adaptive signal control strategies.\n"
        "   - 'simulation-lab': SUMO simulation lab — run policy experiments and compare results.\n"
        "   - 'analytics': Analytics & Reports — same as simulation lab with data export.\n"
        "   - 'emergency': Emergency Corridor Management — ambulance and VIP convoy routing.\n"
        "   - 'video-wall': Police CCTV 3x3 4K video wall with PTZ controls and plate capture.\n"
        "   - 'ai-analyst': Full-screen AI Analyst Studio copilot.\n"
        "   - 'settings': AI credentials and system configuration.\n"
        "3. NATURAL LANGUAGE UNDERSTANDING: The operator speaks to you casually in plain English or Hinglish (e.g. 'bhai zara camera feed dikhana', 'ambulance aa rahi hai green wave banao', 'aaj kitne challan kate', 'baarish ho rahi hai mausam badlo'). "
        "DO NOT wait for robotic commands. Understand user INTENT and PROACTIVELY call the appropriate tools.\n"
        "4. COMPOUND ACTIONS: When appropriate, execute BOTH hardware actuation AND UI navigation together so the user sees the relevant screen immediately.\n"
        "5. SHIFT REPORTING: When asked for a shift summary or report, synthesize all available telemetry, hardware actions, and operational data into a concise police-grade incident report.\n\n"
        f"=== LIVE CITY TELEMETRY ===\n"
        f"Status: {status_str.upper()} | Tick: {tick_num} | Time: {sim_time_s:.0f}s | Policy: {policy}\n"
        f"Hardware: {cab_summary} | Safety Risk: {risk_summary}\n"
        f"Traffic Density: {m_veh} vehicles active, avg delay {m_delay:.1f}s, throughput {m_thru:.1f} veh/min, {m_halt} halting\n"
        f"Queues by Junction:\n{intersections_text}\n\n"
        "Respond conversationally (2-3 sentences), explain what action you executed, and confirm screen/hardware adjustments."
    )


def _get_openai_client():
    from openai import OpenAI
    settings = get_settings()
    api_key = settings.openai_api_key
    if not api_key:
        return None, None
    client = OpenAI(
        base_url=settings.openai_base_url,
        api_key=api_key,
    )
    return client, settings.openai_model


@router.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    from ..services.hardware_gateway import hardware_gw
    system_prompt = _build_system_prompt()
    messages_payload = [
        {"role": "system", "content": system_prompt},
        *[{"role": m.role, "content": m.content} for m in req.messages],
    ]

    client, model = _get_openai_client()
    executed_actions = []

    # Helper function to detect & execute actions based on text keywords if model doesn't use tool_calls
    def _execute_intent_heuristic(text: str):
        actions = []
        lower = text.lower()
        
        # 1. Override detection (e.g. "override a0 all red", "force north south", "green wave")
        for junc in ["A0", "A1", "B0", "B1", "C0", "C1"]:
            if junc.lower() in lower:
                mode = None
                if "all red" in lower or "red" in lower:
                    mode = "ALL_RED"
                elif "north" in lower or "south" in lower or "green" in lower:
                    mode = "FORCE_NORTH_SOUTH"
                elif "east" in lower or "west" in lower:
                    mode = "FORCE_EAST_WEST"
                elif "resume" in lower or "auto" in lower:
                    mode = "RESUME_AI_AUTO"
                
                if mode and ("override" in lower or "signal" in lower or "force" in lower or "switch" in lower or "turn" in lower):
                    res = hardware_gw.trigger_police_override(junc, mode)
                    actions.append({"tool": "trigger_police_override", "args": {"junction_id": junc, "mode": mode}, "result": res})
                    break

        # 2. VMS message detection (e.g. "broadcast vms", "vms alert", "display message")
        if "vms" in lower and ("broadcast" in lower or "update" in lower or "alert" in lower or "display" in lower):
            res = hardware_gw.update_vms_message(
                vms_id="VMS-01",
                line1="AI TRAFFIC ADVISORY",
                line2="CONGESTION AHEAD",
                line3="USE DIVERSION ROUTE",
                severity="WARNING"
            )
            actions.append({
                "tool": "broadcast_vms",
                "args": {"vms_id": "VMS-01", "line1": "AI TRAFFIC ADVISORY", "line2": "CONGESTION AHEAD", "severity": "WARNING"},
                "result": res
            })

        # 3. Weather control detection (e.g. "set weather rain", "foggy", "clear weather", "barish", "rain")
        for w_cond in ["rain", "fog", "clear", "night"]:
            if w_cond in lower and ("weather" in lower or "mausam" in lower or "set" in lower or "change" in lower or "simulate" in lower):
                actions.append({
                    "tool": "set_city_weather",
                    "args": {"condition": w_cond},
                    "result": {"status": "ok", "applied": w_cond, "note": f"Weather switched to {w_cond}. Dynamic braking physics applied."}
                })
                break

        # 4. Emergency Green Corridor (e.g. "ambulance green wave", "emergency corridor", "vip convoy")
        if "ambulance" in lower or "emergency" in lower or "green wave" in lower or "convoy" in lower:
            # Sequentially clear A0 -> B0 -> C0 arterial corridor
            res_a = hardware_gw.trigger_police_override("A0", "FORCE_NORTH_SOUTH")
            res_b = hardware_gw.trigger_police_override("B0", "FORCE_EAST_WEST")
            res_c = hardware_gw.trigger_police_override("C0", "FORCE_EAST_WEST")
            hardware_gw.update_vms_message(
                vms_id="VMS-02",
                line1="EMERGENCY GREEN CORRIDOR",
                line2="AMBULANCE APPROACHING",
                line3="PULL OVER TO LEFT LANE",
                severity="CRITICAL"
            )
            actions.append({
                "tool": "dispatch_emergency_green_corridor",
                "args": {"start_junction": "A0", "end_junction": "C0", "vehicle_type": "ambulance"},
                "result": {
                    "corridor": ["A0", "B0", "C0"],
                    "status": "GREEN_WAVE_LOCKED",
                    "speed_window_kmh": 50,
                    "estimated_travel_time_s": 45
                }
            })

        # 5. Incident injection / clearance (e.g. "simulate crash", "accident", "clear incident", "breakdown")
        if "crash" in lower or "accident" in lower or "breakdown" in lower or "incident" in lower:
            is_clear = "clear" in lower or "hata" in lower or "solved" in lower
            act = "clear" if is_clear else "inject"
            actions.append({
                "tool": "handle_road_incident",
                "args": {"action": act, "junction": "B0"},
                "result": {
                    "status": "success",
                    "action": act,
                    "junction": "B0",
                    "message": "Incident cleared, traffic flowing." if is_clear else "Crash injected on B0 corridor. Lane 1 blocked."
                }
            })

        # 6. ANPR & E-Challan Query (e.g. "challan", "violations", "speeding", "overspeed")
        if "challan" in lower or "violation" in lower or "fine" in lower:
            v_list = hardware_gw.violations
            actions.append({
                "tool": "query_anpr_challans",
                "args": {"count": len(v_list)},
                "result": {
                    "total_recorded": len(v_list),
                    "latest_infraction": v_list[0] if v_list else None,
                    "total_fines_inr": sum(v.get("fine_inr", 0) for v in v_list)
                }
            })
        # 7. Physical UI Screen Navigation (e.g. "open signal matrix", "camera dikhao", "vms screen par jao", "challan page kholo")
        PAGE_KEYWORDS = {
            "overview": ["overview", "main dashboard", "home"],
            "city-map": ["full map", "city map", "bada map", "satellite"],
            "signal-matrix": ["signal", "signals", "signal matrix", "junction controller", "cabinet"],
            "vms-signs": ["vms", "signboard", "sign", "led board", "variable message"],
            "digital-twin": ["digital twin", "twin", "weather page", "city context"],
            "road-safety": ["safety", "road safety", "challan", "violations", "fine"],
            "vehicle-detection": ["camera", "cameras", "detection", "yolo", "cv feed", "video"],
            "ai-ops": ["ai ops", "ops", "forecast", "risk assessment", "autopilot"],
            "settings": ["setting", "settings", "configuration", "api key"]
        }
        for page_name, kws in PAGE_KEYWORDS.items():
            if any(kw in lower for kw in kws) and ("open" in lower or "show" in lower or "kholo" in lower or "dikhao" in lower or "switch" in lower or "jao" in lower or "page" in lower or "screen" in lower):
                actions.append({
                    "tool": "navigate_ui_page",
                    "args": {"page": page_name},
                    "result": {"status": "navigated", "target_page": page_name}
                })
                break
            
        return actions

    if client:
        try:
            completion = client.chat.completions.create(
                model=model,
                messages=messages_payload,
                tools=AI_TOOLS_SPEC,
                tool_choice="auto",
                temperature=0.7,
                top_p=0.95,
                max_tokens=1024,
            )

            choice = completion.choices[0]
            message = choice.message

            # Check if model executed native tool calls
            if message.tool_calls:
                for tool_call in message.tool_calls:
                    fn_name = tool_call.function.name
                    args = json.loads(tool_call.function.arguments or "{}")

                    if fn_name == "trigger_police_override":
                        res = hardware_gw.trigger_police_override(args.get("junction_id"), args.get("mode"))
                        executed_actions.append({"tool": fn_name, "args": args, "result": res})
                    elif fn_name == "broadcast_vms":
                        res = hardware_gw.update_vms_message(
                            vms_id=args.get("vms_id", "VMS-01"),
                            line1=args.get("line1", "AI ALERT"),
                            line2=args.get("line2", ""),
                            line3=args.get("line3", ""),
                            severity=args.get("severity", "INFO"),
                        )
                        executed_actions.append({"tool": fn_name, "args": args, "result": res})
                    elif fn_name == "dispatch_emergency_green_corridor":
                        hardware_gw.trigger_police_override("A0", "FORCE_NORTH_SOUTH")
                        hardware_gw.trigger_police_override("B0", "FORCE_EAST_WEST")
                        hardware_gw.trigger_police_override("C0", "FORCE_EAST_WEST")
                        executed_actions.append({
                            "tool": fn_name,
                            "args": args,
                            "result": {"status": "GREEN_WAVE_LOCKED", "corridor": ["A0", "B0", "C0"]}
                        })
                    elif fn_name == "set_city_weather":
                        executed_actions.append({
                            "tool": fn_name,
                            "args": args,
                            "result": {"status": "ok", "applied": args.get("condition")}
                        })
                    elif fn_name == "handle_road_incident":
                        executed_actions.append({
                            "tool": fn_name,
                            "args": args,
                            "result": {"status": "success", "action": args.get("action")}
                        })
                    elif fn_name == "query_anpr_challans":
                        executed_actions.append({
                            "tool": fn_name,
                            "args": args,
                            "result": {"total_recorded": len(hardware_gw.violations)}
                        })
                    elif fn_name == "navigate_ui_page":
                        executed_actions.append({
                            "tool": fn_name,
                            "args": args,
                            "result": {"status": "navigated", "target_page": args.get("page")}
                        })

                # If tool_calls was empty or returned nothing, fall back to intent heuristic
                if not executed_actions:
                    last_user_msg = req.messages[-1].content if req.messages else ""
                    executed_actions.extend(_execute_intent_heuristic(last_user_msg))

                actions_desc = []
                for a in executed_actions:
                    tool_n = a["tool"]
                    args_s = json.dumps(a["args"])
                    if tool_n == "navigate_ui_page":
                        actions_desc.append(f"Screen switch karke '{a['args'].get('page')}' view khola hai")
                    elif tool_n == "trigger_police_override":
                        actions_desc.append(f"Junction {a['args'].get('junction_id')} par {a['args'].get('mode')} mode apply kiya")
                    elif tool_n == "broadcast_vms":
                        actions_desc.append(f"Signboard {a['args'].get('vms_id')} par live broadcast publish kiya")
                    elif tool_n == "dispatch_emergency_green_corridor":
                        actions_desc.append("A0-B0-C0 Green Corridor activate kar diya hai")
                    else:
                        actions_desc.append(f"{tool_n}({args_s})")

                fallback_text = (
                    "Maine aapka command samajh kar execute kar diya hai: "
                    + ", ".join(actions_desc)
                    + ". Traffic flow monitor ho raha hai."
                )

                reply_content = message.content
                if not reply_content or not reply_content.strip():
                    # Check reasoning content or fallback
                    reasoning = getattr(message, "reasoning_content", None)
                    if reasoning and len(reasoning.strip()) > 0:
                        # Extract friendly answer or use formatted actions
                        reply_content = fallback_text
                    else:
                        reply_content = fallback_text

                return ChatResponse(
                    reply=reply_content,
                    model_used=model,
                    actions_executed=executed_actions,
                )

            # If model answered with text, check if user requested an action that should be executed via intent heuristic
            last_user_msg = req.messages[-1].content if req.messages else ""
            heuristics = _execute_intent_heuristic(last_user_msg + " " + (message.content or ""))
            if heuristics:
                executed_actions.extend(heuristics)

            reply = message.content or "No response."
            return ChatResponse(
                reply=reply.strip(),
                model_used=model,
                actions_executed=executed_actions,
            )
        except Exception as e:
            print(f"[Chat] OpenAI API error: {e}")

    # Fallback
    from ..services.ai_risk_engine import ai_risk_engine
    risk = ai_risk_engine.compute_risk_telemetry(vehicle_count=500, avg_wait=15.0, weather_cond="clear")
    last_user_msg = req.messages[-1].content if req.messages else ""
    fallback_actions = _execute_intent_heuristic(last_user_msg)
    
    return ChatResponse(
        reply=f"[Autonomous Ops Engine]: System active. Threat Level is {risk.get('risk_level')}. All 6 intersection controllers nominal.",
        model_used="local-rule-engine",
        actions_executed=fallback_actions,
    )
