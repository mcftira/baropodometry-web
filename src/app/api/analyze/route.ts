import { NextRequest } from "next/server";
import { getDefaultApiKey } from "@/lib/server-config";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const neutral = form.get("neutral");
    const closed = form.get("closed_eyes");
    const cotton = form.get("cotton_rolls");

    if (!(neutral && closed && cotton)) {
      return new Response(JSON.stringify({ ok: false, error: "Missing PDF(s). 3 stages required." }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // Ensure API key availability now (server-side)
    const apiKey = process.env.OPENAI_API_KEY || getDefaultApiKey();
    const apiKeyOk = typeof apiKey === "string" && apiKey.length > 10;

    // MVP stub: itt fogjuk hívni a Vision Assistant backendet vagy edge functiont.
    // Válaszként visszaadunk egy minta sémát, hogy a UI működjön.
    const demo = {
      patient: { name: null, dateTime: null },
      stages: {
        neutral: { textMetrics: {}, visionMetrics: {} },
        closed_eyes: { textMetrics: {}, visionMetrics: {} },
        cotton_rolls: { textMetrics: {}, visionMetrics: {} },
      },
      comparisons: {
        romberg: { length: null, area: null, velocity: null },
        cottonEffect: { length: null, area: null, velocity: null },
        summary: apiKeyOk
          ? "POC stub: processing will be connected later. API key detected."
          : "POC stub: processing will be connected later. No API key detected.",
        confidence: 0.0,
      },
    };

    return new Response(JSON.stringify({ ok: true, data: demo }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Hiba";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}


