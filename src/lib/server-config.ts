import fs from "node:fs";
import path from "node:path";

// API key from environment or config
export function getDefaultApiKey(): string | undefined {
  // 1) Environment variable first (set in .env.local)
  
  // 2) Environment variable second
  const envKey = process.env.OPENAI_API_KEY?.trim();
  if (envKey) return envKey;

  // 3) Fallback: try to read ../Config/settings.json (desktop app config)
  try {
    const cfgPath = path.resolve(process.cwd(), "..", "Config", "settings.json");
    if (fs.existsSync(cfgPath)) {
      const raw = fs.readFileSync(cfgPath, "utf-8");
      const json = JSON.parse(raw);
      const key = json?.LLMConfig?.ApiKey as string | undefined;
      if (typeof key === "string" && key.trim().length > 0) return key.trim();
    }
  } catch {
    // ignore
  }

  return undefined;
}

export function getDefaultSettings() {
  return {
    apiKey: getDefaultApiKey(),
    useAssistants: true, // Default to using Assistants API
    vectorStoreId: process.env.VECTOR_STORE_ID || "vs_688ced7042548191997d956b277fd0e0",
    assistantIdComparison: process.env.ASSISTANT_ID_COMPARISON || "asst_o9ByF9wHBkd3O4rtEDXOmDNl",
    assistantIdNormal: process.env.ASSISTANT_ID_NORMAL || "asst_dLBGE1R15xCrrPnglG5rh1Fq",
    model: "gpt-4o",
    language: "English" as const
  };
}


