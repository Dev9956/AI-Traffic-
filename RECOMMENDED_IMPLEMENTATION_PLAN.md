# Minimal-Change Architecture & Extension Blueprint

**Design Objective:** Extend capabilities to production-grade quality while maintaining existing endpoints, database schemas, frontend interfaces, and simulation lifecycles. Zero breaking changes.

---

## 1. Architectural Strategy

The project's architecture is already clean and follows a decoupled hexagonal design:
```
           ┌─────────────────────────────┐
           │      Web Dashboard          │
           │   (Next.js 14 + Zustand)    │
           └──────────────┬──────────────┘
                          │ REST / WebSockets (10Hz)
                          ▼
           ┌─────────────────────────────┐
           │     FastAPI Backend         │
           │  (Routers, WS Broadcast)    │
           └──────┬───────────────┬──────┘
                  │               │
       ┌──────────▼────────┐      │
       │ Simulation Manager│      │ Supabase ORM / Local JSON
       │ (TraCI / CARLA)   │      ▼
       └──────────┬────────┘ ┌──────────────────────┐
                  │          │ Storage & DB Service │
                  ▼          └──────────────────────┘
       ┌─────────────────────┐
       │   Adaptive Policy   │ ◄── (Actuated / ALINEA / Preemption)
       └─────────────────────┘
                  ▲
                  │ Vision Inference (Queues, Violations)
       ┌──────────┴──────────┐
       │     CV Pipeline     │ ◄── (YOLOv11m + ByteTrack + Homography)
       └─────────────────────┘
```

---

## 2. Minimal-Change Integration Points

### A. Wrong-Way & Speed Violations
- **File:** `packages/cv-pipeline/cv_pipeline/approach_analyzer.py`
- **Hook:** Inside `_SpeedTracker.update()`:
  - Calculate velocity vector $\vec{v} = (x_t - x_{t-1}, y_t - y_{t-1})$.
  - Compare $\vec{v} \cdot \vec{d}_{\text{lane}}$ where $\vec{d}_{\text{lane}}$ is the known lane bearing.
  - If $\cos(\theta) < -0.5$, emit violation `type="wrong_way"`.
  - If $\|\vec{v}\| > v_{\text{limit}}$, emit violation `type="speeding"`.
- **API Impact:** Zero. Reuses existing `violations.csv` logger and WebSocket `ViolationEvent` payload.

### B. Cascaded Multi-Intersection Green Wave
- **File:** `packages/sumo-engine/sumo_engine/emergency.py` & `packages/adaptive-policy/adaptive_policy/preemption.py`
- **Hook:** Reuses the existing BFS path `route: list[str] = ['A0', 'B0', 'C0']`:
  - Current logic preempts only `target_intersection = route[0]`.
  - Extension: If distance to `route[0] < 50m`, trigger preemptive transition on `route[1]` with an offset equal to `distance / ev_speed`.
- **API Impact:** Zero. Frontend already supports `activeEvRoutes` visualization.

### C. Watchdog Fallback & Fail-Safe
- **File:** `backend/backend/services/simulation_service.py`
- **Hook:** In the simulation step loop:
  - If `cv_pipeline` fails to emit frames or throws an exception for $> 3$ consecutive ticks:
    - Log error and automatically switch policy from `ActuatedController` to fallback `FixedTimeController`.
    - Broadcast health alert over WebSocket `{"type": "system_warning", "msg": "CV timeout, fallback active"}`.

### D. Historical AI Traffic Analyst
- **File:** `backend/backend/routers/chat.py`
- **Hook:** In `_build_system_prompt()`:
  - Add query parameter to retrieve aggregated summary from `db_service.get_run_global_metrics(run_id)`.
  - Append recent comparison experiment metrics into the Groq LLM system prompt context.
- **Frontend Impact:** Zero changes needed in `ChatWidget.tsx`.

### E. Indian Traffic Taxonomy
- **File:** `packages/cv-pipeline/cv_pipeline/classes.py`
- **Hook:** Add `"auto_rickshaw": "auto_rickshaw"` and `"rickshaw": "auto_rickshaw"` to `CLASS_TO_VEHICLE_TYPE`.
- **Model:** Fine-tune `best.pt` on Indian Driving Dataset (IDD) vehicle images without changing model input/output dimensions.
