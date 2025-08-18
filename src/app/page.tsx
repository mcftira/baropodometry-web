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
  Package
} from "lucide-react";

type Stage = "neutral" | "closed_eyes" | "cotton_rolls";
type AnalysisMode = "normal" | "comparison";

interface StageData {
  textMetrics?: Record<string, unknown>;
  visionMetrics?: Record<string, unknown>;
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
}

export default function Home() {
  const [files, setFiles] = useState<Partial<Record<Stage, File>>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [statusMessages, setStatusMessages] = useState<string[]>([]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("normal");

  // Auto-advance carousel when new messages arrive
  useEffect(() => {
    if (statusMessages.length > 0) {
      setCurrentMessageIndex(statusMessages.length - 1);
    }
  }, [statusMessages]);

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
      "🔄 Initializing comparison analysis",
      "📤 Uploading PDF files",
      "✅ PDFs validated successfully",
      "🧵 Creating analysis thread",
      "🤖 Engaging Comparison Expert",
      "📊 Extracting Neutral stage metrics",
      "👁️ Analyzing Closed Eyes data",
      "🦷 Processing Cotton Rolls measurements",
      "📈 Computing Romberg ratio",
      "📈 Computing Cotton Effect",
      "📚 Searching medical literature",
      "✍️ Generating clinical interpretation",
      "✅ Analysis complete"
    ] : [
      "🔄 Initializing stage analysis",
      "📤 Uploading PDF files",
      "✅ PDFs validated successfully",
      "🧵 Creating analysis thread",
      "🤖 Engaging Analysis Expert",
      "📊 Reading Global Synthesis values",
      "📏 Extracting L/S Ratio metrics",
      "🎯 Analyzing velocity parameters",
      "📐 Computing ellipse areas",
      "🔍 Processing stabilograms",
      "🌡️ Analyzing heatmaps",
      "📚 Searching knowledge base",
      "✍️ Generating diagnosis",
      "✅ Analysis complete"
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
      const res = await fetch("/api/analyze", { 
        method: "POST", 
        body: form 
      });
      
      const data = await res.json();
      
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
          <h1 className="text-2xl font-semibold tracking-tight">Baropodometry Analyzer Web</h1>
          <div className="text-sm opacity-80 flex items-center gap-3">
            <a href="/settings" className="underline underline-offset-4">Settings</a>
            <span>Modern Medical UI · 2025</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full p-6">
        {!result ? (
          <div className="grid gap-6 md:grid-cols-2">
            <section className="glass-card p-6">
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload · 3 PDFs (1 per stage)
              </h2>
              <div className="grid gap-3">
                <Uploader 
                  label="Neutral" 
                  file={files.neutral}
                  onPick={(f) => onPick("neutral", f)} 
                />
                <Uploader 
                  label="Closed Eyes" 
                  file={files.closed_eyes}
                  onPick={(f) => onPick("closed_eyes", f)} 
                />
                <Uploader 
                  label="Cotton Rolls (Bite)" 
                  file={files.cotton_rolls}
                  onPick={(f) => onPick("cotton_rolls", f)} 
                />
              </div>
              
              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-medium opacity-80">Choose Analysis Type:</h3>
                <div className="flex gap-3">
                  <button 
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex-1" 
                    onClick={() => onSubmit("normal")} 
                    disabled={busy || !hasAllFiles}
                  >
                    {busy && analysisMode === "normal" ? "Processing..." : "Stage Analysis"}
                  </button>
                  <button 
                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed flex-1" 
                    onClick={() => onSubmit("comparison")} 
                    disabled={busy || !hasAllFiles}
                  >
                    {busy && analysisMode === "comparison" ? "Processing..." : "Comparison Analysis"}
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
                              if (msg.includes('✅') || msg.includes('complete')) return <CheckCircle2 className="h-6 w-6 text-green-600" />;
                              if (msg.includes('📤') || msg.includes('Upload')) return <Upload className="h-6 w-6 text-blue-600" />;
                              if (msg.includes('📄') || msg.includes('PDF')) return <FileText className="h-6 w-6 text-orange-600" />;
                              if (msg.includes('🤖') || msg.includes('AI') || msg.includes('Assistant')) return <Brain className="h-6 w-6 text-purple-600" />;
                              if (msg.includes('🔍') || msg.includes('Analyz')) return <Search className="h-6 w-6 text-indigo-600" />;
                              if (msg.includes('📊') || msg.includes('metric')) return <Activity className="h-6 w-6 text-cyan-600" />;
                              if (msg.includes('👁') || msg.includes('Eyes')) return <Eye className="h-6 w-6 text-teal-600" />;
                              if (msg.includes('⚙️') || msg.includes('model')) return <Package className="h-6 w-6 text-gray-600" />;
                              return <FileCheck className="h-6 w-6 text-blue-600" />;
                            };
                            
                            return (
                              <>
                                {getIcon()}
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-800">
                                    {msg.replace(/[✅❌⚠️🔄📤📄🤖🔍📊👁⚙️🦷]/g, '').trim()}
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
              <h2 className="text-2xl font-semibold">
                {analysisMode === "comparison" ? "Comparison Analysis Results" : "Stage Analysis Results"}
              </h2>
              <button 
                onClick={() => { setResult(null); setFiles({}); }}
                className="text-sm underline"
              >
                New Analysis
              </button>
            </div>

            {/* KPI Cards - Only show for comparison mode */}
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

            {/* Stage Metrics - Show for normal mode */}
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
                          <p>✓ Data extracted</p>
                          {Object.keys(result.stages[stage] as StageData).length > 0 && (
                            <p className="opacity-60">
                              {Object.keys(result.stages[stage] as StageData).join(", ")}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="opacity-60">No data</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Summary for Comparison Mode */}
            {result.comparisons?.summary && (
              <section className="glass-card p-6">
                <h3 className="text-lg font-medium mb-3">Clinical Summary</h3>
                <p className="text-sm whitespace-pre-wrap">{result.comparisons.summary}</p>
              </section>
            )}

            {/* Clinical Report for Stage Analysis Mode */}
            {analysisMode === "normal" && result.interpretation && (
              <div className="space-y-4">
                {result.interpretation.vision_findings && (
                  <section className="glass-card p-6">
                    <h3 className="text-lg font-medium mb-3">Vision Findings</h3>
                    <p className="text-sm whitespace-pre-wrap">{result.interpretation.vision_findings}</p>
                  </section>
                )}
                
                {result.interpretation.clinical_interpretation && (
                  <section className="glass-card p-6">
                    <h3 className="text-lg font-medium mb-3">Clinical Interpretation</h3>
                    <p className="text-sm whitespace-pre-wrap">{result.interpretation.clinical_interpretation}</p>
                  </section>
                )}
                
                {result.interpretation.literature_support && (
                  <section className="glass-card p-6">
                    <h3 className="text-lg font-medium mb-3">Literature Support</h3>
                    <p className="text-sm whitespace-pre-wrap">{result.interpretation.literature_support}</p>
                  </section>
                )}
                
                {result.interpretation.conclusion && (
                  <section className="glass-card p-6">
                    <h3 className="text-lg font-medium mb-3">Conclusion</h3>
                    <p className="text-sm whitespace-pre-wrap">{result.interpretation.conclusion}</p>
                  </section>
                )}
                
                {result.interpretation.diagnosis && (
                  <section className="glass-card p-6 bg-blue-50">
                    <h3 className="text-lg font-medium mb-3 text-blue-900">Provisional Diagnosis</h3>
                    <p className="text-sm whitespace-pre-wrap text-blue-800">{result.interpretation.diagnosis}</p>
                    <p className="text-xs mt-3 opacity-70">Note: This is a provisional clinical impression. Clinical correlation and further evaluation are advised.</p>
                  </section>
                )}
              </div>
            )}

            {/* Raw JSON Toggle */}
            <section className="glass-card p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium">Detailed Data</h3>
                <button 
                  onClick={() => setShowRaw(!showRaw)}
                  className="text-sm underline"
                >
                  {showRaw ? "Hide" : "Show"} Raw JSON
                </button>
              </div>
              {showRaw && (
                <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-96 p-3 bg-gray-50 rounded">
                  {JSON.stringify(result, null, 2)}
                </pre>
              )}
            </section>

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
                className="btn-primary"
              >
                Export JSON
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

function Uploader({ label, file, onPick }: { label: string; file?: File; onPick: (f?: File) => void }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium flex items-center justify-between">
        {label}
        {file && <span className="text-xs opacity-60">{file.name}</span>}
      </span>
      <input
        type="file"
        accept="application/pdf"
        className="block w-full rounded-lg border border-[color:var(--muted)] bg-white/60 p-2 text-sm"
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