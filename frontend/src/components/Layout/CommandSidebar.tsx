"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTrafficStore } from "@/store/trafficStore";

export type NavSection =
  | "overview"
  | "video-wall"
  | "digital-twin"
  | "signal-matrix"
  | "vms-signs"
  | "ai-ops"
  | "city-map"
  | "intersections"
  | "ai-intelligence"
  | "vehicle-detection"
  | "emergency"
  | "road-safety"
  | "simulation-lab"
  | "analytics"
  | "ai-analyst"
  | "settings";

interface NavItem {
  id: NavSection;
  label: string;
  href?: string;
  badge?: string;
  icon: string;
}

const NAV_ITEMS: { category: string; items: NavItem[] }[] = [
  {
    category: "OPERATIONS",
    items: [
      { id: "overview", label: "Overview Dashboard", icon: "📊" },
      { id: "video-wall", label: "Police CCTV Video Wall", icon: "📺", badge: "3x3 4K" },
      { id: "signal-matrix", label: "4-Way Signal Heads", icon: "🚦", badge: "NTCIP" },
      { id: "vms-signs", label: "VMS LED Signboards", icon: "📟", badge: "BROADCAST" },
      { id: "digital-twin", label: "Real Digital Twin", icon: "🌐", badge: "LIVE" },
      { id: "city-map", label: "Live City Map", icon: "🗺️" },
      { id: "intersections", label: "Intersections", icon: "📍" },
      { id: "emergency", label: "Emergency Corridor", icon: "🚨", badge: "LIVE" },
    ],
  },
  {
    category: "INTELLIGENCE & CV",
    items: [
      { id: "ai-ops", label: "Autonomous AI Ops", icon: "🧠", badge: "AUTOPILOT" },
      { id: "ai-intelligence", label: "AI Traffic Policy", icon: "⚡" },
      { id: "vehicle-detection", label: "Vehicle Detection", icon: "📹" },
      { id: "road-safety", label: "Road Safety Center", icon: "🛡️" },
      { id: "ai-analyst", label: "AI Traffic Analyst", icon: "💬" },
    ],
  },
  {
    category: "ANALYTICS & CONTROL",
    items: [
      { id: "simulation-lab", label: "Simulation Lab", icon: "🧪" },
      { id: "analytics", label: "Analytics & Reports", icon: "📈" },
      { id: "settings", label: "System Settings", icon: "⚙️" },
    ],
  },
];

interface CommandSidebarProps {
  currentTab: NavSection;
  onSelectTab: (tab: NavSection) => void;
  onOpenSimControls?: () => void;
  isSimControlsOpen?: boolean;
}

export default function CommandSidebar({
  currentTab,
  onSelectTab,
  onOpenSimControls,
  isSimControlsOpen,
}: CommandSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const status = useTrafficStore((s) => s.status);
  const activeEvCount = useTrafficStore((s) => s.activeEvRoutes?.length || 0);

  return (
    <aside
      className={`h-full bg-[#080d16] border-r border-[#1a2333] transition-all duration-300 flex flex-col z-30 flex-shrink-0 select-none ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Brand Header */}
      <div className="h-14 border-b border-[#1a2333] flex items-center justify-between px-3.5">
        {!collapsed && (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center font-bold text-white text-xs shadow-md shadow-blue-500/20">
              T
            </div>
            <div>
              <div className="text-[12px] font-black text-white tracking-wider font-mono">
                TRAFFIC·TOC
              </div>
              <div className="text-[9px] text-cyan-400/90 font-medium tracking-tight">
                AI COMMAND CENTER
              </div>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-[#121c2c] text-gray-400 hover:text-white transition-colors"
          title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      {/* Quick Launch Simulation Panel Button directly in Sidebar */}
      {onOpenSimControls && (
        <div className="p-2 border-b border-[#1a2333] bg-[#0c1322]">
          <button
            onClick={onOpenSimControls}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all shadow-lg ${
              isSimControlsOpen
                ? "bg-cyan-500/30 border border-cyan-400 text-cyan-200 ring-2 ring-cyan-500/30"
                : "bg-cyan-950/40 border border-cyan-600/40 text-cyan-300 hover:bg-cyan-900/60 hover:border-cyan-400"
            }`}
            title="Open Simulation & Engine Parameters Drawer"
          >
            <span className="text-sm animate-spin-slow">⚙️</span>
            {!collapsed && <span>{isSimControlsOpen ? "Close Sim Panel" : "Simulation Panel"}</span>}
          </button>
        </div>
      )}

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4 scrollbar-thin scrollbar-thumb-gray-800">
        {NAV_ITEMS.map((group) => (
          <div key={group.category}>
            {!collapsed && (
              <div className="text-[9px] font-bold text-gray-500 tracking-wider px-2 pb-1.5 uppercase font-mono">
                {group.category}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  item.href
                    ? pathname === item.href
                    : pathname === "/" && currentTab === item.id;

                const content = (
                  <button
                    onClick={() => onSelectTab(item.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? "bg-blue-600/15 border border-blue-500/30 text-blue-400 shadow-[inset_0_0_12px_rgba(59,130,246,0.12)]"
                        : "text-gray-400 hover:bg-[#0f1726] hover:text-gray-200 border border-transparent"
                    }`}
                  >
                    <span className="text-sm flex-shrink-0">{item.icon}</span>
                    {!collapsed && (
                      <span className="truncate flex-1 text-left">{item.label}</span>
                    )}
                    {!collapsed && item.id === "emergency" && activeEvCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
                        {activeEvCount} EV
                      </span>
                    )}
                  </button>
                );

                return item.href ? (
                  <Link key={item.id} href={item.href} className="block">
                    {content}
                  </Link>
                ) : (
                  <div key={item.id}>{content}</div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* System Status Footer */}
      <div className="p-2.5 border-t border-[#1a2333] bg-[#060a10]">
        {!collapsed ? (
          <div className="flex items-center justify-between text-[10px]">
            <span className="flex items-center gap-1.5 text-gray-400">
              <span
                className={`w-2 h-2 rounded-full ${
                  status === "running" ? "bg-emerald-500 animate-pulse" : "bg-gray-600"
                }`}
              />
              {status.toUpperCase()}
            </span>
            <span className="text-gray-500 font-mono">v1.2-ENTERPRISE</span>
          </div>
        ) : (
          <div className="flex justify-center">
            <span
              className={`w-2 h-2 rounded-full ${
                status === "running" ? "bg-emerald-500 animate-pulse" : "bg-gray-600"
              }`}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
