"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useTrafficStore } from "@/store/trafficStore";

export default function AutonomousAiOpsView() {
  const [riskData, setRiskData] = useState<any>(null);
  const [forecast, setForecast] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [targetJunction, setTargetJunction] = useState("B0");
  const [incidentType, setIncidentType] = useState("COLLISION");
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const activeCity = useTrafficStore((s) => s.activeCityContext);

  // User adjustable AI parameters
  const [sensitivity, setSensitivity] = useState<number>(75); // 0-100%
  const [greenWaveDuration, setGreenWaveDuration] = useState<number>(45); // Seconds
  const [isAutoPilotEnabled, setIsAutoPilotEnabled] = useState<boolean>(true);
  const [vmsAlertMode, setVmsAlertMode] = useState<string>("AUTOMATIC");

  const fetchAiTelemetry = async () => {
    try {
      const [r, f, ev] = await Promise.all([
        api.getRiskAssessment().catch(() => null),
        api.get15MinForecast().catch(() => []),
        api.getEmergencyEvents().catch(() => []),
      ]);
      if (r) setRiskData(r);
      if (f) setForecast(f);
      if (ev) setEvents(ev);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAiTelemetry();
    const interval = setInterval(fetchAiTelemetry, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleMitigate = async () => {
    setLoadingAction(true);
    setActionMsg(null);
    try {
      const res = await api.mitigateEmergency(targetJunction, incidentType);
      setActionMsg(
        `🚨 Autonomous Action Deployed: Isolated ${targetJunction}, forced green flush & published VMS alert!`
      );
      await fetchAiTelemetry();
      setTimeout(() => setActionMsg(null), 6000);
    } catch (err: any) {
      setActionMsg(`⚠ Mitigation error: ${err.message}`);
    } finally {
      setLoadingAction(false);
    }
  };

  const riskScore = riskData?.risk_score ?? 15;
  const riskLevel = riskData?.risk_level ?? "LOW";

  return (
    <div className="h-full overflow-y-auto bg-[#060a10] p-6 text-gray-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-gray-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <h1 className="text-xl font-black text-white font-mono tracking-wider">
              🧠 AUTONOMOUS AI RESILIENCE &amp; RISK MITIGATION
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
              SMART CITY AUTOPILOT
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Proactive spatio-temporal bottleneck forecasting, automated incident mitigation, and dynamic risk containment for {activeCity.cityName}.
          </p>
        </div>

        {/* Quick Adjustable Autopilot Switch */}
        <div className="flex items-center gap-3 bg-[#0d1424] border border-gray-800 p-2 rounded-xl">
          <div className="text-xs font-mono text-gray-300">
            AUTONOMOUS MITIGATION:
          </div>
          <button
            onClick={() => setIsAutoPilotEnabled(!isAutoPilotEnabled)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              isAutoPilotEnabled
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-sm shadow-emerald-500/20"
                : "bg-red-500/20 text-red-400 border border-red-500/50"
            }`}
          >
            {isAutoPilotEnabled ? "● AUTOPILOT ENGAGED" : "○ MANUAL ONLY"}
          </button>
        </div>
      </div>

      {/* Adjustable AI Control Sliders */}
      <div className="mt-6 bg-[#0b1220] border border-gray-800 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-3 gap-6 shadow-lg">
        <div>
          <div className="flex justify-between text-xs font-mono mb-2">
            <span className="text-gray-300">AI Congestion Sensitivity:</span>
            <span className="text-cyan-400 font-bold">{sensitivity}%</span>
          </div>
          <input
            type="range"
            min="20"
            max="100"
            value={sensitivity}
            onChange={(e) => setSensitivity(Number(e.target.value))}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <span className="text-[10px] text-gray-500 mt-1 block">Higher sensitivity triggers preemptive signal changes earlier.</span>
        </div>

        <div>
          <div className="flex justify-between text-xs font-mono mb-2">
            <span className="text-gray-300">Emergency Green Wave Duration:</span>
            <span className="text-emerald-400 font-bold">{greenWaveDuration}s</span>
          </div>
          <input
            type="range"
            min="20"
            max="90"
            step="5"
            value={greenWaveDuration}
            onChange={(e) => setGreenWaveDuration(Number(e.target.value))}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <span className="text-[10px] text-gray-500 mt-1 block">Duration each junction stays locked green for ambulances.</span>
        </div>

        <div>
          <div className="flex justify-between text-xs font-mono mb-2">
            <span className="text-gray-300">VMS Advisory Trigger Mode:</span>
            <span className="text-amber-400 font-bold">{vmsAlertMode}</span>
          </div>
          <div className="flex gap-2">
            {["AUTOMATIC", "ON_CONFIRM", "SILENT"].map((m) => (
              <button
                key={m}
                onClick={() => setVmsAlertMode(m)}
                className={`flex-1 py-1 rounded text-[11px] font-mono border transition-all ${
                  vmsAlertMode === m
                    ? "bg-amber-500/20 border-amber-500/60 text-amber-300 font-bold"
                    : "bg-gray-800/60 border-gray-700 text-gray-400 hover:text-white"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-gray-500 mt-1 block">How roadside signs publish emergency alerts.</span>
        </div>
      </div>

      {actionMsg && (
        <div className="mt-4 p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-xs font-mono">
          {actionMsg}
        </div>
      )}

      {/* Top Cards: Real-Time Risk Score & Active Mitigation */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Risk Gauge Card */}
        <div className="md:col-span-5 bg-[#0a0f1d] border border-gray-800 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">
              Real-Time Network Threat Assessment
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                riskLevel === "CRITICAL"
                  ? "bg-red-500/20 text-red-400 border border-red-500/50"
                  : riskLevel === "ELEVATED"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/50"
                  : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
              }`}
            >
              {riskLevel} THREAT
            </span>
          </div>

          <div className="my-6 flex items-baseline gap-4">
            <span className="text-5xl font-black font-mono text-white tracking-tight">
              {riskScore}
            </span>
            <span className="text-xs font-mono text-gray-500">/ 100 RISK INDEX</span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                riskScore > 65 ? "bg-red-500" : riskScore > 35 ? "bg-amber-400" : "bg-emerald-400"
              }`}
              style={{ width: `${riskScore}%` }}
            />
          </div>

          {/* Active Risk Factors */}
          <div className="mt-4 pt-3 border-t border-gray-800/80 flex flex-wrap gap-1.5">
            <span className="text-[10px] text-gray-500 font-mono">Detected Hazards:</span>
            {riskData?.risk_factors?.length > 0 ? (
              riskData.risk_factors.map((rf: string) => (
                <span
                  key={rf}
                  className="px-2 py-0.5 rounded text-[9px] font-mono bg-[#111927] border border-gray-700 text-cyan-300"
                >
                  {rf}
                </span>
              ))
            ) : (
              <span className="text-[10px] text-emerald-400 font-mono">ALL CORRIDORS NOMINAL</span>
            )}
          </div>
        </div>

        {/* 1-Click Autonomous Emergency Overcoming Launcher */}
        <div className="md:col-span-7 bg-[#0a0f1d] border border-gray-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-2 border-b border-gray-800">
              <span className="text-base">⚡</span>
              <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                Autonomous Emergency Mitigation Override
              </h2>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Inject an incident. The AI Autopilot will immediately isolate the affected approach, adjust upstream metering signals, and dispatch roadside VMS detours.
            </p>
          </div>

          <div className="my-4 grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono text-gray-400 uppercase">Target Junction</label>
              <select
                value={targetJunction}
                onChange={(e) => setTargetJunction(e.target.value)}
                className="mt-1 w-full bg-[#0b1220] border border-gray-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
              >
                {["A0", "A1", "B0", "B1", "C0", "C1"].map((j) => (
                  <option key={j} value={j} className="bg-[#0b1220]">
                    Intersection {j}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono text-gray-400 uppercase">Hazard Type</label>
              <select
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value)}
                className="mt-1 w-full bg-[#0b1220] border border-gray-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="COLLISION">🚨 High-Speed Collision</option>
                <option value="STALLED_VEHICLE">🚚 Stalled Heavy Truck</option>
                <option value="FLOODED_LANE">🌊 Monsoon Waterlogging</option>
                <option value="VIP_CORRIDOR">🚔 VIP / Ambulance Convoy</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleMitigate}
            disabled={loadingAction}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 font-mono font-bold text-xs text-white shadow-lg shadow-red-600/20 transition-all uppercase tracking-wider"
          >
            {loadingAction ? "Deploying Mitigation Protocol..." : "🛡️ Trigger Autonomous AI Mitigation"}
          </button>
        </div>
      </div>

      {/* Spatio-Temporal 15-Minute Congestion Forecast */}
      <div className="mt-6 bg-[#0a0f1d] border border-gray-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-base">📈</span>
            <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              SPATIO-TEMPORAL CONGESTION FORECAST (NEXT 15 MINUTES)
            </h2>
          </div>
          <span className="text-[10px] font-mono text-cyan-400">
            PROACTIVE GREEN SPLIT TUNER
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-5 gap-3">
          {forecast.map((fc: any, idx: number) => (
            <div
              key={idx}
              className="bg-[#070b14] border border-gray-800/80 rounded-xl p-3.5 flex flex-col justify-between font-mono"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-400">{fc.time_horizon}</span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    fc.status === "CONGESTION_SPIKE"
                      ? "bg-red-500/20 text-red-400"
                      : fc.status === "HEAVY_FLOW"
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-emerald-500/20 text-emerald-400"
                  }`}
                >
                  {fc.status}
                </span>
              </div>

              <div className="my-3 space-y-1">
                <div className="text-lg font-black text-white">{fc.predicted_vehicles} <span className="text-[10px] text-gray-500 font-normal">veh</span></div>
                <div className="text-[11px] text-gray-400">Delay: {fc.predicted_avg_delay_s}s</div>
                <div className="text-[10px] text-amber-400">Jam Prob: {fc.bottleneck_probability_pct}%</div>
              </div>

              <div className="pt-2 border-t border-gray-800 text-[9px] text-gray-400">
                Action: <span className="text-cyan-300 font-bold">{fc.recommended_action}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Emergency Event Audit Log */}
      <div className="mt-6 bg-[#0a0f1d] border border-gray-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-2 pb-3 border-b border-gray-800">
          <span className="text-base">📋</span>
          <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
            AUTONOMOUS MITIGATION EVENT TIMELINE
          </h2>
        </div>

        <div className="mt-4 space-y-2.5 font-mono text-xs">
          {events.length > 0 ? (
            events.map((ev: any) => (
              <div
                key={ev.id}
                className="p-3 rounded-xl bg-[#070b14] border border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/40">
                    {ev.incident_type}
                  </span>
                  <span className="text-white font-bold">{ev.junction} ROAD</span>
                  <span className="text-gray-400 text-[11px]">{ev.action_taken}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-gray-500">
                  <span>Detour: <b className="text-cyan-400">{ev.detour_route}</b></span>
                  <span>Time: {ev.timestamp}</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-bold">
                    {ev.status}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-gray-600 text-xs">
              No active emergency interventions recorded. System operating nominal.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
