/** REST API client for the traffic management backend. */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" ? "/api" : "http://127.0.0.1:8000/api");

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(formatApiError(err, res.status));
  }
  return res.json();
}

// FastAPI's error `detail` can be:
//   - a string  → HTTPException("plain message")
//   - an array  → 422 validation errors: [{ loc, msg, type, input? }, ...]
//   - an object → custom error shapes
// Stringifying naively gives "[object Object]" for the array/object cases.
function formatApiError(err: unknown, status: number): string {
  const e = err as { detail?: unknown };
  const d = e?.detail;
  if (typeof d === "string" && d.length > 0) return d;
  if (Array.isArray(d)) {
    return d
      .map((row: { loc?: unknown; msg?: string }) => {
        const loc = Array.isArray(row.loc) ? row.loc.join(".") : "";
        const msg = row.msg ?? JSON.stringify(row);
        return loc ? `${loc} — ${msg}` : msg;
      })
      .join("; ");
  }
  if (d && typeof d === "object") return JSON.stringify(d);
  return `API error: ${status}`;
}

export const api = {
  // Simulation
  startSimulation: (config?: Record<string, unknown>) =>
    request("/sim/start", { method: "POST", body: JSON.stringify(config || {}) }),
  stopSimulation: () => request("/sim/stop", { method: "POST" }),
  pauseSimulation: () => request("/sim/pause", { method: "POST" }),
  resumeSimulation: () => request("/sim/resume", { method: "POST" }),
  getSimStatus: () => request("/sim/status"),

  // Signals
  getAllSignals: () => request("/signals"),
  getSignal: (id: string) => request(`/signals/${id}`),
  getSignalTargets: (id: string) => request(`/signals/${id}/targets`),
  setSignal: (id: string, command: Record<string, unknown>) =>
    request(`/signals/${id}`, { method: "PUT", body: JSON.stringify(command) }),

  // Weather & Environment Physics
  setWeather: (condition: "clear" | "rain" | "fog" | "night") =>
    request("/sim/environment/weather", {
      method: "POST",
      body: JSON.stringify({ condition }),
    }),

  // Production Real-World External Telemetry Feeds
  searchLocation: (query: string) =>
    request<any>("/external/search", {
      method: "POST",
      body: JSON.stringify({ query }),
    }),
  getLiveWeather: () => request<any>("/external/weather"),
  getLiveAirQuality: () => request<any>("/external/air-quality"),
  getOsmJunctions: (bbox?: string) =>
    request<any>(`/external/osm-junctions${bbox ? `?bbox=${encodeURIComponent(bbox)}` : ""}`),
  changeCity: (city_name: string, lat: number, lon: number) =>
    request<any>("/external/city", {
      method: "POST",
      body: JSON.stringify({ city_name, lat, lon }),
    }),
  syncLiveEnvironmentToSim: () =>
    request<any>("/external/sync-environment", { method: "POST" }),

  // Real-World Field Hardware & NTCIP 1202 Gateway
  getCabinets: () => request<any>("/hardware/cabinets"),
  getCabinet: (id: string) => request<any>(`/hardware/cabinets/${id}`),
  policeOverride: (id: string, mode: "ALL_RED" | "FORCE_NORTH_SOUTH" | "FORCE_EAST_WEST" | "RESUME_AI_AUTO") =>
    request<any>(`/hardware/cabinets/${id}/police-override`, {
      method: "POST",
      body: JSON.stringify({ mode }),
    }),
  getVmsBoards: () => request<any>("/hardware/vms"),
  broadcastVms: (data: { vms_id: string; line1: string; line2: string; line3: string; severity?: string }) =>
    request<any>("/hardware/vms/broadcast", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getAnprViolations: () => request<any>("/hardware/violations"),

  // Autonomous AI Risk & Mitigation Engine
  getRiskAssessment: () => request<any>("/ai/risk-assessment"),
  get15MinForecast: () => request<any>("/ai/forecast-15min"),
  mitigateEmergency: (junction_id: string, incident_type: string = "COLLISION") =>
    request<any>("/ai/mitigate-emergency", {
      method: "POST",
      body: JSON.stringify({ junction_id, incident_type }),
    }),
  getEmergencyEvents: () => request<any>("/ai/emergency-events"),

  // Road Incidents (Crash / Lane Blockage)
  injectIncident: (edge: string, laneIndex = 0, durationS = 60) =>
    request("/sim/incidents/inject", {
      method: "POST",
      body: JSON.stringify({ edge, lane_index: laneIndex, duration_s: durationS }),
    }),
  clearIncident: (edge: string, laneIndex = 0) =>
    request("/sim/incidents/clear", {
      method: "POST",
      body: JSON.stringify({ edge, lane_index: laneIndex }),
    }),

  // Metrics
  getCurrentMetrics: () => request("/metrics/current"),
  getMetricsHistory: (limit = 100) => request(`/metrics/history?limit=${limit}`),

  // Emergency
  injectEmergency: (routeEdges: string[]) =>
    request("/emergency/inject", {
      method: "POST",
      body: JSON.stringify({ route_edges: routeEdges }),
    }),
  getActiveEmergency: () => request("/emergency/active"),

  // Comparison experiments
  createComparison: (body: {
    name?: string;
    seed: number;
    runs: Record<string, unknown>[];
  }) =>
    request("/experiments/comparison", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listComparisons: () => request("/experiments/"),
  getComparison: (id: string) => request(`/experiments/${id}`),
  cancelComparison: (id: string) =>
    request(`/experiments/${id}/cancel`, { method: "POST" }),

  // Runs history (Supabase-backed)
  listRuns: (limit = 50) => request(`/runs?limit=${limit}`),
  getRun: (runId: string) => request(`/runs/${runId}`),
  getRunMetrics: (runId: string) => request(`/runs/${runId}/metrics`),
  getRunIntersectionMetrics: (runId: string) =>
    request(`/runs/${runId}/intersection-metrics`),

  // Policy variants
  listPolicyVariants: (family?: "arterial" | "highway") =>
    request(family ? `/policy/variants?family=${family}` : "/policy/variants"),
  savePolicyVariant: (variant: Record<string, unknown>) =>
    request("/policy/variants", { method: "POST", body: JSON.stringify(variant) }),
  deletePolicyVariant: (name: string) =>
    request(`/policy/variants/${encodeURIComponent(name)}`, { method: "DELETE" }),
  getVariantRuns: (name: string, limit = 50) =>
    request(`/policy/variants/${encodeURIComponent(name)}/runs?limit=${limit}`),
  suggestPolicy: (
    draft: Record<string, unknown>,
    goal = "balanced",
    family: "arterial" | "highway" = "arterial",
  ) =>
    request("/policy/variants/suggest", {
      method: "POST",
      body: JSON.stringify({ draft, goal, family }),
    }),

  // CARLA cameras
  getCameraStatus: () => request("/cameras/status"),
  listCameras: (detail: "summary" | "full" = "summary") =>
    request(`/cameras?detail=${detail}`),
  saveCamera: (payload: {
    intersection_id: string;
    approach: "N" | "E" | "S" | "W";
    x: number;
    y: number;
    z: number;
    pitch: number;
    yaw: number;
  }) =>
    request("/cameras/save", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  // Per-camera analytics regions (lane polygons + violation lines)
  getCameraRegions: () => request("/cameras/regions"),
  saveCameraRegions: (payload: {
    intersection_id: string;
    approach: "N" | "E" | "S" | "W";
    lanes: { id: string; polygon: [number, number][] }[];
    forbidden_lines: { id: string; points: [[number, number], [number, number]] }[];
  }) =>
    request("/cameras/regions", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  // Vision overlay + hybrid-merge runtime toggle (CARLA mode)
  getVision: () => request("/cameras/vision"),
  setVision: (enabled: boolean) =>
    request("/cameras/vision", {
      method: "POST",
      body: JSON.stringify({ enabled }),
    }),

  // AI assistant
  sendChat: (messages: { role: string; content: string }[]) =>
    request<{
      reply: string;
      model_used?: string;
      actions_executed?: { tool: string; args: Record<string, unknown>; result?: unknown }[];
    }>("/chat", {
      method: "POST",
      body: JSON.stringify({ messages }),
    }),

  // Emergency dispatch (arterial grid)
  dispatchEmergency: (body: {
    from_intersection: string;
    to_intersection: string;
    vehicle_type: string;
  }) =>
    request<{
      vehicle_id: string;
      route_intersections: string[];
    }>("/emergency/dispatch", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  cancelEmergency: (vehicleId: string) =>
    request(`/emergency/${encodeURIComponent(vehicleId)}`, { method: "DELETE" }),

  // NOTE: camera streams are consumed directly via <img src> using
  // API_BASE + `/cameras/{id}/{approach}/stream`, so no fetch wrapper.
};

export const cameraStreamUrl = (intersectionId: string, approach: string) =>
  `${API_BASE}/cameras/${intersectionId}/${approach}/stream`;

export const previewCameraUrl = (params: {
  x: number;
  y: number;
  z: number;
  pitch: number;
  yaw: number;
  t?: number;     // cache-busting tick
}) => {
  const q = new URLSearchParams({
    x: params.x.toString(),
    y: params.y.toString(),
    z: params.z.toString(),
    pitch: params.pitch.toString(),
    yaw: params.yaw.toString(),
    _t: (params.t ?? 0).toString(),
  });
  return `${API_BASE}/cameras/preview?${q.toString()}`;
};
