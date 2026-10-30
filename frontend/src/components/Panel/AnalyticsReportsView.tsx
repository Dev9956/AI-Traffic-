"use client";

import { useEffect, useState } from "react";
import { useTrafficStore } from "@/store/trafficStore";
import { api } from "@/lib/api";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

export default function AnalyticsReportsView() {
  const metricsHistory = useTrafficStore((s) => s.metricsHistory);
  const metrics = useTrafficStore((s) => s.metrics);
  const vehicles = useTrafficStore((s) => s.vehicles);
  const intersections = useTrafficStore((s) => s.intersections);
  const activeCity = useTrafficStore((s) => s.activeCityContext);
  const [comparisons, setComparisons] = useState<any[]>([]);
  const [selectedReportRange, setSelectedReportRange] = useState("TODAY");

  useEffect(() => {
    api.listComparisons().then((res: any) => {
      if (Array.isArray(res)) setComparisons(res);
    }).catch(() => {});
  }, []);

  // Format data for chart
  const chartData = metricsHistory.slice(-50).map((m, i) => ({
    time: `T-${50 - i}`,
    throughput: Math.round(m.throughput_veh_per_min || 0),
    delay: Math.round(m.avg_delay_s || 0),
    halting: Math.round(m.total_halting || 0),
    tripTime: Math.round(m.avg_trip_time_s || 0),
  }));

  const exportCSV = () => {
    if (metricsHistory.length === 0) {
      alert("Koi telemetry data available nahi hai abhi export ke liye.");
      return;
    }
    const headers = "Tick,SimTime,Throughput_vpm,AvgDelay_s,Halting_Veh,AvgTripTime_s\n";
    const rows = metricsHistory.map(m => 
      `${m.tick},${m.sim_time},${m.throughput_veh_per_min},${m.avg_delay_s},${m.total_halting},${m.avg_trip_time_s}`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `atms-traffic-metrics-${activeCity.cityName}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="h-full overflow-y-auto bg-[#070b14] p-6 text-gray-200 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-gray-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <h1 className="text-xl font-black text-white font-mono tracking-wider">
              📈 TRAFFIC ANALYTICS &amp; SHIFT AUDIT REPORTS
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
              EXECUTIVE INTELLIGENCE
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Historical vehicle flow, wait-time bottlenecks, emissions audit, and executive PDF/CSV exports for {activeCity.cityName}.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="px-3.5 py-1.5 rounded-xl bg-blue-900/50 hover:bg-blue-800/60 border border-blue-500/40 text-blue-300 text-xs font-mono font-bold transition-all flex items-center gap-1.5 shadow-md"
          >
            <span>📥</span> Export CSV Log
          </button>
          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-900/50 hover:bg-emerald-800/60 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold transition-all flex items-center gap-1.5 shadow-md"
          >
            <span>🖨️</span> Print / PDF Report
          </button>
        </div>
      </div>

      {/* KPI Overview Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0b1220] border border-gray-800 rounded-2xl p-4 shadow-xl">
          <div className="text-[10px] font-mono text-gray-400 uppercase">City-Wide Flow Throughput</div>
          <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
            {metrics.throughput_veh_per_min?.toFixed(0) || "0"} <span className="text-xs text-gray-500">v/min</span>
          </div>
          <div className="text-[10px] text-gray-500 mt-1">Real-time detector sensor count</div>
        </div>

        <div className="bg-[#0b1220] border border-gray-800 rounded-2xl p-4 shadow-xl">
          <div className="text-[10px] font-mono text-gray-400 uppercase">Average Control Delay</div>
          <div className="text-2xl font-black text-amber-400 font-mono mt-1">
            {metrics.avg_delay_s?.toFixed(1) || "0.0"} <span className="text-xs text-gray-500">seconds</span>
          </div>
          <div className="text-[10px] text-gray-500 mt-1">Queue clearance latency</div>
        </div>

        <div className="bg-[#0b1220] border border-gray-800 rounded-2xl p-4 shadow-xl">
          <div className="text-[10px] font-mono text-gray-400 uppercase">Total Halting Vehicles</div>
          <div className="text-2xl font-black text-rose-400 font-mono mt-1">
            {metrics.total_halting || 0} <span className="text-xs text-gray-500">vehicles</span>
          </div>
          <div className="text-[10px] text-gray-500 mt-1">Currently stopped at red lights</div>
        </div>

        <div className="bg-[#0b1220] border border-gray-800 rounded-2xl p-4 shadow-xl">
          <div className="text-[10px] font-mono text-gray-400 uppercase">Eco &amp; Green Score</div>
          <div className="text-2xl font-black text-cyan-400 font-mono mt-1">
            {metrics.green_index_score || 96} <span className="text-xs text-gray-500">/ 100</span>
          </div>
          <div className="text-[10px] text-gray-500 mt-1">Based on idle time &amp; emissions</div>
        </div>
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Flow & Halting Area Chart */}
        <div className="bg-[#0b1220] border border-gray-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-800/80">
            <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              🌊 Live Flow Volume vs. Halting Queue
            </h2>
            <span className="text-[10px] font-mono text-cyan-400">Last 50 Samples</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="flowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="haltGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: "#0b1220", borderColor: "#1e293b", fontSize: "11px" }} />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                <Area type="monotone" dataKey="throughput" name="Flow (v/min)" stroke="#10b981" fillOpacity={1} fill="url(#flowGrad)" />
                <Area type="monotone" dataKey="halting" name="Halting Cars" stroke="#ef4444" fillOpacity={1} fill="url(#haltGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Delay & Trip Time Bar Chart */}
        <div className="bg-[#0b1220] border border-gray-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-800/80">
            <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              ⏱️ Latency &amp; Mean Trip Duration (Seconds)
            </h2>
            <span className="text-[10px] font-mono text-amber-400">Delay Analytics</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: "#0b1220", borderColor: "#1e293b", fontSize: "11px" }} />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                <Bar dataKey="delay" name="Avg Delay (s)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="tripTime" name="Trip Time (s)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Junction Congestion Audit Table */}
      <div className="bg-[#0b1220] border border-gray-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-800/80">
          <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
            🚦 Junction Performance &amp; Level-of-Service (LOS) Matrix
          </h2>
          <span className="text-[10px] font-mono text-gray-500">Live Traffic Control Audit</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-[10px] uppercase">
                <th className="py-2.5 px-3">Junction ID</th>
                <th className="py-2.5 px-3">Active Phase</th>
                <th className="py-2.5 px-3">Queue North</th>
                <th className="py-2.5 px-3">Queue South</th>
                <th className="py-2.5 px-3">Queue East</th>
                <th className="py-2.5 px-3">Queue West</th>
                <th className="py-2.5 px-3">Avg Wait</th>
                <th className="py-2.5 px-3">LOS Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {intersections.map((it) => {
                const totalQ = it.queue_lengths.N + it.queue_lengths.S + it.queue_lengths.E + it.queue_lengths.W;
                const los = it.avg_wait_s < 10 ? "A (Optimal)" : it.avg_wait_s < 20 ? "B (Good)" : it.avg_wait_s < 35 ? "C (Fair)" : "D (Congested)";
                const losColor = it.avg_wait_s < 10 ? "text-emerald-400" : it.avg_wait_s < 20 ? "text-cyan-400" : it.avg_wait_s < 35 ? "text-amber-400" : "text-rose-400";

                return (
                  <tr key={it.id} className="hover:bg-[#0f172a] transition-colors">
                    <td className="py-2 px-3 font-bold text-blue-400">{it.id}</td>
                    <td className="py-2 px-3 text-gray-300">Phase #{it.phase_index} ({it.phase_remaining_s.toFixed(0)}s)</td>
                    <td className="py-2 px-3 text-gray-400">{it.queue_lengths.N} veh</td>
                    <td className="py-2 px-3 text-gray-400">{it.queue_lengths.S} veh</td>
                    <td className="py-2 px-3 text-gray-400">{it.queue_lengths.E} veh</td>
                    <td className="py-2 px-3 text-gray-400">{it.queue_lengths.W} veh</td>
                    <td className="py-2 px-3 text-white font-bold">{it.avg_wait_s.toFixed(1)}s</td>
                    <td className={`py-2 px-3 font-bold ${losColor}`}>{los}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}