"use client";

import { useEffect, useState } from "react";
import { trafficWS } from "@/lib/ws";
import { useTrafficStore } from "@/store/trafficStore";

interface LiveAlert {
  id: string;
  type: "speeding" | "wrong_way" | "red_light" | "emergency" | "warning" | "ai_actuation";
  title: string;
  message: string;
  timestamp: string;
}

// Play clean Web Audio synth alert chime (no external audio assets required)
function playAlertChime(type: "emergency" | "warning") {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "emergency") {
      // Two-tone priority siren beep
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else {
      // Subtle alert chime
      osc.type = "triangle";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch {
    // Audio autoplay restrictions or headless runner safety
  }
}

export default function IncidentAlertBanner() {
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);
  const lastAiAction = useTrafficStore((s) => s.lastAiActionNotification);

  // Synchronize when AI triggers an action in chat
  useEffect(() => {
    if (!lastAiAction) return;
    playAlertChime("emergency");
    const aiAlert: LiveAlert = {
      id: `${lastAiAction.timestamp}-ai-act`,
      type: "ai_actuation",
      title: `⚡ AI HARDWARE ACTUATION: ${lastAiAction.tool.toUpperCase()}`,
      message: `Direct field change applied: ${lastAiAction.summary}`,
      timestamp: new Date(lastAiAction.timestamp).toLocaleTimeString(),
    };
    setAlerts((prev) => [aiAlert, ...prev.slice(0, 2)]);
  }, [lastAiAction]);

  useEffect(() => {
    const unsub = trafficWS.subscribe((raw: any) => {
      if (!raw) return;

      // Check system alert from backend watchdog
      if (raw.type === "system_alert") {
        const newAlert: LiveAlert = {
          id: `${Date.now()}-watchdog`,
          type: "warning",
          title: "SYSTEM FAIL-SAFE TRIGGERED",
          message: raw.message || "Actuated controller failover to Fixed-Time",
          timestamp: new Date().toLocaleTimeString(),
        };
        playAlertChime("warning");
        setAlerts((prev) => [newAlert, ...prev.slice(0, 3)]);
        return;
      }

      // Check emergency active - trigger alert when new EV enters
      if (raw.emergency?.active && raw.emergency.active.length > 0) {
        const ev = raw.emergency.active[0];
        setAlerts((prev) => {
          if (prev.some((a) => a.id === ev.id)) return prev;
          playAlertChime("emergency");
          const newAlert: LiveAlert = {
            id: ev.id,
            type: "emergency",
            title: `EMERGENCY CORRIDOR ACTIVE: ${ev.id.toUpperCase()}`,
            message: `Priority green wave triggered heading to ${ev.target_intersection || "Dest"}`,
            timestamp: new Date().toLocaleTimeString(),
          };
          return [newAlert, ...prev.slice(0, 2)];
        });
      }
    });

    return () => unsub();
  }, []);

  const removeAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  if (alerts.length === 0) return null;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 max-w-lg w-full px-4 pointer-events-none">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`pointer-events-auto flex items-center justify-between p-3 rounded-lg shadow-xl backdrop-blur-md border animate-bounce-once ${
            alert.type === "ai_actuation"
              ? "bg-emerald-950/95 border-emerald-500 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
              : alert.type === "emergency"
              ? "bg-red-950/90 border-red-500/80 text-red-100"
              : alert.type === "warning"
              ? "bg-amber-950/90 border-amber-500/80 text-amber-100"
              : "bg-blue-950/90 border-blue-500/80 text-blue-100"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider">{alert.title}</div>
              <div className="text-[10px] text-gray-300">{alert.message}</div>
            </div>
          </div>
          <button
            onClick={() => removeAlert(alert.id)}
            className="text-gray-400 hover:text-white text-xs px-2 py-0.5 rounded ml-2"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
