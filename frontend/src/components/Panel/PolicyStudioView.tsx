"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import {
  ARTERIAL_PARAM_FIELDS,
  DEFAULT_ALINEA_PARAMS,
  DEFAULT_POLICY_PARAMS,
  HIGHWAY_PARAM_FIELDS,
  type PolicyFamily,
  type PolicyVariant,
} from "@/lib/types";
import VariantList from "@/components/Policy/VariantList";
import VariantEditor from "@/components/Policy/VariantEditor";
import VariantPerformance from "@/components/Policy/VariantPerformance";
import VariantCompare from "@/components/Policy/VariantCompare";
import PolicySuggester from "@/components/Policy/PolicySuggester";

type Tab = "editor" | "performance" | "compare" | "suggest";

const ACTIVE_KEY = "traffic.activeVariantName";

function schemaFor(family: PolicyFamily) {
  if (family === "highway") {
    return {
      fields: HIGHWAY_PARAM_FIELDS,
      defaults: DEFAULT_ALINEA_PARAMS as unknown as Record<string, number>,
      label: "Highway · ALINEA",
    };
  }
  return {
    fields: ARTERIAL_PARAM_FIELDS,
    defaults: DEFAULT_POLICY_PARAMS as unknown as Record<string, number>,
    label: "Arterial · Actuated",
  };
}

function FamilyBtn({
  active, onClick, label, hint,
}: { active: boolean; onClick: () => void; label: string; hint: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className={`flex-1 text-[11px] py-1.5 px-2 rounded-md border font-medium transition-all ${
        active
          ? "bg-blue-600/20 border-blue-500/60 text-blue-300 shadow-[0_0_8px_rgba(59,130,246,0.15)]"
          : "bg-[#0f172a] border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700"
      }`}
    >
      {label}
    </button>
  );
}

export default function PolicyStudioView() {
  const [family, setFamily] = useState<PolicyFamily>("arterial");
  const [variants, setVariants] = useState<PolicyVariant[]>([]);
  const [selectedName, setSelectedName] = useState<string>("");
  const [draftParams, setDraftParams] = useState<Record<string, number>>(
    DEFAULT_POLICY_PARAMS as unknown as Record<string, number>,
  );
  const [draftDescription, setDraftDescription] = useState<string>("");
  const [activeName, setActiveName] = useState<string>("");
  const [tab, setTab] = useState<Tab>("editor");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const schema = useMemo(() => schemaFor(family), [family]);

  const refreshVariants = useCallback(async () => {
    try {
      const list = (await api.listPolicyVariants()) as PolicyVariant[];
      setVariants(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load variants");
    }
  }, []);

  useEffect(() => {
    refreshVariants();
    if (typeof window !== "undefined") {
      setActiveName(localStorage.getItem(ACTIVE_KEY) ?? "");
    }
  }, [refreshVariants]);

  useEffect(() => {
    setSelectedName("");
    setDraftParams({ ...schema.defaults });
    setDraftDescription("");
  }, [family, schema.defaults]);

  const familyVariants = useMemo(
    () => variants.filter((v) => (v.family ?? "arterial") === family),
    [variants, family],
  );

  const selectVariant = (name: string) => {
    setSelectedName(name);
    if (!name) {
      setDraftParams({ ...schema.defaults });
      setDraftDescription("");
      return;
    }
    const v = familyVariants.find((x) => x.name === name);
    if (v) {
      setDraftParams(v.params as Record<string, number>);
      setDraftDescription(v.description ?? "");
    }
  };

  const saveVariant = async (name: string, description: string) => {
    const trimmed = name.trim();
    if (!trimmed) { setError("Name is required"); return; }
    setLoading(true);
    try {
      await api.savePolicyVariant({ name: trimmed, params: draftParams, family, description });
      await refreshVariants();
      setSelectedName(trimmed);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setLoading(false);
    }
  };

  const deleteVariant = async (name: string) => {
    if (!window.confirm(`Delete variant "${name}"?`)) return;
    setLoading(true);
    try {
      await api.deletePolicyVariant(name);
      if (activeName === name) {
        localStorage.removeItem(ACTIVE_KEY);
        setActiveName("");
      }
      await refreshVariants();
      if (selectedName === name) selectVariant("");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setLoading(false);
    }
  };

  const setActive = (name: string) => {
    if (name) localStorage.setItem(ACTIVE_KEY, name);
    else localStorage.removeItem(ACTIVE_KEY);
    setActiveName(name);
  };

  const selectedVariant: PolicyVariant | null = useMemo(() => {
    if (!selectedName) return null;
    return familyVariants.find((v) => v.name === selectedName) ?? null;
  }, [selectedName, familyVariants]);

  return (
    <div className="flex-1 flex overflow-hidden bg-[#070b12]">
      {/* Left rail: family switch + variant list */}
      <aside className="w-72 flex-shrink-0 bg-[#0a0f1d] border-r border-gray-800/80 overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="p-3 border-b border-gray-800/80 bg-[#080d1a]">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <span className="text-sm">⚡</span>
            <span className="text-xs font-bold text-white font-mono tracking-wide">AI Traffic Policy</span>
          </div>
          <p className="text-[10px] text-gray-500 px-2 mt-1">
            Design, tune, and deploy adaptive traffic control strategies.
          </p>
        </div>

        {/* Family selector */}
        <div className="p-4 border-b border-gray-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-400">
              Control Strategy
            </span>
            <span className="text-[9px] font-mono bg-blue-500/10 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/20">
              AI ENGINE
            </span>
          </div>
          <div className="flex gap-2">
            <FamilyBtn
              active={family === "arterial"}
              onClick={() => setFamily("arterial")}
              label="Arterial Grid"
              hint="3x2 multi-intersection actuated controller with green waves"
            />
            <FamilyBtn
              active={family === "highway"}
              onClick={() => setFamily("highway")}
              label="Highway Ramp"
              hint="ALINEA feedback ramp metering strategy"
            />
          </div>
        </div>

        {/* Variant list */}
        <div className="flex-1 overflow-y-auto p-2">
          <VariantList
            variants={familyVariants}
            selectedName={selectedName}
            activeName={activeName}
            onSelect={selectVariant}
            onNew={() => selectVariant("")}
          />
        </div>
      </aside>

      {/* Main area: tabbed */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#070b12]">
        {/* Tab bar */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-gray-800/80 bg-[#0b1020]/50 backdrop-blur-sm">
          <div className="flex gap-1.5 bg-[#070b12] p-1 rounded-lg border border-gray-800/70">
            {(["editor", "performance", "compare", "suggest"] as Tab[]).map((t) => {
              const tabLabels: Record<Tab, string> = {
                editor: "Parameter Tuning",
                performance: "Performance Analytics",
                compare: "Strategy Benchmark",
                suggest: "AI Optimizer & Suggestions",
              };
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    tab === t
                      ? "bg-blue-600/25 border border-blue-500/60 text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.15)] font-semibold"
                      : "text-gray-400 hover:text-gray-200 border border-transparent hover:bg-gray-800/40"
                  }`}
                >
                  {tabLabels[t]}
                </button>
              );
            })}
          </div>
          {activeName && (
            <div className="flex items-center gap-2 text-xs bg-[#0e172a] border border-blue-500/30 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-gray-400">Deployed Controller:</span>
              <span className="text-blue-300 font-mono font-bold">{activeName}</span>
            </div>
          )}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="text-xs bg-red-950/40 border border-red-500/40 text-red-300 px-4 py-2.5 rounded-lg mb-4 flex items-center gap-2">
              <span className="text-red-400 font-bold">ERROR:</span> {error}
            </div>
          )}

          {tab === "editor" && (
            <VariantEditor
              name={selectedName}
              description={draftDescription}
              params={draftParams}
              fields={schema.fields}
              familyLabel={schema.label}
              isActive={!!selectedName && activeName === selectedName}
              loading={loading}
              onParamsChange={setDraftParams}
              onDescriptionChange={setDraftDescription}
              onSave={saveVariant}
              onDelete={deleteVariant}
              onSetActive={setActive}
              onResetToDefaults={() => setDraftParams({ ...schema.defaults })}
            />
          )}

          {tab === "performance" && (
            <VariantPerformance variant={selectedVariant} />
          )}

          {tab === "compare" && (
            <VariantCompare variants={familyVariants} family={family} />
          )}

          {tab === "suggest" && (
            <PolicySuggester
              draft={draftParams}
              family={family}
              onApply={(field, value) =>
                setDraftParams({ ...draftParams, [field]: value })
              }
            />
          )}
        </div>
      </main>
    </div>
  );
}
