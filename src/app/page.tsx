"use client";
import { useState } from "react";

type Stage = "neutral" | "closed_eyes" | "cotton_rolls";

export default function Home() {
  const [files, setFiles] = useState<Partial<Record<Stage, File>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  function onPick(stage: Stage, f?: File) {
    setFiles((prev) => ({ ...prev, [stage]: f }));
  }

  async function onSubmit() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      (Object.keys(files) as Stage[]).forEach((s) => {
        const f = files[s];
        if (f) form.append(s, f);
      });
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Hiba";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell font-sans">
      <header className="px-6 py-4 brand-gradient border-b border-[color:var(--muted)]">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Baropodometry Analyzer Web</h1>
          <div className="text-sm opacity-80">Modern Medical UI · 2025</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full p-6 grid gap-6 sm:grid-cols-2">
        <section className="glass-card p-6">
          <h2 className="text-lg font-medium mb-4">Upload · 3 PDFs (1 per stage)</h2>
          <div className="grid gap-3">
            <Uploader label="Neutral" onPick={(f)=>onPick("neutral", f)} />
            <Uploader label="Closed Eyes" onPick={(f)=>onPick("closed_eyes", f)} />
            <Uploader label="Cotton Rolls (Bite)" onPick={(f)=>onPick("cotton_rolls", f)} />
          </div>
          <div className="mt-5 flex gap-3">
            <button className="btn-primary" onClick={onSubmit} disabled={busy}>
              {busy ? "Processing..." : "Start analysis"}
            </button>
          </div>
          {error && <p className="text-red-600 mt-3">{error}</p>}
        </section>

        <section className="glass-card p-6 min-h-[300px]">
          <h2 className="text-lg font-medium mb-4">Result (JSON)</h2>
          <pre className="text-xs whitespace-pre-wrap">{result || "No result yet."}</pre>
        </section>
      </main>

      <footer className="px-6 py-4 text-sm opacity-70 text-center">© 2025 Baropodometry · Medical UI</footer>
    </div>
  );
}

function Uploader({ label, onPick }: { label: string; onPick: (f?: File)=>void }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <input
        type="file"
        accept="application/pdf"
        className="block w-full rounded-lg border border-[color:var(--muted)] bg-white/60 p-2"
        onChange={(e)=>onPick(e.target.files?.[0] || undefined)}
      />
    </label>
  );
}
