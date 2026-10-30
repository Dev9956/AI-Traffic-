"use client";

import React, { useEffect, useState } from "react";
import { useTrafficStore } from "@/store/trafficStore";
import { api } from "@/lib/api";

interface ViolationRecord {
  id: string;
  license_plate: string;
  junction: string;
  violation_type: string;
  speed_kmh: number;
  speed_limit: number;
  timestamp: string;
  status: string;
  fine_inr: number;
}

export default function RoadSafetyView() {
  const intersections = useTrafficStore((s) => s.intersections);
  const vehicles = useTrafficStore((s) => s.vehicles);
  
  const [violations, setViolations] = useState<ViolationRecord[]>([]);
  const [selectedChallan, setSelectedChallan] = useState<ViolationRecord | null>(null);
  const [filterType, setFilterType] = useState<string>("ALL");

  useEffect(() => {
    const fetchViolations = async () => {
      try {
        const data = await api.getAnprViolations();
        setViolations(data);
      } catch (err) {
        console.error("Failed to fetch ANPR violations:", err);
      }
    };
    fetchViolations();
    const interval = setInterval(fetchViolations, 3000);
    return () => clearInterval(interval);
  }, []);

  // Compute live safety metrics from actual state
  const speedingVehicles = vehicles.filter((v) => v.speed > 16.5); // > ~60 km/h
  const highQueueIntersections = intersections.filter((i) => i.avg_wait_s > 35.0);

  const filteredViolations = violations.filter((v) => {
    if (filterType === "ALL") return true;
    return v.violation_type === filterType;
  });

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 bg-[#070b12] text-gray-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-800 pb-4 gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span>🛡️</span> Road Safety &amp; E-Challan Center
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Real-time traffic camera enforcement, speed checks, and official digital challan receipts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-emerald-950/70 text-emerald-400 border border-emerald-800/80 rounded-full text-xs flex items-center gap-1.5 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            CAMERA SYSTEM ONLINE
          </span>
        </div>
      </div>

      {/* Safety KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#0b121f] border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-400 font-medium">Excessive Speeding Alerts</div>
          <div className="text-2xl font-black text-rose-400 mt-1">
            {speedingVehicles.length > 0 ? speedingVehicles.length : violations.filter(v => v.violation_type === "OVERSPEEDING").length}
          </div>
          <div className="text-[10px] text-gray-500 mt-1">Vehicles exceeding 60 km/h speed limit</div>
        </div>

        <div className="bg-[#0b121f] border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-400 font-medium">Heavy Traffic Queue</div>
          <div className="text-2xl font-black text-amber-400 mt-1">{highQueueIntersections.length}</div>
          <div className="text-[10px] text-gray-500 mt-1">Junctions with wait time over 35 seconds</div>
        </div>

        <div className="bg-[#0b121f] border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-400 font-medium">Recorded Violations Today</div>
          <div className="text-2xl font-black text-blue-400 mt-1">{violations.length}</div>
          <div className="text-[10px] text-gray-500 mt-1">Captured automatically by ANPR cameras</div>
        </div>

        <div className="bg-[#0b121f] border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-400 font-medium">Total Fine Penalties</div>
          <div className="text-2xl font-black text-emerald-400 mt-1">
            ₹{violations.reduce((sum, v) => sum + (v.fine_inr || 0), 0).toLocaleString("en-IN")}
          </div>
          <div className="text-[10px] text-gray-500 mt-1">Issued under Motor Vehicles Act</div>
        </div>
      </div>

      {/* Real-time ANPR Violations Feed with E-Challan Generator */}
      <div className="bg-[#0b121f] border border-gray-800 rounded-xl overflow-hidden shadow-lg">
        <div className="px-4 py-3 border-b border-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-[#0e1626]">
          <div className="flex items-center gap-2">
            <span className="text-sm">📸</span>
            <h2 className="text-xs font-bold text-gray-200 uppercase tracking-wider">
              Real-time Traffic Violation Log (ANPR Camera)
            </h2>
          </div>
          <div className="flex gap-1.5">
            {["ALL", "RED_LIGHT_JUMP", "OVERSPEEDING"].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`text-[10px] px-2.5 py-1 rounded transition-colors font-medium ${
                  filterType === type
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800/80 text-gray-400 hover:text-white"
                }`}
              >
                {type === "ALL" ? "All Violations" : type === "RED_LIGHT_JUMP" ? "Red Light Jump" : "Overspeeding"}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] text-gray-400 bg-[#080d17] border-b border-gray-800">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Challan No.</th>
                <th className="py-2.5 px-4 font-semibold">Vehicle Number</th>
                <th className="py-2.5 px-4 font-semibold">Location</th>
                <th className="py-2.5 px-4 font-semibold">Violation Type</th>
                <th className="py-2.5 px-4 font-semibold">Observed Speed</th>
                <th className="py-2.5 px-4 font-semibold">Time</th>
                <th className="py-2.5 px-4 font-semibold">Fine (INR)</th>
                <th className="py-2.5 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 font-mono">
              {filteredViolations.map((vio) => (
                <tr key={vio.id} className="hover:bg-[#121c2d] transition-colors">
                  <td className="py-2.5 px-4 font-bold text-gray-300">{vio.id}</td>
                  <td className="py-2.5 px-4 font-bold text-amber-300 bg-amber-950/20 px-2 py-0.5 rounded">
                    {vio.license_plate}
                  </td>
                  <td className="py-2.5 px-4 text-blue-400">Junction {vio.junction}</td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        vio.violation_type === "RED_LIGHT_JUMP"
                          ? "bg-rose-950 text-rose-300 border border-rose-800/80"
                          : "bg-amber-950 text-amber-300 border border-amber-800/80"
                      }`}
                    >
                      {vio.violation_type === "RED_LIGHT_JUMP" ? "RED LIGHT JUMP" : "OVERSPEEDING"}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-gray-300">
                    {vio.speed_kmh} km/h <span className="text-gray-500 text-[10px]">(Limit: {vio.speed_limit})</span>
                  </td>
                  <td className="py-2.5 px-4 text-gray-400">{vio.timestamp}</td>
                  <td className="py-2.5 px-4 font-bold text-emerald-400">₹{vio.fine_inr}</td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      onClick={() => setSelectedChallan(vio)}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-sans font-medium transition-colors"
                    >
                      View Challan Slip
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Junction Queues & Delays */}
      <div className="bg-[#0b121f] border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center bg-[#0e1626]">
          <h2 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
            Intersection Traffic Delays &amp; Flow Condition
          </h2>
          <span className="text-[10px] text-gray-400 font-mono">LIVE UPDATE</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] text-gray-400 bg-[#080d17] border-b border-gray-800">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Intersection</th>
                <th className="py-2.5 px-4 font-semibold">Current Light</th>
                <th className="py-2.5 px-4 font-semibold">Waiting Vehicles</th>
                <th className="py-2.5 px-4 font-semibold">Average Wait</th>
                <th className="py-2.5 px-4 font-semibold">Road Condition</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 font-mono">
              {intersections.map((it) => {
                const totalQ =
                  it.queue_lengths.N + it.queue_lengths.S + it.queue_lengths.E + it.queue_lengths.W;
                const isCritical = it.avg_wait_s > 30 || totalQ > 15;
                const isModerate = it.avg_wait_s > 15 || totalQ > 8;

                return (
                  <tr key={it.id} className="hover:bg-[#121c2d] transition-colors">
                    <td className="py-2.5 px-4 font-bold text-blue-400">{it.id}</td>
                    <td className="py-2.5 px-4 text-gray-300">Phase #{it.phase_index} ({it.phase_remaining_s.toFixed(0)}s left)</td>
                    <td className="py-2.5 px-4 text-gray-400">
                      N:{it.queue_lengths.N} | S:{it.queue_lengths.S} | E:{it.queue_lengths.E} | W:{it.queue_lengths.W}
                    </td>
                    <td className="py-2.5 px-4 text-gray-300">{it.avg_wait_s.toFixed(1)} seconds</td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isCritical
                            ? "bg-rose-950 text-rose-400 border border-rose-800"
                            : isModerate
                            ? "bg-amber-950 text-amber-400 border border-amber-800"
                            : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                        }`}
                      >
                        {isCritical ? "Heavy Congestion" : isModerate ? "Moderate Traffic" : "Smooth Flow"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* E-Challan Official Modal */}
      {selectedChallan && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-blue-500/50 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex justify-between items-start border-b border-gray-800 pb-3">
              <div>
                <div className="text-[11px] font-bold text-blue-400 tracking-wider">SMART CITY TRAFFIC POLICE</div>
                <h3 className="text-base font-black text-white mt-0.5">E-CHALLAN VIOLATION NOTICE</h3>
              </div>
              <button
                onClick={() => setSelectedChallan(null)}
                className="text-gray-400 hover:text-white p-1 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 font-mono text-xs">
              <div className="flex justify-between py-1 border-b border-gray-800/80">
                <span className="text-gray-400">Challan Number:</span>
                <span className="font-bold text-white">{selectedChallan.id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800/80">
                <span className="text-gray-400">Vehicle Plate:</span>
                <span className="font-bold text-amber-300 text-sm bg-black px-2 py-0.5 rounded border border-gray-700">
                  {selectedChallan.license_plate}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800/80">
                <span className="text-gray-400">Location:</span>
                <span className="text-blue-300">Junction {selectedChallan.junction} Approach Camera</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800/80">
                <span className="text-gray-400">Violation Type:</span>
                <span className="font-bold text-rose-400">
                  {selectedChallan.violation_type.replace(/_/g, " ")}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800/80">
                <span className="text-gray-400">Recorded Speed:</span>
                <span className="text-white">
                  {selectedChallan.speed_kmh} km/h (Permissible: {selectedChallan.speed_limit} km/h)
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800/80">
                <span className="text-gray-400">Timestamp:</span>
                <span className="text-gray-300">{selectedChallan.timestamp}</span>
              </div>
              <div className="flex justify-between py-2 bg-emerald-950/30 px-3 rounded-lg border border-emerald-800/40">
                <span className="text-emerald-300 font-bold">Fine Payable:</span>
                <span className="text-emerald-400 font-black text-base">₹{selectedChallan.fine_inr}</span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  alert(`E-Challan #${selectedChallan.id} downloaded successfully.`);
                  setSelectedChallan(null);
                }}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Download Receipt
              </button>
              <button
                onClick={() => setSelectedChallan(null)}
                className="py-2 px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
