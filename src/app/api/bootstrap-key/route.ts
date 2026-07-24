import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

type BootstrapBody = {
  apiKey?: string;
  model?: string;
  language?: string;
  vectorStoreId?: string;
  rotate?: boolean;
  verboseOpenAI?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BootstrapBody;
    const apiKey = (body?.apiKey || "").trim();
    const model = (body?.model || "").trim();
    const language = (body?.language || "").trim();
    const vectorStoreId = (body?.vectorStoreId || "").trim();
    const rotate = Boolean(body?.rotate);
    const verboseOpenAI = Boolean(body?.verboseOpenAI);

    if (!apiKey) {
      return new Response(JSON.stringify({ ok: false, error: "Missing apiKey" }), {
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }

    const configDir = path.resolve(process.cwd(), "..", "Config");
    const configPath = path.join(configDir, "settings.json");

    // Ensure directory exists
    fs.mkdirSync(configDir, { recursive: true });

    if (fs.existsSync(configPath) && !rotate) {
      // Already bootstrapped; do not overwrite
      // However we may need to merge verbose flag without overwriting api key
      if (verboseOpenAI || model || language || vectorStoreId) {
        try {
          const prev = JSON.parse(fs.readFileSync(configPath, "utf-8"));
          if (model) prev.LLMConfig = { ...(prev.LLMConfig||{}), Model: model };
          if (language) prev.Language = language;
          if (vectorStoreId) prev.VectorStoreId = vectorStoreId;
          if (typeof verboseOpenAI === "boolean") prev.VerboseOpenAI = verboseOpenAI;
          fs.writeFileSync(configPath, JSON.stringify(prev, null, 2), "utf-8");
        } catch {}
      }
      return new Response(JSON.stringify({ ok: true, alreadyConfigured: true, merged: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }

    const payload: any = {
      LLMConfig: {
        ApiKey: apiKey
      }
    };
    if (model) payload.LLMConfig.Model = model;
    if (language) payload.Language = language;
    if (vectorStoreId) payload.VectorStoreId = vectorStoreId;
    if (typeof verboseOpenAI === "boolean") payload.VerboseOpenAI = verboseOpenAI;

    fs.writeFileSync(configPath, JSON.stringify(payload, null, 2), "utf-8");

    const last4 = apiKey.slice(-4);
    return new Response(JSON.stringify({ ok: true, saved: true, last4 }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  } catch (error) {
    console.error("Error bootstrapping API key:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
}


