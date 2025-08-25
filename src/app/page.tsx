"use client";
import { useState, useEffect } from "react";
import { 
  Upload, 
  FileCheck, 
  Activity, 
  Brain, 
  Search, 
  CheckCircle2, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
  Eye,
  Package,
  FileUp,
  TrendingUp,
  BarChart3,
  Heart,
  Download,
  RefreshCw,
  Info,
  Zap,
  Target
} from "lucide-react";
import MarkdownReport from "@/components/MarkdownReport";
import ReportSummaryCard from "@/components/ReportSummaryCard";
import DebugLogViewer from "@/components/DebugLogViewer";
import PosturalRadarChart from "@/components/PosturalRadarChart";
import RombergWaterfallChart from "@/components/RombergWaterfallChart";
import VNStatusDistribution from "@/components/VNStatusDistribution";
import LoadBalanceVisualization from "@/components/LoadBalanceVisualization";
import FFTFrequencyDashboard from "@/components/FFTFrequencyDashboard";

// Lightweight client-side debug logger (always on for troubleshooting)
function dlog(...args: any[]) {
  if (typeof window !== "undefined") {
    // eslint-disable-next-line no-console
    console.log("[UI]", ...args);
  }
}

// Deep client-side network logger: logs all fetch requests/responses
if (typeof window !== "undefined" && !(window as any).__fetchPatched) {
  (window as any).__fetchPatched = true;
  const nativeFetch = window.fetch.bind(window);

  async function digestSha256Hex(buf: ArrayBuffer, take: number = 12): Promise<string> {
    try {
      const hash = await crypto.subtle.digest("SHA-256", buf);
      const view = new Uint8Array(hash);
      let hex = "";
      for (let i = 0; i < view.length; i++) hex += view[i].toString(16).padStart(2, "0");
      return hex.slice(0, take);
    } catch {
      return "sha-error";
    }
  }

  function headersToObject(headers?: HeadersInit): Record<string, string> {
    const out: Record<string, string> = {};
    try {
      if (!headers) return out;
      const h = new Headers(headers as any);
      h.forEach((v, k) => {
        // Mask sensitive
        if (k.toLowerCase() === "authorization") out[k] = v ? `${v.slice(0, 8)}…` : "";
        else out[k] = v;
      });
    } catch {}
    return out;
  }

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      const url = typeof input === "string" ? input : (input as Request).url || String(input);
      const method = (init?.method || (input as Request)?.method || "GET").toUpperCase();
      const hdrs = headersToObject(init?.headers || (input as Request)?.headers as any);
      let bodyInfo: any = null;

      if (init?.body instanceof FormData) {
        const fd = init.body as FormData;
        const items: any[] = [];
        const promises: Promise<void>[] = [];
        fd.forEach((v, k) => {
          if (v instanceof File) {
            const file: File = v as File;
            const info: any = { key: k, name: file.name, type: file.type, size: file.size, sha256_12: "" };
            const p = file.arrayBuffer().then((buf) => digestSha256Hex(buf).then((hex) => { info.sha256_12 = hex; }));
            promises.push(p);
            items.push(info);
          } else {
            items.push({ key: k, value: String(v) });
          }
        });
        await Promise.all(promises);
        bodyInfo = { type: "FormData", items };
      } else if (typeof init?.body === "string") {
        bodyInfo = { type: "string", length: init.body.length, content: init.body };
      } else if (init?.body && typeof (init.body as any).getReader === "function") {
        bodyInfo = { type: "stream" };
      }

      dlog("[NET] →", method, url, { headers: hdrs, body: bodyInfo });

      const res = await nativeFetch(input as any, init);
      const resClone = res.clone();
      const contentType = resClone.headers.get("content-type") || "";
      let body: any = null;
      try {
        if (contentType.includes("application/json")) body = await resClone.text();
        else if (contentType.startsWith("text/")) body = await resClone.text();
        else body = `<${contentType || "binary"}> bytes=${(await resClone.arrayBuffer()).byteLength}`;
      } catch (e) {
        body = `<unreadable: ${String(e)}>\n`;
      }
      dlog("[NET] ←", method, url, {
        status: res.status,
        headers: headersToObject(res.headers as any),
        body
      });
      return res;
    } catch (err) {
      dlog("[NET] fetch error:", err);
      throw err;
    }
  }) as typeof window.fetch;
}

type Stage = "neutral" | "closed_eyes" | "cotton_rolls";
type AnalysisMode = "normal" | "comparison";

interface StageData {
  mainStabilometric?: Record<string, unknown>;
  footCenters?: {
    left?: Record<string, unknown>;
    right?: Record<string, unknown>;
  };
  swayDensity?: Record<string, unknown>;
  globalSynthesis?: Record<string, unknown>;
  visualAnalysis?: Record<string, unknown>;
}

interface ComparisonData {
  ratio?: number;
  deltaPct?: number;
  direction?: "improvement" | "worsening" | "neutral";
  length?: { ratio?: number; deltaPct?: number; direction?: string };
  area?: { ratio?: number; deltaPct?: number; direction?: string };
  velocity?: { ratio?: number; deltaPct?: number; direction?: string };
}

interface AnalysisResult {
  patient?: { name?: string; dateTime?: string };
  stages?: {
    neutral?: StageData;
    closed_eyes?: StageData;
    cotton_rolls?: StageData;
  };
  comparisons?: {
    romberg?: ComparisonData;
    cottonEffect?: ComparisonData;
    summary?: string;
    confidence?: number;
  };
  interpretation?: {
    vision_findings?: string;
    clinical_interpretation?: string;
    literature_support?: string;
    conclusion?: string;
    diagnosis?: string;
    evidence_status?: "VALID" | "INVALID";
    refusal_reason?: string | null;
  };
  // New dual-report fields for Responses API pipeline
  extractionReportText?: string;
  augmentedReportText?: string;
  extractionReportJson?: any;
}

export default function Home() {
  const [files, setFiles] = useState<Partial<Record<Stage, File>>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [statusMessages, setStatusMessages] = useState<string[]>([]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("normal");

  // Derive structured extraction JSON if available
  const extracted = (() => {
    const r: any = result as any;
    if (!r) return undefined;
    if (r.extractionReportJson) {
      dlog("extracted from extractionReportJson", Object.keys(r.extractionReportJson || {}));
      return r.extractionReportJson;
    }
    const text: string | undefined = r.extractionReportText;
    if (!text) return undefined;
    const trimFences = (s: string) => {
      const fs = "<<<JSON_START>>>";
      const fe = "<<<JSON_END>>>";
      const i = s.indexOf(fs);
      const j = s.lastIndexOf(fe);
      if (i !== -1 && j !== -1 && j > i) return s.substring(i + fs.length, j).trim();
      // fallback: split at first '{'
      const k = s.indexOf("{");
      return k >= 0 ? s.substring(k) : s;
    };
    try {
      const parsed = JSON.parse(trimFences(text));
      dlog("extracted parsed from text", parsed ? Object.keys(parsed) : null);
      return parsed;
    } catch (e) {
      dlog("extracted parse error", e);
      return undefined;
    }
  })();

  const hasRespReports = Boolean(extracted || result?.augmentedReportText);

  // Small helpers for safe access/formatting
  const getNumber = (v: any): string => (typeof v === "number" ? v.toFixed(2) : "—");
  const getPct = (v: any): string => (typeof v === "string" ? v : v == null ? "" : String(v));
  const pickGlobals = (test: any) => {
    const p1 = test?.page1 || {};
    // Handle new nested structure where metrics are in global_metrics with value/vn_status objects
    if (p1.global_metrics) {
      // Extract just the values from the nested structure
      const flattened: any = {};
      Object.entries(p1.global_metrics).forEach(([key, data]: [string, any]) => {
        if (data && typeof data === 'object' && 'value' in data) {
          flattened[key] = data.value;
        } else {
          flattened[key] = data;
        }
      });
      return flattened;
    }
    // Fallback to legacy structure
    return p1.globals || p1;
  };
  const pickLoads = (test: any) => {
    const p1 = test?.page1 || {};
    return p1.loads || p1;
  };
  const cmp = extracted?.comparisons;
  const cmpFmt = (o?: any) => (o && o.ratio != null ? `${Number(o.ratio).toFixed(2)} (${getPct(o.pct_change)})` : "—");
  const cmpAngleFmt = (o?: any) => {
    if (!o) return "—";
    if (typeof o?.delta_deg === "number") {
      const signFlip = o?.sign_flip ? " (sign flip)" : "";
      return `${o.delta_deg.toFixed(2)}°${signFlip}`;
    }
    // Fallback to ratio formatting if object not present
    if (o?.ratio != null) return `${Number(o.ratio).toFixed(2)} (${getPct(o.pct_change)})`;
    return "—";
  };

  function VNChip({ status }: { status?: string }) {
    if (!status) return null as any;
    const map: Record<string, string> = {
      within: "bg-emerald-50 text-emerald-800 border-emerald-200",
      above: "bg-orange-50 text-orange-800 border-orange-200",
      below: "bg-blue-50 text-blue-800 border-blue-200",
      not_printed: "bg-gray-50 text-gray-700 border-gray-200"
    };
    const cls = map[status] || "bg-gray-50 text-gray-700 border-gray-200";
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] whitespace-nowrap ${cls}`}>{status}</span>
    );
  }

  // V.N. status helpers
  const getVNStatus = (test: any, key: string): string | undefined => {
    const p1 = test?.page1 || {};
    // Handle new nested structure
    if (p1.global_metrics && p1.global_metrics[key]) {
      return p1.global_metrics[key].vn_status;
    }
    // Fallback to legacy flat structure
    const g = pickGlobals(test) || {};
    return g?.[`${key}_vn_status`];
  };

  // Auto-advance carousel when new messages arrive
  useEffect(() => {
    if (statusMessages.length > 0) {
      setCurrentMessageIndex(statusMessages.length - 1);
    }
  }, [statusMessages]);

  // Debug: log render gates and expose globals for inspection
  useEffect(() => {
    (window as any).__analysisMode = analysisMode;
    (window as any).__result = result;
    (window as any).__extracted = extracted;
    dlog("render gate → analysisMode:", analysisMode,
      "has result:", !!result,
      "extracted?:", !!extracted,
      "augTextLen:", (result?.augmentedReportText || "").length,
      "keys(result):", result ? Object.keys(result as any) : null);
  }, [analysisMode, result, extracted]);

  // Debug: track main visibility gate
  useEffect(() => {
    dlog("visibility gate → hasRespReports:", hasRespReports, {
      extracted: !!extracted,
      augmented: !!(result?.augmentedReportText)
    });
  }, [hasRespReports, extracted, result?.augmentedReportText]);

  function onPick(stage: Stage, f?: File) {
    setFiles((prev) => ({ ...prev, [stage]: f }));
    setError(null);
  }

  async function onSubmit(mode: AnalysisMode) {
    setBusy(true);
    setError(null);
    setResult(null);
    setAnalysisMode(mode);
    setProgress("Processing analysis...");
    
    // Set dummy status messages for carousel
    const dummyMessages = mode === "comparison" ? [
      "Initializing comparison analysis",
      "Uploading PDF files to server",
      "Validating PDF structure",
      "Creating analysis thread",
      "Engaging Comparison Expert Assistant",
      "Extracting Neutral stage metrics",
      "Analyzing Closed Eyes data",
      "Processing Cotton Rolls measurements",
      "Computing Romberg ratio (Closed Eyes/Neutral)",
      "Computing Cotton Effect (Cotton Rolls/Closed Eyes)",
      "Searching medical literature database",
      "Generating clinical interpretation",
      "Finalizing analysis report"
    ] : [
      "Initializing stage analysis",
      "Uploading PDF files to server",
      "Validating PDF structure",
      "Creating analysis thread",
      "Engaging Analysis Expert Assistant",
      "Reading Global Synthesis values",
      "Extracting L/S Ratio and foot pressures",
      "Analyzing COP velocity parameters",
      "Computing ellipse areas and ratios",
      "Processing foot stabilograms",
      "Analyzing Sway Density curves",
      "Extracting FFT frequency data",
      "Processing 3D load distribution",
      "Reading Postural Index Dashboard",
      "Searching knowledge base for references",
      "Generating clinical diagnosis"
    ];
    
    setStatusMessages(dummyMessages);
    
    // Simulate progress through messages
    let messageIndex = 0;
    const progressInterval = setInterval(() => {
      if (messageIndex < dummyMessages.length - 1) {
        messageIndex++;
        setCurrentMessageIndex(messageIndex);
      }
    }, 2000); // Change message every 2 seconds
    
    try {
      const form = new FormData();
      (Object.keys(files) as Stage[]).forEach((s) => {
        const f = files[s];
        if (f) form.append(s, f);
      });
      
      // Add analysis mode to form data
      form.append("mode", mode);
      
      // Use regular API (not streaming)
      const apiUrl = "/api/analyze";
      console.log("[UI] Calling API:", apiUrl);
      console.log("[UI] Request method: POST");
      console.log("[UI] Form data keys:", Array.from(form.keys()));
      console.log("[UI] Window location:", window.location.href);
      
      const res = await fetch(apiUrl, { 
        method: "POST", 
        body: form 
      });
      
      console.log("[UI] Response status:", res.status);
      console.log("[UI] Response headers:", Object.fromEntries(res.headers.entries()));
      console.log("[UI] Response URL:", res.url);
      console.log("[UI] Response type:", res.type);
      
      // Check if response is HTML instead of JSON
      const contentType = res.headers.get("content-type");
      console.log("[UI] Content-Type:", contentType);
      
      // Check for HTML error response
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("[UI] ERROR: Expected JSON but got:", contentType);
        console.error("[UI] Response body (first 500 chars):", text.substring(0, 500));
        
        if (text.includes("<!DOCTYPE") || text.includes("<html")) {
          console.error("[UI] ERROR: Received HTML instead of JSON. API route not found.");
          setError("API route not found. The server returned HTML instead of JSON. This usually means the API endpoint doesn't exist or isn't configured properly on Netlify.");
          setLoading(false);
          return;
        }
        
        setError(`Invalid response type: ${contentType}. Expected JSON. Response: ${text.substring(0, 200)}`);
        setLoading(false);
        return;
      }
      
      let data;
      try {
        data = await res.json();
      } catch (jsonError) {
        console.error("[UI] Failed to parse JSON:", jsonError);
        const text = await res.text();
        console.error("[UI] Raw response:", text.substring(0, 500));
        setError("Failed to parse server response as JSON");
        setLoading(false);
        return;
      }
      dlog("/api/analyze status:", res.status, "keys:", Object.keys(data||{}));
      if (data?.data) {
        const d = data.data;
        dlog("payload sizes → extractionTextLen:", (d.extractionReportText||"").length, 
          "augTextLen:", (d.augmentedReportText||"").length,
          "has extractionReportJson:", !!d.extractionReportJson);
      }
      
      if (!res.ok) {
        // Parse specific error types
        let errorMessage = data.error || `HTTP ${res.status}`;
        
        if (errorMessage.includes("rate_limit_exceeded")) {
          const match = errorMessage.match(/Please try again in ([\d.]+)s/);
          const seconds = match ? match[1] : "a few seconds";
          errorMessage = `⏱️ Rate limit exceeded. Please wait ${seconds} seconds and try again. Consider switching to GPT-4o Mini in Settings for higher limits.`;
        } else if (errorMessage.includes("No assistant found") || errorMessage.includes("asst_")) {
          errorMessage = `🔧 Assistant configuration error. Please check your Assistant IDs in Settings or recreate assistants.`;
        } else if (errorMessage.includes("API key") || errorMessage.includes("Incorrect API key")) {
          errorMessage = `🔑 Invalid API key. Please check your OpenAI API key in Settings.`;
        } else if (errorMessage.includes("Failed to upload")) {
          errorMessage = `📁 Failed to upload PDF files. Please try again or check if PDFs are valid.`;
        }
        
        throw new Error(errorMessage);
      }
      
      if (data.ok && data.data) {
        // Show final message
        setCurrentMessageIndex(dummyMessages.length - 1);
        setProgress("");
        
        // Wait a bit before showing results
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setResult(data.data);
        // Also mirror to window for manual inspection
        (window as any).__lastEnv = data;
        (window as any).__result = data.data;
        setStatusMessages([]);
      } else {
        throw new Error(data.error || "Invalid response");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      setError(msg);
      setProgress("");
      setStatusMessages([]);
    } finally {
      clearInterval(progressInterval);
      setBusy(false);
    }
  }

  const hasAllFiles = files.neutral && files.closed_eyes && files.cotton_rolls;

  return (
    <div className="app-shell font-sans">
      <header className="px-6 py-4 brand-gradient border-b border-[color:var(--muted)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-white/90" />
            <h1 className="text-2xl font-semibold tracking-tight">Baropodometry Analyzer Web</h1>
          </div>
          <div className="text-sm opacity-80 flex items-center gap-4">
            <button 
              onClick={async () => {
                console.log("[UI] Testing API connection...");
                try {
                  const testUrl = "/api/test";
                  console.log("[UI] Test URL:", testUrl);
                  const res = await fetch(testUrl);
                  console.log("[UI] Test response status:", res.status);
                  console.log("[UI] Test response URL:", res.url);
                  console.log("[UI] Test response headers:", Object.fromEntries(res.headers.entries()));
                  
                  const contentType = res.headers.get("content-type");
                  if (!contentType || !contentType.includes("application/json")) {
                    const text = await res.text();
                    console.error("[UI] Test failed - not JSON. Content-Type:", contentType);
                    console.error("[UI] Response body:", text.substring(0, 500));
                    alert(`API Test Failed!\n\nExpected JSON but got ${contentType}\n\nThis means API routes are not working on Netlify.\n\nCheck console for details.`);
                    return;
                  }
                  
                  const data = await res.json();
                  console.log("[UI] Test response data:", data);
                  alert(`API Test Success!\n\n${data.message}\n\nOpenAI Key: ${data.env.hasOpenAIKey ? '✓ Set' : '✗ Missing'}\nModel: ${data.env.model}\nLanguage: ${data.env.language}`);
                } catch (e) {
                  console.error("[UI] API test failed:", e);
                  alert(`API test failed!\n\n${e.message}\n\nCheck console for details.`);
                }
              }}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-md transition-colors flex items-center gap-1.5"
            >
              <Zap className="h-4 w-4" />
              Test API
            </button>
            <a href="/settings" className="flex items-center gap-1.5 underline underline-offset-4 hover:opacity-100 transition-opacity">
              <Zap className="h-4 w-4" />
              Settings
            </a>
            <span className="flex items-center gap-1.5">
              <Heart className="h-4 w-4" />
              Modern Medical UI · 2025
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full p-6">
        {!result ? (
          <div className="grid gap-6 md:grid-cols-2">
            <section className="glass-card p-6">
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <FileUp className="h-5 w-5 text-blue-600" />
                Upload · 3 PDFs (1 per stage)
              </h2>
              <div className="grid gap-3">
                <Uploader 
                  label="Neutral" 
                  icon={<Target className="h-4 w-4 text-gray-600" />}
                  file={files.neutral}
                  onPick={(f) => onPick("neutral", f)} 
                />
                <Uploader 
                  label="Closed Eyes" 
                  icon={<Eye className="h-4 w-4 text-gray-600" />}
                  file={files.closed_eyes}
                  onPick={(f) => onPick("closed_eyes", f)} 
                />
                <Uploader 
                  label="Cotton Rolls (Bite)" 
                  icon={<Package className="h-4 w-4 text-gray-600" />}
                  file={files.cotton_rolls}
                  onPick={(f) => onPick("cotton_rolls", f)} 
                />
              </div>
              
              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-medium opacity-80">Choose Analysis Type:</h3>
                <div className="flex gap-3">
                  <button 
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex-1 flex items-center justify-center gap-2" 
                    onClick={() => onSubmit("normal")} 
                    disabled={busy || !hasAllFiles}
                  >
                    {busy && analysisMode === "normal" ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
                    ) : (
                      <><BarChart3 className="h-4 w-4" /> Stage Analysis</>
                    )}
                  </button>
                  <button 
                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed flex-1 flex items-center justify-center gap-2" 
                    onClick={() => onSubmit("comparison")} 
                    disabled={busy || !hasAllFiles}
                  >
                    {busy && analysisMode === "comparison" ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
                    ) : (
                      <><TrendingUp className="h-4 w-4" /> Comparison Analysis</>
                    )}
                  </button>
                </div>
                <div className="text-xs opacity-60">
                  <p><strong>Stage Analysis:</strong> Extract metrics from each stage</p>
                  <p><strong>Comparison Analysis:</strong> Calculate Romberg & Cotton Effects</p>
                </div>
              </div>
              
              {!hasAllFiles && !busy && (
                <div className="mt-3 text-sm text-orange-600">Please upload all 3 PDFs</div>
              )}
              
              {error && (
                <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-800 mb-1">Error occurred:</p>
                      <p className="text-sm text-red-700">{error}</p>
                      {error.includes("Rate limit") && (
                        <div className="mt-2 pt-2 border-t border-red-200">
                          <a href="/settings" className="text-xs text-red-600 underline">
                            → Go to Settings to change model
          </a>
        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="glass-card p-6">
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Status
              </h2>
              {busy ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Loader2 className="animate-spin h-5 w-5 text-[color:var(--brand)]" />
                    <span className="text-sm font-medium">{progress}</span>
                  </div>
                  
                  {statusMessages.length > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs opacity-60">
                          Step {currentMessageIndex + 1} of {statusMessages.length}
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setCurrentMessageIndex(Math.max(0, currentMessageIndex - 1))}
                            disabled={currentMessageIndex === 0}
                            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setCurrentMessageIndex(Math.min(statusMessages.length - 1, currentMessageIndex + 1))}
                            disabled={currentMessageIndex === statusMessages.length - 1}
                            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg min-h-[80px] flex items-center">
                        <div className="flex items-center gap-3 w-full">
                          {(() => {
                            const msg = statusMessages[currentMessageIndex];
                            const getIcon = () => {
                              if (msg.toLowerCase().includes('final') || msg.toLowerCase().includes('complet')) return <CheckCircle2 className="h-6 w-6 text-green-600" />;
                              if (msg.toLowerCase().includes('upload')) return <Upload className="h-6 w-6 text-blue-600" />;
                              if (msg.toLowerCase().includes('pdf') || msg.toLowerCase().includes('validat')) return <FileText className="h-6 w-6 text-orange-600" />;
                              if (msg.toLowerCase().includes('assistant') || msg.toLowerCase().includes('expert')) return <Brain className="h-6 w-6 text-purple-600" />;
                              if (msg.toLowerCase().includes('analyz') || msg.toLowerCase().includes('process')) return <Search className="h-6 w-6 text-indigo-600" />;
                              if (msg.toLowerCase().includes('metric') || msg.toLowerCase().includes('extract')) return <Activity className="h-6 w-6 text-cyan-600" />;
                              if (msg.toLowerCase().includes('eyes') || msg.toLowerCase().includes('closed')) return <Eye className="h-6 w-6 text-teal-600" />;
                              if (msg.toLowerCase().includes('comput') || msg.toLowerCase().includes('ratio')) return <Package className="h-6 w-6 text-gray-600" />;
                              return <FileCheck className="h-6 w-6 text-blue-600" />;
                            };
                            
                            return (
                              <>
                                {getIcon()}
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-800">
                                    {msg}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {new Date().toLocaleTimeString()}
                                  </p>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                      
                      <div className="flex justify-center mt-3 gap-1">
                        {statusMessages.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setCurrentMessageIndex(idx)}
                            className={`h-1.5 rounded-full transition-all ${
                              idx === currentMessageIndex 
                                ? 'w-6 bg-[color:var(--brand)]' 
                                : 'w-1.5 bg-gray-300 hover:bg-gray-400'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="text-xs opacity-60 mt-3">
                    <details>
                      <summary className="cursor-pointer hover:opacity-80">What's happening?</summary>
                      <div className="mt-2 pl-4">
                        {analysisMode === "comparison" ? (
                          <>
                            The Comparison Expert is:
                            <ul className="list-disc list-inside mt-1 space-y-0.5">
                              <li>Computing Romberg ratio (Closed Eyes / Neutral)</li>
                              <li>Computing Cotton Effect (Cotton Rolls / Closed Eyes)</li>
                              <li>Evaluating stability changes</li>
                              <li>Searching medical literature for citations</li>
                              <li>Generating clinical interpretation</li>
                            </ul>
                          </>
                        ) : (
                          <>
                            The Analysis Expert is:
                            <ul className="list-disc list-inside mt-1 space-y-0.5">
                              <li>Reading Global Synthesis values</li>
                              <li>Extracting L/S Ratio, Velocity, Area</li>
                              <li>Analyzing stabilograms and heatmaps</li>
                              <li>Searching knowledge base for references</li>
                              <li>Identifying key postural metrics</li>
                            </ul>
                          </>
                        )}
                      </div>
                    </details>
                  </div>
                </div>
              ) : (
                <div className="text-sm opacity-60">
                  Ready to analyze. Upload all 3 PDF reports and choose analysis type.
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                {analysisMode === "comparison" ? (
                  <><TrendingUp className="h-6 w-6 text-blue-600" /> Comparison Analysis Results</>
                ) : (
                  <><BarChart3 className="h-6 w-6 text-emerald-600" /> Stage Analysis Results</>
                )}
              </h2>
              <button 
                onClick={() => { setResult(null); setFiles({}); }}
                className="text-sm underline flex items-center gap-1.5 hover:text-blue-600 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                New Analysis
              </button>
            </div>

            {/* KPI Cards - Only show for comparison mode (legacy JSON result) */}
            {analysisMode === "comparison" && result.comparisons && (
              <div className="grid gap-4 md:grid-cols-3">
                <KPICard 
                  title="Romberg Effect"
                  subtitle="Closed Eyes / Neutral"
                  value={result.comparisons.romberg}
                  color="blue"
                />
                <KPICard 
                  title="Cotton Rolls Effect"
                  subtitle="Cotton Rolls / Closed Eyes"
                  value={result.comparisons.cottonEffect}
                  color="green"
                />
                <KPICard 
                  title="Confidence"
                  subtitle="Analysis confidence"
                  value={result.comparisons.confidence ? `${(result.comparisons.confidence * 100).toFixed(0)}%` : "N/A"}
                  color="purple"
                />
              </div>
            )}

            {/* Stage Metrics - Show for normal mode (legacy JSON result) */}
            {analysisMode === "normal" && result.stages && (
              <div className="grid gap-4 md:grid-cols-3">
                {(["neutral", "closed_eyes", "cotton_rolls"] as const).map((stage) => (
                  <div key={stage} className="glass-card p-4">
                    <h3 className="text-sm font-medium opacity-80 mb-2">
                      {stage === "neutral" ? "Neutral" : 
                       stage === "closed_eyes" ? "Closed Eyes" : "Cotton Rolls"}
                    </h3>
                    <div className="text-xs space-y-1">
                      {result.stages?.[stage] ? (
                        <>
                          <p className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                            Data extracted
                          </p>
                          {(() => {
                            const data = result.stages[stage] as StageData;
                            const sections = [];
                            if (data.mainStabilometric) sections.push("Main Parameters");
                            if (data.footCenters) sections.push("Foot Centers");
                            if (data.swayDensity) sections.push("Sway Density");
                            if (data.globalSynthesis) sections.push("Global Synthesis");
                            if (data.visualAnalysis) sections.push("Visual Analysis");
                            
                            return sections.length > 0 && (
                              <p className="opacity-60 text-[10px]">
                                {sections.join(" • ")}
                              </p>
                            );
                          })()}
                        </>
                      ) : (
                        <p className="opacity-60">No data</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Summary for Comparison Mode (legacy JSON result) */}
            {result.comparisons?.summary && (
              <section className="glass-card p-6">
                <h3 className="text-lg font-medium mb-3">Clinical Summary</h3>
                <MarkdownReport content={result.comparisons.summary} className="mt-2" />
              </section>
            )}

            {/* Responses API reports (Objective + Augmented) */}
            {hasRespReports && (
              <div className="space-y-4">
                {/* Summary Card */}
                <ReportSummaryCard extracted={extracted} augmentedText={result.augmentedReportText} />
                
                {/* Objective Findings - Show First */}
                {extracted && (
                  <section className="glass-card p-6">
                    <h3 className="text-lg font-medium mb-3">Objective Findings (from PDFs)</h3>
                    <div className="text-sm space-y-4">
                      {extracted.patient?.name && (
                        <div className="flex items-center justify-between">
                          <p><strong>Patient:</strong> {extracted.patient.name}</p>
                          {extracted.tests?.A?.metadata?.test_datetime_local && (
                            <p className="opacity-70">{extracted.tests.A.metadata.test_datetime_local}</p>
                          )}
                        </div>
                      )}
                      {/* Condition summary cards */}
                      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
                        {(["A","B","C"] as const).map((k) => {
                          const t = extracted.tests?.[k];
                          if (!t) return null;
                          const g = pickGlobals(t);
                          const loads = pickLoads(t);
                          return (
                            <div key={k} className="p-4 rounded border bg-white/70">
                              <h4 className="text-sm font-semibold mb-3">{k === "A" ? "Neutral" : k === "B" ? "Closed Eyes" : "Cotton Rolls"}</h4>
                              <div className="space-y-4">
                                <div>
                                  <div className="text-xs text-gray-600 mb-2">Key Vitals</div>
                                  <div className="space-y-1.5">
                                    <div className="grid grid-cols-[60px_45px_30px_auto] gap-1 items-center text-xs">
                                      <span className="font-medium">Length:</span>
                                      <span className="text-right">{getNumber(g.length_mm)}</span>
                                      <span className="text-gray-500">mm</span>
                                      <VNChip status={getVNStatus(t, "length_mm")} />
                                    </div>
                                    <div className="grid grid-cols-[60px_45px_30px_auto] gap-1 items-center text-xs">
                                      <span className="font-medium">Area:</span>
                                      <span className="text-right">{getNumber(g.area_mm2)}</span>
                                      <span className="text-gray-500">mm²</span>
                                      <VNChip status={getVNStatus(t, "area_mm2")} />
                                    </div>
                                    <div className="grid grid-cols-[60px_45px_30px_auto] gap-1 items-center text-xs">
                                      <span className="font-medium">Velocity:</span>
                                      <span className="text-right">{getNumber(g.velocity_mm_s)}</span>
                                      <span className="text-gray-500">mm/s</span>
                                      <VNChip status={getVNStatus(t, "velocity_mm_s")} />
                                    </div>
                                    <div className="grid grid-cols-[60px_45px_30px_auto] gap-1 items-center text-xs">
                                      <span className="font-medium">L/S:</span>
                                      <span className="text-right">{getNumber(g.l_s_ratio)}</span>
                                      <span></span>
                                      <VNChip status={getVNStatus(t, "l_s_ratio")} />
                                    </div>
                                    <div className="grid grid-cols-[60px_45px_30px_auto] gap-1 items-center text-xs">
                                      <span className="font-medium">LFS:</span>
                                      <span className="text-right">{getNumber(g.lfs)}</span>
                                      <span></span>
                                      <VNChip status={getVNStatus(t, "lfs")} />
                                    </div>
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-600 mb-2">Loads & Pressures</div>
                                  <div className="space-y-1">
                                    <div className="text-xs flex items-center justify-between">
                                      <span className="font-medium">Loads:</span>
                                      <span>L {getNumber(loads.page6_left_load_pct)}% / R {getNumber(loads.page6_right_load_pct)}%</span>
                                    </div>
                                    <div className="text-xs flex items-center justify-between">
                                      <span className="font-medium">Mean P:</span>
                                      <span>L {getNumber(loads.left_mean_pressure)} / R {getNumber(loads.right_mean_pressure)}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {/* Comparisons */}
                      {extracted.comparisons && (
                        <div className="mt-2">
                          <h4 className="text-sm font-semibold mb-3">Computed Comparisons</h4>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="p-4 rounded border bg-white/60">
                              <h5 className="text-sm font-semibold mb-3">Romberg B/A</h5>
                              {(() => { const rb = cmp?.romberg_b_over_a || {}; return (
                                <div className="space-y-2 text-xs">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>Length: {cmpFmt(rb.length_mm)}</div>
                                    <div>Area: {cmpFmt(rb.area_mm2)}</div>
                                    <div>Velocity: {cmpFmt(rb.velocity_mm_s)}</div>
                                    <div>L/S: {cmpFmt(rb.l_s_ratio)}</div>
                                    <div>LFS: {cmpFmt(rb.lfs)}</div>
                                    <div>AP accel: {cmpFmt(rb.ap_acceleration_mm_s2)}</div>
                                  </div>
                                  <div>Ellipse A/P Δ: {cmpAngleFmt(rb.ellipse_ap_deviation_deg)}</div>
                                </div>
                              ); })()}
                            </div>
                            <div className="p-4 rounded border bg-white/60">
                              <h5 className="text-sm font-semibold mb-3">Cotton C/B</h5>
                              {(() => { const cb = cmp?.cotton_c_over_b || {}; return (
                                <div className="space-y-2 text-xs">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>Length: {cmpFmt(cb.length_mm)}</div>
                                    <div>Area: {cmpFmt(cb.area_mm2)}</div>
                                    <div>Velocity: {cmpFmt(cb.velocity_mm_s)}</div>
                                    <div>L/S: {cmpFmt(cb.l_s_ratio)}</div>
                                    <div>LFS: {cmpFmt(cb.lfs)}</div>
                                    <div>AP accel: {cmpFmt(cb.ap_acceleration_mm_s2)}</div>
                                  </div>
                                  <div>Ellipse A/P Δ: {cmpAngleFmt(cb.ellipse_ap_deviation_deg)}</div>
                                </div>
                              ); })()}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Discrepancies (if present) */}
                      {(["A","B","C"] as const).some((k) => extracted.tests?.[k]?.discrepancies) && (
                        <div className="mt-3 p-3 border rounded bg-amber-50">
                          <h5 className="text-xs font-semibold mb-1 flex items-center gap-1"><AlertCircle className="h-4 w-4 text-amber-600" /> Discrepancies</h5>
                          <div className="text-xs grid gap-1">
                            {(["A","B","C"] as const).map((k) => {
                              const disc = extracted.tests?.[k]?.discrepancies;
                              if (!disc) return null;
                              const items = Object.keys(disc);
                              return items.map((name: string, idx: number) => (
                                <div key={`${k}-${name}-${idx}`} className="flex items-center justify-between">
                                  <span className="opacity-70">{k} · {name}</span>
                                  <span className="opacity-80">decision: {disc[name]?.decision || "page1"}</span>
                                </div>
                              ));
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* Clinical Interpretation - Show Second */}
                {result.augmentedReportText && (
                  <section className="glass-card p-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-medium">Clinical Interpretation & Diagnosis</h3>
                      <button 
                        onClick={() => window.print()}
                        className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors print:hidden"
                      >
                        🖨️ Print Report
                      </button>
                    </div>
                    <div className="max-h-[600px] overflow-y-auto pr-2 print:max-h-none print:overflow-visible">
                      <MarkdownReport content={result.augmentedReportText} className="mt-4" />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200">Diagnosis</span>
                      <span className="px-2 py-1 rounded-full bg-blue-50 border border-blue-200">Evidence</span>
                      <span className="px-2 py-1 rounded-full bg-purple-50 border border-purple-200">References</span>
                    </div>
                  </section>
                )}

                {/* Data Visualizations */}
                {extracted && (
                  <section className="glass-card p-6">
                    <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Data Analysis & Visualizations
                    </h3>
                    
                    <div className="grid gap-6 lg:grid-cols-2">
                      {/* Postural Radar Chart */}
                      <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <PosturalRadarChart data={extracted.tests} />
                      </div>
                      
                      {/* Romberg/Cotton Waterfall */}
                      <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <RombergWaterfallChart 
                          romberg={extracted.comparisons?.romberg_b_over_a}
                          cotton={extracted.comparisons?.cotton_c_over_b}
                        />
                      </div>
                      
                      {/* VN Status Distribution */}
                      <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <VNStatusDistribution data={extracted.tests} />
                      </div>
                      
                      {/* Load Balance Visualization */}
                      <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <LoadBalanceVisualization data={extracted.tests} />
                      </div>
                    </div>
                    
                    {/* FFT Frequency Analysis - Full Width */}
                    <div className="mt-6 bg-white p-4 rounded-lg border border-gray-200">
                      <FFTFrequencyDashboard data={extracted.tests} />
                    </div>
                    
                    {/* Sensory System Summary */}
                    {extracted.comparisons?.sensory_ranking && (
                      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Sensory System Ranking</h4>
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-blue-500 text-white rounded-full text-xs font-medium">
                            Primary: {extracted.comparisons.sensory_ranking.primary}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="px-3 py-1 bg-blue-400 text-white rounded-full text-xs font-medium">
                            Secondary: {extracted.comparisons.sensory_ranking.secondary}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="px-3 py-1 bg-blue-300 text-white rounded-full text-xs font-medium">
                            Minor: {extracted.comparisons.sensory_ranking.minor}
                          </span>
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {/* Debug Logs Viewer (when verbose mode is enabled) */}
                {((result as any)?.debug?.verboseLogs) && (
                  <DebugLogViewer 
                    logs={(result as any).debug.verboseLogs || []}
                    extractionDiagnostics={(result as any).debug?.extractionDiagnostics}
                  />
                )}
                
                {/* Diagnostics (Agent 1) - Show only if verbose logs are not available */}
                {((result as any)?.debug?.extractionDiagnostics && !(result as any)?.debug?.verboseLogs) && (
                  <section className="glass-card p-6">
                    <h3 className="text-lg font-medium mb-3 flex items-center gap-2"><Info className="h-5 w-5" /> Extraction Diagnostics</h3>
                    <details>
                      <summary className="text-sm cursor-pointer opacity-80 hover:opacity-100">Show detailed extraction log</summary>
                      <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-96 p-3 bg-gray-50 rounded font-mono mt-3">{(result as any).debug.extractionDiagnostics}</pre>
                    </details>
                  </section>
                )}
              </div>
            )}



            {/* Export Options */}
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `baropodometry-${analysisMode}-${new Date().toISOString()}.json`;
                  a.click();
                }}
                className="btn-primary flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export JSON
              </button>
              {(result.extractionReportText || result.augmentedReportText) && (
                <button 
                  onClick={() => {
                    const text = `Primary Extraction Report\n\n${result.extractionReportText || ""}\n\n---\n\nKnowledge-Augmented Report\n\n${result.augmentedReportText || ""}`;
                    const blob = new Blob([text], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `baropodometry-${analysisMode}-${new Date().toISOString()}.txt`;
                    a.click();
                  }}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export Reports (TXT)
                </button>
              )}
              {/* Print-friendly */}
              <button
                onClick={() => window.print()}
                className="btn-secondary flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Print Summary
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="px-6 py-4 text-sm opacity-70 text-center mt-12">
        © 2025 Baropodometry · Medical UI
      </footer>
    </div>
  );
}

function Uploader({ label, icon, file, onPick }: { 
  label: string; 
  icon?: React.ReactNode;
  file?: File; 
  onPick: (f?: File) => void 
}) {
  return (
    <label className="flex flex-col gap-2 cursor-pointer group">
      <span className="text-sm font-medium flex items-center justify-between">
        <span className="flex items-center gap-2">
          {icon}
          {label}
        </span>
        {file && (
          <span className="text-xs opacity-60 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-600" />
            {file.name}
          </span>
        )}
      </span>
      <input
        type="file"
        accept="application/pdf"
        className="block w-full rounded-lg border border-[color:var(--muted)] bg-white/60 p-2 text-sm group-hover:border-blue-300 transition-colors"
        onChange={(e) => onPick(e.target.files?.[0] || undefined)}
      />
    </label>
  );
}

function KPICard({ title, subtitle, value, color }: { 
  title: string; 
  subtitle: string; 
  value: ComparisonData | number | string | undefined; 
  color: string;
}) {
  const formatValue = (v: ComparisonData | number | string | undefined): string => {
    if (!v) return "N/A";
    if (typeof v === "string") return v;
    if (typeof v === "number") return v.toFixed(2);
    if (typeof v === "object") {
      // Try to extract meaningful data
      if (v.ratio) return `${v.ratio.toFixed(2)}x`;
      if (v.length?.ratio) return `L: ${v.length.ratio?.toFixed(2)}x`;
      if (v.area?.ratio) return `A: ${v.area.ratio?.toFixed(2)}x`;
      if (v.velocity?.ratio) return `V: ${v.velocity.ratio?.toFixed(2)}x`;
      return "See details";
    }
    return "N/A";
  };

  const bgColor = color === "blue" ? "bg-blue-50" : 
                  color === "green" ? "bg-green-50" : "bg-purple-50";
  const textColor = color === "blue" ? "text-blue-700" : 
                    color === "green" ? "text-green-700" : "text-purple-700";

  return (
    <div className={`glass-card p-4 ${bgColor}`}>
      <h3 className="text-sm font-medium opacity-80">{title}</h3>
      <p className={`text-2xl font-semibold mt-1 ${textColor}`}>{formatValue(value)}</p>
      <p className="text-xs opacity-60 mt-1">{subtitle}</p>
    </div>
  );
}