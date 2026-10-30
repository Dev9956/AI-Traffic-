"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useTrafficStore } from "@/store/trafficStore";

const JUNCTIONS = ["A0", "A1", "B0", "B1", "C0", "C1"];

export default function IntersectionSignalHub() {
  const [selectedJunction, setSelectedJunction] = useState("A0");
  const [cabinet, setCabinet] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [overrideMsg, setOverrideMsg] = useState<string | null>(null);
  const [overrideLog, setOverrideLog] = useState<any[]>([]);
  const activeCity = useTrafficStore((s) => s.activeCityContext);

  const fetchCabinet = async (jid: string) => {
    try {
      const data = await api.getCabinet(jid);
      setCabinet(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchCabinet(selectedJunction);
    const interval = setInterval(() => {
      fetchCabinet(selectedJunction);
    }, 2000);
    return () => clearInterval(interval);
  }, [selectedJunction]);

  const handlePoliceOverride = async (mode: string, targetJunction = selectedJunction) => {
    try {
      const res = await api.policeOverride(targetJunction, mode as any);
      const timeStr = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
      setOverrideMsg(`⚡ Mode Applied: ${mode} on ${targetJunction} Controller`);
      setOverrideLog((prev) => [
        { id: Date.now(), junction: targetJunction, mode, time: timeStr },
        ...prev.slice(0, 5),
      ]);
      setCabinet((prev: any) => ({
        ...prev,
        signal_heads: res.signal_heads,
      }));
      setTimeout(() => setOverrideMsg(null), 4000);
    } catch (err: any) {
      setOverrideMsg(`⚠ Override failed: ${err.message}`);
    }
  };

  const handleBulkOverride = async (mode: string) => {
    if (!window.confirm(`Kya aap sabhi ${JUNCTIONS.length} junctions par '${mode}' apply karna chahte hain?`)) return;
    for (const jid of JUNCTIONS) {
      try {
        await api.policeOverride(jid, mode as any);
      } catch {}
    }
    setOverrideMsg(`🚨 BULK OVERRIDE: '${mode}' applied to ALL ${JUNCTIONS.length} junctions!`);
    fetchCabinet(selectedJunction);
    setTimeout(() => setOverrideMsg(null), 5000);
  };

  return (
    <div className="h-full overflow-y-auto bg-[#060a10] p-6 text-gray-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-gray-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h1 className="text-xl font-black text-white font-mono tracking-wider">
              🚦 4-WAY PHYSICAL SIGNAL HEAD &amp; NTCIP GATEWAY
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
              FIELD HARDWARE INSPECTOR
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Real-time optical aspects (Red, Amber, Green), conflict monitor interlocks, sub-surface inductive loops, and manual police overrides for {activeCity.cityName}.
          </p>
        </div>

        {/* Junction Switcher */}
        <div className="flex items-center gap-1.5 bg-[#0b1322] border border-gray-800 p-1 rounded-xl">
          {JUNCTIONS.map((jid) => (
            <button
              key={jid}
              onClick={() => setSelectedJunction(jid)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                selectedJunction === jid
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              {jid}
            </button>
          ))}
        </div>
      </div>

      {overrideMsg && (
        <div className="mt-4 p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-mono">
          {overrideMsg}
        </div>
      )}

      {/* Optical Signal Heads 4-Way Visualization */}
      {cabinet?.signal_heads && (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cabinet.signal_heads.map((head: any) => {
            const isRed = head.aspect === "RED";
            const isAmber = head.aspect === "AMBER";
            const isGreen = head.aspect === "GREEN";

            return (
              <div
                key={head.approach}
                className="bg-[#0a0f1d] border border-gray-800 rounded-2xl p-4 flex flex-col items-center shadow-xl relative overflow-hidden"
              >
                <div className="w-full flex items-center justify-between pb-2 mb-3 border-b border-gray-800/80">
                  <span className="text-xs font-mono font-bold text-white tracking-wider">
                    {head.approach} APPROACH
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">
                    Phase #{head.phase_id ?? "1"}
                  </span>
                </div>

                {/* 3-Aspect Traffic Light Pole */}
                <div className="bg-[#111827] border-2 border-gray-700 rounded-2xl p-3 flex flex-col gap-3 shadow-inner my-2">
                  {/* RED */}
                  <div
                    className={`w-12 h-12 rounded-full border border-red-950 flex items-center justify-center transition-all duration-300 ${
                      isRed
                        ? "bg-red-500 shadow-[0_0_24px_rgba(239,68,68,0.9)] border-red-300"
                        : "bg-red-950/40 opacity-40"
                    }`}
                  >
                    <span className="text-[10px] font-mono font-bold text-red-100">
                      {isRed ? `${head.countdown_s || 15}s` : ""}
                    </span>
                  </div>

                  {/* AMBER */}
                  <div
                    className={`w-12 h-12 rounded-full border border-amber-950 flex items-center justify-center transition-all duration-300 ${
                      isAmber
                        ? "bg-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.9)] border-amber-200"
                        : "bg-amber-950/40 opacity-40"
                    }`}
                  >
                    <span className="text-[10px] font-mono font-bold text-amber-900">
                      {isAmber ? "3s" : ""}
                    </span>
                  </div>

                  {/* GREEN */}
                  <div
                    className={`w-12 h-12 rounded-full border border-emerald-950 flex items-center justify-center transition-all duration-300 ${
                      isGreen
                        ? "bg-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.9)] border-emerald-200"
                        : "bg-emerald-950/40 opacity-40"
                    }`}
                  >
                    <span className="text-[10px] font-mono font-bold text-emerald-950">
                      {isGreen ? `${head.countdown_s || 30}s` : ""}
                    </span>
                  </div>
                </div>

                {/* Pedestrian Crossing Module */}
                <div className="w-full bg-[#070b14] border border-gray-800 rounded-xl p-2.5 flex items-center justify-between text-xs font-mono mt-3">
                  <span className="text-gray-500 text-[10px]">PEDESTRIAN:</span>
                  <span className={`font-bold flex items-center gap-1 ${
                    head.pedestrian === "CROSS" ? "text-emerald-400" : "text-red-400"
                  }`}>
                    {head.pedestrian === "CROSS" ? "🚶 WALK" : "🛑 DON'T WALK"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Section: Police Override Controls & Inductive Loops Telemetry */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Police Key Override Panel */}
        <div className="bg-[#0a0f1d] border border-gray-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <span className="text-sm">👮</span>
              <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                MANUAL POLICE OVERRIDE PANEL ({selectedJunction})
              </h2>
            </div>
            <span className="text-[10px] font-mono text-emerald-400">NTCIP 1202 v2</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handlePoliceOverride("ALL_RED")}
              className="py-3 px-3 rounded-xl bg-red-600/20 border border-red-500/50 hover:bg-red-600 hover:text-white text-red-300 font-mono font-bold text-xs transition-all shadow-lg active:scale-95"
            >
              🛑 ALL-RED FLUSH
            </button>
            <button
              onClick={() => handlePoliceOverride("FORCE_NORTH_SOUTH")}
              className="py-3 px-3 rounded-xl bg-blue-600/20 border border-blue-500/50 hover:bg-blue-600 hover:text-white text-blue-300 font-mono font-bold text-xs transition-all shadow-lg active:scale-95"
            >
              🟢 FORCE N-S GREEN
            </button>
            <button
              onClick={() => handlePoliceOverride("FORCE_EAST_WEST")}
              className="py-3 px-3 rounded-xl bg-blue-600/20 border border-blue-500/50 hover:bg-blue-600 hover:text-white text-blue-300 font-mono font-bold text-xs transition-all shadow-lg active:scale-95"
            >
              🟢 FORCE E-W GREEN
            </button>
            <button
              onClick={() => handlePoliceOverride("RESUME_AI_AUTO")}
              className="py-3 px-3 rounded-xl bg-emerald-600/20 border border-emerald-500/50 hover:bg-emerald-600 hover:text-white text-emerald-300 font-mono font-bold text-xs transition-all shadow-lg active:scale-95"
            >
              🧠 RESUME AI AUTO
            </button>
          </div>

          {/* Bulk Controls */}
          <div className="pt-2 border-t border-gray-800/80">
            <div className="text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-2">
              🚨 City-Wide Bulk Overrides (All 6 Junctions)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleBulkOverride("ALL_RED")}
                className="flex-1 py-2 px-2 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-700/50 text-red-300 font-mono text-[11px] font-bold transition-all"
              >
                🛑 City All-Red
              </button>
              <button
                onClick={() => handleBulkOverride("RESUME_AI_AUTO")}
                className="flex-1 py-2 px-2 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-700/50 text-emerald-300 font-mono text-[11px] font-bold transition-all"
              >
                🧠 City AI Auto
              </button>
            </div>
          </div>

          {/* Override History */}
          {overrideLog.length > 0 && (
            <div className="pt-2 border-t border-gray-800/80 text-[10px] font-mono space-y-1">
              <div className="text-gray-500 uppercase">Recent Overrides:</div>
              {overrideLog.map((log) => (
                <div key={log.id} className="flex justify-between text-gray-400 bg-[#070b14] px-2 py-1 rounded">
                  <span className="text-blue-400 font-bold">{log.junction}</span>
                  <span className="text-amber-300">{log.mode}</span>
                  <span className="text-gray-500">{log.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sub-Surface Inductive Loops Telemetry */}
        <div className="bg-[#0a0f1d] border border-gray-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-800">
            <span className="text-sm">🧲</span>
            <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              SUB-SURFACE INDUCTIVE LOOP WIRE SENSORS ({selectedJunction})
            </h2>
          </div>

          {cabinet?.inductive_loops && (
            <div className="space-y-2.5 font-mono text-xs">
              {cabinet.inductive_loops.map((loop: any) => (
                <div key={loop.lane_id} className="p-2.5 rounded-xl bg-[#070b14] border border-gray-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-gray-200 font-semibold">{loop.lane_id}</span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px]">
                    <span className="text-gray-500">Occ: <b className="text-cyan-400">{loop.occupancy_pct}%</b></span>
                    <span className="text-gray-500">Flow: <b className="text-white">{loop.vehicles_per_min} v/min</b></span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800">HEALTHY</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}