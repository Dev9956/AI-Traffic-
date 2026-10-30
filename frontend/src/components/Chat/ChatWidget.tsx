"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useTrafficStore } from "@/store/trafficStore";

interface ActionExecuted {
  tool: string;
  args: Record<string, unknown>;
  result?: unknown;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  model_used?: string;
  actions_executed?: ActionExecuted[];
  timestamp: number; // Unix ms
  pinned?: boolean;
}

interface ChatWidgetProps {
  forceOpen?: boolean;
}

const STORAGE_KEY = "atms-chat-session-v2";

// Police/RTA friendly preset prompts
const PRESET_PROMPTS = [
  { label: "🚨 Ambulance Green Wave", prompt: "Emergency! Ambulance aa rahi hai A0 se C0 tak — green corridor activate karo abhi!" },
  { label: "🚦 A0 All Red Override", prompt: "Junction A0 par NTCIP override lagao ALL RED mode mein — accident scene clear ho raha hai" },
  { label: "📋 Aaj ke Challans", prompt: "Aaj kitne red light jump aur overspeeding challans kate hain? Summary do" },
  { label: "📡 VMS Alert Broadcast", prompt: "VMS-01 par broadcast karo: Highway 44 pe congestion hai, alternative route lo" },
  { label: "🌧️ Barish Weather Set", prompt: "Mausam set karo — baarish ho rahi hai, signal timing adjust karo" },
  { label: "📊 Live Traffic Status", prompt: "Abhi kis junction par sabse zyada jam hai? Puri city ka traffic status do" },
  { label: "⚠️ Incident Inject", prompt: "B0 junction par accident simulate karo — lane block ho gayi hai" },
  { label: "🏁 Shift Summary", prompt: "Is shift ki summary do — incidents, challans, emergency calls, aur AI actions ka report banao" },
];

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Sound alert for hardware execution
function playActionBeep() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); // 880Hz beep
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
  } catch {
    // Ignore audio context errors if sound blocked by browser policy
  }
}

export default function ChatWidget({ forceOpen }: ChatWidgetProps = {}) {
  const [open, setOpen]                 = useState(false);
  const [minimized, setMinimized]       = useState(false);
  const [messages, setMessages]         = useState<Message[]>([]);
  const [input, setInput]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [isListening, setIsListening]   = useState(false);
  const [showPresets, setShowPresets]   = useState(true);
  const [retryPayload, setRetryPayload] = useState<Message[] | null>(null);
  const [isConnected, setIsConnected]   = useState(true);
  const [searchQuery, setSearchQuery]   = useState("");
  const [showSearch, setShowSearch]     = useState(false);
  const [copiedIdx, setCopiedIdx]       = useState<number | null>(null);

  const bottomRef      = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const inputRef       = useRef<HTMLInputElement>(null);

  const setLastAiActionNotification = useTrafficStore((s) => s.setLastAiActionNotification);
  const setActiveEvRoutes           = useTrafficStore((s) => s.setActiveEvRoutes);
  const setActiveCityContext        = useTrafficStore((s) => s.setActiveCityContext);
  const setActiveTab                = useTrafficStore((s) => s.setActiveTab);
  const selectIntersection          = useTrafficStore((s) => s.selectIntersection);

  const isOpen = forceOpen || open;

  // ── Persist chat to localStorage ───────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Message[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          setShowPresets(false);
        }
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    try {
      const toSave = messages.slice(-100);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch { /* storage full */ }
  }, [messages]);

  // ── Auto-scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!minimized) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, minimized]);

  // ── Focus input when chat opens ─────────────────────────────────────────────
  useEffect(() => {
    if (isOpen && !minimized) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, minimized]);

  // ── Web Speech API Voice Recognition ───────────────────────────────────────
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-IN"; // Hinglish friendly

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput(transcript);
          send(transcript);
        }
        setIsListening(false);
      };

      recognition.onerror = () => { setIsListening(false); };
      recognition.onend   = () => { setIsListening(false); };
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) {
      alert("Voice recognition: Chrome ya Edge browser use karein.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      try { recognitionRef.current.start(); }
      catch { setIsListening(false); }
    }
  };

  // ── Restart / Fresh Session ────────────────────────────────────────────────
  const handleRestartSession = () => {
    if (!window.confirm("Naya police shift session shuru karein? Purani chat archive ho jayegi.")) return;
    setMessages([]);
    setShowPresets(true);
    setRetryPayload(null);
    setSearchQuery("");
    setShowSearch(false);
    localStorage.removeItem(STORAGE_KEY);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ── Export shift log as JSON ────────────────────────────────────────────────
  const handleExportLog = () => {
    if (messages.length === 0) {
      alert("Koi messages nahi hain abhi.");
      return;
    }
    const logData = {
      session_export_time: new Date().toISOString(),
      system: "AI Traffic Management System (ATMS) — Police Shift Log",
      total_exchanges: messages.length,
      actions_count: messages.filter(m => m.actions_executed?.length).length,
      conversation: messages,
    };
    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `atms-shift-log-${new Date().toISOString().slice(0,10)}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Copy Message to Clipboard ──────────────────────────────────────────────
  const handleCopyMessage = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(index);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  // ── Toggle Pin Message ─────────────────────────────────────────────────────
  const togglePinMessage = (index: number) => {
    setMessages(prev => {
      const next = [...prev];
      next[index] = { ...next[index], pinned: !next[index].pinned };
      return next;
    });
  };

  // ── Generate Shift Summary ─────────────────────────────────────────────────
  const handleShiftSummary = () => {
    send("Meri is poori shift ki summary generate karo — kitne incidents hue, kitne challans, kaunse AI actions execute hue, aur kya warnings aaye. Ek clean shift handover report banao.");
  };

  // ── Main Send function ─────────────────────────────────────────────────────
  async function send(promptOverride?: string) {
    const text = (promptOverride ?? input).trim();
    if (!text || loading) return;

    const now = Date.now();
    const userMsg: Message = { role: "user", content: text, timestamp: now };
    const next: Message[] = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    setShowPresets(false);
    setRetryPayload(null);

    try {
      const data = await api.sendChat(next.map(m => ({ role: m.role, content: m.content })));
      setIsConnected(true);

      // Trigger global store updates from AI actions
      if (data.actions_executed && data.actions_executed.length > 0) {
        playActionBeep();
        data.actions_executed.forEach((act) => {
          setLastAiActionNotification({
            tool: act.tool,
            summary: JSON.stringify(act.args),
            timestamp: Date.now(),
          });

          if (act.tool === "navigate_ui_page") {
            const page = (act.args as any)?.page;
            if (page) setActiveTab(page);
          } else if (act.tool === "trigger_police_override") {
            const jid = (act.args as any)?.junction_id;
            if (jid) {
              setActiveTab("signal-matrix");
              selectIntersection(jid);
            }
          } else if (act.tool === "broadcast_vms") {
            setActiveTab("vms-signs");
          } else if (act.tool === "query_anpr_challans") {
            setActiveTab("road-safety");
          } else if (act.tool === "dispatch_emergency_green_corridor") {
            setActiveTab("overview");
            setActiveEvRoutes([["A0", "B0", "C0"]]);
          } else if (act.tool === "set_city_weather") {
            const cond = (act.args as any)?.condition || "clear";
            setActiveCityContext({ weatherCondition: cond });
          }
        });
      }

      const aiMsg: Message = {
        role: "assistant",
        content: data.reply,
        model_used: data.model_used || undefined,
        actions_executed: data.actions_executed || undefined,
        timestamp: Date.now(),
      };
      setMessages([...next, aiMsg]);
    } catch {
      setIsConnected(false);
      const errMsg: Message = {
        role: "assistant",
        content: "⚠️ Backend se connect nahi ho pa raha. Local rule engine active hai. Retry karein ya server check karein.",
        timestamp: Date.now(),
        model_used: "local-rule-engine",
      };
      setMessages([...next, errMsg]);
      setRetryPayload(next);
    } finally {
      setLoading(false);
    }
  }

  function modelBadge(model?: string) {
    if (!model) return null;
    let color = "bg-emerald-950/80 border border-emerald-700/50 text-emerald-300";
    let label = model;
    if (model.includes("nemotron")) {
      label = "⚡ NVIDIA Nemotron";
      color = "bg-violet-950/80 border border-violet-600/50 text-violet-300";
    } else if (model.includes("gpt-4")) {
      label = "🤖 GPT-4";
    } else if (model.includes("gpt")) {
      label = `🤖 OpenAI`;
    } else if (model.includes("local") || model.includes("rule")) {
      color = "bg-blue-950/80 border border-blue-700/50 text-blue-300";
      label = "🛡️ Local Rule Engine";
    }
    return (
      <span className={`inline-block text-[9px] font-mono px-1.5 py-0.5 rounded-full ${color} mt-1`}>
        {label}
      </span>
    );
  }

  // Filter messages if search is active
  const filteredIndices = messages
    .map((m, idx) => ({ m, idx }))
    .filter(({ m }) => {
      if (!searchQuery.trim()) return true;
      return m.content.toLowerCase().includes(searchQuery.toLowerCase());
    });

  const pinnedMessages = messages.filter(m => m.pinned);

  return (
    <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2" style={{ maxHeight: "calc(100vh - 56px)" }}>

      {/* ── Chat Panel ──────────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="w-[420px] flex flex-col bg-[#090e1a] border border-[#1e2d45] rounded-xl shadow-2xl overflow-hidden transition-all duration-200"
          style={{
            height: minimized ? "48px" : "min(560px, calc(100vh - 120px))",
            boxShadow: "0 0 40px rgba(0,200,120,0.08), 0 20px 60px rgba(0,0,0,0.7)",
          }}
        >

          {/* ── Header ──────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-[#0d1829] to-[#0a1520] border-b border-[#1e2d45] flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-sm shadow-lg shadow-emerald-500/20">
                  🤖
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0d1829] ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
              </div>
              <div>
                <div className="text-[11px] font-bold text-white tracking-wide font-mono">
                  AI TRAFFIC COMMANDER
                </div>
                <div className={`text-[9px] font-mono ${isConnected ? "text-emerald-400" : "text-red-400"}`}>
                  {isConnected ? "● LIVE — NTCIP + VMS Active" : "⚠ OFFLINE — Local Mode"}
                </div>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleShiftSummary}
                disabled={loading || messages.length === 0}
                className="text-[9px] font-mono px-1.5 py-1 rounded bg-blue-900/60 hover:bg-blue-800/60 text-blue-300 border border-blue-700/40 disabled:opacity-40 transition-colors"
                title="Shift Summary Report"
              >
                📋 Shift
              </button>
              <button
                onClick={() => setShowSearch(v => !v)}
                className={`p-1.5 rounded transition-colors text-xs ${showSearch ? "bg-emerald-900/50 text-emerald-300" : "text-gray-400 hover:text-white hover:bg-gray-800/50"}`}
                title="Search Messages"
              >
                🔍
              </button>
              <button
                onClick={handleRestartSession}
                className="text-gray-400 hover:text-emerald-300 p-1.5 rounded hover:bg-gray-800/50 transition-colors text-xs"
                title="🔄 Naya Session (Restart)"
              >
                🔄
              </button>
              <button
                onClick={handleExportLog}
                className="text-gray-400 hover:text-emerald-300 p-1.5 rounded hover:bg-gray-800/50 transition-colors text-xs"
                title="Shift Log Export (JSON)"
              >
                📥
              </button>
              <button
                onClick={() => setMinimized(v => !v)}
                className="text-gray-400 hover:text-white p-1.5 rounded hover:bg-gray-800/50 transition-colors text-xs font-mono"
                title={minimized ? "Expand" : "Minimize"}
              >
                {minimized ? "▲" : "▼"}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-white p-1.5 rounded hover:bg-gray-800/50 transition-colors text-xs"
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* ── Search Bar (Toggleable) ──────────────────────────────────── */}
              {showSearch && (
                <div className="px-3 py-1.5 bg-[#0b1322] border-b border-[#1e2d45] flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-gray-400">🔍</span>
                  <input
                    type="text"
                    placeholder="Search keywords (e.g. A0, challan, ambulance)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent text-[11px] text-gray-200 placeholder-gray-500 outline-none"
                    autoFocus
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="text-xs text-gray-500 hover:text-white">✕</button>
                  )}
                </div>
              )}

              {/* ── Pinned Messages Strip (if any) ──────────────────────────── */}
              {pinnedMessages.length > 0 && !searchQuery && (
                <div className="bg-[#121c2e] border-b border-amber-500/20 px-3 py-1.5 flex flex-col gap-1 flex-shrink-0">
                  <div className="text-[9px] font-bold text-amber-400 flex items-center gap-1 font-mono">
                    📌 PINNED INSTRUCTIONS ({pinnedMessages.length})
                  </div>
                  <div className="max-h-20 overflow-y-auto space-y-1 scrollbar-thin">
                    {pinnedMessages.map((pm, pidx) => (
                      <div key={pidx} className="text-[9.5px] text-gray-300 bg-[#0c1524] rounded px-2 py-1 border border-amber-500/10 truncate">
                        {pm.content}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Stats bar ──────────────────────────────────────────────────── */}
              {messages.length > 0 && (
                <div className="flex items-center gap-3 px-3 py-1.5 bg-[#0a1220] border-b border-[#1a2535] text-[9px] font-mono text-gray-500 flex-shrink-0">
                  <span>💬 {messages.filter(m=>m.role==="user").length} commands</span>
                  <span>⚡ {messages.filter(m=>m.actions_executed?.length).length} actions</span>
                  {pinnedMessages.length > 0 && <span className="text-amber-400">📌 {pinnedMessages.length} pinned</span>}
                  <span className="ml-auto text-gray-600">Session: {formatDate(messages[0]?.timestamp ?? Date.now())}</span>
                </div>
              )}

              {/* ── Messages List ────────────────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2 scrollbar-thin scrollbar-thumb-gray-800">

                {/* Welcome / Preset Prompts */}
                {showPresets && messages.length === 0 && (
                  <div className="space-y-2">
                    <div className="text-center py-2">
                      <div className="text-2xl mb-1">🏙️</div>
                      <div className="text-[11px] font-bold text-white">AI Traffic Operations Commander</div>
                      <div className="text-[10px] text-emerald-400/80 font-mono mt-0.5">
                        OpenAI SDK · NTCIP 1202 · VMS Control
                      </div>
                      <div className="text-[10px] text-gray-500 mt-2">
                        Command type karein ya quick action chunein:
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 mt-1">
                      {PRESET_PROMPTS.map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => send(p.prompt)}
                          disabled={loading}
                          className="text-left text-[10px] bg-[#0f1a2e] hover:bg-[#162035]
                                     border border-[#1e2d45] hover:border-emerald-600/40 rounded-lg px-2.5 py-2
                                     text-gray-300 hover:text-white disabled:opacity-40 transition-all font-medium leading-tight"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Message rendering with search & copy & pin */}
                {filteredIndices.map(({ m, idx }) => {
                  const isUser = m.role === "user";
                  const prevM = idx > 0 ? messages[idx - 1] : null;
                  const showDateSep = idx === 0 || (prevM && formatDate(prevM.timestamp) !== formatDate(m.timestamp));

                  return (
                    <div key={idx} className="group relative">
                      {showDateSep && (
                        <div className="flex items-center gap-2 my-2">
                          <div className="flex-1 h-px bg-[#1e2d45]" />
                          <span className="text-[9px] text-gray-600 font-mono">{formatDate(m.timestamp)}</span>
                          <div className="flex-1 h-px bg-[#1e2d45]" />
                        </div>
                      )}

                      <div className={`flex ${isUser ? "justify-end" : "justify-start"} gap-2`}>
                        {!isUser && (
                          <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-emerald-700 to-teal-500 flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                            🤖
                          </div>
                        )}
                        <div className="max-w-[84%] flex flex-col relative">
                          <div
                            className={`rounded-xl px-3 py-2 text-[11px] leading-relaxed relative ${
                              isUser
                                ? "bg-blue-600 text-white rounded-br-sm"
                                : "bg-[#101a2e] text-gray-200 border border-[#1e2d45] rounded-bl-sm"
                            }`}
                          >
                            <div className="whitespace-pre-wrap">{m.content}</div>

                            {/* Hardware Actions Executed */}
                            {m.actions_executed && m.actions_executed.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-emerald-800/40 flex flex-col gap-1.5">
                                <div className="text-[9px] font-bold text-emerald-400 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  HARDWARE ACTION EXECUTED
                                </div>
                                {m.actions_executed.map((act, aIdx) => (
                                  <div
                                    key={aIdx}
                                    className="bg-emerald-950/50 border border-emerald-600/30 rounded-lg p-1.5 text-[9.5px] font-mono text-emerald-200"
                                  >
                                    <div className="flex items-center justify-between font-bold text-emerald-300">
                                      <span>⚡ {act.tool}</span>
                                      <span className="text-[8px] bg-emerald-500/20 text-emerald-300 px-1.5 rounded-full border border-emerald-500/30">
                                        ✓ OK
                                      </span>
                                    </div>
                                    <div className="text-gray-400 text-[9px] mt-0.5 truncate">
                                      {JSON.stringify(act.args).slice(0, 80)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Hover Quick Action Toolbar (Copy & Pin) */}
                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-[#090e1a]/90 rounded px-1 py-0.5 border border-[#1e2d45]">
                              <button
                                onClick={() => handleCopyMessage(m.content, idx)}
                                className="text-[9px] text-gray-400 hover:text-white px-0.5"
                                title="Copy message"
                              >
                                {copiedIdx === idx ? "✓" : "📋"}
                              </button>
                              <button
                                onClick={() => togglePinMessage(idx)}
                                className={`text-[9px] px-0.5 ${m.pinned ? "text-amber-400" : "text-gray-400 hover:text-amber-300"}`}
                                title={m.pinned ? "Unpin" : "Pin message"}
                              >
                                📌
                              </button>
                            </div>
                          </div>

                          {/* Timestamp + Model badge */}
                          <div className={`flex items-center gap-1.5 mt-0.5 ${isUser ? "justify-end" : "justify-start"}`}>
                            <span className="text-[9px] text-gray-600 font-mono">
                              {formatTime(m.timestamp)}
                            </span>
                            {m.pinned && <span className="text-[8px] text-amber-400 font-mono">PINNED</span>}
                            {!isUser && modelBadge(m.model_used)}
                          </div>
                        </div>

                        {isUser && (
                          <div className="w-5 h-5 rounded-md bg-blue-700 flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                            👮
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Loading indicator */}
                {loading && (
                  <div className="flex justify-start gap-2">
                    <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-emerald-700 to-teal-500 flex items-center justify-center text-[10px] flex-shrink-0">
                      🤖
                    </div>
                    <div className="bg-[#101a2e] border border-[#1e2d45] rounded-xl rounded-bl-sm px-3 py-2 text-[11px] text-emerald-400 flex items-center gap-2">
                      <span className="flex gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                      <span className="text-gray-400">City telemetry synthesize ho raha hai...</span>
                    </div>
                  </div>
                )}

                {/* Retry button */}
                {retryPayload && !loading && (
                  <div className="flex justify-center">
                    <button
                      onClick={() => {
                        const lastUser = retryPayload[retryPayload.length - 1];
                        if (lastUser) send(lastUser.content);
                      }}
                      className="text-[10px] px-3 py-1.5 rounded-lg bg-orange-900/40 hover:bg-orange-800/60 border border-orange-700/40 text-orange-300 transition-colors font-medium"
                    >
                      🔄 Dobara Try Karo
                    </button>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* ── Input Area ─────────────────────────────────────────────────── */}
              <div className="px-3 py-2.5 border-t border-[#1e2d45] bg-[#080d1a] flex-shrink-0">
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    className="flex-1 bg-[#0f1a2e] border border-[#1e2d45] rounded-lg px-3 py-2
                               text-[11px] text-gray-100 placeholder-gray-600 outline-none
                               focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                    placeholder={isListening ? "🎙️ Sun raha hoon... bolein..." : "Command likhen ya mic use karein..."}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={toggleVoice}
                    disabled={loading}
                    className={`p-2 rounded-lg text-sm transition-all flex-shrink-0 ${
                      isListening
                        ? "bg-red-600/80 text-white animate-pulse shadow-lg shadow-red-500/30 border border-red-500"
                        : "bg-[#0f1a2e] hover:bg-[#162035] text-gray-400 hover:text-gray-200 border border-[#1e2d45]"
                    }`}
                    title={isListening ? "Listening... roko" : "Voice Command"}
                  >
                    🎙️
                  </button>
                  <button
                    onClick={() => send()}
                    disabled={loading || !input.trim()}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed
                               rounded-lg text-sm text-white font-bold transition-all flex-shrink-0 shadow-lg shadow-emerald-500/20"
                  >
                    ↑
                  </button>
                </div>
                <div className="flex items-center justify-between mt-1.5 px-0.5">
                  <span className="text-[9px] text-gray-600 font-mono">
                    Enter = Send · 📋 Hover = Copy/Pin · 🔄 = Restart
                  </span>
                  <span className={`text-[9px] font-mono ${isConnected ? "text-emerald-600" : "text-red-500"}`}>
                    {isConnected ? "● Backend Online" : "⚠ Backend Offline"}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Toggle Button ────────────────────────────────────────────────────── */}
      <button
        onClick={() => {
          if (isOpen && minimized) {
            setMinimized(false);
          } else {
            setOpen((v) => !v);
            setMinimized(false);
          }
        }}
        className="relative w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500
                   hover:from-emerald-500 hover:to-teal-400 shadow-xl shadow-emerald-500/20
                   flex items-center justify-center text-xl transition-all hover:scale-105 active:scale-95"
        title="AI Traffic Operations Commander"
      >
        {open && !minimized ? "✕" : "🤖"}
        {!open && !isConnected && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-[#080d16] flex items-center justify-center text-[8px] text-white font-bold">
            !
          </span>
        )}
        {!open && messages.length > 0 && isConnected && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#080d16] animate-pulse" />
        )}
      </button>
    </div>
  );
}