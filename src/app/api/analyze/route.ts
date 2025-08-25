import { NextRequest } from "next/server";
import { getDefaultSettings } from "@/lib/server-config";
import { pdf } from "pdf-to-img";
import sharp from "sharp";
import crypto from "crypto";

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

// --- Deep logging helpers ---


function truncateForLog(s: string, max = 1200, forceNoTruncate = false): string {
  if (!s) return s as any;
  // If verbose mode is on or force flag is set, don't truncate
  const settings = getDefaultSettings() as any;
  if (forceNoTruncate || settings?.verboseOpenAI) {
    return s;
  }
  if (s.length <= max) return s;
  return `${s.slice(0, max)}… [truncated ${s.length - max} chars]`;
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
          sensory_ranking: {
            type: "object",
            properties: {
              primary: { type: "string", enum: ["visual", "vestibular", "proprioceptive", "stomatognathic", "not_determinable"] },
              secondary: { type: "string", enum: ["visual", "vestibular", "proprioceptive", "stomatognathic", "not_determinable"] },
              minor: { type: "string", enum: ["visual", "vestibular", "proprioceptive", "stomatognathic", "not_determinable"] }
            }
          }
        },
      },
    },
    $defs: {
      vnStatus: { type: "string", enum: ["within", "above", "below", "not_printed"] },
      testBlock: {
        type: "object",
        additionalProperties: false,
        required: ["metadata", "page1", "page2", "page3", "page4_fft", "page5_sdc", "page6_synthesis", "page8_dashboard"],
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
          page6_synthesis: {
            type: "object",
            additionalProperties: false,
            required: ["page6_left_load_pct", "page6_right_load_pct"],
            properties: {
              page6_left_load_pct: { type: ["number", "null"] },
              page6_right_load_pct: { type: ["number", "null"] },
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

ROLE
You are a baropodometric/stabilometric extraction agent.

INPUTS (process SEQUENTIALLY)
1) PDFs (PARSE FIRST for all text/table data)
   • Same subject, three reports:
     A = Neutral / Eyes Open
     B = Closed Eyes
     C = Closed Eyes + Cotton Rolls
   • Use PDF text/OCR only to extract ALL numbers/tables on pages 1,2,3,4,5,6,8.

2) PNG images (USE SECOND for visual interpretation ONLY)
   • High-resolution screenshots of pages 1,2,3,4,5,6,8.
   • Use ONLY for qualitative descriptions of plots/heatmaps (no numbers).

MANDATORY ORDER
STEP 1: Parse PDFs → capture all printed text/numbers/tables.
STEP 2: Inspect images → add visual (qualitative) observations only.
STEP 3: Merge into a single structured JSON.

SCOPE
Use ONLY pages 1,2,3,4,5,6,8.

STRICT RULES
• Extract ONLY what is printed on those pages. Do NOT guess or infer.
• Preserve units; normalize decimals to dot (e.g., 11.57). Return numbers as JSON numbers.
• Verbatim strings:
  – patient.name and measure_condition must match exactly as printed (keep capitalization/diacritics).
  – test_datetime_local is the exact printed string.
• Radar axis labels must come from this whitelist ONLY:
  ["Length","Area","Velocity","Ell. ratio","LFS","X medium","Y medium","Accel. AP"].
  – If the figure shows Greek gamma “γ medium”, map it to "Y medium".
• V.N. statuses: Calculate by comparing measured value to V.N. value:
  - If V.N. format is "X ± Y" or "X+/-Y": treat as range [X-Y to X+Y]
    * "within" if inside the range
    * "below" if less than the minimum
    * "above" if greater than the maximum
  - If V.N. is a single number "N" with no ±: treat as threshold (upper limit ≤ N)
    * "within" if measured value ≤ N
    * "above" if measured value > N (no "below" for thresholds)
  - ONLY use "not_printed" if V.N. cell is truly blank/empty.
• Loads sanity check: if left_load_pct + right_load_pct is not within [98,102], set both to null.
• Cross-page discrepancies:
  – For any value printed on both Page-1 and Page-8 that differs:
    * For L/R loads: if |diff| > 0.5% on either side → record a discrepancy and prefer Page-1.
    * For other scalars: if |diff| > 1 unit → record a discrepancy and prefer Page-1.
  – Record discrepancies under tests.<A|B|C>.discrepancies (see schema below).
• Qualitative caution:
  – Page-2 less_stable_foot ∈ {"left","right","tie","not_determinable"}.
    Choose "left"/"right" ONLY when visibly different; otherwise "tie".
  – Page-3 dominant_plane ∈ {"ML","AP","balanced","not_determinable"}.
    Choose "ML"/"AP" ONLY when clearly dominant; otherwise "balanced".
• Absolutely NO clinical interpretation or diagnosis.

DIAGNOSTIC REPORTING (before JSON)
Provide these sections in plain text WITHOUT curly braces:
1) PDF Parsing Phase — what tables/fields you captured by page.
2) Image Analysis Phase — concise visual notes per page.
3) Issues Encountered — any ambiguities/reading problems.
4) Missing Data — fields not present and why.
5) Decision Rationale — how you chose less_stable_foot / dominant_plane.
6) Data Quality Notes — OCR clarity, decimal commas, etc.

After diagnostics, output the JSON ONLY between the exact fence markers:
<<<JSON_START>>>
{ ... }
<<<JSON_END>>>

PAGE LAYOUT & FIELDS

0) Page header (on page 1)
- patient_name (actual patient's name, NOT clinic name), test_datetime_local, duration_s (number), measure_condition (verbatim).

1) Page 1 — Baropodometry & Stabilometry (footprints + globals)
- left_load_pct, right_load_pct
- left_mean_pressure, right_mean_pressure
- quadrant_loads: [UL, UR, LL, LR] if printed
- arch_type_left, arch_type_right (null if blank), arch_type_present ∈ {"printed","not_printed"}
- COP mean coordinates with SD and V.N. flag:
  cop_mean_x_mm, cop_sd_x_mm, cop_x_vn_status
  cop_mean_y_mm, cop_sd_y_mm, cop_y_vn_status
- Global metrics (+ V.N. flag each):
  length_mm, area_mm2, velocity_mm_s, l_s_ratio, ellipse_ratio,
  ellipse_ap_deviation_deg, velocity_variance_total_mm_s,
  velocity_variance_ml_mm_s, velocity_variance_ap_mm_s,
  ap_acceleration_mm_s2, lfs.

2) Page 2 — Per-foot metrics + Foot stabilograms
- left/right tables: length_mm, area_mm2, velocity_mm_s, x_avg_mm, y_avg_mm, x_dev_mm, y_dev_mm, ellipse_ap_deviation_deg
- foot_stabilograms:
  { ml_observation, ap_observation, less_stable_foot }

3) Page 3 — Global stabilograms + CoP velocity
- { ml_trace_observation, ap_trace_observation, cop_velocity_observation, dominant_plane }

4) Page 4 — FFT (X = M-L, Y = A-P, then Cross-spectrum, Force Z)
- ml: { dominant_band_hz ∈ {"<0.2","0.2–0.5",">0.5","not_determinable"}, top_peak_hz_est (e.g., "≈0.10" or null), high_freq_present_gt_0_5 (boolean) }
- ap: same fields
- cross_spectrum: { low_freq_coupling_present (boolean), coupling_peak_hz_est (string or null) }
- force_z: { low_freq_peak_hz_est (string or null), tail_to_1hz ∈ {"rapid","moderate","long","not_determinable"} }
- fft_summary_across_tests: one sentence comparing A vs B vs C.

5) Page 5 — Sway Density Curve
- mp_s, sp_s, md_mm, sd_mm, mt_s, st_s, area
- sdc_pattern ∈ {"regular","irregular","mixed","not_determinable"}
- sdc_note (brief).

6) Page 8 — Postural Index Dashboard
- postural_index_score (number)
- radar_expanded_axes: array from the whitelist (most expanded → least)
- radar_contracted_axes: array from the whitelist (most contracted → least)

COMPUTED COMPARISONS (Page-1 globals ONLY)
- For the metrics below, compute B/A and C/B:
  length_mm, area_mm2, velocity_mm_s, l_s_ratio, ellipse_ratio,
  velocity_variance_total_mm_s, velocity_variance_ml_mm_s,
  velocity_variance_ap_mm_s, ap_acceleration_mm_s2, lfs.
  • Output as { "ratio": <number rounded to 2 decimals>, "pct_change": "<+/-XX%>" }.
- DO NOT compute ratio/% for angles. For ellipse_ap_deviation_deg, output:
  • romberg_b_over_a.ellipse_ap_deviation_deg = { "delta_deg": B - A, "sign_flip": <true|false> }
  • cotton_c_over_b.ellipse_ap_deviation_deg = { "delta_deg": C - B, "sign_flip": <true|false> }

OUTPUT FORMAT (single JSON object)
{
  "patient": { "name": "...", "name_detected_in": ["A","B","C"], "notes": null },
  "tests": {
    "A": { "metadata": {...}, "page1": {...}, "page2": {...}, "page3": {...}, "page4_fft": {...}, "page5_sdc": {...}, "page6_synthesis": {...}, "page8_dashboard": {...}, "discrepancies": { /* optional */ } },
    "B": { ... },
    "C": { ... }
  },
  "comparisons": {
    "romberg_b_over_a": { ... },
    "cotton_c_over_b": { ... }
  }
}

DISCREPANCIES OBJECT SCHEMA (if any)
"discrepancies": {
  "left_right_load_pct": {
    "page1": {"left": <num>, "right": <num>},
    "page8": {"left": <num>, "right": <num>},
    "decision": "page1"
  },
  "...other_fields_if_any...": { "page1": <num>, "page8": <num>, "decision": "page1" }
}
`.trim();

const AGENT2_PROMPT = `
Prompt 2 — Clinical Interpretation & Diagnosis (consumes Agent-1 JSON)

ROLE
You are a clinical posturology expert.

INPUT
• You receive the first agent’s JSON payload. Treat it as the SOLE patient evidence.

KNOWLEDGE USE
• Prefer the organization's KB via vector store. Cite ONLY retrieved KB snippets (e.g., [Title] or [Author, Year]) and include a short References list.
• If no relevant KB passages are retrieved: use your pretrained knowledge to explain concepts, but write: "KB support: none found." Do NOT cite external articles.

EVIDENCE DISCIPLINE
• Use ONLY facts present in the JSON for patient measurements.
• Where JSON uses qualitative uncertainty ("tie","balanced","not_determinable"), reflect that caution—do not over-interpret.

ANGLE HANDLING
• Never use ratios or % change for angles.
• Use the JSON’s angle comparison fields:
  – romberg_b_over_a.ellipse_ap_deviation_deg: { delta_deg, sign_flip }
  – cotton_c_over_b.ellipse_ap_deviation_deg: { delta_deg, sign_flip }

STRUCTURE (write these sections)

Header
- Patient: <patient.name>.

(1) Evidence from patient’s PDFs (verbatim)
- Summarize A, B, C by page:
  • Page-1 globals (+ V.N. statuses if present), loads/pressures, COP X/Y, LFS, L/S, ellipse metrics.
  • Page-2 per-foot metrics + foot-stabilogram notes (less_stable_foot).
  • Page-3 global stabilograms/CoP-velocity highlights (drifts, bursts, dominant_plane, acknowledging "balanced" if applicable).
  • Page-4 FFT (order: M-L[X], A-P[Y], Cross-spectrum, Force[Z]) — dominant bands, >0.5 Hz presence, coupling, Z tail; include the across-tests FFT comparison.
  • Page-5 SDC values & pattern.
  • Page-8 Postural Index & radar axes (use whitelist terms).
  • Computed Romberg (B/A) and Cotton (C/B) ratios per JSON.
  • If JSON has "discrepancies", list them briefly and note the Page-1 tie-breaker.

(2) KB-backed and/or pretrained context
- Explain clinical meaning of metrics (Length, Area, Velocity, L/S, ellipse, velocity variance, A/P acceleration, LFS, SDC, FFT bands).
- Compare sensory contributions (visual, vestibular, proprioceptive, stomatognathic); state clearly which appears strongest, tying to JSON evidence (ratios, LFS/L-S, FFT profile, SDC).
- Provide inline citations ONLY to retrieved KB; end with a short References list or "KB support: none found."

(3) Diagnosis
- Provide a concise diagnosis.
- Explicitly RANK sensory systems using this EXACT format: "PRIMARY: [visual|vestibular|proprioceptive|stomatognathic] → SECONDARY: [system] → MINOR: [system]" based on JSON evidence.
  Example: "PRIMARY: visual → SECONDARY: proprioceptive → MINOR: vestibular"
- Recommend next steps (e.g., visual reweighting, TMJ/occlusal evaluation, vestibular/oculomotor screen, foam conditions, re-testing).

(4) Safety notes / methodological caveats
- Device/protocol dependencies (platform-specific LFS, 30-s window), missing fields/V.N. statuses, inter-trial variability, cotton-rolls as screening not treatment.

TONE
Professional and clinical; reflect uncertainty where present; do not over-state beyond JSON evidence.
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

// Helper function to clean extracted JSON and remove diagnostics
function cleanExtractedJson(jsonText: string, reqId: string): string {
  try {
    const parsed = JSON.parse(jsonText);
    
    // Keep only the required fields
    const cleaned = {
      patient: parsed.patient || {},
      tests: parsed.tests || {},
      comparisons: parsed.comparisons || {}
    };
    
    // Log if we're removing any unexpected fields
    const extraFields = Object.keys(parsed).filter(key => !['patient', 'tests', 'comparisons'].includes(key));
    if (extraFields.length > 0) {
      console.log(`[analyze:${reqId}] Removing unexpected fields from extracted JSON: ${extraFields.join(', ')}`);
    }
    
    return JSON.stringify(cleaned, null, 2);
  } catch (e) {
    // Return original if parsing fails
    console.log(`[analyze:${reqId}] Unable to clean extracted JSON: ${e}`);
    return jsonText;
  }
}

function normalizeExtraction(ex: any) {
  try {
    for (const key of ["A", "B", "C"] as const) {
      const t = ex?.tests?.[key];
      if (!t) continue;
      
      // Check load percentages directly under page1 (not page1.loads)
      const page1 = t?.page1;
      if (page1 && typeof page1.left_load_pct === "number" && typeof page1.right_load_pct === "number") {
        const sum = page1.left_load_pct + page1.right_load_pct;
        if (!(sum >= 98 && sum <= 102)) {
          page1.left_load_pct = null;
          page1.right_load_pct = null;
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
  // Collect debug logs if verbose mode is enabled
  const debugLogs: string[] = [];
  const originalConsoleLog = console.log;
  
  try {
    const reqId = Math.random().toString(36).slice(2, 8);
    const t0 = Date.now();
    
    // Check if verbose mode is enabled and intercept console.log
    const tempSettings = getDefaultSettings() as any;
    if (tempSettings?.verboseOpenAI) {
      // Helper function to sanitize base64 data in logs
      const sanitizeBase64 = (obj: any): any => {
        if (typeof obj === 'string') {
          // Check for base64 data URLs
          if (obj.includes('data:') && obj.includes('base64,')) {
            // Replace the base64 content but keep the structure
            return obj.replace(/data:([^;]+);base64,[A-Za-z0-9+/]+=*/g, (match, mimeType) => {
              const fileType = mimeType.split('/')[1]?.toUpperCase() || 'FILE';
              const sizeKB = Math.round(match.length / 1024);
              return `data:${mimeType};base64,[${fileType} base64 - ${sizeKB}KB]`;
            });
          }
          // Check for raw base64 strings (long strings with base64 chars)
          if (obj.length > 5000 && /^[A-Za-z0-9+/]{100,}={0,2}$/.test(obj)) {
            return `[Base64 data - ${Math.round(obj.length / 1024)}KB]`;
          }
          // Check for file_data property with base64
          if (obj.length > 100 && obj.includes('"file_data"') && obj.includes('base64')) {
            return obj.replace(/"file_data"\s*:\s*"data:[^"]+"/g, (match) => {
              const sizeKB = Math.round(match.length / 1024);
              return `"file_data": "[Base64 data - ${sizeKB}KB]"`;
            });
          }
          return obj;
        }
        if (Array.isArray(obj)) {
          return obj.map(sanitizeBase64);
        }
        if (obj && typeof obj === 'object') {
          const result: any = {};
          for (const key in obj) {
            result[key] = sanitizeBase64(obj[key]);
          }
          return result;
        }
        return obj;
      };
      
      console.log = (...args: any[]) => {
        const message = args.map(arg => {
          const sanitized = sanitizeBase64(arg);
          return typeof sanitized === 'object' ? JSON.stringify(sanitized, null, 2) : String(sanitized);
        }).join(' ');
        debugLogs.push(message);
        originalConsoleLog.apply(console, args);
      };
    }
    
    console.log(`[analyze:${reqId}] Received request`);
    const reqHeadersSafe: Record<string, string> = {};
    req.headers.forEach((v, k) => {
      if (k.toLowerCase() === "authorization") {
        reqHeadersSafe[k] = v ? `${v.slice(0, 8)}…` : "";
      } else {
        reqHeadersSafe[k] = v;
      }
    });
    console.log(`[analyze:${reqId}] Incoming headers`, reqHeadersSafe);
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

    const sha12 = (b: Buffer) => crypto.createHash('sha256').update(b).digest('hex').slice(0, 12);
    console.log(`[analyze:${reqId}] Uploads → A(name=${neutral.name}, type=${neutral.type}, size=${neutral.size}, sha256_12=${sha12(neutralBuf)}), B(name=${closed.name}, type=${closed.type}, size=${closed.size}, sha256_12=${sha12(closedBuf)}), C(name=${cotton.name}, type=${cotton.type}, size=${cotton.size}, sha256_12=${sha12(cottonBuf)})`);

    // Convert PDFs to images for better visual interpretation
    console.log(`[analyze:${reqId}] Converting PDFs to high-quality images for pages 1,2,3,4,5,6,8...`);
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
    if (neutralImages.length === 0 || closedImages.length === 0 || cottonImages.length === 0) {
      console.warn(`[analyze:${reqId}] One or more image sets are empty. PDF-to-image may have failed.`);
    }

    // First pass: Extraction analysis directly on PDFs
    console.log(`[analyze:${reqId}] Starting extraction (Agent 1) using model=${extractionModel} ...`);
    const tExt0 = Date.now();
    const extractionPrompt = `Prompt 1 — Extraction & Pre-Analysis Agent (feeds Agent 2)
You are a baropodometric/stabilometric extraction agent.

Goal
Parse the provided inputs SEQUENTIALLY - PDFs first for data, then images for visual interpretation:

MANDATORY Processing Order:

1. **FIRST: Parse PDFs for ALL text and table data**:
   - Three PDF reports: A = Neutral / Eyes Open, B = Eyes Closed, C = Eyes Closed + Cotton Rolls
   - Use PDF parser to extract ALL text, numbers, tables from pages 1, 2, 3, 4, 5, 6, and 8
   - Extract patient names, dates, all numeric measurements, table values, load percentages (patients name is mentioned in one line with test date. the patients name is not hermann dental that is just the name of our clinic, so dont print that as patients name.)
   - Get ALL quantitative data from PDFs before looking at images

2. **SECOND: Use PNG Images for visual interpretation ONLY**:
   - High-resolution screenshots of pages 1, 2, 3, 4, 5, 6, and 8 from each PDF
   - ONLY use these for: interpreting graphs/plots, analyzing stabilogram patterns,
     understanding FFT spectra, viewing footprint heatmaps, assessing visual trends
   - Do NOT extract numbers from images - you should already have all numbers from PDF parsing

3. **THIRD: Combine both sources**:
   - Merge PDF-extracted data with image-based visual interpretations
   - PDF data = all numbers and text
   - Image analysis = qualitative patterns and visual assessments

Scope
Use ONLY pages 1, 2, 3, 4, 5, 6, and 8. Ignore all other pages.

CRITICAL: Output Structure Requirements

Your response MUST be in TWO distinct parts:

PART 1: DIAGNOSTIC REPORT (Optional - plain text)
If you encounter issues or used fallbacks, briefly list them here:
- PDF parsing issues
- Missing data  
- Ambiguous values
- Load percentage source (e.g., "Used page 1 fallback - page 6 only had 50/50" or "Page 6 loads used: 51/49")
Skip this section if no issues and no fallbacks used.

<<<JSON_START>>>
PART 2: JSON EXTRACTION (Required)
Place your JSON here - must contain ONLY these three top-level fields:
- patient
- tests
- comparisons
<<<JSON_END>>>

IMPORTANT RULES:
1. Diagnostics go BEFORE the JSON markers, NOT inside the JSON
2. The JSON must contain ONLY these three top-level fields: patient, tests, comparisons
3. Do NOT add a "diagnostics" field to the JSON
4. Use the exact fence markers: <<<JSON_START>>> and <<<JSON_END>>>
5. Everything between the markers must be valid JSON

Strict rules
- Extract ONLY what is printed on those pages (OCR if needed). Do NOT guess or infer.
- Preserve units, but normalize decimals to dot (e.g., 11.57). Return numbers as JSON numbers, not strings.
- If a printed value/field is missing, set it to null. For V.N. statuses, only use "not_printed" when the V.N. cell is truly blank/empty (not when it contains a single number).
- Qualitative descriptions of plots are allowed (short, factual, no speculation).
- Absolutely NO clinical interpretation or diagnosis.

PAGE LAYOUT & WHAT TO EXTRACT

0) Page header (present on page 1)
- patient_name: the actual patient's name from the report (typically found on a line with the test date). NOT the clinic name from the header. Look for "Paziente:" or similar field. Keep diacritics and spacing.
- test_datetime_local: the "Test date" + time string as printed.
- duration_s: numeric duration in seconds, if printed.
- measure_condition: string shown under the header (e.g., "Neutral", "Closed Eyes", "closed eyes cotton rolls").

1) Page 1 — Baropodometry & Stabilometry (footprints + globals)
- Load percentages determination:
  PRIMARY SOURCE: Use page 6 GLOBAL SYNTHESIS percentages (if valid and not 50/50)
  FALLBACK: If page 6 has only 50/50 or missing, use two-number pair near footprints on page 1 that sums to ~100 and is not 50/50
  Final values: left_load_pct, right_load_pct (propagate chosen values here)
- Mean pressures: left_mean_pressure, right_mean_pressure
- Quadrant loads: ordered [UL, UR, LL, LR] if printed (these are the four numbers, NOT the L/R percentages)
- Arch types: arch_type_left/right if printed else null.
- COP mean coordinates table (with SD and V.N. status):
  cop_mean_x_mm, cop_sd_x_mm, cop_x_vn_status ∈ {"within","above","below","not_printed"}
  cop_mean_y_mm, cop_sd_y_mm, cop_y_vn_status ∈ same set.
  IMPORTANT: Calculate status by comparing mean value to V.N. value:
  - If V.N. is "X ± Y": range [X-Y to X+Y] → within/below/above
  - If V.N. is single number "N": threshold ≤ N → within/above only
  - Only use "not_printed" if V.N. cell is empty
- Global metrics table: Store in a nested "global_metrics" object where each metric has "value" and "vn_status":
  global_metrics: {
    length_mm: { value: <number>, vn_status: <string> },
    area_mm2: { value: <number>, vn_status: <string> },
    velocity_mm_s: { value: <number>, vn_status: <string> },
    l_s_ratio: { value: <number>, vn_status: <string> },
    ellipse_ratio: { value: <number>, vn_status: <string> },
    ellipse_ap_deviation_deg: { value: <number>, vn_status: <string> },
    velocity_variance_total_mm_s: { value: <number>, vn_status: <string> },
    velocity_variance_ml_mm_s: { value: <number>, vn_status: <string> },
    velocity_variance_ap_mm_s: { value: <number>, vn_status: <string> },
    ap_acceleration_mm_s2: { value: <number>, vn_status: <string> },
    lfs: { value: <number>, vn_status: <string> }
  }
  For each metric's V.N. status:
  1. Extract the V.N. value from the table:
     - If format is "X ± Y" or "X+/-Y": treat as range [X-Y to X+Y]
     - If single number "N" with no ±: treat as threshold (upper limit ≤ N)
  2. Compare measured value:
     - For ranges: "within" if inside range, "below" if < min, "above" if > max
     - For thresholds: "within" if ≤ N, "above" if > N (no "below" for thresholds)
     - Example: If length V.N. is "60" and measured is 78.34, status is "above"
     - Example: If area V.N. is "40±10" (range 30-50) and measured is 22.83, status is "below"
  3. ONLY use "not_printed" if V.N. cell is truly blank/empty

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

6) Page 6 — GLOBAL SYNTHESIS
- Load percentages: Look for two percentages immediately above "RETROPIEDE" text.
  - Normalize commas to dots (51,0% → 51.0)
  - Keep pairs that sum to 100 ±1
  - Discard 50.0% / 50.0% (placeholder values)
  - If multiple valid pairs exist, take the leftmost
  - NEVER use four-number sets (those are quadrant loads)
  - Store as: page6_left_load_pct, page6_right_load_pct
  - If only 50/50 found or missing: set both to null

7) Page 8 — Postural Index Dashboard
- postural_index_score (number).
- radar_expanded_axes: array of axis labels that appear most expanded.
- radar_contracted_axes: array of labels most contracted.

Computed comparisons (use ONLY page-1 global metrics)
- romberg_b_over_a: for each page-1 global metric, provide { ratio, pct_change }
  where ratio = B/A to 2 decimals and pct_change is a signed percent string (e.g., "+97%").
- cotton_c_over_b: same structure comparing C/B.
- sensory_ranking: Based on all metrics (ratios, LFS, FFT, SDC patterns), determine:
  - primary: dominant sensory system (visual/vestibular/proprioceptive/stomatognathic/not_determinable)
  - secondary: second most important system
  - minor: least influential system

OUTPUT FORMAT
Between <<<JSON_START>>> and <<<JSON_END>>>, return this exact structure:

{
  "patient": {
    "name": "<actual patient name>",
    "name_detected_in": ["A","B","C"],
    "notes": null
  },
  "tests": {
    "A": { 
      "metadata": { 
        "test_datetime_local": "...",
        "duration_s": 30,
        "measure_condition": "..."
      },
      "page1": {
        "page6_left_load_pct": <number>,
        "page6_right_load_pct": <number>,
        "left_mean_pressure": <number>,
        "right_mean_pressure": <number>,
        "quadrant_loads": [<4 numbers>],
        "arch_type_left": null,
        "arch_type_right": null,
        "cop_mean_x_mm": <number>,
        "cop_sd_x_mm": <number>,
        "cop_x_vn_status": "...",
        "cop_mean_y_mm": <number>,
        "cop_sd_y_mm": <number>,
        "cop_y_vn_status": "...",
        "global_metrics": {
          "length_mm": { "value": <number>, "vn_status": "..." },
          "area_mm2": { "value": <number>, "vn_status": "..." },
          "velocity_mm_s": { "value": <number>, "vn_status": "..." },
          "l_s_ratio": { "value": <number>, "vn_status": "..." },
          "ellipse_ratio": { "value": <number>, "vn_status": "..." },
          "ellipse_ap_deviation_deg": { "value": <number>, "vn_status": "..." },
          "velocity_variance_total_mm_s": { "value": <number>, "vn_status": "..." },
          "velocity_variance_ml_mm_s": { "value": <number>, "vn_status": "..." },
          "velocity_variance_ap_mm_s": { "value": <number>, "vn_status": "..." },
          "ap_acceleration_mm_s2": { "value": <number>, "vn_status": "..." },
          "lfs": { "value": <number>, "vn_status": "..." }
        }
      },
      "page2": { ... },
      "page3": { ... },
      "page4_fft": { ... },
      "page5_sdc": { ... },
      "page6_synthesis": { ... },
      "page8_dashboard": { ... }
    },
    "B": { ... },
    "C": { ... }
  },
  "comparisons": {
    "romberg_b_over_a": { ... },
    "cotton_c_over_b": { ... },
    "sensory_ranking": { "primary": "...", "secondary": "...", "minor": "..." }
  }
}

No narrative. No diagnosis. No extra fields.`;

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

    console.log(`[analyze:${reqId}] OpenAI#1 (extraction) request: model=${extractionModel}, input_parts=${extractionInput[0].content.length}`);
    if ((getDefaultSettings() as any).verboseOpenAI) {
      console.log(`[analyze:${reqId}] OpenAI#1 exact payload:`, JSON.stringify({ model: extractionModel, input: extractionInput }, null, 2));
    }
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
    const verboseMode = (getDefaultSettings() as any).verboseOpenAI;
    if (!verboseMode) {
      console.log(`[analyze:${reqId}] OpenAI#1 (extraction) raw preview:`, extractionText.slice(0, 400).replace(/\s+/g, ' '));
    } else {
      console.log(`[analyze:${reqId}] OpenAI#1 exact response:`, JSON.stringify(extractionResp, null, 2));
    }
    const tExt1 = Date.now();
    console.log(`[analyze:${reqId}] Extraction completed in ${tExt1 - tExt0}ms, chars=${extractionText?.length || 0}`);

    if (!extractionText) {
      throw new Error("Empty extraction response from model");
    }

    // Parse the diagnostic section and JSON from the extraction response (support fence markers)
    let extractionDiagnostics = "";
    let extractionJsonText = extractionText;
    const fenceStart = '<<<JSON_START>>>';
    const fenceEnd = '<<<JSON_END>>>';
    const startIdx = extractionText.indexOf(fenceStart);
    const endIdx = extractionText.lastIndexOf(fenceEnd);
    
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      // Found fence markers - use them
      extractionDiagnostics = extractionText.substring(0, startIdx).trim();
      extractionJsonText = extractionText.substring(startIdx + fenceStart.length, endIdx).trim();
    } else {
      // No fence markers - try to detect JSON structure
      // Look for JSON that starts with {"patient": or {"diagnostics":
      const jsonMatch = extractionText.match(/(\{[\s\S]*"patient"[\s\S]*\})\s*$/);
      if (jsonMatch) {
        extractionJsonText = jsonMatch[1];
        extractionDiagnostics = extractionText.substring(0, jsonMatch.index).trim();
      } else {
        // Fallback: split at first JSON opening brace
        const jsonStartIndex = extractionText.indexOf('{');
        if (jsonStartIndex > 0) {
          extractionDiagnostics = extractionText.substring(0, jsonStartIndex).trim();
          extractionJsonText = extractionText.substring(jsonStartIndex).trim();
        }
      }
    }
    
    // Clean up the JSON to ensure it only contains required fields
    extractionJsonText = cleanExtractedJson(extractionJsonText, reqId);
    // Log extraction diagnostics if available
    const verboseDiag = (getDefaultSettings() as any).verboseOpenAI;
    if (extractionDiagnostics) {
      if (verboseDiag) {
        console.log(`[analyze:${reqId}] Extraction diagnostics:\n${extractionDiagnostics}`);
      } else {
        console.log(`[analyze:${reqId}] Extraction diagnostics available (${extractionDiagnostics.length} chars)`);
      }
    }

    // Second pass: Knowledge augmentation (RAG) based on extraction using vector store
    console.log(`[analyze:${reqId}] Starting augmentation (Responses API call #2) with RAG=${settings.vectorStoreId ? 'on' : 'off'} (KB primary, pretrained fallback without external citations) ...`);
    const tAug0 = Date.now();
    const augmentationPrompt = AGENT2_PROMPT;

    const augmentationInput: any[] = [
      {
        role: "user",
        content: [
          { type: "input_text", text: augmentationPrompt },
          { type: "input_text", text: `Extracted findings to augment (verbatim):\n\n${extractionJsonText}` }
        ]
      }
    ];

    console.log(`[analyze:${reqId}] OpenAI#2 (augmentation) request: model=${model}, kb=${settings.vectorStoreId ? 'on' : 'off'}, input_len=${augmentationInput[0].content.map((p:any)=>p.text||'').join('\n').length}`);
    if ((getDefaultSettings() as any).verboseOpenAI) {
      console.log(`[analyze:${reqId}] OpenAI#2 exact payload:`, JSON.stringify({ model, input: augmentationInput, tools: settings.vectorStoreId ? [{ type: 'file_search', vector_store_ids: [settings.vectorStoreId] }] : [{ type: 'file_search', vector_store_ids: [] }] }, null, 2));
    }
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
    const verboseMode2 = (getDefaultSettings() as any).verboseOpenAI;
    if (!verboseMode2) {
      console.log(`[analyze:${reqId}] OpenAI#2 (augmentation) raw preview:`, augmentedText.slice(0, 300).replace(/\s+/g, ' '));
    } else {
      console.log(`[analyze:${reqId}] OpenAI#2 exact response:`, JSON.stringify(augmentedResp, null, 2));
    }
    const tAug1 = Date.now();
    console.log(`[analyze:${reqId}] Augmentation completed in ${tAug1 - tAug0}ms, chars=${augmentedText?.length || 0}`);
    const t1 = Date.now();
    console.log(`[analyze:${reqId}] Done in ${t1 - t0}ms`);

    const respPayload = { ok: true, data: {
      mode,
      extractionReportText: extractionJsonText,
      // Provide parsed JSON too when possible
      extractionReportJson: tryParseJSON(extractionJsonText),
      augmentedReportText: augmentedText,
      debug: {
        prepareMs: tPrep1 - tPrep0,
        extractionMs: tExt1 - tExt0,
        augmentationMs: tAug1 - tAug0,
        totalMs: t1 - t0,
        extractionModel,
        augmentationModel: model,
        vectorStoreUsed: Boolean(settings.vectorStoreId),
        extractionDiagnostics: extractionDiagnostics || "No diagnostic output provided",
        // Include full debug logs if verbose mode is enabled
        ...(settings?.verboseOpenAI ? { verboseLogs: debugLogs } : {})
      }
    }};
    const verboseFinal = (getDefaultSettings() as any).verboseOpenAI;
    if (!verboseFinal) {
      console.log(`[analyze:${reqId}] → Response body preview:`, truncateForLog(JSON.stringify(respPayload), 2000));
    }
    return new Response(JSON.stringify(respPayload), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
  } catch (error) {
    // Restore original console.log
    console.log = originalConsoleLog;
    console.error("Error in analyze route:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  } finally {
    // Always restore original console.log
    console.log = originalConsoleLog;
  }
}