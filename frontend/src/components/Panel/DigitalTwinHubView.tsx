"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useTrafficStore } from "@/store/trafficStore";
import GeoLocationMapView from "@/components/Map/GeoLocationMapView";

const CITIES = [
  { name: "New Delhi", lat: 28.6139, lon: 77.2090, desc: "Central Smart City Traffic Corridor (CP)" },
  { name: "Mumbai", lat: 19.0760, lon: 72.8777, desc: "Bandra-Kurla Complex Arterial Ring" },
  { name: "Bengaluru", lat: 12.9716, lon: 77.5946, desc: "Silk Board & Outer Ring Road Grid" },
  { name: "London", lat: 51.5074, lon: -0.1278, desc: "TfL Congestion Charging Zone" },
  { name: "New York", lat: 40.7128, lon: -74.0060, desc: "Manhattan Grid Network" },
];

export default function DigitalTwinHubView() {
  const activeCityContext = useTrafficStore((s) => s.activeCityContext);
  const setActiveCityContext = useTrafficStore((s) => s.setActiveCityContext);

  const [weather, setWeather] = useState<any>(null);
  const [air, setAir] = useState<any>(null);
  const [osm, setOsm] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);

  const loadCityData = async (lat: number, lon: number, cityName: string) => {
    setLoading(true);
    setSyncMsg(null);
    try {
      await api.changeCity(cityName, lat, lon);
      const [w, a, o] = await Promise.all([
        api.getLiveWeather(),
        api.getLiveAirQuality(),
        api.getOsmJunctions(),
      ]);
      setWeather(w);
      setAir(a);
      setOsm(o);
      setActiveCityContext({
        cityName,
        lat,
        lon,
        temperatureC: w.temperature_c,
        weatherCondition: w.condition,
        roadStatus: w.road_status,
        aqiIndex: a.aqi_index,
        pm25: a.pm2_5_ug_m3,
        signalsCount: o.total_signals_detected || 6,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCityData(activeCityContext.lat, activeCityContext.lon, activeCityContext.cityName);
  }, [activeCityContext.cityName]);

  const handleCitySelect = (c: typeof CITIES[0]) => {
    loadCityData(c.lat, c.lon, c.name);
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true);
    setSearchError(null);
    try {
      const res = await api.searchLocation(searchQuery.trim());
      await loadCityData(res.lat, res.lon, res.city);
      setSearchQuery("");
    } catch (err: any) {
      setSearchError(err.message || "Location not found.");
      setLoading(false);
    }
  };

  const handleSyncToSimulation = async () => {
    setSyncing(true);
    try {
      const res = await api.syncLiveEnvironmentToSim();
      setSyncMsg(
        `✅ Synced live weather (${res.live_condition}) to simulation! Speed factor ${res.applied_speed_factor} applied to ${res.vehicles_adapted} vehicles.`
      );
    } catch (e: any) {
      setSyncMsg(`⚠ Sync failed: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#060a10] p-6 text-gray-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-gray-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <h1 className="text-xl font-black text-white font-mono tracking-wider">
              REAL-WORLD DIGITAL TWIN HUB
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
              OPEN-DATA LIVE FEED
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Live real-world meteorology (Open-Meteo), air quality ground stations (OpenAQ), and OpenStreetMap junction networks.
          </p>
        </div>

        {/* Sync Button */}
        <button
          onClick={handleSyncToSimulation}
          disabled={syncing || loading}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 font-bold text-xs text-white shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition-all flex items-center gap-2"
        >
          {syncing ? "🔄 Syncing Physics..." : "⚡ Sync Real Weather to Sim"}
        </button>
      </div>

      {syncMsg && (
        <div className="mt-4 p-3 rounded-lg bg-cyan-950/40 border border-cyan-500/40 text-cyan-300 text-xs font-mono">
          {syncMsg}
        </div>
      )}

      {/* Global Location Search & Quick Switcher */}
      <div className="mt-6 flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        {/* Custom Global Search */}
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Search ANY city, coordinates or place in the world (e.g. Dubai, Tokyo, Jaipur)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0b1220] border border-gray-700/80 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition-colors font-mono"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 font-bold text-xs text-white shadow-md shadow-cyan-600/20 transition-all font-mono whitespace-nowrap"
          >
            Locate &amp; Pull Real Data
          </button>
        </form>
      </div>

      {searchError && (
        <div className="mt-2 text-xs text-red-400 font-mono">
          ⚠ {searchError}
        </div>
      )}

      {/* Preset Quick Cities */}
      <div className="mt-4 flex flex-wrap gap-2 items-center">
        <span className="text-[10px] text-gray-500 uppercase font-mono mr-1">Quick Hubs:</span>
        {CITIES.map((c) => {
          const isSel = activeCityContext.cityName === c.name;
          return (
            <button
              key={c.name}
              onClick={() => handleCitySelect(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                isSel
                  ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-sm shadow-cyan-500/10"
                  : "bg-[#0b1220] border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700"
              }`}
            >
              📍 {c.name}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="mt-12 text-center text-gray-500 text-sm">
          <span className="animate-spin inline-block mr-2">⟳</span> Fetching live satellite & ground station telemetry...
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Live Meteorological Station */}
          <div className="bg-[#0a0f1d] border border-gray-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl -mr-10 -mt-10" />
            <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-3 flex items-center justify-between">
              <span>🌦️ Live Meteorology</span>
              <span className="px-1.5 py-0.5 rounded text-[8px] bg-cyan-950 text-cyan-400 border border-cyan-800">
                OPEN-METEO
              </span>
            </div>

            <div className="text-3xl font-black text-white font-mono">
              {weather?.temperature_c}°C
            </div>
            <div className="text-xs text-gray-400 mt-1 capitalize font-medium">
              Location: <span className="text-white font-bold">{activeCityContext.cityName}</span>
              {activeCityContext.fullName && (
                <div className="text-[10px] text-gray-500 font-mono truncate max-w-xs">{activeCityContext.fullName}</div>
              )}
            </div>
            <div className="text-xs text-gray-400 mt-0.5 capitalize font-medium">
              Condition: <span className="text-white font-bold">{weather?.condition}</span> ({weather?.road_status})
            </div>

            <div className="mt-5 space-y-2.5 text-xs font-mono border-t border-gray-800/80 pt-4">
              <div className="flex justify-between">
                <span className="text-gray-500">Precipitation:</span>
                <span className="text-cyan-300 font-bold">{weather?.precipitation_mm} mm/h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Optical Visibility:</span>
                <span className="text-gray-200">{weather?.visibility_km} km</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Wind Velocity:</span>
                <span className="text-gray-200">{weather?.wind_kmh} km/h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Road Friction Factor:</span>
                <span className="text-amber-400 font-bold">{weather?.recommended_speed_factor}x</span>
              </div>
            </div>
          </div>

          {/* Card 2: Ground Air Quality Station */}
          <div className="bg-[#0a0f1d] border border-gray-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-10 -mt-10" />
            <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-3 flex items-center justify-between">
              <span>🍃 Air Quality & Pollutants</span>
              <span className="px-1.5 py-0.5 rounded text-[8px] bg-emerald-950 text-emerald-400 border border-emerald-800">
                GROUND SENSOR
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-black text-white font-mono">
                {air?.aqi_index}
              </div>
              <span className="text-xs text-gray-400">EU-AQI</span>
              <span
                className={`ml-auto px-2 py-0.5 rounded text-[10px] font-bold ${
                  air?.aqi_index > 75
                    ? "bg-red-500/20 text-red-400 border border-red-500/40"
                    : air?.aqi_index > 50
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                    : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                }`}
              >
                {air?.health_status}
              </span>
            </div>

            <div className="text-xs text-gray-400 mt-1">
              AI Strategy: <span className="text-emerald-300 font-semibold">{air?.traffic_recommendation}</span>
            </div>

            <div className="mt-5 space-y-2.5 text-xs font-mono border-t border-gray-800/80 pt-4">
              <div className="flex justify-between">
                <span className="text-gray-500">PM2.5 Concentration:</span>
                <span className="text-red-400 font-bold">{air?.pm2_5_ug_m3} µg/m³</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">PM10 Coarse Dust:</span>
                <span className="text-amber-400">{air?.pm10_ug_m3} µg/m³</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Nitrogen Dioxide (NO₂):</span>
                <span className="text-gray-200">{air?.no2_ug_m3} µg/m³</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Carbon Monoxide (CO):</span>
                <span className="text-gray-200">{air?.co_ug_m3} µg/m³</span>
              </div>
            </div>
          </div>

          {/* Card 3: OpenStreetMap Real Road Grid */}
          <div className="bg-[#0a0f1d] border border-gray-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -mr-10 -mt-10" />
            <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center justify-between">
              <span>🗺️ OpenStreetMap Arterial Network</span>
              <span className="px-1.5 py-0.5 rounded text-[8px] bg-blue-950 text-blue-400 border border-blue-800">
                OVERPASS OSM
              </span>
            </div>

            <div className="text-3xl font-black text-white font-mono">
              {osm?.total_signals_detected ?? 6}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Real Traffic Light Signals Mapped in {activeCityContext.cityName}
            </div>

            <div className="mt-5 space-y-2.5 text-xs font-mono border-t border-gray-800/80 pt-4">
              <div className="flex justify-between">
                <span className="text-gray-500">Bounding Box:</span>
                <span className="text-gray-400 text-[10px] truncate max-w-[140px]">{osm?.bbox}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Arterial Segments:</span>
                <span className="text-blue-300 font-bold">{osm?.total_arterial_segments ?? 14}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Ingestion Mode:</span>
                <span className="text-emerald-400 font-bold">DIGITAL TWIN LIVE</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Network Type:</span>
                <span className="text-gray-200">SUMO XML / OSM Native</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real-World Geographic Google Maps / OSM Interactive Viewer Canvas */}
      <div className="mt-6 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
              🌍 LIVE GEOGRAPHIC TERRAIN &amp; STREET VIEW
            </span>
            <span className="text-[10px] text-gray-500 font-mono">
              (Pan, Zoom, Streets &amp; Real City Infrastructure)
            </span>
          </div>
          <span className="text-[10px] text-cyan-400 font-mono">
            COORDINATES: {activeCityContext.lat.toFixed(4)}°N, {activeCityContext.lon.toFixed(4)}°E
          </span>
        </div>

        <div className="h-[460px] w-full">
          <GeoLocationMapView
            lat={activeCityContext.lat}
            lon={activeCityContext.lon}
            cityName={activeCityContext.cityName}
          />
        </div>
      </div>
    </div>
  );
}
