"use client";
import { useState, useEffect } from "react";
import type { AppSettings } from "@/lib/types";
import { loadSettings, saveSettings } from "@/lib/settings";

const AVAILABLE_MODELS = [
  { value: "gpt-4o", label: "GPT-4o (Best quality, lowest rate limit)" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini (Good quality, high rate limit)" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo (High quality, medium rate limit)" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo (Basic quality, highest rate limit)" }
] as const;

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({
    apiKey: "",
    model: "gpt-4o-mini",
    language: "English",
    useAssistants: true,
    vectorStoreId: "",
    assistantIdComparison: "",
    assistantIdNormal: ""
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const loaded = loadSettings();
    if (loaded) {
      setSettings(loaded);
    }
  }, []);

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="app-shell font-sans">
      <header className="px-6 py-4 brand-gradient border-b border-[color:var(--muted)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <div className="text-sm opacity-80 flex items-center gap-3">
            <a href="/" className="underline underline-offset-4">Back to Analysis</a>
            <span>Modern Medical UI · 2025</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto w-full p-6">
        <div className="glass-card p-6 space-y-6">
          <div>
            <h2 className="text-lg font-medium mb-4">OpenAI Configuration</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  API Key <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={settings.apiKey || ""}
                  onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                  className="w-full px-3 py-2 border border-[color:var(--muted)] rounded-lg bg-white/60"
                  placeholder="sk-proj-..."
                />
                <p className="text-xs opacity-60 mt-1">
                  Your OpenAI API key. Keep this secret!
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Model
                </label>
                <select
                  value={settings.model || "gpt-4o-mini"}
                  onChange={(e) => setSettings({ ...settings, model: e.target.value as AppSettings["model"] })}
                  className="w-full px-3 py-2 border border-[color:var(--muted)] rounded-lg bg-white/60"
                >
                  {AVAILABLE_MODELS.map(model => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>
                <div className="mt-2 p-3 bg-blue-50 rounded-lg text-xs">
                  <strong>Model comparison:</strong>
                  <ul className="mt-1 space-y-1">
                    <li>• <strong>GPT-4o:</strong> Best for complex analysis, 30K TPM limit, $5/$15 per 1M tokens</li>
                    <li>• <strong>GPT-4o Mini:</strong> Recommended, 200K TPM limit, $0.15/$0.60 per 1M tokens</li>
                    <li>• <strong>GPT-4 Turbo:</strong> Good quality, 150K TPM limit, $10/$30 per 1M tokens</li>
                    <li>• <strong>GPT-3.5 Turbo:</strong> Basic analysis, 1M TPM limit, $0.50/$1.50 per 1M tokens</li>
                  </ul>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Language
                </label>
                <select
                  value={settings.language || "English"}
                  onChange={(e) => setSettings({ ...settings, language: e.target.value as AppSettings["language"] })}
                  className="w-full px-3 py-2 border border-[color:var(--muted)] rounded-lg bg-white/60"
                >
                  <option value="English">English</option>
                  <option value="Hungarian">Magyar</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-medium mb-4">Assistant Configuration</h2>
            
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.useAssistants}
                    onChange={(e) => setSettings({ ...settings, useAssistants: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">Use Assistants API</span>
                </label>
                <p className="text-xs opacity-60 mt-1 ml-6">
                  Enable to use pre-configured assistants with RAG knowledge base
                </p>
              </div>

              {settings.useAssistants && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Vector Store ID
                    </label>
                    <input
                      type="text"
                      value={settings.vectorStoreId || ""}
                      onChange={(e) => setSettings({ ...settings, vectorStoreId: e.target.value })}
                      className="w-full px-3 py-2 border border-[color:var(--muted)] rounded-lg bg-white/60 font-mono text-xs"
                      placeholder="vs_..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Comparison Assistant ID
                    </label>
                    <input
                      type="text"
                      value={settings.assistantIdComparison || ""}
                      onChange={(e) => setSettings({ ...settings, assistantIdComparison: e.target.value })}
                      className="w-full px-3 py-2 border border-[color:var(--muted)] rounded-lg bg-white/60 font-mono text-xs"
                      placeholder="asst_..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Normal Assistant ID
                    </label>
                    <input
                      type="text"
                      value={settings.assistantIdNormal || ""}
                      onChange={(e) => setSettings({ ...settings, assistantIdNormal: e.target.value })}
                      className="w-full px-3 py-2 border border-[color:var(--muted)] rounded-lg bg-white/60 font-mono text-xs"
                      placeholder="asst_..."
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[color:var(--muted)]">
            <button
              onClick={handleSave}
              className="btn-primary"
            >
              Save Settings
            </button>
            {saved && (
              <span className="text-sm text-green-600">✓ Settings saved</span>
            )}
          </div>
        </div>

        <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
          <h3 className="text-sm font-medium text-yellow-800 mb-2">⚠️ Rate Limit Information</h3>
          <p className="text-xs text-yellow-700">
            If you encounter "rate_limit_exceeded" errors, try:
          </p>
          <ul className="text-xs text-yellow-700 mt-1 list-disc list-inside">
            <li>Switching to GPT-4o Mini or GPT-3.5 Turbo</li>
            <li>Waiting a few seconds between requests</li>
            <li>Reducing the size of your PDF files</li>
          </ul>
        </div>
      </main>

      <footer className="px-6 py-4 text-sm opacity-70 text-center mt-12">
        © 2025 Baropodometry · Medical UI
      </footer>
    </div>
  );
}