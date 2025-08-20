import { NextRequest } from "next/server";
import { getDefaultSettings } from "@/lib/server-config";

export const runtime = "nodejs";
export const maxDuration = 60; // 60 seconds timeout for processing

function toBase64DataUrl(name: string, mime: string, buffer: Buffer) {
  const base64 = buffer.toString("base64");
  return {
    filename: name || "file.pdf",
    file_data: `data:${mime || "application/pdf"};base64,${base64}`
  } as const;
}

export async function POST(req: NextRequest) {
  try {
    const reqId = Math.random().toString(36).slice(2, 8);
    const t0 = Date.now();
    console.log(`[analyze:${reqId}] Received request`);
    const form = await req.formData();
    const neutral = form.get("neutral") as File | null;
    const closed = form.get("closed_eyes") as File | null;
    const cotton = form.get("cotton_rolls") as File | null;
    const mode = (form.get("mode") as string | null) || "normal"; // "normal" or "comparison"

    if (!(neutral && closed && cotton)) {
      return new Response(JSON.stringify({ ok: false, error: "Missing PDF(s). 3 stages required." }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const settings = getDefaultSettings();
    console.log(`[analyze:${reqId}] Settings loaded → model=${settings.model} language=${settings.language} vectorStore=${settings.vectorStoreId ? 'set' : 'none'}`);
    if (!settings.apiKey) {
      console.error("No API key available");
      return new Response(JSON.stringify({ ok: false, error: "API key not configured" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    const { OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: settings.apiKey });

    // Prepare base64-embedded PDFs for Responses API
    const tPrep0 = Date.now();
    console.log(`[analyze:${reqId}] Preparing base64-embedded PDFs...`);
    const [neutralBuf, closedBuf, cottonBuf] = await Promise.all([
      Buffer.from(await neutral.arrayBuffer()),
      Buffer.from(await closed.arrayBuffer()),
      Buffer.from(await cotton.arrayBuffer()),
    ]);

    const files = [
      toBase64DataUrl(neutral.name, neutral.type || "application/pdf", neutralBuf),
      toBase64DataUrl(closed.name, closed.type || "application/pdf", closedBuf),
      toBase64DataUrl(cotton.name, cotton.type || "application/pdf", cottonBuf),
    ];

    const language = settings.language || "English";
    const model = settings.model || "gpt-5";
    const tPrep1 = Date.now();
    console.log(`[analyze:${reqId}] Prepared files in ${tPrep1 - tPrep0}ms`);

    // First pass: Extraction analysis directly on PDFs
    console.log(`[analyze:${reqId}] Starting extraction (Responses API call #1) using model=${model} ...`);
    const tExt0 = Date.now();
    const extractionPrompt = `You are a baropodometric/stabilometric expert. Analyze the three PDF test reports provided (A: Neutral/Eyes Open, B: Eyes Closed, C: Eyes Closed with Cotton Rolls).
Return a doctor-facing, concise but comprehensive report in ${language} with:
- Key global metrics (Length, Area, Velocity, L/S, ellipse ratio, torsion, COP coordinates, pressures) for each stage
- Per-foot metrics where present
- Sway Density parameters
- Computed comparisons: Romberg (B/A) and Cotton effect (C/B)
- Short interpretation notes. Avoid speculation; quote only values present on the PDFs.`;

    const extractionInput: any[] = [
      {
        role: "user",
        content: [
          { type: "input_text", text: extractionPrompt },
          { type: "input_file", filename: files[0].filename, file_data: files[0].file_data },
          { type: "input_file", filename: files[1].filename, file_data: files[1].file_data },
          { type: "input_file", filename: files[2].filename, file_data: files[2].file_data },
        ]
      }
    ];

    const extractionResp = await openai.responses.create({
      model,
      input: extractionInput,
      text: { format: { type: "text" }, verbosity: "medium" },
      reasoning: { effort: "medium" },
      tools: [],
      store: false
    } as any);

    const extractionText: string = (extractionResp as any).output_text
      || (((extractionResp as any).output?.[0]?.content?.[0]?.text) ?? "");
    const tExt1 = Date.now();
    console.log(`[analyze:${reqId}] Extraction completed in ${tExt1 - tExt0}ms, chars=${extractionText?.length || 0}`);

    if (!extractionText) {
      throw new Error("Empty extraction response from model");
    }

    // Second pass: Knowledge augmentation (RAG) based on extraction using vector store
    console.log(`[analyze:${reqId}] Starting augmentation (Responses API call #2) with RAG=${settings.vectorStoreId ? 'on' : 'off'} (enforced citations from KB) ...`);
    const tAug0 = Date.now();
    const augmentationPrompt = `You are a clinical posturology expert. Using the extracted findings below, augment ONLY with relevant clinical knowledge retrieved from the organization's knowledge base via file_search (vector store). Do not use or cite external, pretrained knowledge.

Rules:
- Cite ONLY from retrieved KB snippets. Use inline [Author, Year] or [Title] and include a short References section with titles (and page numbers if present).
- If no relevant passages are retrieved, explicitly write: "KB support: none found" and DO NOT add any external citations or knowledge.
- Maintain a professional tone in ${language}. Clearly separate: (1) Evidence from the patient's PDFs vs (2) KB-backed context.
- Avoid diagnoses; provide safety notes and methodological caveats where appropriate.`;

    const augmentationInput: any[] = [
      {
        role: "user",
        content: [
          { type: "input_text", text: augmentationPrompt },
          { type: "input_text", text: `Extracted findings to augment (verbatim):\n\n${extractionText}` }
        ]
      }
    ];

    const augmentedResp = await openai.responses.create({
      model,
      input: augmentationInput,
      text: { format: { type: "text" }, verbosity: "medium" },
      reasoning: { effort: "medium" },
      // Enforce file_search against vector store
      tools: [
        settings.vectorStoreId ? {
          type: "file_search",
          vector_store_ids: [settings.vectorStoreId]
        } : {
          // If no vector store configured, still provide an empty tool to nudge output to "KB support: none found"
          type: "file_search",
          vector_store_ids: [] as any
        }
      ],
      store: false
    } as any);

    const augmentedText: string = (augmentedResp as any).output_text
      || (((augmentedResp as any).output?.[0]?.content?.[0]?.text) ?? "");
    const tAug1 = Date.now();
    console.log(`[analyze:${reqId}] Augmentation completed in ${tAug1 - tAug0}ms, chars=${augmentedText?.length || 0}`);
    const t1 = Date.now();
    console.log(`[analyze:${reqId}] Done in ${t1 - t0}ms`);

    return new Response(JSON.stringify({ ok: true, data: {
      mode,
      extractionReportText: extractionText,
      augmentedReportText: augmentedText,
      debug: {
        prepareMs: tPrep1 - tPrep0,
        extractionMs: tExt1 - tExt0,
        augmentationMs: tAug1 - tAug0,
        totalMs: t1 - t0,
        model,
        vectorStoreUsed: Boolean(settings.vectorStoreId)
      }
    }}), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Error in analyze route:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}