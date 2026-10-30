"use client";

import { useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useTrafficStore } from "@/store/trafficStore";
import StreetMap         from "@/components/Map/StreetMap";
import IntersectionPanel from "@/components/Panel/IntersectionPanel";
import CameraCarousel    from "@/components/Panel/CameraCarousel";
import MetricsPanel      from "@/components/Metrics/MetricsPanel";
import MetricsTimeline   from "@/components/Metrics/MetricsTimeline";
import SimControls       from "@/components/Simulation/SimControls";
import SystemSummary     from "@/components/Simulation/SystemSummary";
import ChatWidget        from "@/components/Chat/ChatWidget";
import EmergencyPanel    from "@/components/Emergency/EmergencyPanel";
import EmergencyManagementView from "@/components/Emergency/EmergencyManagementView";
import IncidentAlertBanner from "@/components/Simulation/IncidentAlertBanner";
import CommandSidebar, { NavSection } from "@/components/Layout/CommandSidebar";
import RoadSafetyView    from "@/components/Panel/RoadSafetyView";
import SystemSettingsView from "@/components/Panel/SystemSettingsView";
import VehicleDetectionView from "@/components/Panel/VehicleDetectionView";
import DigitalTwinHubView from "@/components/Panel/DigitalTwinHubView";
import IntersectionSignalHub from "@/components/Panel/IntersectionSignalHub";
import VmsOperationsView from "@/components/Panel/VmsOperationsView";
import AutonomousAiOpsView from "@/components/Panel/AutonomousAiOpsView";
import PoliceVideoWallView from "@/components/Panel/PoliceVideoWallView";
import AiAnalystStudioView from "@/components/Panel/AiAnalystStudioView";
import SimulationLabView from "@/components/Panel/SimulationLabView";
import PolicyStudioView from "@/components/Panel/PolicyStudioView";
import AnalyticsReportsView from "@/components/Panel/AnalyticsReportsView";

export default function Dashboard() {
  useWebSocket();
  const currentTab = useTrafficStore((s) => s.activeTab as NavSection);
  const setActiveTab = useTrafficStore((s) => s.setActiveTab);
  const selected = useTrafficStore((s) => s.selectedIntersection);
  const selectIntersection = useTrafficStore((s) => s.selectIntersection);
  const [controlsOpen, setControlsOpen] = useState(false);

  const handleSelectTab = (tab: NavSection) => {
    setActiveTab(tab);
    if (tab === "intersections") {
      selectIntersection("A0"); // Automatically open intersection panel
    }
  };

  /* ---------- Full-page tab views (no map sidebar) ---------- */
  const fullPageView =
    currentTab === "video-wall"        ? <PoliceVideoWallView /> :
    currentTab === "ai-analyst"        ? <AiAnalystStudioView /> :
    currentTab === "ai-ops"            ? <AutonomousAiOpsView /> :
    currentTab === "signal-matrix"     ? <IntersectionSignalHub /> :
    currentTab === "vms-signs"         ? <VmsOperationsView /> :
    currentTab === "digital-twin"      ? <DigitalTwinHubView /> :
    currentTab === "road-safety"       ? <RoadSafetyView /> :
    currentTab === "settings"          ? <SystemSettingsView /> :
    currentTab === "vehicle-detection" ? <VehicleDetectionView /> :
    currentTab === "emergency"         ? <EmergencyManagementView /> :
    currentTab === "simulation-lab"    ? <SimulationLabView /> :
    currentTab === "analytics"         ? <AnalyticsReportsView /> :
    currentTab === "ai-intelligence"   ? <PolicyStudioView /> :
    null;

  if (fullPageView) {
    return (
      <div className="flex-1 flex overflow-hidden relative">
        <IncidentAlertBanner />
        <CommandSidebar currentTab={currentTab} onSelectTab={handleSelectTab} />
        <main className="flex-1 overflow-hidden relative">{fullPageView}</main>
        <ChatWidget />
      </div>
    );
  }

  /* ---------- Map-based views (overview, city-map, intersections, ai-analyst) ---------- */
  const isFullMap = currentTab === "city-map";

  return (
    <div className="flex-1 flex overflow-hidden relative">
      <IncidentAlertBanner />

      {/* Enterprise Collapsible Command Sidebar */}
      <CommandSidebar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
      />

      {/* Persistent Left Simulation Panel (Collapsible, Zero Overlap, Pushes Canvas Cleanly) */}
      <aside
        className={`h-full bg-[#0a0f19] border-r border-[#1a2333] flex flex-col z-20 flex-shrink-0 transition-all duration-300 relative ${
          controlsOpen ? "w-80" : "w-10"
        }`}
      >
        {controlsOpen ? (
          <>
            <div className="p-3.5 bg-[#0d1424] border-b border-[#1a2333] flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-400 font-mono tracking-wide flex items-center gap-1.5">
                <span>⚙️</span> ENGINE &amp; SCENARIO
              </span>
              <button
                onClick={() => setControlsOpen(false)}
                className="text-gray-400 hover:text-white text-xs px-2 py-0.5 rounded bg-gray-800 transition-colors flex items-center gap-1"
                title="Collapse Panel"
              >
                ◀ Minimize
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 scrollbar-thin scrollbar-thumb-gray-800">
              <SystemSummary />
              <SimControls />
              <div className="border-t border-[#1a2333]" />
              <EmergencyPanel />
              <div className="border-t border-[#1a2333]" />
              <MetricsPanel />
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center py-4 bg-[#080d16] hover:bg-[#0c1322] cursor-pointer transition-colors"
               onClick={() => setControlsOpen(true)}
               title="Click to Open Simulation Controls Panel">
            <button
              className="text-cyan-400 text-sm p-1 rounded hover:bg-cyan-950 transition-colors"
            >
              ▶
            </button>
            <div className="writing-mode-vertical text-[11px] font-mono font-bold tracking-widest text-cyan-400/90 mt-6 select-none uppercase rotate-180"
                 style={{ writingMode: "vertical-rl" }}>
              ⚙️ SIMULATION PANEL
            </div>
          </div>
        )}
      </aside>

      {/* Map Area — Full-screen Command Canvas */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#060a10] relative">
        <div className="flex-1 relative overflow-hidden">
          <StreetMap />
          {!selected && currentTab !== "intersections" && <CameraCarousel />}
          <IntersectionPanel />
          {!selected && <ChatWidget forceOpen={currentTab === "ai-analyst"} />}

          {/* city-map: floating mini control panel */}
          {isFullMap && (
            <div className="absolute top-4 right-4 w-56 bg-[#0a0f19]/90 backdrop-blur-md border border-[#1a2333] rounded-xl p-3 shadow-2xl z-20 space-y-3">
              <div className="text-[9px] text-cyan-400 font-bold uppercase tracking-widest">
                🗺️ FULL MAP MODE
              </div>
              <SimControls />
            </div>
          )}
        </div>
        {!isFullMap && <MetricsTimeline />}
      </main>
    </div>
  );
}
