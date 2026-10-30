"use client";

import React, { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { useTrafficStore } from "@/store/trafficStore";

interface ActionExecuted {
  tool: string;
  args: Record<string, unknown>;
  result?: unknown;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  model_used?: string;
  actions_executed?: ActionExecuted[];
}

const STORAGE_KEY_STUDIO = "atms-analyst-studio-v2";

const QUICK_COMMANDS = [
  { label: "🚨 Create Green Wave for Ambulance", prompt: "Activate emergency corridor green wave for Junction A0 to C1" },
  { label: "📊 City Traffic Health Status", prompt: "Provide full traffic congestion and safety summary across all junctions" },
  { label: "⚡ Flush North Arterial", prompt: "Give maximum green time priority to North approach on Junction A0" },
  { label: "📟 Broadcast VMS Advisory", prompt: "Post an advisory on roadside VMS: HIGH TRAFFIC - MAINTAIN SAFE DISTANCE" },
  { label: "🛡️ Check Speeding Violations", prompt: "Show latest over-speeding vehicles and pending e-challans" },
];

export default function AiAnalystStudioView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"ALL" | "ACTIONS" | "ALERTS">("ALL");
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const activeCity = useTrafficStore((s) => s.activeCityContext);
  const intersections = useTrafficStore((s) => s.intersections);

  // Restore session from localStorage or show initial message
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_STUDIO);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch {}
    // Default initial message
    setMessages([
      {
        id: "welcome-1",
        role: "assistant",
        content: "Namaste Officer! I am your AI Traffic Command Assistant. I monitor real-time junction cameras, loop detectors, e-challans, and emergency corridors. How can I assist you with city traffic management right now?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model_used: "NVIDIA Nemotron-3.5 (Active LLM)",
      }
    ]);
  }, []);

  // Save to localStorage on update
  useEffect(() => {
    if (messages.length === 0) return;
    try {
      localStorage.setItem(STORAGE_KEY_STUDIO, JSON.stringify(messages.slice(-50)));
    } catch {}
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Web Speech API Voice Recognition setup
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-IN"; // English (India) / Hinglish friendly

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput(transcript);
          sendMessage(transcript);
        }
        setIsListening(false);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      try {
        recognitionRef.current.start();
      } catch {
        setIsListening(false);
      }
    }
  };

  const sendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMsg: Message = {
      id: "msg-" + Date.now(),
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const nextPayload = [
      ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content: query },
    ];

    try {
      const res = await api.sendChat(nextPayload);
      const assistantMsg: Message = {
        id: "msg-" + (Date.now() + 1),
        role: "assistant",
        content: res.reply || (res as any).response || "Action processed successfully by Traffic Agent.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model_used: res.model_used || "DeepSeek-R1 / Llama-3.3-70B",
        actions_executed: res.actions_executed,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: "msg-" + (Date.now() + 1),
        role: "assistant",
        content: `⚠ Error communicating with traffic engine: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (confirm("Clear current conversation history?")) {
      setMessages([]);
      localStorage.removeItem(STORAGE_KEY_STUDIO);
    }
  };

  const handleExportTranscript = () => {
    const data = JSON.stringify(messages, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `traffic-ai-log-${Date.now()}.json`;
    a.click();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#070b13] text-slate-100 font-sans overflow-hidden">
      {/* Top Header */}
      <div className="h-16 border-b border-slate-800 bg-[#0c1322] px-6 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-lg shadow-lg shadow-cyan-500/20">
            🤖
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-wide">
                AI Traffic Analyst &amp; Copilot Studio
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950 text-cyan-400 border border-cyan-700/50">
                ACTIVE CITY: {activeCity.cityName.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Voice-enabled natural language interface for traffic dispatch, camera analysis, and signal overrides
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportTranscript}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 transition-colors flex items-center gap-1.5"
            title="Export Conversation Log"
          >
            <span>📥</span> Export Transcript
          </button>
          <button
            onClick={handleClearHistory}
            className="px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 text-xs text-red-300 transition-colors"
          >
            Clear Log
          </button>
        </div>
      </div>

      {/* Main Workspace (Split View: Chat Stream + Quick Insight Sidepanel) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat History & Input */}
        <div className="flex-1 flex flex-col bg-[#080d18] border-r border-slate-800/80">
          {/* Quick Prompts Bar */}
          <div className="p-3 bg-slate-900/60 border-b border-slate-800/80 overflow-x-auto flex items-center gap-2">
            <span className="text-[11px] font-mono text-cyan-400 font-semibold uppercase shrink-0">
              ⚡ Quick Actions:
            </span>
            {QUICK_COMMANDS.map((cmd, idx) => (
              <button
                key={idx}
                onClick={() => sendMessage(cmd.prompt)}
                disabled={loading}
                className="shrink-0 px-3 py-1 rounded-full bg-slate-800/90 hover:bg-blue-600/30 border border-slate-700 hover:border-blue-500/50 text-xs text-slate-200 transition-all font-sans"
              >
                {cmd.label}
              </button>
            ))}
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  className={`flex gap-3 max-w-3xl ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                >
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-sm ${
                      isUser
                        ? "bg-blue-600 text-white font-bold"
                        : "bg-cyan-950 border border-cyan-500/40 text-cyan-400"
                    }`}
                  >
                    {isUser ? "👮" : "🤖"}
                  </div>

                  <div className={`space-y-1 ${isUser ? "items-end" : "items-start"}`}>
                    <div className="flex items-center gap-2 px-1 text-[11px] font-mono text-slate-400">
                      <span>{isUser ? "Officer On Duty" : "AI Copilot Agent"}</span>
                      <span>•</span>
                      <span>{m.timestamp}</span>
                      {m.model_used && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 rounded text-cyan-300">
                          {m.model_used}
                        </span>
                      )}
                    </div>

                    <div
                      className={`p-4 rounded-2xl text-sm leading-relaxed shadow-md ${
                        isUser
                          ? "bg-blue-600 text-white rounded-tr-none"
                          : "bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none"
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{m.content}</div>

                      {/* Tool / Action Badges if any */}
                      {m.actions_executed && m.actions_executed.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2">
                          <div className="text-[11px] font-mono font-bold text-amber-400 flex items-center gap-1.5">
                            <span>⚡ Physical Action Executed:</span>
                          </div>
                          {m.actions_executed.map((act, i) => (
                            <div
                              key={i}
                              className="p-2 rounded bg-black/40 border border-slate-800 font-mono text-xs text-emerald-300 flex items-center justify-between"
                            >
                              <span>🔧 {act.tool}</span>
                              <span className="text-slate-400 text-[10px]">
                                {JSON.stringify(act.args)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex gap-3 max-w-xl mr-auto">
                <div className="h-8 w-8 rounded-full bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400 text-sm">
                  🤖
                </div>
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 text-sm flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>AI Agent analyzing traffic flow &amp; preparing command...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Bottom Prompt Bar */}
          <div className="p-4 bg-[#0a101d] border-t border-slate-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex items-center gap-3"
            >
              {/* Voice recognition microphone button */}
              <button
                type="button"
                onClick={toggleVoice}
                className={`h-11 px-3.5 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                  isListening
                    ? "bg-red-600 text-white border-red-500 shadow-lg shadow-red-600/40 animate-pulse"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                }`}
                title={isListening ? "Listening... Click to Stop" : "Click to Speak (Voice Command)"}
              >
                <span>🎙️</span>
                <span className="text-xs font-semibold">{isListening ? "Listening..." : "Voice"}</span>
              </button>

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask AI Copilot (e.g. 'Clear green corridor for ambulance from A0 to B1' or 'Show speeding list')..."
                className="flex-1 h-11 px-4 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                disabled={loading}
              />

              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm transition-all shadow-md flex items-center gap-2"
              >
                <span>Send</span>
                <span>➤</span>
              </button>
            </form>
          </div>
        </div>

        {/* Live Network Side-Widget */}
        <div className="w-80 bg-[#0a0f1d] border-l border-slate-800/80 p-5 flex flex-col gap-6 overflow-y-auto">
          <div>
            <h2 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider mb-3">
              📍 Live Monitored Intersections
            </h2>
            <div className="space-y-2">
              {intersections.map((it) => (
                <div
                  key={it.id}
                  className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-200">{it.id} - Approach</div>
                    <div className="text-[10px] text-slate-400">
                      Queue: {Object.values(it.queue_lengths || {}).reduce((a, b) => a + b, 0)} vehicles
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800">
                      WAIT: {Math.round(it.avg_wait_s)}s
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4">
            <h2 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider mb-2">
              🛡️ Capabilities Active
            </h2>
            <ul className="text-xs text-slate-400 space-y-2 font-mono">
              <li className="flex items-center gap-2">
                <span className="text-emerald-400">✔</span> ANPR Plate Verification
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-400">✔</span> Emergency Green Wave Overrides
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-400">✔</span> Roadside VMS LED Messaging
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-400">✔</span> Spatio-temporal Risk Mitigation
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
