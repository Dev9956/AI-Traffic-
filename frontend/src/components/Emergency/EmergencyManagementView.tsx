"use client";

import { useTrafficStore } from "@/store/trafficStore";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";

const INTERSECTION_IDS = ["A0", "A1", "B0", "B1", "C0", "C1"] as const;

const VEHICLE_TYPES = [
  { value: "ambulance", label: "Ambulance", icon: "🚑", color: "red" },
  { value: "fire_truck", label: "Fire Truck", icon: "🚒", color: "orange" },
  { value: "police", label: "Police", icon: "🚓", color: "blue" },
] as const;

interface ActiveEv {
  vehicle_id: string;
  label: string;
  route_intersections: string[];
  vehicle_type: string;
  dispatched_at: number;
}

export default function EmergencyManagementView() {
  const status = useTrafficStore((s) => s.status);
  const network = useTrafficStore((s) => s.network);
  const setActiveEvRoutes = useTrafficStore((s) => s.setActiveEvRoutes);
  const metrics = useTrafficStore((s) => s.metrics);

  const [from, setFrom] = useState("A0");
  const [to, setTo] = useState("C1");
  const [vehicleType, setVehicleType] = useState("ambulance");
  const [loading, setLoading] = useState(false);
  const [activeEvs, setActiveEvs] = useState<ActiveEv[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dispatchHistory, setDispatchHistory] = useState<ActiveEv[]>([]);

  useEffect(() => {
    setActiveEvRoutes(activeEvs.map((ev) => ev.route_intersections));
  }, [activeEvs, setActiveEvRoutes]);

  useEffect(() => {
    if (status === "idle" || status === "stopped") {
      setActiveEvs([]);
    }
  }, [status]);

  async function dispatch() {
    if (from === to || loading) return;
    setError(null);
    setLoading(true);
    try {
      const data = await api.dispatchEmergency({
        from_intersection: from,
        to_intersection: to,
        vehicle_type: vehicleType,
      });
      const vt = VEHICLE_TYPES.find((v) => v.value === vehicleType);
      const ev: ActiveEv = {
        vehicle_id: data.vehicle_id,
        label: `${vt?.icon} ${vt?.label}: ${from} → ${to}`,
        route_intersections: data.route_intersections,
        vehicle_type: vehicleType,
        dispatched_at: Date.now(),
      };
      setActiveEvs((prev) => [...prev, ev]);
      setDispatchHistory((prev) => [ev, ...prev].slice(0, 20));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dispatch failed.");
    } finally {
      setLoading(false);
    }
  }

  async function cancel(vehicleId: string) {
    try {
      await api.cancelEmergency(vehicleId);
    } catch {
      // best-effort
    }
    setActiveEvs((prev) => prev.filter((ev) => ev.vehicle_id !== vehicleId));
  }

  const isRunning = status === "running" || status === "paused";

  return (
    <div className="h-full overflow-y-auto bg-[#060a10] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-3">
            🚨 Emergency Corridor Management
            {isRunning && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
                SYSTEM ACTIVE
              </span>
            )}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Dispatch emergency vehicles &amp; manage green corridor preemption
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-gray-500">Network</div>
          <div className="text-xs font-mono text-cyan-400">{network?.toUpperCase() || "—"}</div>
        </div>
      </div>

      {!isRunning ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-5xl mb-4">⏸️</div>
            <div className="text-gray-400 text-sm">Simulation is not running</div>
            <div className="text-gray-600 text-xs mt-1">Start a simulation to enable emergency dispatch</div>
          </div>
        </div>
      ) : network !== "arterial" ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-5xl mb-4">🚧</div>
            <div className="text-gray-400 text-sm">Emergency dispatch is only available on the Arterial network</div>
            <div className="text-gray-600 text-xs mt-1">Switch to Arterial network in simulation controls</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: Dispatch Control Panel */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-[#0a1020] border border-[#1a2333] rounded-xl p-5">
              <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-4">
                Quick Dispatch
              </h2>

              {/* Vehicle Type Selector */}
              <div className="mb-4">
                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 block">Vehicle Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {VEHICLE_TYPES.map((vt) => (
                    <button
                      key={vt.value}
                      onClick={() => setVehicleType(vt.value)}
                      className={`py-3 rounded-lg text-center transition-all ${
                        vehicleType === vt.value
                          ? "bg-red-600/20 border-2 border-red-500/50 text-white shadow-lg shadow-red-500/10"
                          : "bg-[#111827] border border-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-200"
                      }`}
                    >
                      <div className="text-2xl mb-1">{vt.icon}</div>
                      <div className="text-[10px] font-semibold">{vt.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Route Selector */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Origin</label>
                  <select
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-full bg-[#1f2937] border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-red-500 transition-colors"
                  >
                    {INTERSECTION_IDS.map((id) => (
                      <option key={id} value={id}>{id}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Destination</label>
                  <select
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-full bg-[#1f2937] border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-red-500 transition-colors"
                  >
                    {INTERSECTION_IDS.map((id) => (
                      <option key={id} value={id}>{id}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Route visualization */}
              <div className="mb-4 bg-[#111827] rounded-lg p-3 border border-gray-800">
                <div className="text-[10px] text-gray-500 mb-2">PLANNED CORRIDOR</div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="px-2 py-1 rounded bg-green-500/20 text-green-400 font-mono font-bold">{from}</span>
                  <span className="text-gray-600">→ → →</span>
                  <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 font-mono font-bold">{to}</span>
                </div>
              </div>

              {/* Dispatch Button */}
              <button
                onClick={dispatch}
                disabled={loading || from === to}
                className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed
                           rounded-xl text-sm text-white font-bold transition-all uppercase tracking-wider
                           shadow-lg shadow-red-500/20 hover:shadow-red-500/30 active:scale-[0.98]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⟳</span> Dispatching...
                  </span>
                ) : (
                  "🚨 DISPATCH NOW"
                )}
              </button>

              {error && (
                <div className="mt-3 p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                  ⚠ {error}
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0a1020] border border-[#1a2333] rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-red-400">{activeEvs.length}</div>
                <div className="text-[10px] text-gray-500 mt-1">ACTIVE EVs</div>
              </div>
              <div className="bg-[#0a1020] border border-[#1a2333] rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-amber-400">{dispatchHistory.length}</div>
                <div className="text-[10px] text-gray-500 mt-1">TOTAL DISPATCHED</div>
              </div>
            </div>
          </div>

          {/* MIDDLE: Active EV Tracker */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-[#0a1020] border border-[#1a2333] rounded-xl p-5 h-full">
              <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Active Vehicles
              </h2>

              {activeEvs.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-600 text-sm">
                  No active emergency vehicles
                </div>
              ) : (
                <div className="space-y-3">
                  {activeEvs.map((ev) => {
                    const elapsed = Math.round((Date.now() - ev.dispatched_at) / 1000);
                    return (
                      <div
                        key={ev.vehicle_id}
                        className="bg-[#111827] border border-gray-800 rounded-lg p-3 hover:border-red-500/30 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-gray-200 font-semibold">{ev.label}</span>
                          <button
                            onClick={() => cancel(ev.vehicle_id)}
                            className="px-2 py-0.5 rounded text-[10px] bg-gray-800 text-gray-400 hover:bg-red-600 hover:text-white transition-colors"
                          >
                            CANCEL
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-gray-500 font-mono">ID: {ev.vehicle_id}</span>
                          <span className="text-cyan-400">{elapsed}s elapsed</span>
                        </div>
                        <div className="mt-2 flex items-center gap-1">
                          {ev.route_intersections.map((intersection, i) => (
                            <span key={i} className="flex items-center gap-1">
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-gray-800 text-gray-300">
                                {intersection}
                              </span>
                              {i < ev.route_intersections.length - 1 && (
                                <span className="text-gray-600 text-[9px]">→</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Corridor Status + Dispatch History */}
          <div className="lg:col-span-1 space-y-4">
            {/* Signal Preemption Status */}
            <div className="bg-[#0a1020] border border-[#1a2333] rounded-xl p-5">
              <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-4">
                Signal Preemption Status
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {INTERSECTION_IDS.map((id) => {
                  const hasActiveEv = activeEvs.some((ev) =>
                    ev.route_intersections.includes(id)
                  );
                  return (
                    <div
                      key={id}
                      className={`p-3 rounded-lg text-center border transition-all ${
                        hasActiveEv
                          ? "bg-red-500/10 border-red-500/40 shadow-lg shadow-red-500/10"
                          : "bg-[#111827] border-gray-800"
                      }`}
                    >
                      <div className="text-xs font-mono font-bold text-gray-200">{id}</div>
                      <div className={`text-[9px] mt-1 font-semibold ${
                        hasActiveEv ? "text-red-400 animate-pulse" : "text-gray-600"
                      }`}>
                        {hasActiveEv ? "PREEMPT" : "NORMAL"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Traffic Metrics */}
            <div className="bg-[#0a1020] border border-[#1a2333] rounded-xl p-5">
              <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3">
                Corridor Metrics
              </h2>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Active Vehicles</span>
                  <span className="text-gray-200 font-mono">{metrics?.total_vehicles ?? "—"}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Avg Speed</span>
                  <span className="text-gray-200 font-mono">{metrics?.avg_delay_s?.toFixed(1) ?? "—"} s delay</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Throughput</span>
                  <span className="text-gray-200 font-mono">{metrics?.throughput_veh_per_min?.toFixed(1) ?? "—"} veh/min</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Halting</span>
                  <span className="text-gray-200 font-mono">{metrics?.total_halting ?? "—"}</span>
                </div>
              </div>
            </div>

            {/* Dispatch History */}
            <div className="bg-[#0a1020] border border-[#1a2333] rounded-xl p-5">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
                Dispatch Log
              </h2>
              {dispatchHistory.length === 0 ? (
                <div className="text-gray-600 text-xs text-center py-4">No dispatches yet</div>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800">
                  {dispatchHistory.map((ev, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px] px-2 py-1.5 rounded bg-[#111827]">
                      <span className="text-gray-300">{ev.label}</span>
                      <span className="text-gray-600 font-mono">
                        {new Date(ev.dispatched_at).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
