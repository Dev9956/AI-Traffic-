"use client";

import React, { useState } from "react";
import { useTrafficStore } from "@/store/trafficStore";

interface CameraFeed {
  id: string;
  name: string;
  intersectionId: string;
  approach: string;
  type: "PTZ 4K" | "ANPR FIXED" | "THERMAL OVERVIEW";
  location: string;
  speedLimit: number;
}

const CAMERAS: CameraFeed[] = [
  { id: "CAM-01", name: "Junction A0 - North Arterial", intersectionId: "A0", approach: "North", type: "PTZ 4K", location: "Grand Trunk Corridor N", speedLimit: 60 },
  { id: "CAM-02", name: "Junction A0 - South Approach", intersectionId: "A0", approach: "South", type: "ANPR FIXED", location: "Central Metro Plaza S", speedLimit: 50 },
  { id: "CAM-03", name: "Junction B0 - East Commercial", intersectionId: "B0", approach: "East", type: "PTZ 4K", location: "Financial District E", speedLimit: 40 },
  { id: "CAM-04", name: "Junction B0 - West Bypass", intersectionId: "B0", approach: "West", type: "ANPR FIXED", location: "Ring Expressway W", speedLimit: 70 },
  { id: "CAM-05", name: "Junction C1 - Main Terminal", intersectionId: "C1", approach: "North", type: "PTZ 4K", location: "Central Railway Circle", speedLimit: 50 },
  { id: "CAM-06", name: "Junction C1 - South Boulevard", intersectionId: "C1", approach: "South", type: "THERMAL OVERVIEW", location: "Heritage Corridor S", speedLimit: 40 },
  { id: "CAM-07", name: "Junction A1 - Outer Ring N", intersectionId: "A1", approach: "North", type: "ANPR FIXED", location: "NH-48 Sector 12", speedLimit: 80 },
  { id: "CAM-08", name: "Junction B1 - Transit Hub", intersectionId: "B1", approach: "East", type: "PTZ 4K", location: "BRTS Rapid Interchange", speedLimit: 40 },
  { id: "CAM-09", name: "Junction C0 - Airport Access", intersectionId: "C0", approach: "West", type: "PTZ 4K", location: "VIP Airport Link Road", speedLimit: 60 },
];

export default function PoliceVideoWallView() {
  const [selectedCam, setSelectedCam] = useState<CameraFeed | null>(null);
  const [gridSize, setGridSize] = useState<"3x3" | "2x2" | "focus">("3x3");
  const [isAiOverlayActive, setIsAiOverlayActive] = useState<boolean>(true);
  const [alertFilter, setAlertFilter] = useState<string>("ALL");

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0f1d] text-slate-100 overflow-hidden font-sans">
      {/* Top Police Command Toolbar */}
      <div className="h-14 border-b border-slate-800 bg-[#0d1527] px-6 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-black tracking-wider uppercase bg-gradient-to-r from-red-400 to-amber-400 bg-clip-text text-transparent">
            TRAFFIC POLICE COMMAND &amp; CONTROL — 3X3 CCTV VIDEO WALL
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-950/80 border border-blue-500/30 text-blue-300">
            ICCC MULTI-STREAM HUB
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAiOverlayActive(!isAiOverlayActive)}
            className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all border ${
              isAiOverlayActive
                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-sm shadow-emerald-500/20"
                : "bg-slate-800 border-slate-700 text-slate-400"
            }`}
          >
            <span>🎯</span> AI Bounding Boxes: {isAiOverlayActive ? "ON" : "OFF"}
          </button>

          <div className="flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-xs font-mono">
            <button
              onClick={() => setGridSize("3x3")}
              className={`px-3 py-1 rounded ${gridSize === "3x3" ? "bg-blue-600 text-white font-bold" : "text-slate-400 hover:text-white"}`}
            >
              3×3 Matrix (9)
            </button>
            <button
              onClick={() => setGridSize("2x2")}
              className={`px-3 py-1 rounded ${gridSize === "2x2" ? "bg-blue-600 text-white font-bold" : "text-slate-400 hover:text-white"}`}
            >
              2×2 Quadrant (4)
            </button>
          </div>

          <div className="px-3 py-1 bg-slate-800/80 rounded border border-slate-700 text-xs font-mono text-amber-300">
            STREAM PROTOCOL: <span className="text-emerald-400">RTSP / MJPEG (59.94 FPS)</span>
          </div>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div
          className={`grid gap-3 h-full ${
            gridSize === "3x3"
              ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
              : "grid-cols-1 md:grid-cols-2"
          }`}
        >
          {CAMERAS.slice(0, gridSize === "3x3" ? 9 : 4).map((cam) => {
            const streamUrl = `/api/cameras/${cam.intersectionId}/${cam.approach}/stream`;
            return (
              <div
                key={cam.id}
                className="relative flex flex-col bg-slate-900/90 rounded-lg border border-slate-800 overflow-hidden group shadow-lg hover:border-blue-500/60 transition-all"
              >
                {/* OSD Header Bar */}
                <div className="h-7 bg-slate-950/90 px-3 flex items-center justify-between text-[11px] font-mono border-b border-slate-800/80 z-10">
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-400 font-bold">{cam.id}</span>
                    <span className="text-slate-400 truncate max-w-[150px]">{cam.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-slate-300">{cam.type}</span>
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                </div>

                {/* Video Container */}
                <div className="relative flex-1 min-h-[200px] bg-black flex items-center justify-center overflow-hidden">
                  <img
                    src={streamUrl}
                    alt={cam.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />

                  {/* Overlaid Live Police HUD */}
                  <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-end justify-between pointer-events-none">
                    <div className="text-[10px] font-mono text-slate-300 space-y-0.5">
                      <div>LOC: <span className="text-amber-300 font-bold">{cam.location}</span></div>
                      <div>MAX SPEED: <span className="text-emerald-400">{cam.speedLimit} KM/H</span> | STATUS: NORMAL</div>
                    </div>
                    <div className="text-right text-[10px] font-mono">
                      <span className="px-1.5 py-0.5 bg-red-950/80 border border-red-500/40 text-red-300 rounded font-bold">
                        REC ● LIVE
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Action Footer */}
                <div className="h-8 bg-slate-950 px-3 flex items-center justify-between text-xs border-t border-slate-800">
                  <span className="text-[10px] text-slate-400 font-mono">
                    PTZ PRESET: 01-ROADWAY
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => alert(`PTZ Zoom & Pan triggered for ${cam.id}`)}
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                    >
                      PTZ Pan
                    </button>
                    <button
                      onClick={() => alert(`ANPR Snapshot saved for ${cam.id}`)}
                      className="text-[10px] px-2 py-0.5 rounded bg-blue-900/40 border border-blue-500/30 hover:bg-blue-800/40 text-blue-300 transition-colors"
                    >
                      Capture Plate
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
