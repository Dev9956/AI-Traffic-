# Architecture Gaps & Limitations Analysis

**Target Systems:** AI-Based Traffic Management & Monitoring System  
**Auditor:** Senior AI Architect

---

## 1. Identified Architectural Gaps

### Gap 1: Single-Point-of-Failure in Vision-to-Policy Loop
- **Current State:** The actuated controller directly relies on `queue_lengths` provided by TraCI subscriptions or CV inference. If a camera feed lags, drops frames, or crashes, the controller does not implement a timeout watchdog to fall back to fixed-time operation.
- **Risk:** Intersections can experience permanent phase stalls (indefinite green or red).

### Gap 2: Reactive Rather Than Predictive Signal Allocation
- **Current State:** `ActuatedController` only observes vehicles already standing in the queue ($v < 1.0\text{ m/s}$). It has no look-ahead horizon for incoming shockwaves from upstream intersections.
- **Risk:** Queues on high-speed corridors spill back into upstream junctions before the controller reacts.

### Gap 3: Localized Emergency Preemption vs Network-Wide Corridor
- **Current State:** `ev_routing.py` calculates a complete multi-hop BFS path (`['A0', 'B0', 'C0']`), but `preemption.py` only commands green for the single junction immediately ahead. Downstream junctions remain in conflicting phases until the emergency vehicle is within close proximity.
- **Risk:** Emergency vehicles must decelerate at downstream junctions while waiting for yellow/red clearing intervals (3–5 seconds per junction).

### Gap 4: Disconnect Between Historical Analytics and AI Chat Assistant
- **Current State:** The system features extensive Supabase persistence (runs, vehicle snapshots, signal logs, experiment races) and a Groq LLM chat endpoint. However, `backend/backend/routers/chat.py` only samples instantaneous tick data.
- **Risk:** Operators cannot ask the AI assistant analytical questions regarding historical trends, past race comparisons, or weekly bottleneck patterns.

### Gap 5: Collision Detection Discrepancy
- **Current State:** The project documentation and README highlight collision detection as a delivered objective; however, inspection of the codebase confirms zero collision calculation logic (neither in bounding box IoU velocity checks nor TraCI collision callbacks).
- **Risk:** Documentation mismatch during technical due diligence and auditing.

---

## 2. Summary of Gaps vs Impact

| Gap Area | Current Impact | Recommended Remediation |
|---|---|---|
| **Controller Fault Tolerance** | High risk of signal freeze on camera failure | Implement a 3-tick Watchdog timer reverting to `FixedTimeController` |
| **Emergency Wave** | Deceleration at multi-hop junctions | Advance cascade preemption with travel-time offsets |
| **Safety Violations** | Only catches red light crossings | Add vector-based wrong-way and threshold speed checks |
| **Predictive Horizon** | Sluggish response to incoming bursts | Add 5-minute rolling polynomial/exponential queue forecaster |
| **Analytics Chatbot** | Limited to current moment snapshot | Inject Supabase historical aggregations into LLM prompt |
