import fs from "node:fs";
import path from "node:path";

export function getDefaultApiKey(): string | undefined {
  // 1) Environment variable first (safe)
  const envKey = process.env.OPENAI_API_KEY?.trim();
  if (envKey) return envKey;

  // 2) Fallback: try to read ../Config/settings.json (desktop app config)
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


