"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useTrafficStore } from "@/store/trafficStore";

const MAX_LINE_CHARS = 24;

export default function VmsOperationsView() {
  const [boards, setBoards] = useState<any[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<string>("VMS-01");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [line3, setLine3] = useState("");
  const [severity, setSeverity] = useState("INFO");
  const [broadcastMsg, setBroadcastMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [broadcastHistory, setBroadcastHistory] = useState<any[]>([]);
  const activeCity = useTrafficStore((s) => s.activeCityContext);

  const fetchBoards = async () => {
    try {
      const data = await api.getVmsBoards();
      setBoards(data);
      const sel = data.find((b: any) => b.id === selectedBoard) || data[0];
      if (sel && !line1) {
        setLine1(sel.message_line1);
        setLine2(sel.message_line2);
        setLine3(sel.message_line3);
        setSeverity(sel.severity);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchBoards();
  }, []);

  const handleSelectBoard = (b: any) => {
    setSelectedBoard(b.id);
    setLine1(b.message_line1);
    setLine2(b.message_line2);
    setLine3(b.message_line3);
    setSeverity(b.severity);
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setBroadcastMsg(null);
    try {
      await api.broadcastVms({
        vms_id: selectedBoard,
        line1: line1 || " ",
        line2: line2 || " ",
        line3: line3 || " ",
        severity,
      });

      // Add to broadcast history
      setBroadcastHistory((prev) => [
        {
          id: Date.now(),
          board: selectedBoard,
          text: `${line1} | ${line2} | ${line3}`,
          severity,
          time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }),
        },
        ...prev.slice(0, 7),
      ]);

      setBroadcastMsg(`✅ Broadcast successfully published to ${selectedBoard} Roadside LED Signboard!`);
      await fetchBoards();
      setTimeout(() => setBroadcastMsg(null), 5000);
    } catch (err: any) {
      setBroadcastMsg(`⚠ Broadcast failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAdvisory = (l1: string, l2: string, l3: string, sev: string) => {
    setLine1(l1.slice(0, MAX_LINE_CHARS));
    setLine2(l2.slice(0, MAX_LINE_CHARS));
    setLine3(l3.slice(0, MAX_LINE_CHARS));
    setSeverity(sev);
  };

  return (
    <div className="h-full overflow-y-auto bg-[#060a10] p-6 text-gray-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-gray-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <h1 className="text-xl font-black text-white font-mono tracking-wider">
              📟 VARIABLE MESSAGE SIGNS (VMS) CITY BROADCASTER
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
              SMART ROADSIDE LED NETWORK
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Dispatch real-time traveler warnings, congestion alerts, and weather advisories to highway and arterial LED signboards in {activeCity.cityName}.
          </p>
        </div>
      </div>

      {broadcastMsg && (
        <div className="mt-4 p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-mono">
          {broadcastMsg}
        </div>
      )}

      {/* Main Studio Layout */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: VMS Signboard Selector */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
            Network Signboards ({boards.length})
          </div>

          {boards.map((b) => {
            const isSel = b.id === selectedBoard;
            return (
              <div
                key={b.id}
                onClick={() => handleSelectBoard(b)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  isSel
                    ? "bg-[#0c1424] border-cyan-500/50 shadow-lg shadow-cyan-500/10"
                    : "bg-[#0a0f1d] border-gray-800 hover:border-gray-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-white">{b.id}</span>
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    b.severity === "CRITICAL"
                      ? "bg-red-500/20 text-red-400"
                      : b.severity === "WARNING"
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-cyan-500/20 text-cyan-400"
                  }`}>
                    {b.severity}
                  </span>
                </div>
                <div className="text-[11px] text-gray-400 mt-1">{b.location}</div>
                <div className="text-[9px] font-mono text-gray-500 mt-2">Active: {b.last_updated}</div>
              </div>
            );
          })}

          {/* Broadcast History */}
          {broadcastHistory.length > 0 && (
            <div className="mt-6 bg-[#0a0f1d] border border-gray-800 rounded-2xl p-4">
              <div className="text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-2">
                Broadcast History (This Session)
              </div>
              <div className="space-y-2 text-xs">
                {broadcastHistory.map((item) => (
                  <div key={item.id} className="p-2 bg-[#060a12] border border-gray-800/80 rounded-lg font-mono">
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span className="text-cyan-400 font-bold">{item.board}</span>
                      <span>{item.time}</span>
                    </div>
                    <div className="text-gray-300 text-[11px] mt-0.5 truncate">{item.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Live LED Matrix Preview & Dispatch Form */}
        <div className="lg:col-span-8 space-y-6">
          {/* Real-World LED Matrix Canvas */}
          <div className="bg-[#050810] border-4 border-gray-900 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center min-h-[220px]">
            {/* LED Glow overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 to-transparent pointer-events-none" />

            <div className="w-full text-center space-y-2 font-mono font-black tracking-widest uppercase">
              <div className="text-2xl md:text-3xl text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.8)]">
                {line1 || "WELCOME TO SMART CORRIDOR"}
              </div>
              <div className="text-2xl md:text-3xl text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.8)]">
                {line2 || "DRIVE SAFELY · SPEED 50 KM/H"}
              </div>
              <div className={`text-2xl md:text-3xl ${
                severity === "CRITICAL"
                  ? "text-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.9)]"
                  : "text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.8)]"
              }`}>
                {line3 || "AI TRAFFIC FLOW OPTIMIZED"}
              </div>
            </div>

            <div className="absolute bottom-3 right-4 text-[9px] font-mono text-gray-600">
              LED MATRIX 192x64 RGB PIXELS · FIELD VERIFIED
            </div>
          </div>

          {/* Broadcast Controller Form */}
          <form onSubmit={handleBroadcast} className="bg-[#0a0f1d] border border-gray-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-800">
              <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                VMS Dispatch Terminal (Target: {selectedBoard})
              </span>
              <span className="text-[10px] font-mono text-amber-400">Max {MAX_LINE_CHARS} Chars/Line</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-mono text-gray-400 uppercase">Line 1 (Header)</label>
                  <span className={`text-[9px] font-mono ${line1.length > MAX_LINE_CHARS ? "text-red-400" : "text-gray-500"}`}>
                    {line1.length}/{MAX_LINE_CHARS}
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={MAX_LINE_CHARS}
                  value={line1}
                  onChange={(e) => setLine1(e.target.value)}
                  className="w-full bg-[#0b1220] border border-gray-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-mono text-gray-400 uppercase">Line 2 (Condition)</label>
                  <span className={`text-[9px] font-mono ${line2.length > MAX_LINE_CHARS ? "text-red-400" : "text-gray-500"}`}>
                    {line2.length}/{MAX_LINE_CHARS}
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={MAX_LINE_CHARS}
                  value={line2}
                  onChange={(e) => setLine2(e.target.value)}
                  className="w-full bg-[#0b1220] border border-gray-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-mono text-gray-400 uppercase">Line 3 (Action)</label>
                  <span className={`text-[9px] font-mono ${line3.length > MAX_LINE_CHARS ? "text-red-400" : "text-gray-500"}`}>
                    {line3.length}/{MAX_LINE_CHARS}
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={MAX_LINE_CHARS}
                  value={line3}
                  onChange={(e) => setLine3(e.target.value)}
                  className="w-full bg-[#0b1220] border border-gray-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Severity Radio */}
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="text-gray-400 text-[10px] uppercase">Severity:</span>
              {(["INFO", "WARNING", "CRITICAL"] as const).map((sev) => (
                <label key={sev} className="flex items-center gap-1.5 cursor-pointer text-gray-300">
                  <input
                    type="radio"
                    name="severity"
                    value={sev}
                    checked={severity === sev}
                    onChange={(e) => setSeverity(e.target.value)}
                    className="accent-amber-400"
                  />
                  <span>{sev}</span>
                </label>
              ))}
            </div>

            {/* Quick Template Presets */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-800">
              <span className="text-[10px] font-mono text-gray-500 self-center">1-Click Presets:</span>
              <button
                type="button"
                onClick={() => handleQuickAdvisory("DENSE FOG ALERT", "VISIBILITY < 50M", "SPEED LIMIT 30 KM/H", "WARNING")}
                className="px-2.5 py-1 rounded bg-[#0e172a] border border-gray-700 text-[10px] font-mono text-gray-300 hover:text-white hover:border-amber-400"
              >
                🌫️ Fog Warning
              </button>
              <button
                type="button"
                onClick={() => handleQuickAdvisory("CRASH AHEAD AT B0", "LANES 1-2 BLOCKED", "USE RING ROAD DETOUR", "CRITICAL")}
                className="px-2.5 py-1 rounded bg-[#0e172a] border border-gray-700 text-[10px] font-mono text-gray-300 hover:text-white hover:border-red-400"
              >
                🚨 Accident Detour
              </button>
              <button
                type="button"
                onClick={() => handleQuickAdvisory("AMBULANCE CONVOY", "GREEN WAVE CORRIDOR", "PULL OVER TO LEFT", "CRITICAL")}
                className="px-2.5 py-1 rounded bg-[#0e172a] border border-gray-700 text-[10px] font-mono text-gray-300 hover:text-white hover:border-red-400"
              >
                🚑 Emergency Wave
              </button>
              <button
                type="button"
                onClick={() => handleQuickAdvisory("SMART TRAFFIC FLOW", "AI ADAPTIVE SIGNALS", "DRIVE CAREFULLY", "INFO")}
                className="px-2.5 py-1 rounded bg-[#0e172a] border border-gray-700 text-[10px] font-mono text-gray-300 hover:text-white hover:border-cyan-400"
              >
                ✨ Normal Flow
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 font-mono font-bold text-xs text-white shadow-lg shadow-amber-600/20 transition-all uppercase tracking-wider"
            >
              {loading ? "Transmitting to Roadside Controller..." : "📡 Broadcast Message to Field VMS Board"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}