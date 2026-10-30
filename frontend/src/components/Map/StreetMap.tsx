"use client";

import { useEffect, useRef, useState } from "react";
import { useTrafficStore } from "@/store/trafficStore";
import { api } from "@/lib/api";
import SumoGrid from "./SumoGrid";
import HighwayMeterMap from "./HighwayMeterMap";
import CombinedMap from "./CombinedMap";
import RealCityMap from "./RealCityMap";
import { Layers, Globe } from "lucide-react";

const LEGEND = [
  { color: "#22c55e", label: "Low" },
  { color: "#eab308", label: "Moderate" },
  { color: "#f97316", label: "High" },
  { color: "#ef4444", label: "Critical" },
];

export default function StreetMap() {
  const selectIntersection = useTrafficStore((s) => s.selectIntersection);
  const network = useTrafficStore((s) => s.network);
  const activeCityContext = useTrafficStore((s) => s.activeCityContext);
  const [showHeat, setShowHeat] = useState(true);
  const [viewMode, setViewMode] = useState<"2d" | "earth">("earth");
  const [weather, setWeather] = useState<"clear" | "rain" | "fog" | "night">("clear");
  const [incidentActive, setIncidentActive] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panPos, setPanPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Native Non-Passive Wheel Event Listener
  // React's onWheel in synthetic event is passive by default in modern Chrome/Edge,
  // which causes e.preventDefault() to fail intermittently and trigger browser zoom.
  // Using active addEventListener({ passive: false }) permanently locks browser zoom!
  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;

    const onWheelHandler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const zoomDelta = e.deltaY < 0 ? 0.08 : -0.08;
      setZoomLevel((prev) => Math.min(2.5, Math.max(0.7, +(prev + zoomDelta).toFixed(2))));
    };

    el.addEventListener("wheel", onWheelHandler, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheelHandler);
    };
  }, []);

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.min(2.5, Math.max(0.7, +(prev + delta).toFixed(1))));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setPanPos({ x: 0, y: 0 });
  };

  const handleWeatherChange = async (w: "clear" | "rain" | "fog" | "night") => {
    setWeather(w);
    try {
      await api.setWeather(w);
    } catch (e) {
      console.error("Failed to update weather", e);
    }
  };

  const handleToggleIncident = async () => {
    try {
      if (!incidentActive) {
        await api.injectIncident("B0C0", 0, 60);
        setIncidentActive(true);
      } else {
        await api.clearIncident("B0C0", 0);
        setIncidentActive(false);
      }
    } catch (e) {
      console.error("Incident toggle failed", e);
    }
  };

  // Each map is hand-tuned to a specific viewBox aspect:
  //   arterial → 1500x600 (5:2), stretched to fill the screen
  //   highway  →  900x600 (3:2), preserveAspectRatio="meet" handles fit
  //   combined → 2500x600 (~25:6), highway and grid side-by-side
  const viewBox =
    network === "arterial"        ? "0 0 1500 600" :
    network === "highway_metered" ? "0 0 900 600"  :
                                    "0 0 2500 700";  // combined (wider corridor)
  const aspectMode = network === "arterial" ? "none" : "xMidYMid meet";

  if (viewMode === "earth") {
    return (
      <div className="w-full h-full relative overflow-hidden select-none bg-slate-950">
        <RealCityMap />

        {/* Floating 2D / Real Google Earth Switch Overlay */}
        <div className="absolute top-3 left-3 z-30 flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[#0b101c]/90 border border-emerald-500/50 rounded-xl p-1 backdrop-blur-md shadow-2xl">
            <button
              onClick={() => setViewMode("earth")}
              className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-lg shadow-emerald-500/20"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              Real Google Earth 3D
            </button>
            <button
              onClick={() => setViewMode("2d")}
              className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all text-slate-400 hover:text-white"
            >
              <Layers className="w-3.5 h-3.5" />
              2D Tactical Grid
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-full relative overflow-hidden select-none"
    >
      {/* 2D / Real Earth Switch in 2D Mode */}
      <div className="absolute top-3 left-3 z-30 flex items-center gap-2">
        <div className="flex items-center gap-1 bg-[#0b101c]/90 border border-gray-800 rounded-xl p-1 backdrop-blur-md shadow-2xl">
          <button
            onClick={() => setViewMode("earth")}
            className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all text-gray-400 hover:text-emerald-300"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            Real Google Earth 3D
          </button>
          <button
            onClick={() => setViewMode("2d")}
            className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all bg-blue-600/30 text-blue-300 border border-blue-500/50 shadow-sm"
          >
            <Layers className="w-3.5 h-3.5" />
            2D Tactical Grid
          </button>
        </div>
      </div>
      {/* Dynamic Environmental Overlays */}
      {weather === "rain" && (
        <div className="absolute inset-0 pointer-events-none z-10 bg-blue-950/20 backdrop-blur-[0.5px] animate-pulse" />
      )}
      {weather === "fog" && (
        <div className="absolute inset-0 pointer-events-none z-10 bg-slate-300/15 backdrop-blur-[1.5px]" />
      )}
      {weather === "night" && (
        <div className="absolute inset-0 pointer-events-none z-10 bg-indigo-950/40 mix-blend-multiply" />
      )}

      <svg
        viewBox={viewBox}
        preserveAspectRatio={aspectMode}
        className="w-full h-full transition-transform duration-200"
        style={{
          background: weather === "night" ? "#04060a" : weather === "fog" ? "#0f141f" : "#0a0e16",
          transform: `scale(${zoomLevel}) translate(${panPos.x}px, ${panPos.y}px)`,
          transformOrigin: "center center",
        }}
        onClick={() => selectIntersection(null)}
      >
        {network === "highway_metered" ? (
          <HighwayMeterMap showHeat={showHeat} />
        ) : network === "combined" ? (
          <CombinedMap showHeat={showHeat} />
        ) : (
          <SumoGrid showHeat={showHeat} />
        )}
      </svg>

      {/* Top Floating Control Bar: Weather & Incident Simulator */}
      <div className="absolute top-3 left-3 z-20 hidden md:flex items-center gap-2 bg-[#090e1a]/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-gray-800 text-[10px] font-mono shadow-xl">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
        <span className="text-gray-300 font-bold">
          📍 {activeCityContext.cityName.toUpperCase()} DIGITAL TWIN
        </span>
        <span className="text-gray-600">|</span>
        <span className="text-gray-400">
          GPS: {activeCityContext.lat.toFixed(2)}°N, {activeCityContext.lon.toFixed(2)}°E
        </span>
        <span className="text-gray-600">|</span>
        <span className="text-cyan-300 font-semibold">{activeCityContext.roadStatus}</span>
      </div>

      <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
        {/* Dynamic Weather Engine Selector */}
        <div className="flex items-center gap-1 bg-[#0b101c]/90 border border-gray-800 rounded-lg p-1 backdrop-blur-sm shadow-lg">
          {(["clear", "rain", "fog", "night"] as const).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => handleWeatherChange(w)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono capitalize transition-all ${
                weather === w
                  ? "bg-blue-600/30 text-blue-300 border border-blue-500/50 font-bold shadow-sm"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {w === "clear" ? "☀️ Clear" : w === "rain" ? "🌧️ Rain" : w === "fog" ? "🌫️ Fog" : "🌙 Night"}
            </button>
          ))}
        </div>

        {/* Coordinated Green Wave speed indicator */}
        <div className="flex items-center gap-1.5 bg-[#0b101c]/90 border border-emerald-500/30 rounded-lg px-2.5 py-1 text-[10px] font-mono shadow-lg text-emerald-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-bold">AI GREEN WAVE</span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-300">50 KM/H</span>
        </div>

        {/* 1-Click Road Incident Simulator */}
        <button
          type="button"
          onClick={handleToggleIncident}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-mono font-bold transition-all shadow-lg ${
            incidentActive
              ? "bg-red-950/80 border-red-500 text-red-200 animate-pulse"
              : "bg-[#0b101c]/90 border-gray-800 text-gray-300 hover:border-red-500/50 hover:text-red-300"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${incidentActive ? "bg-red-400 shadow-[0_0_8px_#ef4444]" : "bg-gray-500"}`} />
          {incidentActive ? "⚠️ CLEAR CRASH (B0-C0)" : "⚡ SIMULATE CRASH"}
        </button>

        {/* Heatmap toggle */}
        <button
          onClick={() => setShowHeat((v) => !v)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-medium transition-colors shadow-lg ${
            showHeat
              ? "bg-[#1a1332]/90 border-[#4c3080] text-purple-300 hover:bg-[#241748]"
              : "bg-[#0b101c]/90 border-gray-800 text-gray-500 hover:text-gray-300"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${showHeat ? "bg-purple-400" : "bg-gray-600"}`} />
          Heatmap
        </button>
      </div>

      {/* Legend & Zoom Controls — bottom overlay */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2">
        {showHeat && (
          <div className="flex items-center gap-3 bg-[#0a0e16]/90 border border-gray-800 rounded-lg px-2.5 py-1.5 backdrop-blur-sm shadow-md">
            {LEGEND.map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-sm flex-shrink-0"
                  style={{ background: color, opacity: 0.85 }}
                />
                <span className="text-[9px] text-gray-400 font-mono">{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Dedicated Canvas Zoom In / Out / Reset Controls (Does NOT zoom whole browser dashboard) */}
        <div className="flex items-center gap-1 bg-[#0a0e16]/90 border border-gray-800 rounded-lg p-1 backdrop-blur-sm shadow-md font-mono text-xs">
          <button
            onClick={() => handleZoom(0.2)}
            className="w-6 h-6 flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-gray-200 rounded"
            title="Zoom In Traffic Canvas"
          >
            +
          </button>
          <span className="text-[10px] text-gray-400 px-1 font-bold">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            onClick={() => handleZoom(-0.2)}
            className="w-6 h-6 flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-gray-200 rounded"
            title="Zoom Out Traffic Canvas"
          >
            -
          </button>
          <button
            onClick={handleResetZoom}
            className="text-[9px] text-cyan-400 hover:text-cyan-300 px-1.5 py-0.5 rounded bg-gray-900 border border-gray-800 ml-0.5"
            title="Reset Canvas View"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Map Pan / Zoom quick hint */}
      <div className="absolute bottom-3 right-3 z-10 bg-[#0a0e16]/80 border border-gray-800/80 rounded px-2 py-1 text-[9px] text-gray-500 font-mono">
        💡 Click on any junction (A0, B1, etc.) for live signal phases
      </div>
    </div>
  );
}
