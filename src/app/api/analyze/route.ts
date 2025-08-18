import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const neutral = form.get("neutral");
    const closed = form.get("closed_eyes");
    const cotton = form.get("cotton_rolls");

    if (!(neutral && closed && cotton)) {
      return new Response(JSON.stringify({ ok: false, error: "Hiányzó PDF(ek). 3 stage szükséges." }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

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
        summary: "POC stub: feldolgozás később kerül bekötésre.",
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


