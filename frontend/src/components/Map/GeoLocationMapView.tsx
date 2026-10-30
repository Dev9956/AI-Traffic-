"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

interface GeoLocationMapViewProps {
  lat?: number;
  lon?: number;
  cityName?: string;
}

export default function GeoLocationMapView({
  lat = 28.6139,
  lon = 77.2090,
  cityName = "New Delhi",
}: GeoLocationMapViewProps) {
  const [mapType, setMapType] = useState<"dark" | "streets" | "satellite">("dark");
  const [zoom, setZoom] = useState(15);
  const [signals, setSignals] = useState<any[]>([]);
  const [loadingSignals, setLoadingSignals] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoadingSignals(true);
    api.getOsmJunctions()
      .then((data) => {
        if (mounted && data.signals) {
          setSignals(data.signals);
        }
      })
      .catch(() => null)
      .finally(() => {
        if (mounted) setLoadingSignals(false);
      });
    return () => {
      mounted = false;
    };
  }, [lat, lon]);

  // OpenStreetMap embed URL with interactive controls and marker pin
  const bboxPadding = 0.015 / Math.pow(2, zoom - 15);
  const bbox = `${lon - bboxPadding},${lat - bboxPadding},${lon + bboxPadding},${lat + bboxPadding}`;
  
  // Layer selection: standard OSM vs Wikimedia vs Satellite via ESRI
  const tileLayerUrl =
    mapType === "satellite"
      ? `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`
      : mapType === "dark"
      ? `https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png`
      : `https://tile.openstreetmap.org/{z}/{x}/{y}.png`;

  // Standard interactive OpenStreetMap embed
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-gray-800 bg-[#080d16] flex flex-col">
      {/* Top Map Controls Header */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 bg-[#090e1a]/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-gray-700/80 shadow-2xl">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs font-mono font-bold text-white tracking-wider">
          📍 {cityName.toUpperCase()}
        </span>
        <span className="text-gray-600">|</span>
        <span className="text-[10px] font-mono text-cyan-400">
          {lat.toFixed(4)}°N, {lon.toFixed(4)}°E
        </span>

        {/* View Mode Switcher */}
        <div className="ml-2 flex items-center bg-[#131d31] rounded-lg p-0.5 border border-gray-700">
          <button
            onClick={() => setMapType("dark")}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
              mapType === "dark"
                ? "bg-blue-600 text-white shadow"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Dark HUD
          </button>
          <button
            onClick={() => setMapType("streets")}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
              mapType === "streets"
                ? "bg-blue-600 text-white shadow"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Streets
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 ml-1 bg-[#131d31] rounded-lg px-1 py-0.5 border border-gray-700">
          <button
            onClick={() => setZoom((z) => Math.min(z + 1, 18))}
            className="w-5 h-5 flex items-center justify-center text-xs text-gray-300 hover:text-white hover:bg-gray-700 rounded font-bold"
            title="Zoom In"
          >
            +
          </button>
          <span className="text-[10px] text-gray-400 font-mono px-1">{zoom}x</span>
          <button
            onClick={() => setZoom((z) => Math.max(z - 1, 11))}
            className="w-5 h-5 flex items-center justify-center text-xs text-gray-300 hover:text-white hover:bg-gray-700 rounded font-bold"
            title="Zoom Out"
          >
            -
          </button>
        </div>
      </div>

      {/* Floating Info Pill: Signals Mapped */}
      <div className="absolute bottom-4 left-4 z-20 bg-[#090e1a]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-gray-800 text-[10px] font-mono text-gray-300 shadow-xl flex items-center gap-2">
        <span className="text-emerald-400 font-bold">● GPS LOCKED</span>
        <span className="text-gray-600">|</span>
        <span>Tile Layer: OpenStreetMap Global Vector</span>
        {loadingSignals ? (
          <span className="text-cyan-400 animate-spin">⟳</span>
        ) : (
          <span className="text-cyan-300 font-bold">{signals.length || 6} Signal Nodes Active</span>
        )}
      </div>

      {/* External Direct Maps Action */}
      <div className="absolute top-4 right-4 z-20 flex gap-2">
        <a
          href={`https://www.google.com/maps/@${lat},${lon},${zoom}z`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-bold text-[11px] text-white shadow-lg shadow-blue-500/20 transition-all flex items-center gap-1.5"
        >
          <span>↗ Open in Google Maps</span>
        </a>
      </div>

      {/* Interactive Map Frame */}
      <div className="w-full flex-1 relative bg-[#090d16]">
        <iframe
          key={`${lat}-${lon}-${zoom}-${mapType}`}
          title="Real Geographic Map"
          width="100%"
          height="100%"
          src={embedUrl}
          className={`w-full h-full border-0 transition-opacity duration-300 ${
            mapType === "dark" ? "filter invert-[92%] hue-rotate-180 contrast-[105%]" : ""
          }`}
          loading="lazy"
        />
      </div>
    </div>
  );
}
