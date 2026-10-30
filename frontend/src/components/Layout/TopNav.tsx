"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTrafficStore } from "@/store/trafficStore";
import { api } from "@/lib/api";
import { trafficWS } from "@/lib/ws";

const CITIES = [
  { name: "New Delhi", lat: 28.6139, lon: 77.2090 },
  { name: "Mumbai", lat: 19.0760, lon: 72.8777 },
  { name: "Bengaluru", lat: 12.9716, lon: 77.5946 },
  { name: "London", lat: 51.5074, lon: -0.1278 },
  { name: "New York", lat: 40.7128, lon: -74.0060 },
];

const TABS = [
  { label: "Dashboard", href: "/" },
  { label: "AI Policy", href: "/policy" },
  { label: "Simulation Lab", href: "/lab" },
];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function TopNav() {
  const pathname = usePathname();
  const status = useTrafficStore((s) => s.status);
  const simTime = useTrafficStore((s) => s.simTime);
  const mode = useTrafficStore((s) => s.mode);
  const wsConnected = useTrafficStore((s) => s.wsConnected);
  const setWsConnected = useTrafficStore((s) => s.setWsConnected);
  const activeCityContext = useTrafficStore((s) => s.activeCityContext);
  const setActiveCityContext = useTrafficStore((s) => s.setActiveCityContext);

  const [clock, setClock] = useState<string>("");
  const [navSearch, setNavSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [showReconnectBanner, setShowReconnectBanner] = useState(false);

  // ── Live clock ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString("en-US", { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── WebSocket reconnection banner ───────────────────────────────────────────
  useEffect(() => {
    const unsub = trafficWS.onStatus((connected) => {
      setWsConnected(connected);
      if (!connected) {
        setShowReconnectBanner(true);
      } else {
        // Hide banner after 3s when reconnected
        setTimeout(() => setShowReconnectBanner(false), 3000);
      }
    });
    return () => unsub();
  }, [setWsConnected]);

  const handleGlobalSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!navSearch.trim() || searching) return;
    setSearching(true);
    try {
      const geo = await api.searchLocation(navSearch.trim());
      const [w, a, osm] = await Promise.all([
        api.getLiveWeather(),
        api.getLiveAirQuality(),
        api.getOsmJunctions(),
      ]);

      setActiveCityContext({
        cityName: geo.city,
        fullName: geo.full_name,
        lat: geo.lat,
        lon: geo.lon,
        temperatureC: w.temperature_c,
        weatherCondition: w.condition,
        roadStatus: w.road_status,
        aqiIndex: a.aqi_index,
        pm25: a.pm2_5_ug_m3,
        signalsCount: osm.total_signals_detected || 6,
      });
      setNavSearch("");
    } catch (err) {
      console.error("Global search failed:", err);
    } finally {
      setSearching(false);
    }
  };

  const handleCitySelect = async (cityName: string) => {
    const c = CITIES.find((x) => x.name === cityName);
    if (!c) return;
    try {
      await api.changeCity(c.name, c.lat, c.lon);
      const [w, a, osm] = await Promise.all([
        api.getLiveWeather(),
        api.getLiveAirQuality(),
        api.getOsmJunctions(),
      ]);
      setActiveCityContext({
        cityName: c.name,
        fullName: `${c.name}, Metropolitan Corridor`,
        lat: c.lat,
        lon: c.lon,
        temperatureC: w.temperature_c,
        weatherCondition: w.condition,
        roadStatus: w.road_status,
        aqiIndex: a.aqi_index,
        pm25: a.pm2_5_ug_m3,
        signalsCount: osm.total_signals_detected || 6,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const statusColor =
    status === "running" ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" :
    status === "paused"  ? "bg-amber-400" :
    "bg-gray-600";

  const statusText =
    status === "running" ? `RUNNING · ${formatTime(simTime)}` :
    status === "paused"  ? `PAUSED · ${formatTime(simTime)}` :
    "STANDBY";

  return (
    <div className="flex-shrink-0">
      {/* ── Reconnection Warning Banner ─────────────────────────────────────── */}
      {showReconnectBanner && (
        <div className={`w-full flex items-center justify-center gap-3 px-4 py-1.5 text-[11px] font-mono transition-all ${
          wsConnected
            ? "bg-emerald-900/80 border-b border-emerald-700/50 text-emerald-300"
            : "bg-red-900/80 border-b border-red-700/50 text-red-200 animate-pulse"
        }`}>
          {wsConnected ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              ✅ Backend se live telemetry connection restore ho gaya — ATMS fully operational
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
              ⚠️ ATMS Backend se connection toot gaya — Automatically reconnect ho raha hai... (Local Rule Engine active)
              <button
                onClick={() => trafficWS.connect()}
                className="px-2 py-0.5 rounded bg-red-700/60 hover:bg-red-600/60 text-white text-[10px] border border-red-600/40 ml-2"
              >
                🔄 Abhi Retry
              </button>
            </>
          )}
        </div>
      )}

      <nav className="h-12 flex-shrink-0 bg-[#090d16] border-b border-gray-800/80 flex items-center px-4 gap-4 select-none">
      <Link href="/" className="flex items-center gap-2 mr-2 hover:opacity-80 transition-opacity">
        <div className="w-2.5 h-2.5 rounded-sm bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
        <span className="text-[13px] font-black text-white font-mono tracking-wider">
          AI TRAFFIC <span className="text-blue-400 font-normal">TOC</span>
        </span>
      </Link>

      <div className="flex h-full">
        {TABS.map(({ label, href }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`px-3.5 flex items-center text-xs font-medium border-b-2 transition-all ${
                active
                  ? "text-blue-400 border-blue-500 bg-blue-500/10 font-semibold"
                  : "text-gray-400 border-transparent hover:text-gray-200 hover:bg-gray-800/40"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-2">
      {/* Universal Real-Time Global Location Search Bar & Geolocation Auto-detect */}
      <div className="flex items-center gap-1.5">
        <form onSubmit={handleGlobalSearch} className="relative flex items-center">
          <input
            type="text"
            placeholder="Search location (e.g. Dubai, London, New York)..."
            value={navSearch}
            onChange={(e) => setNavSearch(e.target.value)}
            className="w-48 md:w-56 bg-[#0a1020] border border-cyan-500/30 rounded-lg pl-7 pr-3 py-1 text-[11px] text-white placeholder-gray-500 font-mono focus:outline-none focus:border-cyan-400 focus:w-64 transition-all shadow-inner"
          />
          <span className="absolute left-2 text-[10px] text-gray-500">
            {searching ? "⟳" : "🔍"}
          </span>
        </form>

        {/* Browser GPS Geolocation Auto-Detect Button */}
        <button
          type="button"
          onClick={() => {
            if ("geolocation" in navigator) {
              navigator.geolocation.getCurrentPosition(
                async (pos) => {
                  const { latitude, longitude } = pos.coords;
                  try {
                    await api.changeCity("My Current Location", latitude, longitude);
                    const [w, a] = await Promise.all([
                      api.getLiveWeather(),
                      api.getLiveAirQuality(),
                    ]);
                    setActiveCityContext({
                      cityName: "Local Geolocation",
                      fullName: `Detected: Lat ${latitude.toFixed(2)}, Lon ${longitude.toFixed(2)}`,
                      lat: latitude,
                      lon: longitude,
                      temperatureC: w.temperature_c,
                      weatherCondition: w.condition,
                      roadStatus: w.road_status,
                      aqiIndex: a.aqi_index,
                      pm25: a.pm2_5_ug_m3,
                      signalsCount: 6,
                    });
                  } catch (e) {
                    console.error("GPS fetch error:", e);
                  }
                },
                (err) => {
                  alert("GPS Location access denied or unavailable: " + err.message);
                }
              );
            } else {
              alert("Geolocation is not supported by your browser.");
            }
          }}
          className="px-2 py-1 bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/40 rounded text-[10px] font-mono text-cyan-300 flex items-center gap-1 transition-colors"
          title="Detect my real-time GPS location"
        >
          <span>🎯</span>
          <span className="hidden sm:inline">GPS Auto-Detect</span>
        </button>
      </div>

        {/* Real-World Digital Twin City & Meteorological Pill */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0b1324] border border-cyan-500/30 text-[10px] font-mono shadow-[0_0_10px_rgba(6,182,212,0.1)]">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <select
            value={activeCityContext.cityName}
            onChange={(e) => handleCitySelect(e.target.value)}
            className="bg-transparent text-cyan-300 font-bold outline-none cursor-pointer text-[10px]"
          >
            {CITIES.map((c) => (
              <option key={c.name} value={c.name} className="bg-[#0b1324] text-white">
                📍 {c.name.toUpperCase()}
              </option>
            ))}
            {!CITIES.some((c) => c.name === activeCityContext.cityName) && (
              <option value={activeCityContext.cityName} className="bg-[#0b1324] text-white">
                📍 {activeCityContext.cityName.toUpperCase()}
              </option>
            )}
          </select>
          <span className="text-gray-600">|</span>
          <span className="text-gray-300">
            {activeCityContext.temperatureC}°C · {activeCityContext.weatherCondition.toUpperCase()}
          </span>
          <span className="text-gray-600">|</span>
          <span
            className={`font-bold ${
              activeCityContext.aqiIndex > 75
                ? "text-red-400"
                : activeCityContext.aqiIndex > 50
                ? "text-amber-400"
                : "text-emerald-400"
            }`}
            title={`PM2.5: ${activeCityContext.pm25} µg/m³`}
          >
            AQI {activeCityContext.aqiIndex}
          </span>
        </div>

        {/* Real-time System Clock */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0f172a] border border-gray-800 text-[11px] font-mono text-gray-300">
          <span className="text-gray-500">UTC/LCL:</span>
          <span>{clock || "--:--:--"}</span>
        </div>

        {/* Real Simulation Engine Status */}
        <div className="flex items-center gap-2 bg-[#0d1424] border border-gray-800 rounded-full px-3 py-1">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColor}`} />
          <span className="text-[11px] font-mono text-gray-300">{statusText}</span>
        </div>

        {/* Execution Mode */}
        <div className="bg-[#1e293b] border border-gray-700/60 rounded px-2 py-0.5 text-[10px] text-gray-300 font-mono font-bold tracking-wide">
          {mode.toUpperCase()}
        </div>

        {/* Live WebSocket Bridge Indicator */}
        <div
          title={wsConnected ? "Telemetry Stream: Online" : "Telemetry Stream: Offline — Reconnecting..."}
          className="flex items-center gap-1.5 text-[10px] font-mono text-gray-400 bg-[#0f172a] px-2 py-1 rounded border border-gray-800 cursor-pointer"
          onClick={() => { if (!wsConnected) trafficWS.connect(); }}
        >
          <div className={`w-2 h-2 rounded-full ${wsConnected ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" : "bg-red-500 animate-ping"}`} />
          <span>{wsConnected ? "WS LIVE" : "RECONNECTING"}</span>
        </div>
      </div>
    </nav>
    </div>
  );
}
