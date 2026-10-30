"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import ComparisonHistory from "@/components/Comparison/ComparisonHistory";
import ComparisonProgress from "@/components/Comparison/ComparisonProgress";
import ResultsTable from "@/components/Comparison/ResultsTable";
import RunBuilder, {
  type BuilderRow,
  DEFAULT_ROW,
} from "@/components/Comparison/RunBuilder";
import ComparisonCharts from "@/components/Lab/ComparisonCharts";
import { api } from "@/lib/api";
import { policiesForNetwork } from "@/lib/policies";
import type {
  ComparisonExperiment,
  ExperimentUpdateMessage,
  NetworkType,
  SimulationConfig,
} from "@/lib/types";
import { trafficWS } from "@/lib/ws";

let nextRowId = 1;
const mkRowId = () => `row-${nextRowId++}`;

function rowToConfig(row: BuilderRow, network: NetworkType): SimulationConfig {
  return {
    mode: "sumo",
    network_type: network,
    policy_type: row.policy,
    tick_rate: 1000,
    seed: 42,
    duration_ticks: row.mode === "time" ? row.duration_s : null,
    demand_profile: row.profile,
    total_vehicles: row.cars,
    dominant_direction: row.dominant,
    race_mode: row.mode === "race",
    gui: false,
    ...(network === "combined"
      ? { ramp_policy_type: row.ramp_policy ?? "ramp_alinea" }
      : {}),
    ...(row.policy_params ? { policy_params: row.policy_params } : {}),
    ...(row.alinea_params ? { alinea_params: row.alinea_params } : {}),
  };
}

export default function SimulationLabView() {
  const [seed, setSeed] = useState(42);
  const [network, setNetwork] = useState<NetworkType>("arterial");
  const [rows, setRows] = useState<BuilderRow[]>([
    { ...DEFAULT_ROW(mkRowId()), policy: "fixed_time" },
    { ...DEFAULT_ROW(mkRowId()), policy: "actuated" },
  ]);
  const [experiment, setExperiment] = useState<ComparisonExperiment | null>(null);
  const [history, setHistory] = useState<ComparisonExperiment[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeId = experiment?.experiment_id ?? null;
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshHistory = useCallback(async () => {
    try {
      const data = (await api.listComparisons()) as ComparisonExperiment[];
      setHistory(data);
    } catch (e) {
      console.warn("listComparisons failed", e);
    }
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    trafficWS.connect();
    const unsub = trafficWS.subscribe((raw) => {
      const msg = raw as Partial<ExperimentUpdateMessage>;
      if (msg?.type !== "experiment_update" || !msg.experiment) return;
      setExperiment((prev) => {
        if (prev && prev.experiment_id !== msg.experiment!.experiment_id) return prev;
        return msg.experiment!;
      });
      if (
        msg.status === "completed" ||
        msg.status === "cancelled" ||
        msg.status === "failed"
      ) {
        refreshHistory();
      }
    });
    return () => { unsub(); };
  }, [refreshHistory]);

  useEffect(() => {
    if (!activeId || !experiment) return;
    const terminal =
      experiment.status === "completed" ||
      experiment.status === "cancelled" ||
      experiment.status === "failed";
    if (terminal) return;

    pollRef.current = setInterval(async () => {
      try {
        const data = (await api.getComparison(activeId)) as ComparisonExperiment;
        setExperiment(data);
      } catch (e) {
        console.warn("poll getComparison failed", e);
      }
    }, 3000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [activeId, experiment]);

  const addRow = () => setRows((rs) => [...rs, DEFAULT_ROW(mkRowId())]);
  const removeRow = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id));
  const patchRow = (id: string, patch: Partial<BuilderRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const changeNetwork = (n: NetworkType) => {
    setNetwork(n);
    const valid = policiesForNetwork[n];
    setRows((rs) =>
      rs.map((r) =>
        valid.includes(r.policy)
          ? r
          : {
              ...r,
              policy: valid[valid.length - 1],
              variant_name: undefined,
              policy_params: undefined,
              alinea_params: undefined,
            }
      )
    );
  };

  const startComparison = async () => {
    setStarting(true);
    setError(null);
    try {
      const body = {
        name: `comparison-${new Date().toISOString().slice(11, 19)}`,
        seed,
        runs: rows.map((r) => rowToConfig(r, network)) as unknown as Record<string, unknown>[],
      };
      const exp = (await api.createComparison(body)) as ComparisonExperiment;
      setExperiment(exp);
      refreshHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to start comparison");
    } finally {
      setStarting(false);
    }
  };

  const cancelComparison = async () => {
    if (!activeId) return;
    try {
      const exp = (await api.cancelComparison(activeId)) as ComparisonExperiment;
      setExperiment(exp);
      refreshHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to cancel");
    }
  };

  const loadFromHistory = async (id: string) => {
    try {
      const exp = (await api.getComparison(id)) as ComparisonExperiment;
      setExperiment(exp);
    } catch (e) {
      console.warn("getComparison failed", e);
    }
  };

  const clearSelection = () => {
    setExperiment(null);
    setError(null);
  };

  const isActive =
    experiment &&
    (experiment.status === "running" || experiment.status === "pending");
  const showResults =
    experiment &&
    (experiment.status === "completed" ||
      experiment.status === "cancelled" ||
      experiment.status === "failed");

  return (
    <div className="flex-1 flex overflow-hidden bg-[#070b12]">
      {/* Left sidebar — Experiment Archive */}
      <aside className="w-80 flex-shrink-0 border-r border-gray-800/80 bg-[#0a0f1d] p-4 space-y-4 overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-800/80 pb-3">
          <h2 className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Experiment Archive
          </h2>
          <span className="text-[10px] font-mono text-gray-500 bg-gray-900 px-2 py-0.5 rounded border border-gray-800">
            {history.length} RUNS
          </span>
        </div>
        <ComparisonHistory
          items={history}
          activeId={activeId}
          onSelect={loadFromHistory}
        />
      </aside>

      {/* Main area */}
      <main className="flex-1 p-8 space-y-6 overflow-y-auto bg-[#070b12]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800/80 pb-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white tracking-tight">
                🧪 AI Traffic Simulation Lab
              </h1>
              <span className="text-[10px] font-mono uppercase bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
                SUMO ENGINE v1.28
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Configure multi-controller race &amp; time experiments, benchmark adaptive policies, and analyze comparative telemetry.
            </p>
          </div>
          {experiment && (
            <button
              type="button"
              onClick={clearSelection}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#0f172a] hover:bg-gray-800 text-gray-300 border border-gray-700/80 transition-all shadow-sm"
            >
              ← Back to Experiment Builder
            </button>
          )}
        </div>

        {!experiment && (
          <div className="bg-[#0a0f1d] border border-gray-800/80 rounded-xl p-6 shadow-xl">
            <RunBuilder
              rows={rows}
              seed={seed}
              network={network}
              onSeedChange={setSeed}
              onNetworkChange={changeNetwork}
              onRowChange={patchRow}
              onAdd={addRow}
              onRemove={removeRow}
              onStart={startComparison}
              starting={starting}
              error={error}
            />
          </div>
        )}

        {experiment && (
          <div className="space-y-6">
            <ComparisonProgress
              experiment={experiment}
              onCancel={cancelComparison}
            />
            {isActive && (
              <div className="flex items-center gap-3 p-3 bg-blue-950/30 border border-blue-500/30 rounded-lg text-xs text-blue-300">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping flex-shrink-0" />
                <span>Simulation in progress: Runs execute sequentially on the active SUMO engine instance. Live telemetry charts will update in real time.</span>
              </div>
            )}
            {showResults && (
              <div className="space-y-6">
                <div className="bg-[#0a0f1d] border border-gray-800/80 rounded-xl p-6 shadow-xl">
                  <ComparisonCharts experiment={experiment} />
                </div>
                <div className="bg-[#0a0f1d] border border-gray-800/80 rounded-xl p-6 shadow-xl">
                  <ResultsTable experiment={experiment} />
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
