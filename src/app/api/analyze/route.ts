import { NextRequest } from "next/server";
import { getDefaultSettings } from "@/lib/server-config";
import { pdf } from "pdf-to-img";
import sharp from "sharp";

export const runtime = "nodejs";
export const maxDuration = 60; // 60 seconds timeout for processing

function toBase64DataUrl(name: string, mime: string, buffer: Buffer) {
  const base64 = buffer.toString("base64");
  return {
    filename: name || "file.pdf",
    file_data: `data:${mime || "application/pdf"};base64,${base64}`
  } as const;
}

// Convert PDF pages to base64 images
async function pdfToImages(pdfBuffer: Buffer, pagesToExtract: number[] = [1, 2, 3, 4, 5, 8]): Promise<string[]> {
  try {
    const doc = await pdf(pdfBuffer, { scale: 2.0 }); // scale: 2.0 for higher quality
    const images: string[] = [];
    
    let pageNumber = 1;
    for await (const page of doc) {
      // pdf-to-img pages are 1-indexed
      if (pagesToExtract.includes(pageNumber)) {
        // Page is already a Buffer from pdf-to-img
        const pngBuffer = await sharp(Buffer.from(page))
          .png({ quality: 100, compressionLevel: 0 })
          .toBuffer();
        
        const base64 = pngBuffer.toString('base64');
        images.push(`data:image/png;base64,${base64}`);
      }
      pageNumber++;
    }
    
    return images;
  } catch (error) {
    console.error('Error converting PDF to images:', error);
    return [];
  }
}

// Simple 429 retry with exponential backoff + jitter
async function withRetry<T>(fn: () => Promise<T>, label: string, maxAttempts = 5): Promise<T> {
  let attempt = 0;
  let lastErr: any;
  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const is429 =
        err?.status === 429 ||
        /Rate limit/i.test(err?.message || "") ||
        err?.error?.type === "rate_limit_exceeded";
      if (!is429) throw err;
      const delay = 250 * Math.pow(2, attempt) + Math.floor(Math.random() * 250); // backoff + jitter
      console.warn(`[${label}] 429 rate limit — backoff ${delay}ms (attempt ${attempt + 1}/${maxAttempts})`);
      await new Promise((r) => setTimeout(r, delay));
      attempt++;
    }
  }
  throw lastErr;
}

// ---------- Agent 1 JSON Schema ----------
const EXTRACTION_SCHEMA = {
  name: "stabilometry_extract",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["patient", "tests", "comparisons"],
    properties: {
      patient: {
        type: "object",
        additionalProperties: false,
        required: ["name", "name_detected_in"],
        properties: {
          name: { type: "string" },
          name_detected_in: {
            type: "array",
            items: { type: "string", enum: ["A", "B", "C"] },
          },
          notes: { type: ["string", "null"] },
        },
      },
      tests: {
        type: "object",
        additionalProperties: false,
        required: ["A", "B", "C"],
        properties: {
          A: { $ref: "#/$defs/testBlock" },
          B: { $ref: "#/$defs/testBlock" },
          C: { $ref: "#/$defs/testBlock" },
        },
      },
      comparisons: {
        type: "object",
        additionalProperties: false,
        required: ["romberg_b_over_a", "cotton_c_over_b"],
        properties: {
          romberg_b_over_a: { $ref: "#/$defs/compBlock" },
          cotton_c_over_b: { $ref: "#/$defs/compBlock" },
        },
      },
    },
    $defs: {
      vnStatus: { type: "string", enum: ["within", "above", "below", "not_printed"] },
      testBlock: {
        type: "object",
        additionalProperties: false,
        required: ["metadata", "page1", "page2", "page3", "page4_fft", "page5_sdc", "page8_dashboard"],
        properties: {
          metadata: {
            type: "object",
            additionalProperties: false,
            required: ["measure_condition", "test_datetime_local", "duration_s"],
            properties: {
              measure_condition: { type: "string" },
              test_datetime_local: { type: "string" },
              duration_s: { type: ["number", "null"] },
            },
          },
          page1: {
            type: "object",
            additionalProperties: false,
            required: ["loads", "cop_mean", "globals"],
            properties: {
              loads: {
                type: "object",
                additionalProperties: false,
                required: ["left_load_pct", "right_load_pct", "left_mean_pressure", "right_mean_pressure"],
                properties: {
                  left_load_pct: { type: ["number", "null"] },
                  right_load_pct: { type: ["number", "null"] },
                  left_mean_pressure: { type: ["number", "null"] },
                  right_mean_pressure: { type: ["number", "null"] },
                  quadrant_loads: {
                    type: ["array", "null"],
                    items: { type: "number" },
                    minItems: 4,
                    maxItems: 4,
                  },
                  arch_type_left: { type: ["string", "null"] },
                  arch_type_right: { type: ["string", "null"] },
                },
              },
              cop_mean: {
                type: "object",
                additionalProperties: false,
                required: ["x_mm", "x_sd_mm", "x_vn_status", "y_mm", "y_sd_mm", "y_vn_status"],
                properties: {
                  x_mm: { type: ["number", "null"] },
                  x_sd_mm: { type: ["number", "null"] },
                  x_vn_status: { $ref: "#/$defs/vnStatus" },
                  y_mm: { type: ["number", "null"] },
                  y_sd_mm: { type: ["number", "null"] },
                  y_vn_status: { $ref: "#/$defs/vnStatus" },
                },
              },
              globals: {
                type: "object",
                additionalProperties: false,
                required: [
                  "length_mm",
                  "length_vn_status",
                  "area_mm2",
                  "area_vn_status",
                  "velocity_mm_s",
                  "velocity_vn_status",
                  "l_s_ratio",
                  "l_s_vn_status",
                  "ellipse_ratio",
                  "ellipse_ratio_vn_status",
                  "ellipse_ap_deviation_deg",
                  "velocity_variance_total_mm_s",
                  "velocity_variance_ml_mm_s",
                  "velocity_variance_ap_mm_s",
                  "ap_acceleration_mm_s2",
                  "ap_acceleration_vn_status",
                  "lfs",
                  "lfs_vn_status",
                ],
                properties: {
                  length_mm: { type: ["number", "null"] },
                  length_vn_status: { $ref: "#/$defs/vnStatus" },
                  area_mm2: { type: ["number", "null"] },
                  area_vn_status: { $ref: "#/$defs/vnStatus" },
                  velocity_mm_s: { type: ["number", "null"] },
                  velocity_vn_status: { $ref: "#/$defs/vnStatus" },
                  l_s_ratio: { type: ["number", "null"] },
                  l_s_vn_status: { $ref: "#/$defs/vnStatus" },
                  ellipse_ratio: { type: ["number", "null"] },
                  ellipse_ratio_vn_status: { $ref: "#/$defs/vnStatus" },
                  ellipse_ap_deviation_deg: { type: ["number", "null"] },
                  velocity_variance_total_mm_s: { type: ["number", "null"] },
                  velocity_variance_ml_mm_s: { type: ["number", "null"] },
                  velocity_variance_ap_mm_s: { type: ["number", "null"] },
                  ap_acceleration_mm_s2: { type: ["number", "null"] },
                  ap_acceleration_vn_status: { $ref: "#/$defs/vnStatus" },
                  lfs: { type: ["number", "null"] },
                  lfs_vn_status: { $ref: "#/$defs/vnStatus" },
                },
              },
            },
          },
          page2: {
            type: "object",
            additionalProperties: false,
            required: ["left", "right", "foot_stabilograms"],
            properties: {
              left: {
                type: "object",
                additionalProperties: false,
                required: [
                  "length_mm",
                  "area_mm2",
                  "velocity_mm_s",
                  "x_avg_mm",
                  "y_avg_mm",
                  "x_dev_mm",
                  "y_dev_mm",
                  "ellipse_ap_deviation_deg",
                ],
                properties: {
                  length_mm: { type: ["number", "null"] },
                  area_mm2: { type: ["number", "null"] },
                  velocity_mm_s: { type: ["number", "null"] },
                  x_avg_mm: { type: ["number", "null"] },
                  y_avg_mm: { type: ["number", "null"] },
                  x_dev_mm: { type: ["number", "null"] },
                  y_dev_mm: { type: ["number", "null"] },
                  ellipse_ap_deviation_deg: { type: ["number", "null"] },
                },
              },
              right: {
                type: "object",
                additionalProperties: false,
                required: [
                  "length_mm",
                  "area_mm2",
                  "velocity_mm_s",
                  "x_avg_mm",
                  "y_avg_mm",
                  "x_dev_mm",
                  "y_dev_mm",
                  "ellipse_ap_deviation_deg",
                ],
                properties: {
                  length_mm: { type: ["number", "null"] },
                  area_mm2: { type: ["number", "null"] },
                  velocity_mm_s: { type: ["number", "null"] },
                  x_avg_mm: { type: ["number", "null"] },
                  y_avg_mm: { type: ["number", "null"] },
                  x_dev_mm: { type: ["number", "null"] },
                  y_dev_mm: { type: ["number", "null"] },
                  ellipse_ap_deviation_deg: { type: ["number", "null"] },
                },
              },
              foot_stabilograms: {
                type: "object",
                additionalProperties: false,
                required: ["ml_observation", "ap_observation", "less_stable_foot"],
                properties: {
                  ml_observation: { type: ["string", "null"] },
                  ap_observation: { type: ["string", "null"] },
                  less_stable_foot: { type: "string", enum: ["left", "right", "tie", "not_determinable"] },
                },
              },
            },
          },
          page3: {
            type: "object",
            additionalProperties: false,
            required: ["ml_trace_observation", "ap_trace_observation", "cop_velocity_observation", "dominant_plane"],
            properties: {
              ml_trace_observation: { type: ["string", "null"] },
              ap_trace_observation: { type: ["string", "null"] },
              cop_velocity_observation: { type: ["string", "null"] },
              dominant_plane: { type: "string", enum: ["ML", "AP", "balanced", "not_determinable"] },
            },
          },
          page4_fft: {
            type: "object",
            additionalProperties: false,
            required: ["ml", "ap", "cross_spectrum", "force_z", "fft_summary_across_tests"],
            properties: {
              ml: {
                type: "object",
                additionalProperties: false,
                required: ["dominant_band_hz", "top_peak_hz_est", "high_freq_present_gt_0_5"],
                properties: {
                  dominant_band_hz: { type: "string", enum: ["<0.2", "0.2–0.5", ">0.5", "not_determinable"] },
                  top_peak_hz_est: { type: ["string", "null"] },
                  high_freq_present_gt_0_5: { type: "boolean" },
                },
              },
              ap: {
                type: "object",
                additionalProperties: false,
                required: ["dominant_band_hz", "top_peak_hz_est", "high_freq_present_gt_0_5"],
                properties: {
                  dominant_band_hz: { type: "string", enum: ["<0.2", "0.2–0.5", ">0.5", "not_determinable"] },
                  top_peak_hz_est: { type: ["string", "null"] },
                  high_freq_present_gt_0_5: { type: "boolean" },
                },
              },
              cross_spectrum: {
                type: "object",
                additionalProperties: false,
                required: ["low_freq_coupling_present", "coupling_peak_hz_est"],
                properties: {
                  low_freq_coupling_present: { type: "boolean" },
                  coupling_peak_hz_est: { type: ["string", "null"] },
                },
              },
              force_z: {
                type: "object",
                additionalProperties: false,
                required: ["low_freq_peak_hz_est", "tail_to_1hz"],
                properties: {
                  low_freq_peak_hz_est: { type: ["string", "null"] },
                  tail_to_1hz: { type: "string", enum: ["rapid", "moderate", "long", "not_determinable"] },
                },
              },
              fft_summary_across_tests: { type: ["string", "null"] },
            },
          },
          page5_sdc: {
            type: "object",
            additionalProperties: false,
            required: ["mp_s", "sp_s", "md_mm", "sd_mm", "mt_s", "st_s", "area", "sdc_pattern", "sdc_note"],
            properties: {
              mp_s: { type: ["number", "null"] },
              sp_s: { type: ["number", "null"] },
              md_mm: { type: ["number", "null"] },
              sd_mm: { type: ["number", "null"] },
              mt_s: { type: ["number", "null"] },
              st_s: { type: ["number", "null"] },
              area: { type: ["number", "null"] },
              sdc_pattern: { type: "string", enum: ["regular", "irregular", "mixed", "not_determinable"] },
              sdc_note: { type: ["string", "null"] },
            },
          },
          page8_dashboard: {
            type: "object",
            additionalProperties: false,
            required: ["postural_index_score", "radar_expanded_axes", "radar_contracted_axes"],
            properties: {
              postural_index_score: { type: ["number", "null"] },
              radar_expanded_axes: { type: "array", items: { type: "string" } },
              radar_contracted_axes: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
      compBlock: {
        type: "object",
        additionalProperties: false,
        properties: {
          length_mm: { $ref: "#/$defs/ratioPair" },
          area_mm2: { $ref: "#/$defs/ratioPair" },
          velocity_mm_s: { $ref: "#/$defs/ratioPair" },
          l_s_ratio: { $ref: "#/$defs/ratioPair" },
          ellipse_ratio: { $ref: "#/$defs/ratioPair" },
          velocity_variance_total_mm_s: { $ref: "#/$defs/ratioPair" },
          velocity_variance_ml_mm_s: { $ref: "#/$defs/ratioPair" },
          velocity_variance_ap_mm_s: { $ref: "#/$defs/ratioPair" },
          ap_acceleration_mm_s2: { $ref: "#/$defs/ratioPair" },
          lfs: { $ref: "#/$defs/ratioPair" },
        },
      },
      ratioPair: {
        type: "object",
        additionalProperties: false,
        required: ["ratio", "pct_change"],
        properties: {
          ratio: { type: ["number", "null"] },
          pct_change: { type: ["string", "null"] },
        },
      },
    },
  },
};

// ---------- Prompts ----------
const AGENT1_PROMPT = `
Prompt 1 — Extraction & Pre-Analysis (JSON only)

Role
You are a baropodometric/stabilometric extraction agent.

Inputs
You receive:
1. Three PDFs for the same subject:
   A = Neutral / Eyes Open
   B = Eyes Closed
   C = Eyes Closed + Cotton Rolls
2. High-quality PNG screenshots of pages 1, 2, 3, 4, 5, and 8 from each PDF for enhanced visual interpretation.

Scope
Use ONLY pages 1, 2, 3, 4, 5, and 8. Ignore all other pages.
Leverage both PDFs and images: use images for better visual interpretation of plots, graphs, tables, and spatial layouts.

CRITICAL: Process Reporting & Debugging
Before generating the final JSON, include in your response:
1. **Processing Steps**: List the steps you're taking to extract data (e.g., "Step 1: Examining Test A Page 1 for patient name and global metrics...")
2. **Issues Encountered**: Report any problems finding specific data, unclear values, or ambiguous readings
3. **Missing Data**: Explicitly state what you cannot find and why (e.g., "Cannot locate arch_type on page 1 - field not visible")
4. **Decision Rationale**: When making qualitative assessments (e.g., less_stable_foot, dominant_plane), briefly explain your reasoning
5. **Data Quality Notes**: Mention any concerns about OCR accuracy, image clarity, or conflicting values

After this diagnostic section, provide the final JSON output as specified.

Strict rules
- Extract ONLY what is printed on those pages (OCR if needed). Do NOT guess or infer.
- Preserve units, but normalize decimals to dot (e.g., 11.57). Return numbers as JSON numbers (not strings).
- If a printed value/field is missing, set it to null and use "not_printed" for V.N. status fields or booleans where applicable.
- Qualitative descriptions of plots are allowed (short, factual, no speculation).
- Absolutely NO clinical interpretation or diagnosis.

VISION TASKS & LAYOUT (constant)
- Page 1 (Footprints + Globals):
  • Read % loads, mean pressures, quadrant loads.
  • Read COP mean (X,Y) with SD and V.N. flags; read ALL global metrics + V.N. flags.
  • Patient name is in the top-left header; test date/time and duration are under the header.

- Page 2 (Per-foot tables + Foot stabilograms):
  • Top: per-foot numerical table (Left/Right) — extract exactly as printed.
  • Bottom: two foot stabilogram plots (top= M-L, bottom= A-P; red=Left, blue=Right).
    Write brief ML/AP observations and set less_stable_foot.

- Page 3 (Global stabilograms + CoP velocity):
  • Three plots in order: (1) M-L, (2) A-P, (3) CoP velocity.
    Note drifts, bursts, quiet periods; decide dominant_plane.

- Page 4 (FFT):
  • Four stacked plots in order: (i) M-L (X), (ii) A-P (Y), (iii) Cross-spectrum, (iv) Force (Z).
  • For M-L and A-P: dominant_band_hz ∈ {"<0.2","0.2–0.5",">0.5","not_determinable"},
    top_peak_hz_est like "≈0.10" or null, high_freq_present_gt_0_5 boolean.
  • Cross-spectrum: low_freq_coupling_present boolean; coupling_peak_hz_est or null.
  • Force Z: low_freq_peak_hz_est or null; tail_to_1hz ∈ {"rapid","moderate","long","not_determinable"}.
  • Provide one-sentence fft_summary_across_tests comparing A vs B vs C.
  • Never invent numeric peak values from plots; keep them qualitative unless printed.

- Page 5 (SDC):
  • Extract MP, SP, MD, SD, MT, ST, Area exactly as printed.
  • Classify sdc_pattern ∈ {regular, irregular, mixed, not_determinable}; add a brief sdc_note.

- Page 8 (Dashboard):
  • Read Postural Index; list which radar axes look most expanded vs contracted.

Computed comparisons (use ONLY page-1 global metrics)
- romberg_b_over_a: compute B/A and signed % change for:
  length_mm, area_mm2, velocity_mm_s, l_s_ratio, ellipse_ratio,
  velocity_variance_total_mm_s, velocity_variance_ml_mm_s,
  velocity_variance_ap_mm_s, ap_acceleration_mm_s2, lfs.
- cotton_c_over_b: same set for C/B.
- Round ratio to 2 decimals; pct_change like "+97%".

Output
Return a single JSON strictly matching the schema provided via response_format.
No narrative. No diagnosis.
`.trim();

const AGENT2_PROMPT = `
Prompt 2 — Clinical Interpretation & Diagnosis (consumes Agent 1 JSON)

You are a clinical posturology expert.

Input
- You receive the first agent’s JSON payload. Treat it as the sole patient evidence.

Knowledge use
- Prefer the organization’s KB via file_search (vector store) for clinical context.
- Fallback: if no relevant KB snippets are retrieved, you may use your pretrained medical knowledge to explain terms, indices, clinical significance, and normative interpretations — but do NOT cite external articles.

Write your report with these sections:

Header
- Patient: <patient.name>.

(1) Evidence from patient's PDFs (verbatim)
- Summarize key values from the JSON for A, B, C:
  • Page-1 globals with V.N. statuses; loads/pressures; COP X/Y; LFS; L/S; ellipse metrics.
  • Page-2 per-foot metrics + foot-stabilogram notes (less_stable_foot).
  • Page-3 global stabilograms/CoP-velocity highlights (drifts, bursts, dominant plane).
  • Page-4 FFT (order: M-L[X], A-P[Y], Cross-spectrum, Force[Z]) — dominant bands, >0.5 Hz presence, cross-spectrum coupling, Z tail; include the across-tests FFT comparison.
  • Page-5 SDC values/pattern.
  • Page-8 Postural Index and radar axes.
  • Computed Romberg (B/A) and Cotton (C/B) ratios.

(2) KB-backed and/or pretrained context
- Explain the meaning/clinical significance of all key metrics (Length, Area, Velocity, L/S, ellipse, velocity variance, A/P acceleration, LFS, SDC, FFT bands).
- Compare sensory system contributions (visual, vestibular, proprioceptive, stomatognathic) and **state clearly** which is strongest, tying to evidence and ratios.
- Cite ONLY retrieved KB snippets (inline [Title] or [Author, Year]) and include a brief References list. If none: “KB support: none found.”

(3) Diagnosis
- Provide a concise diagnosis.
- Explicitly **rank** sensory systems by influence (primary → secondary → minor) using JSON evidence (Romberg, Cotton, FFT profile, SDC, LFS/L-S).
- Recommend next steps (e.g., visual reweighting, TMJ/occlusal evaluation, vestibular/oculomotor screening, foam conditions, re-testing).

(4) Safety notes / methodological caveats
- Note device/protocol dependencies (platform-specific LFS, 30-s window, missing fields), inter-trial variability, and that cotton-roll effects are a screening probe, not treatment.

Tone
- Professional and clinical. Always provide a diagnosis and explicitly rank sensory contributions.
`.trim();

// -------- helpers to read Responses API outputs robustly --------
function extractOutputText(resp: any): string | null {
  const out = (resp as any)?.output;
  if (Array.isArray(out) && out[0]?.content?.length) {
    for (const c of out[0].content) {
      if (typeof c?.text === "string") return c.text;
      if (typeof c?.content === "string") return c.content;
    }
  }
  if (typeof (resp as any).output_text === "string") return (resp as any).output_text;
  return null;
}

function tryParseJSON(str: string | null): any | null {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return null; }
}

function normalizeExtraction(ex: any) {
  try {
    for (const key of ["A", "B", "C"] as const) {
      const t = ex?.tests?.[key];
      if (!t) continue;
      const loads = t?.page1?.loads;
      if (loads && typeof loads.left_load_pct === "number" && typeof loads.right_load_pct === "number") {
        const sum = loads.left_load_pct + loads.right_load_pct;
        if (!(sum >= 98 && sum <= 102)) {
          loads.left_load_pct = null;
          loads.right_load_pct = null;
        }
      }
      const fft = t?.page4_fft;
      if (fft) {
        if (fft.ml_x && !fft.ml) { fft.ml = fft.ml_x; delete fft.ml_x; }
        if (fft.ap_y && !fft.ap) { fft.ap = fft.ap_y; delete fft.ap_y; }
      }
    }
  } catch { /* noop */ }
  return ex;
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

    // Prepare base64-embedded PDFs for Responses API and convert to images
    const tPrep0 = Date.now();
    console.log(`[analyze:${reqId}] Preparing base64-embedded PDFs and converting to images...`);
    const [neutralBuf, closedBuf, cottonBuf] = await Promise.all([
      Buffer.from(await neutral.arrayBuffer()),
      Buffer.from(await closed.arrayBuffer()),
      Buffer.from(await cotton.arrayBuffer()),
    ]);

    // Convert PDFs to images for better visual interpretation
    console.log(`[analyze:${reqId}] Converting PDFs to high-quality images for pages 1,2,3,4,5,8...`);
    const [neutralImages, closedImages, cottonImages] = await Promise.all([
      pdfToImages(neutralBuf),
      pdfToImages(closedBuf),
      pdfToImages(cottonBuf),
    ]);

    const files = [
      toBase64DataUrl(neutral.name, neutral.type || "application/pdf", neutralBuf),
      toBase64DataUrl(closed.name, closed.type || "application/pdf", closedBuf),
      toBase64DataUrl(cotton.name, cotton.type || "application/pdf", cottonBuf),
    ];

    const language = settings.language || "English";
    const model = settings.model || "gpt-5"; // Agent 2 default
    const extractionModel = "gpt-5-mini"; // Agent 1 uses mini for higher TPM
    const tPrep1 = Date.now();
    console.log(`[analyze:${reqId}] Prepared files and images in ${tPrep1 - tPrep0}ms`);
    console.log(`[analyze:${reqId}] Images extracted: A=${neutralImages.length}, B=${closedImages.length}, C=${cottonImages.length}`);

    // First pass: Extraction analysis directly on PDFs
    console.log(`[analyze:${reqId}] Starting extraction (Agent 1) using model=${extractionModel} ...`);
    const tExt0 = Date.now();
    const extractionPrompt = `Prompt 1 — Extraction & Pre-Analysis Agent (feeds Agent 2)
You are a baropodometric/stabilometric extraction agent.

Goal
Parse the provided inputs for the same subject:
- Three PDFs: A = Neutral / Eyes Open, B = Eyes Closed, C = Eyes Closed + Cotton Rolls
- High-quality PNG screenshots of pages 1, 2, 3, 4, 5, and 8 from each PDF

Scope
Use ONLY pages 1, 2, 3, 4, 5, and 8. Ignore all other pages.
Leverage both PDFs and images: use images for better visual interpretation of plots, graphs, tables, footprint heatmaps, and spatial layouts.

CRITICAL: Process Reporting & Debugging
Before generating the final JSON, include in your response:
1. **Processing Steps**: List the steps you're taking to extract data (e.g., "Step 1: Examining Test A Page 1 for patient name and global metrics...")
2. **Issues Encountered**: Report any problems finding specific data, unclear values, or ambiguous readings
3. **Missing Data**: Explicitly state what you cannot find and why (e.g., "Cannot locate arch_type on page 1 - field not visible")
4. **Decision Rationale**: When making qualitative assessments (e.g., less_stable_foot, dominant_plane), briefly explain your reasoning
5. **Data Quality Notes**: Mention any concerns about OCR accuracy, image clarity, or conflicting values

After this diagnostic section, provide the final JSON output as specified.

Strict rules
- Extract ONLY what is printed on those pages (OCR if needed). Do NOT guess or infer.
- Preserve units, but normalize decimals to dot (e.g., 11.57). Return numbers as JSON numbers, not strings.
- If a printed value/field is missing, set it to null and mark the corresponding “…_vn_status” or “…_present” as "not_printed".
- Qualitative descriptions of plots are allowed (short, factual, no speculation).
- Absolutely NO clinical interpretation or diagnosis.

PAGE LAYOUT & WHAT TO EXTRACT

0) Page header (present on page 1)
- patient_name: exact string as printed in the top-left header. Keep diacritics and spacing.
- test_datetime_local: the “Test date” + time string as printed.
- duration_s: numeric duration in seconds, if printed.
- measure_condition: string shown under the header (e.g., “Neutral”, “Closed Eyes”, “closed eyes cotton rolls”).

1) Page 1 — Baropodometry & Stabilometry (footprints + globals)
- Footprints/loads: left_load_pct, right_load_pct; left_mean_pressure, right_mean_pressure;
  quadrant_loads ordered [UL, UR, LL, LR] if printed; arch_type_left/right if printed else null.
- COP mean coordinates table (with SD and V.N. status):
  cop_mean_x_mm, cop_sd_x_mm, cop_x_vn_status ∈ {"within","above","below","not_printed"}
  cop_mean_y_mm, cop_sd_y_mm, cop_y_vn_status ∈ same set.
- Global metrics table (value + V.N. status each if shown):
  length_mm, area_mm2, velocity_mm_s, l_s_ratio, ellipse_ratio,
  ellipse_ap_deviation_deg, velocity_variance_total_mm_s,
  velocity_variance_ml_mm_s, velocity_variance_ap_mm_s,
  ap_acceleration_mm_s2, lfs.
  For each, include a "..._vn_status" field with the same enum.

2) Page 2 — Foot Centers of Pressure & FOOT stabilograms
- Per-foot numerical table (left & right): length_mm, area_mm2, velocity_mm_s,
  x_avg_mm, y_avg_mm, x_dev_mm, y_dev_mm, ellipse_ap_deviation_deg.
- Foot stabilograms (plots at bottom; top=M-L, bottom=A-P; red=Left, blue=Right):
  Provide short qualitative strings:
  foot_stabilograms.ml_observation, foot_stabilograms.ap_observation,
  foot_stabilograms.less_stable_foot ∈ {"left","right","tie","not_determinable"}.

3) Page 3 — Global stabilograms + CoP velocity
- Three plots in fixed order: (1) M-L, (2) A-P, (3) CoP velocity.
  Return strings: ml_trace_observation, ap_trace_observation, cop_velocity_observation,
  and dominant_plane ∈ {"ML","AP","balanced","not_determinable"}.

4) Page 4 — FFT (Fast Fourier Transform) — layout is constant
- Four stacked plots in this exact order: (i) M-L (X), (ii) A-P (Y), (iii) Cross-spectrum, (iv) Force (Z).
- For each spectrum, return qualitative, standardized fields (no invented numbers):
  • dominant_band_hz (e.g., "<0.2")
  • top_peak_hz_est (string like "≈0.08" or null)
  • high_freq_present_gt_0_5 (boolean)
- Cross-spectrum: low_freq_coupling_present (boolean), coupling_peak_hz_est (string or null).
- Force Z: low_freq_peak_hz_est (string or null), tail_to_1hz ∈ {"rapid","moderate","long","not_determinable"}.
- Also add fft_summary_across_tests: one short sentence comparing A vs B vs C.

5) Page 5 — Sway Density Curve (SDC)
- Numeric table: mp_s, sp_s, md_mm, sd_mm, mt_s, st_s, area.
- Qualitative: sdc_pattern ∈ {"regular","irregular","mixed","not_determinable"} and a brief sdc_note.

6) Page 8 — Postural Index Dashboard
- postural_index_score (number).
- radar_expanded_axes: array of axis labels that appear most expanded.
- radar_contracted_axes: array of labels most contracted.

Computed comparisons (use ONLY page-1 global metrics)
- romberg_b_over_a: for each page-1 global metric, provide { ratio, pct_change }
  where ratio = B/A to 2 decimals and pct_change is a signed percent string (e.g., "+97%").
- cotton_c_over_b: same structure comparing C/B.

OUTPUT FORMAT
Return a single JSON object (no prose):

{
  "patient": {
    "name": "<exact header string>",
    "name_detected_in": ["A","B","C"],
    "notes": null
  },
  "tests": {
    "A": { "metadata": { ... }, "page1": { ... }, "page2": { ... }, "page3": { ... }, "page4_fft": { ... }, "page5_sdc": { ... }, "page8_dashboard": { ... } },
    "B": { ... },
    "C": { ... }
  },
  "comparisons": {
    "romberg_b_over_a": { ... },
    "cotton_c_over_b": { ... }
  }
}

No narrative. No diagnosis.`;

    const extractionInput: any[] = [
      {
        role: "user",
        content: [
          { type: "input_text", text: extractionPrompt },
          // PDFs
          { type: "input_file", filename: files[0].filename, file_data: files[0].file_data },
          { type: "input_file", filename: files[1].filename, file_data: files[1].file_data },
          { type: "input_file", filename: files[2].filename, file_data: files[2].file_data },
          // Images for Test A (Neutral)
          ...neutralImages.map((img, idx) => ({
            type: "input_image" as const,
            image: img,
            detail: "high" as const,
            alt_text: `Test A (Neutral) - Page ${[1,2,3,4,5,8][idx] || idx+1}`
          })),
          // Images for Test B (Closed Eyes)
          ...closedImages.map((img, idx) => ({
            type: "input_image" as const,
            image: img,
            detail: "high" as const,
            alt_text: `Test B (Closed Eyes) - Page ${[1,2,3,4,5,8][idx] || idx+1}`
          })),
          // Images for Test C (Cotton Rolls)
          ...cottonImages.map((img, idx) => ({
            type: "input_image" as const,
            image: img,
            detail: "high" as const,
            alt_text: `Test C (Cotton Rolls) - Page ${[1,2,3,4,5,8][idx] || idx+1}`
          })),
        ]
      }
    ];

    const extractionResp = await openai.responses.create({
      model: extractionModel,
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

    // Parse the diagnostic section and JSON from the extraction response
    let extractionDiagnostics = "";
    let extractionJsonText = extractionText;
    
    // Try to split diagnostic section from JSON (JSON typically starts with {)
    const jsonStartIndex = extractionText.indexOf('{');
    if (jsonStartIndex > 0) {
      extractionDiagnostics = extractionText.substring(0, jsonStartIndex).trim();
      extractionJsonText = extractionText.substring(jsonStartIndex).trim();
      
      // Log the diagnostic information for debugging
      if (extractionDiagnostics) {
        console.log(`[analyze:${reqId}] === Extraction Diagnostics ===`);
        console.log(extractionDiagnostics);
        console.log(`[analyze:${reqId}] === End Diagnostics ===`);
      }
    }

    // Second pass: Knowledge augmentation (RAG) based on extraction using vector store
    console.log(`[analyze:${reqId}] Starting augmentation (Responses API call #2) with RAG=${settings.vectorStoreId ? 'on' : 'off'} (KB primary, pretrained fallback without external citations) ...`);
    const tAug0 = Date.now();
    const augmentationPrompt = `Prompt 2 — Clinical Interpretation & Diagnosis Agent (consumes Agent 1)
You are a clinical posturology expert.

Input
- You receive the first agent’s JSON payload (defined above). Treat it as the sole patient evidence.

Knowledge use
- Prefer the organization’s KB via file_search (vector store) for clinical context.
- Fallback: if no relevant KB passages are retrieved, you may use your pretrained medical knowledge to explain terms, indices, clinical significance, and normative interpretations — but do NOT cite external articles.

Write your report with these sections:

Header
- Patient: <patient.name>.

(1) Evidence from patient’s PDFs (verbatim)
- Summarize key values from the JSON for A, B, C:
  • Page-1 globals with V.N. statuses; loads/pressures; COP X/Y; LFS; L/S; ellipse metrics.
  • Page-2 per-foot metrics and foot-stabilogram notes (which foot less stable).
  • Page-3 global stabilograms/CoP-velocity highlights (drift, bursts, dominant plane).
  • Page-4 FFT (fixed order: M-L(X), A-P(Y), Cross-spectrum, Force(Z)) — dominant bands, presence of >0.5 Hz components, relative M-L vs A-P power, cross-spectrum coupling, Z low-freq tail; include the across-tests FFT comparison.
  • Page-5 SDC values and pattern.
  • Page-8 Postural Index and radar axes.
  • Computed Romberg (B/A) and Cotton (C/B) ratios.

(2) KB-backed and/or pretrained context
- Explain the meaning and clinical significance of all key metrics/indices (Length, Area, Velocity, L/S, ellipse, velocity variance, A/P acceleration, LFS, SDC, FFT bands).
- Compare sensory system contributions (visual, vestibular, proprioceptive, stomatognathic) and **state clearly** which is strongest, with a brief rationale tied to the evidence and ratios.
- Cite ONLY retrieved KB snippets (inline [Title] or [Author, Year]) and include a short References list. If none: “KB support: none found.”

(3) Diagnosis
- Provide a concise diagnosis paragraph.
- Explicitly **rank** sensory systems by influence (primary → secondary → minor) using the JSON evidence (Romberg, Cotton, FFT profile, SDC, LFS/L-S).
- Recommend next steps (e.g., visual reweighting tasks, TMJ/occlusal evaluation, vestibular/oculomotor screening, foam conditions, re-testing).

(4) Safety notes / methodological caveats
- Device-/protocol-specific limits (platform-dependent LFS, 30-s window, any missing fields), inter-trial variability, and that cotton-roll effects are a screening probe, not treatment.

Tone
- Professional and clinical. Always provide a diagnosis and explicitly rank sensory contributions.`;

    const augmentationInput: any[] = [
      {
        role: "user",
        content: [
          { type: "input_text", text: augmentationPrompt },
          { type: "input_text", text: `Extracted findings to augment (verbatim):\n\n${extractionJsonText}` }
        ]
      }
    ];

    const augmentedResp = await openai.responses.create({
      model,
      input: augmentationInput,
      text: { format: { type: "text" }, verbosity: "medium" },
      reasoning: { effort: "medium" },
      // Prefer file_search against vector store; allow fallback explanation when no KB passages are retrieved
      tools: [
        settings.vectorStoreId ? {
          type: "file_search",
          vector_store_ids: [settings.vectorStoreId]
        } : {
          // If no vector store configured, still provide an empty tool; model can fallback to pretrained explanations without external citations
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
      extractionReportText: extractionJsonText,
      augmentedReportText: augmentedText,
      debug: {
        prepareMs: tPrep1 - tPrep0,
        extractionMs: tExt1 - tExt0,
        augmentationMs: tAug1 - tAug0,
        totalMs: t1 - t0,
        extractionModel,
        augmentationModel: model,
        vectorStoreUsed: Boolean(settings.vectorStoreId),
        extractionDiagnostics: extractionDiagnostics || "No diagnostic output provided"
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