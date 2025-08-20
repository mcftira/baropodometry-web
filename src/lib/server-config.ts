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

function readLocalConfig(): {
  apiKey?: string;
  model?: string;
  language?: string;
  vectorStoreId?: string;
} {
  try {
    const cfgPath = path.resolve(process.cwd(), "..", "Config", "settings.json");
    if (fs.existsSync(cfgPath)) {
      const raw = fs.readFileSync(cfgPath, "utf-8");
      const json = JSON.parse(raw);
      return {
        apiKey: json?.LLMConfig?.ApiKey,
        model: json?.LLMConfig?.Model,
        language: json?.Language,
        vectorStoreId: json?.VectorStoreId
      };
    }
  } catch {
    // ignore
  }
  return {};
}

export function getDefaultSettings() {
  const local = readLocalConfig();
  const model = (process.env.MODEL?.trim() || local.model || "gpt-5") as "gpt-5" | "gpt-4o" | "gpt-4o-mini" | "gpt-4-turbo" | "gpt-3.5-turbo";
  const language = (process.env.LANGUAGE?.trim() as "English" | "Hungarian") || (local.language as "English" | "Hungarian") || "English";
  const vectorStoreId = process.env.VECTOR_STORE_ID || local.vectorStoreId || "vs_688ced7042548191997d956b277fd0e0"; // default clinic knowledge base
  return {
    apiKey: getDefaultApiKey(),
    model,
    language,
    vectorStoreId
  };
}


