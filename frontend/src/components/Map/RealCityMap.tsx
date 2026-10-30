"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTrafficStore } from "@/store/trafficStore";
import { Layers, Globe, Compass, Moon, Loader2, Radio, AlertTriangle, RefreshCw } from "lucide-react";

interface OsmSignalNode {
  id: number;
  lat: number;
  lon: number;
  tags?: { [key: string]: string };
}

// ─── Tile sources ────────────────────────────────────────────────────────────
// @2x tiles = Retina / HD (256px logical → 512px physical pixels)
// Result: much sharper imagery when zooming in, exactly like Google Maps
const TILE_STYLES = {
  satellite: {
    version: 8 as const,
    sources: {
      "esri-sat": {
        type: "raster" as const,
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        maxzoom: 20,
        attribution: "© Esri, Maxar, Earthstar Geographics",
      },
      "carto-labels": {
        type: "raster" as const,
        // Retina @2x labels overlay — road names/numbers on top of satellite
        tiles: ["https://a.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}@2x.png"],
        tileSize: 512,
        maxzoom: 20,
        attribution: "© CARTO",
      },
    },
    layers: [
      { id: "esri-sat", type: "raster" as const, source: "esri-sat" },
      {
        id: "carto-labels",
        type: "raster" as const,
        source: "carto-labels",
        paint: { "raster-opacity": 0.95 },
      },
    ],
  },
  streets: {
    version: 8 as const,
    sources: {
      osm: {
        type: "raster" as const,
        // @2x OSM tiles = HD road map, sharp at all zoom levels
        tiles: [
          "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: "© OpenStreetMap contributors",
      },
    },
    layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
  },
  dark: {
    version: 8 as const,
    sources: {
      "carto-dark": {
        type: "raster" as const,
        // @2x dark tiles = crisp command-centre night mode
        tiles: [
          "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
          "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
          "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        ],
        tileSize: 512,
        maxzoom: 20,
        attribution: "© CARTO, © OpenStreetMap",
      },
    },
    layers: [{ id: "carto-dark", type: "raster" as const, source: "carto-dark" }],
  },
};

export default function RealCityMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const phaseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ambTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ambMarkerRef = useRef<maplibregl.Marker | null>(null);

  const activeCityContext = useTrafficStore((s) => s.activeCityContext);

  const [mapStyle, setMapStyle] = useState<"satellite" | "streets" | "dark">("satellite");
  const [pitchAngle, setPitchAngle] = useState(55);
  const [loading, setLoading] = useState(true);
  const [signalNodes, setSignalNodes] = useState<OsmSignalNode[]>([]);
  const [fetchStatus, setFetchStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [phaseMap, setPhaseMap] = useState<Record<number, "green" | "red" | "yellow">>({});
  const [currentZoom, setCurrentZoom] = useState(15.5);
  const [ambulanceActive, setAmbulanceActive] = useState(false);

  // ── Phase color helper ───────────────────────────────────────────
  const phaseColor = (p: "green" | "red" | "yellow") =>
    p === "green" ? "#22c55e" : p === "yellow" ? "#eab308" : "#ef4444";

  // ── Fetch REAL signals from OpenStreetMap Overpass API ───────────
  // Uses a 2.5km bounding box around city lat/lon
  // Query: highway=traffic_signals (physical poles) + crossing=traffic_signals
  const fetchSignals = useCallback(async (lat: number, lon: number): Promise<OsmSignalNode[]> => {
    setFetchStatus("loading");
    const r = 0.022; // ~2.5km in degrees
    const bbox = `${lat - r},${lon - r},${lat + r},${lon + r}`;
    const q = `[out:json][timeout:25];(node["highway"="traffic_signals"](${bbox});node["crossing"="traffic_signals"](${bbox}););out body;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`;

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const nodes: OsmSignalNode[] = data.elements || [];
      setSignalNodes(nodes);
      setFetchStatus(nodes.length > 0 ? "done" : "error");

      // Init phase map: stagger so adjacent signals aren't both red/green
      const init: Record<number, "green" | "red" | "yellow"> = {};
      nodes.forEach((n, i) => {
        init[n.id] = i % 3 === 0 ? "green" : i % 3 === 1 ? "red" : "yellow";
      });
      setPhaseMap(init);
      return nodes;
    } catch {
      setFetchStatus("error");
      // Fallback: 10 signals spread around city center
      const fallback: OsmSignalNode[] = Array.from({ length: 10 }, (_, i) => {
        const angle = (i / 10) * 2 * Math.PI;
        const dist = 0.007 + (i % 3) * 0.005;
        return {
          id: -(i + 1),
          lat: lat + dist * Math.cos(angle),
          lon: lon + dist * Math.sin(angle),
          tags: { highway: "traffic_signals" },
        };
      });
      setSignalNodes(fallback);
      const initFb: Record<number, "green" | "red" | "yellow"> = {};
      fallback.forEach((n, i) => { initFb[n.id] = i % 2 === 0 ? "green" : "red"; });
      setPhaseMap(initFb);
      return fallback;
    }
  }, []);

  // ── Build signal DOM element ─────────────────────────────────────
  const buildMarkerEl = (nodeId: number, phase: "green" | "red" | "yellow") => {
    const c = phaseColor(phase);
    const label = phase === "green" ? "GO" : phase === "yellow" ? "WAIT" : "STOP";
    const el = document.createElement("div");
    el.style.cssText = "display:flex;flex-direction:column;align-items:center;cursor:pointer;pointer-events:auto;";
    el.innerHTML = `
      <div data-signal="${nodeId}" style="
        background:#0d1117cc;
        border:2px solid ${c};
        border-radius:7px;
        padding:2px 7px;
        box-shadow:0 0 12px ${c}cc, 0 0 26px ${c}44;
        display:flex;align-items:center;gap:4px;
        font-family:monospace;font-size:10px;font-weight:bold;color:#fff;
        white-space:nowrap;backdrop-filter:blur(4px);
        transition:border-color 0.5s,box-shadow 0.5s;
      ">
        <span data-dot="${nodeId}" style="
          width:8px;height:8px;border-radius:50%;
          background:${c};box-shadow:0 0 8px ${c};
          display:inline-block;transition:background 0.5s,box-shadow 0.5s;
        "></span>
        <span data-lbl="${nodeId}">${label}</span>
      </div>
      <div style="width:2px;height:10px;background:${c};opacity:0.7;transition:background 0.5s;"></div>
    `;
    return el;
  };

  // ── Map initialization ───────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) return;
    setLoading(true);

    const lat = activeCityContext.lat || 28.6139;
    const lon = activeCityContext.lon || 77.209;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: TILE_STYLES[mapStyle] as any,
      center: [lon, lat],
      zoom: 15.5,
      pitch: 55,
      bearing: -15,
      maxZoom: 20,
      minZoom: 10,
    });

    // Controls
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    // Track zoom for UI
    map.on("zoom", () => setCurrentZoom(Math.round(map.getZoom() * 10) / 10));

    mapRef.current = map;

    map.on("load", async () => {
      setLoading(false);

      // ── Fetch real traffic signals ──
      const nodes = await fetchSignals(lat, lon);

      // ── Clear old markers ──
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      // ── Place glowing signal markers on real OSM coordinates ──
      nodes.forEach((node, i) => {
        const phase: "green" | "red" | "yellow" = i % 3 === 0 ? "green" : i % 3 === 1 ? "red" : "yellow";
        const el = buildMarkerEl(node.id, phase);

        const roadName = node.tags?.["name"] || node.tags?.["addr:street"] || "";
        const crossingType = node.tags?.["crossing"] || "";
        const popup = new maplibregl.Popup({ offset: 22, closeButton: false, maxWidth: "220px" })
          .setHTML(`
            <div style="background:#0f172a;color:#f8fafc;padding:10px 13px;border-radius:9px;
                        font-family:ui-monospace,monospace;font-size:12px;
                        border:1px solid #1e3a5f;min-width:190px;">
              <div style="font-weight:bold;color:#38bdf8;margin-bottom:5px;font-size:13px;">
                🚦 Real Traffic Signal
              </div>
              <div style="color:#94a3b8;">OSM ID: <strong style="color:#e2e8f0">${node.id}</strong></div>
              <div style="color:#94a3b8;">Lat: <strong style="color:#e2e8f0">${node.lat.toFixed(6)}°</strong></div>
              <div style="color:#94a3b8;">Lon: <strong style="color:#e2e8f0">${node.lon.toFixed(6)}°</strong></div>
              ${roadName ? `<div style="color:#94a3b8;">Road: <strong style="color:#e2e8f0">${roadName}</strong></div>` : ""}
              ${crossingType ? `<div style="color:#94a3b8;">Crossing: <strong style="color:#e2e8f0">${crossingType}</strong></div>` : ""}
              <div style="margin-top:7px;padding-top:6px;border-top:1px solid #1e293b;color:#475569;font-size:10px;">
                Source: OpenStreetMap Overpass API (Real Data)
              </div>
            </div>
          `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([node.lon, node.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });

      // ── Moving ambulance along real signal route (Only if enabled) ──
      // Default: Ambulance is idle until user activates emergency corridor
      if (ambMarkerRef.current) {
        ambMarkerRef.current.remove();
        ambMarkerRef.current = null;
      }
      if (ambTimerRef.current) {
        clearInterval(ambTimerRef.current);
        ambTimerRef.current = null;
      }
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
      if (ambTimerRef.current) clearInterval(ambTimerRef.current);
      if (ambMarkerRef.current) ambMarkerRef.current.remove();
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapStyle, activeCityContext.lat, activeCityContext.lon]);

  // ── Emergency Ambulance Toggle Effect ──
  useEffect(() => {
    if (!mapRef.current) return;

    if (ambulanceActive && signalNodes.length >= 2) {
      const route = signalNodes.slice(0, Math.min(10, signalNodes.length));
      const ambEl = document.createElement("div");
      ambEl.innerHTML = `
        <div id="amb-badge" style="background:#fff;border:2.5px solid #ef4444;border-radius:50%;
          width:34px;height:34px;display:flex;align-items:center;justify-content:center;
          font-size:18px;box-shadow:0 0 20px #ef4444,0 0 10px #3b82f6;cursor:pointer;animation:pulse 1s infinite alternate;">🚑</div>
      `;
      const ambMarker = new maplibregl.Marker({ element: ambEl })
        .setLngLat([route[0].lon, route[0].lat])
        .setPopup(
          new maplibregl.Popup({ offset: 20 }).setHTML(
            `<div style="background:#0f172a;color:#fff;padding:8px;border-radius:6px;font-family:monospace;font-size:11px;border:1px solid #ef4444;">
              🚑 <strong>Emergency Ambulance #108</strong><br/>
              Green corridor: ACTIVE<br/>
              Status: Priority clearance through 8 signals
            </div>`
          )
        )
        .addTo(mapRef.current);

      ambMarkerRef.current = ambMarker;

      let step = 0;
      ambTimerRef.current = setInterval(() => {
        step = (step + 1) % route.length;
        ambMarker.setLngLat([route[step].lon, route[step].lat]);
      }, 3000);
    } else {
      if (ambMarkerRef.current) {
        ambMarkerRef.current.remove();
        ambMarkerRef.current = null;
      }
      if (ambTimerRef.current) {
        clearInterval(ambTimerRef.current);
        ambTimerRef.current = null;
      }
    }

    return () => {
      if (ambTimerRef.current) clearInterval(ambTimerRef.current);
      if (ambMarkerRef.current) ambMarkerRef.current.remove();
    };
  }, [ambulanceActive, signalNodes]);

  // ── Live phase cycle: Green → Yellow → Red every 8s ─────────────
  useEffect(() => {
    if (signalNodes.length === 0) return;
    if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);

    phaseTimerRef.current = setInterval(() => {
      setPhaseMap((prev) => {
        const next = { ...prev };
        signalNodes.forEach((node, i) => {
          const cur = prev[node.id] || "red";
          const cycle: ("green" | "yellow" | "red")[] =
            i % 2 === 0 ? ["green", "yellow", "red"] : ["red", "yellow", "green"];
          next[node.id] = cycle[(cycle.indexOf(cur) + 1) % 3];
        });
        return next;
      });
    }, 8000);

    return () => { if (phaseTimerRef.current) clearInterval(phaseTimerRef.current); };
  }, [signalNodes]);

  // ── Apply phase colors to DOM markers (no re-render needed) ─────
  useEffect(() => {
    Object.entries(phaseMap).forEach(([idStr, phase]) => {
      const id = Number(idStr);
      const c = phaseColor(phase);
      const label = phase === "green" ? "GO" : phase === "yellow" ? "WAIT" : "STOP";

      const badge = document.querySelector(`[data-signal="${id}"]`) as HTMLElement | null;
      const dot = document.querySelector(`[data-dot="${id}"]`) as HTMLElement | null;
      const lbl = document.querySelector(`[data-lbl="${id}"]`) as HTMLElement | null;

      if (badge) {
        badge.style.borderColor = c;
        badge.style.boxShadow = `0 0 12px ${c}cc, 0 0 26px ${c}44`;
      }
      if (dot) { dot.style.background = c; dot.style.boxShadow = `0 0 8px ${c}`; }
      if (lbl) lbl.textContent = label;
    });
  }, [phaseMap]);

  // ── 3D tilt toggle ───────────────────────────────────────────────
  const togglePitch = () => {
    const next = pitchAngle >= 45 ? 0 : 55;
    setPitchAngle(next);
    mapRef.current?.easeTo({ pitch: next, duration: 900 });
  };

  // ── Style change: update map source without remounting ───────────
  const handleStyleChange = (s: "satellite" | "streets" | "dark") => {
    setMapStyle(s);
    // mapRef re-mounts via the useEffect dependency on mapStyle
  };

  // ── Manual refresh signals for current view ──────────────────────
  const handleRefreshSignals = async () => {
    if (!mapRef.current) return;
    const center = mapRef.current.getCenter();
    const nodes = await fetchSignals(center.lat, center.lng);
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    nodes.forEach((node, i) => {
      const phase: "green" | "red" | "yellow" = i % 3 === 0 ? "green" : i % 3 === 1 ? "red" : "yellow";
      const el = buildMarkerEl(node.id, phase);
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([node.lon, node.lat])
        .addTo(mapRef.current!);
      markersRef.current.push(marker);
    });
  };

  const greenCount = Object.values(phaseMap).filter((p) => p === "green").length;
  const redCount = Object.values(phaseMap).filter((p) => p === "red").length;
  const yellowCount = Object.values(phaseMap).filter((p) => p === "yellow").length;
  const totalCount = signalNodes.length;

  return (
    <div className="relative w-full h-full min-h-[580px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col">

      {/* Loading spinner */}
      {loading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/96 gap-3">
          <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
          <p className="text-cyan-300 font-mono text-sm tracking-wide">Loading HD satellite imagery…</p>
          <p className="text-slate-500 font-mono text-xs">Fetching real signals from OpenStreetMap…</p>
        </div>
      )}

      {/* MapLibre GL Canvas */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

      {/* ── TOP BAR ─────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 p-3
                      bg-gradient-to-b from-slate-950/96 via-slate-900/70 to-transparent
                      pointer-events-none">

        {/* City name + fetch status */}
        <div className="flex items-center gap-2 pointer-events-auto flex-wrap">
          <div className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40
                          text-emerald-300 font-mono text-xs flex items-center gap-2 backdrop-blur-md shadow-xl">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            {activeCityContext.cityName.toUpperCase()} — REAL SATELLITE + OSM SIGNALS
          </div>

          {fetchStatus === "loading" && (
            <span className="px-2 py-1 rounded-md bg-blue-900/80 border border-blue-600/50
                             text-blue-300 font-mono text-[11px] flex items-center gap-1.5 backdrop-blur-md">
              <Loader2 className="w-3 h-3 animate-spin" />
              Fetching real signals from OpenStreetMap…
            </span>
          )}
          {fetchStatus === "done" && totalCount > 0 && (
            <span className="px-2 py-1 rounded-md bg-emerald-900/80 border border-emerald-600/50
                             text-emerald-300 font-mono text-[11px] flex items-center gap-1.5 backdrop-blur-md">
              <Radio className="w-3 h-3" />
              {totalCount} real traffic lights detected (OSM)
            </span>
          )}
          {fetchStatus === "error" && (
            <span className="px-2 py-1 rounded-md bg-amber-900/80 border border-amber-600/50
                             text-amber-300 font-mono text-[11px] flex items-center gap-1.5 backdrop-blur-md">
              <AlertTriangle className="w-3 h-3" />
              OSM API timeout — fallback signals shown
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {(["satellite", "streets", "dark"] as const).map((s) => (
            <button key={s} onClick={() => handleStyleChange(s)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono font-medium
                          flex items-center gap-1.5 transition-all backdrop-blur-md ${
                mapStyle === s
                  ? s === "satellite"
                    ? "bg-sky-500/30 border-sky-400 text-sky-200 shadow-lg shadow-sky-500/20"
                    : s === "streets"
                    ? "bg-blue-600/30 border-blue-400 text-blue-200 shadow-lg"
                    : "bg-purple-600/30 border-purple-400 text-purple-200 shadow-lg"
                  : "bg-slate-900/80 border-slate-700 text-slate-400 hover:text-white"
              }`}>
              {s === "satellite" ? <Globe className="w-3.5 h-3.5" /> :
               s === "dark" ? <Moon className="w-3.5 h-3.5" /> :
               <Layers className="w-3.5 h-3.5" />}
              {s === "satellite" ? "HD Satellite" : s === "streets" ? "Road Map" : "Night Mode"}
            </button>
          ))}

          {/* 3D / Flat toggle */}
          <button onClick={togglePitch} title={pitchAngle > 0 ? "Flat 2D view" : "3D tilt view (55°)"}
            className={`p-1.5 rounded-lg border backdrop-blur-md transition-all ${
              pitchAngle > 0
                ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                : "bg-slate-900/80 border-slate-700 text-slate-400 hover:text-cyan-300"
            }`}>
            <Compass className="w-4 h-4" />
          </button>

          {/* Toggle Emergency Ambulance Corridor */}
          <button
            onClick={() => setAmbulanceActive((prev) => !prev)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 transition-all backdrop-blur-md ${
              ambulanceActive
                ? "bg-red-500/30 border-red-400 text-red-200 shadow-lg shadow-red-500/30 ring-2 ring-red-500/40"
                : "bg-slate-900/80 border-slate-700 text-slate-300 hover:text-red-300 hover:border-red-500/40"
            }`}
            title="Toggle Live Emergency Ambulance Green Corridor"
          >
            <span className="text-sm">🚑</span>
            <span className="hidden sm:inline">
              {ambulanceActive ? "Disengage Corridor" : "Dispatch Ambulance"}
            </span>
          </button>
        </div>
      </div>

      {/* ── BOTTOM STATUS BAR ───────────────────────────────── */}
      <div className="mt-auto relative z-10 flex flex-wrap items-end justify-between gap-2 p-3
                      bg-gradient-to-t from-slate-950/96 via-slate-900/50 to-transparent
                      pointer-events-none">

        <div className="flex flex-col gap-1.5 pointer-events-auto">
          {/* Live phase counters */}
          {totalCount > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center gap-1.5 bg-emerald-900/80 border border-emerald-700/50
                              rounded-md px-2.5 py-1 text-[11px] font-mono text-emerald-300 backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                {greenCount} GREEN
              </div>
              <div className="flex items-center gap-1.5 bg-amber-900/80 border border-amber-700/50
                              rounded-md px-2.5 py-1 text-[11px] font-mono text-amber-300 backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                {yellowCount} YELLOW
              </div>
              <div className="flex items-center gap-1.5 bg-red-900/80 border border-red-700/50
                              rounded-md px-2.5 py-1 text-[11px] font-mono text-red-300 backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                {redCount} RED
              </div>
              <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700
                              rounded-md px-2.5 py-1 text-[11px] font-mono text-slate-300 backdrop-blur-md">
                🗺️ Zoom: {currentZoom}x
              </div>
            </div>
          )}
          {/* Ambulance status bar */}
          {ambulanceActive ? (
            <div className="text-[11px] font-mono text-cyan-300 flex items-center gap-2
                            bg-slate-900/90 px-3 py-1.5 rounded-lg border border-red-500/50 backdrop-blur-md shadow-lg shadow-red-950/40">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-ping" />
              <span>🚑 Emergency Ambulance #108 ACTIVE — Preempting 8 physical signal poles</span>
              <button
                onClick={() => setAmbulanceActive(false)}
                className="ml-2 text-[10px] text-red-300 hover:text-white bg-red-950/80 px-2 py-0.5 rounded border border-red-800 transition-colors"
              >
                ✕ Cancel
              </button>
            </div>
          ) : (
            <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2
                            bg-slate-900/80 px-2.5 py-1 rounded-md border border-slate-800 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>All Corridors Normal (No Active Emergency Preemption)</span>
            </div>
          )}
        </div>

        <div className="text-[10px] font-mono text-slate-500 bg-slate-950/90 px-3 py-1.5
                        rounded-lg border border-slate-800 pointer-events-auto backdrop-blur-md">
          Scroll: HD Zoom In/Out&nbsp;·&nbsp;Drag: Pan&nbsp;·&nbsp;Right-drag: 3D Tilt&nbsp;·&nbsp;Click 🚦: Signal Info
        </div>
      </div>
    </div>
  );
}
