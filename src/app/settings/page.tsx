"use client";
import { useEffect, useState } from "react";
import { loadSettings, saveSettings } from "@/src/lib/settings";
import type { AppSettings } from "@/src/lib/types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({ language: "English" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings((s) => ({ ...s, ...loadSettings() }));
  }, []);

  function update<K extends keyof AppSettings>(k: K, v: AppSettings[K]) {
    setSettings((s) => ({ ...s, [k]: v }));
  }

  function onSave() {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="app-shell font-sans">
      <header className="px-6 py-4 brand-gradient border-b border-[color:var(--muted)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          {saved && <span className="text-sm text-emerald-700">Saved</span>}
        </div>
      </header>

      <main className="max-w-4xl mx-auto w-full p-6 grid gap-6">
        <section className="glass-card p-6 grid gap-4">
          <div className="grid gap-1">
            <label className="text-sm font-medium">OpenAI API Key</label>
            <input
              type="password"
              value={settings.apiKey || ""}
              onChange={(e) => update("apiKey", e.target.value)}
              placeholder="sk-..."
              className="rounded-lg border border-[color:var(--muted)] p-2"
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium">Model</label>
            <input
              type="text"
              value={settings.model || "gpt-4o"}
              onChange={(e) => update("model", e.target.value)}
              className="rounded-lg border border-[color:var(--muted)] p-2"
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium">Vector Store ID</label>
            <input
              type="text"
              value={settings.vectorStoreId || ""}
              onChange={(e) => update("vectorStoreId", e.target.value)}
              className="rounded-lg border border-[color:var(--muted)] p-2"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="useAssistants"
              type="checkbox"
              checked={!!settings.useAssistants}
              onChange={(e) => update("useAssistants", e.target.checked)}
            />
            <label htmlFor="useAssistants">Use Assistants API (else Responses API)</label>
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium">Language</label>
            <select
              value={settings.language || "English"}
              onChange={(e) => update("language", e.target.value as AppSettings["language"])}
              className="rounded-lg border border-[color:var(--muted)] p-2"
            >
              <option>English</option>
              <option>Hungarian</option>
            </select>
          </div>
          <div>
            <button className="btn-primary" onClick={onSave}>Save</button>
          </div>
        </section>
      </main>

      <footer className="px-6 py-4 text-sm opacity-70 text-center">© 2025 Baropodometry · Medical UI</footer>
    </div>
  );
}


