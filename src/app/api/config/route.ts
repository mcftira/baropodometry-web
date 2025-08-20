import { NextRequest } from "next/server";
import { getDefaultSettings } from "@/lib/server-config";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  const s = getDefaultSettings();
  return new Response(JSON.stringify({
    ok: true,
    model: s.model,
    language: s.language,
    vectorStoreId: s.vectorStoreId,
    hasApiKey: Boolean(s.apiKey)
  }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}


