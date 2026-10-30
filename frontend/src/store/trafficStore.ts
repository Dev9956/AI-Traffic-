"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  EmergencyVehicleInfo,
  IntersectionState,
  MetricsSnapshot,
  NetworkType,
  SimulationConfig,
  SimulationMode,
  SimulationStatus,
  TickData,
  VehicleState,
} from "@/lib/types";

// Wide metrics history row used by the live timeline + sparkline trends.
export interface MetricsHistoryRow {
  tick: number;
  sim_time: number;
  total_vehicles: number;
  total_completed: number;
  avg_delay_s: number;
  throughput_veh_per_min: number;
  total_halting: number;
  avg_control_delay_s: number;
  avg_trip_time_s: number;
  completed_trips: number;
}

export interface PolicyLogEntry {
  simTime: number;
  directions: Record<"N" | "E" | "S" | "W", { base: number; target: number; delta: number }>;
}

export interface RealCityContext {
  cityName: string;
  fullName: string;
  lat: number;
  lon: number;
  temperatureC: number;
  weatherCondition: string;
  aqiIndex: number;
  pm25: number;
  signalsCount: number;
  roadStatus: string;
}

interface TrafficStore {
  status: SimulationStatus;
  mode: SimulationMode;
  network: NetworkType;
  tick: number;
  simTime: number;
  intersections: IntersectionState[];
  vehicles: VehicleState[];
  metrics: MetricsSnapshot;
  emergencyVehicles: EmergencyVehicleInfo[];
  selectedIntersection: string | null;
  wsConnected: boolean;
  metricsHistory: MetricsHistoryRow[];
  policyLog: Record<string, PolicyLogEntry[]>;
  activeEvRoutes: string[][];  // Each entry is an ordered list of intersection IDs
  activeTab: string;           // Active navigation tab operated by UI or AI
  lastAiActionNotification: { tool: string; summary: string; timestamp: number } | null;
  // Global Real-World Digital Twin City Context
  activeCityContext: RealCityContext;
  // The last config the user successfully started. Powers the Quick-restart
  // button + the System Summary card. null on a fresh session.
  lastStartedConfig: Partial<SimulationConfig> | null;

  updateFromTick: (data: TickData) => void;
  setStatus: (status: SimulationStatus) => void;
  setMode: (mode: SimulationMode) => void;
  setNetwork: (network: NetworkType) => void;
  setActiveTab: (tab: string) => void;
  selectIntersection: (id: string | null) => void;
  setWsConnected: (connected: boolean) => void;
  appendPolicyLog: (id: string, entry: PolicyLogEntry) => void;
  setActiveEvRoutes: (routes: string[][]) => void;
  setLastAiActionNotification: (act: { tool: string; summary: string; timestamp: number } | null) => void;
  setActiveCityContext: (ctx: Partial<RealCityContext>) => void;
  setLastStartedConfig: (cfg: Partial<SimulationConfig> | null) => void;
  reset: () => void;
}

const MAX_HISTORY = 300;
const MAX_POLICY_LOG = 20;

export const useTrafficStore = create<TrafficStore>()(
  persist(
    (set) => ({
      status: "idle",
      mode: "sumo",
      network: "arterial",
      tick: 0,
      simTime: 0,
      intersections: [],
      vehicles: [],
      metrics: {
        total_vehicles: 0,
        total_completed: 0,
        avg_delay_s: 0,
        throughput_veh_per_min: 0,
        total_halting: 0,
        avg_control_delay_s: 0,
        control_delay_samples: 0,
        avg_trip_time_s: 0,
        completed_trips: 0,
      },
      emergencyVehicles: [],
      selectedIntersection: null,
      wsConnected: false,
      metricsHistory: [],
      policyLog: {},
      activeEvRoutes: [],
      activeTab: "overview",
      lastAiActionNotification: null,
      lastStartedConfig: null,
      activeCityContext: {
        cityName: "New Delhi",
        fullName: "New Delhi, Delhi, India",
        lat: 28.6139,
        lon: 77.2090,
        temperatureC: 22.0,
        weatherCondition: "clear",
        aqiIndex: 58,
        pm25: 32.0,
        signalsCount: 6,
        roadStatus: "NORMAL_DRY",
      },

      updateFromTick: (data) =>
        set((state) => ({
          tick: data.tick,
          simTime: data.sim_time,
          intersections: data.intersections,
          vehicles: data.vehicles,
          metrics: data.metrics,
          emergencyVehicles: data.emergency.active,
          metricsHistory: [
            ...state.metricsHistory.slice(-(MAX_HISTORY - 1)),
            {
              tick: data.tick,
              sim_time: data.sim_time,
              total_vehicles: data.metrics.total_vehicles,
              total_completed: data.metrics.total_completed,
              avg_delay_s: data.metrics.avg_delay_s,
              throughput_veh_per_min: data.metrics.throughput_veh_per_min,
              total_halting: data.metrics.total_halting,
              avg_control_delay_s: data.metrics.avg_control_delay_s,
              avg_trip_time_s: data.metrics.avg_trip_time_s,
              completed_trips: data.metrics.completed_trips,
            },
          ],
        })),

      setStatus: (status) => set({ status }),
      setMode: (mode) => set({ mode }),
      setNetwork: (network) => set({ network }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      selectIntersection: (id) => set({ selectedIntersection: id }),
      setWsConnected: (connected) => set({ wsConnected: connected }),
      setActiveEvRoutes: (routes) => set({ activeEvRoutes: routes }),
      setLastAiActionNotification: (act) => set({ lastAiActionNotification: act }),
      setActiveCityContext: (ctx) =>
        set((state) => ({
          activeCityContext: { ...state.activeCityContext, ...ctx },
        })),
      setLastStartedConfig: (cfg) => set({ lastStartedConfig: cfg }),

      appendPolicyLog: (id, entry) =>
        set((state) => {
          const prev = state.policyLog[id] ?? [];
          return {
            policyLog: {
              ...state.policyLog,
              [id]: [...prev.slice(-(MAX_POLICY_LOG - 1)), entry],
            },
          };
        }),

      reset: () =>
        set({
          status: "idle",
          tick: 0,
          simTime: 0,
          intersections: [],
          vehicles: [],
          metricsHistory: [],
          emergencyVehicles: [],
          selectedIntersection: null,
          policyLog: {},
          activeEvRoutes: [],
        }),
    }),
    {
      name: "ai-traffic-store-v2",
      storage: createJSONStorage(() => localStorage),
      // Only persist operator context across page reloads (tab, city, last config)
      // Never persist live ticks or vehicle positions to avoid stale UI state
      partialize: (state) => ({
        activeTab: state.activeTab,
        activeCityContext: state.activeCityContext,
        lastStartedConfig: state.lastStartedConfig,
      }),
    }
  )
);
