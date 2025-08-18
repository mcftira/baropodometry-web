import { NextRequest } from "next/server";
import { getDefaultSettings } from "@/lib/server-config";

export const runtime = "nodejs";
export const maxDuration = 60; // 60 seconds timeout for processing

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const neutral = form.get("neutral") as File | null;
    const closed = form.get("closed_eyes") as File | null;
    const cotton = form.get("cotton_rolls") as File | null;
    const mode = form.get("mode") as string | null; // "normal" or "comparison"

    if (!(neutral && closed && cotton)) {
      return new Response(JSON.stringify({ ok: false, error: "Missing PDF(s). 3 stages required." }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // Get settings with hardcoded defaults
    const settings = getDefaultSettings();
    
    if (!settings.apiKey) {
      return new Response(JSON.stringify({ ok: false, error: "No API key configured" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    // Call OpenAI Assistant API
    const { OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: settings.apiKey });

    // Upload PDFs as files for the Assistant
    console.log("Uploading PDF files to OpenAI...");
    
    const [neutralFile, closedFile, cottonFile] = await Promise.all([
      openai.files.create({
        file: neutral,
        purpose: "assistants"
      }),
      openai.files.create({
        file: closed,
        purpose: "assistants"
      }),
      openai.files.create({
        file: cotton,
        purpose: "assistants"
      })
    ]);

    console.log("Files uploaded:", {
      neutral: neutralFile.id,
      closed: closedFile.id,
      cotton: cottonFile.id
    });

    // Create thread with the files attached
    const thread = await openai.beta.threads.create({
      messages: [{
        role: "user",
        content: `Please analyze these 3 PDF reports:
1. NEUTRAL stage PDF
2. CLOSED EYES stage PDF  
3. COTTON ROLLS stage PDF

Extract all visible metrics from tables, graphs, and visual elements. ${mode === "comparison" ? "Compute Romberg and Cotton Effect comparisons." : "Provide detailed stage analysis with clinical interpretation."}

Return a structured JSON response as per your instructions.`,
        attachments: [
          { file_id: neutralFile.id, tools: [{ type: "file_search" }] },
          { file_id: closedFile.id, tools: [{ type: "file_search" }] },
          { file_id: cottonFile.id, tools: [{ type: "file_search" }] }
        ]
      }]
    });

    // Run assistant based on mode
    const assistantId = mode === "comparison" 
      ? settings.assistantIdComparison 
      : settings.assistantIdNormal;
    
    console.log("Using assistant:", assistantId, "for mode:", mode);
    console.log("Settings:", settings);
    
    const run = await openai.beta.threads.runs.createAndPoll(
      thread.id,
      { 
        assistant_id: assistantId,
        max_prompt_tokens: 50000,
        max_completion_tokens: 4000
      }
    );

    console.log("Run status:", run.status);
    if (run.status === 'failed') {
      console.error("Run failed:", run);
      console.error("Last error:", run.last_error);
    }

    if (run.status === 'completed') {
      // Get messages
      const messages = await openai.beta.threads.messages.list(thread.id);
      const assistantMessage = messages.data.find(m => m.role === 'assistant');
      
      if (assistantMessage?.content?.[0]?.type === 'text') {
        const responseText = assistantMessage.content[0].text.value;
        
        // Try to parse JSON from response
        let result;
        try {
          // Extract JSON if wrapped in markdown code blocks
          const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/) || 
                           responseText.match(/```\n?([\s\S]*?)\n?```/);
          const jsonStr = jsonMatch ? jsonMatch[1] : responseText;
          result = JSON.parse(jsonStr);
        } catch {
          // If not valid JSON, return the raw text
          result = {
            patient: { name: null, dateTime: new Date().toISOString() },
            stages: {
              neutral: { textMetrics: {}, visionMetrics: {} },
              closed_eyes: { textMetrics: {}, visionMetrics: {} },
              cotton_rolls: { textMetrics: {}, visionMetrics: {} },
            },
            comparisons: {
              romberg: {},
              cottonEffect: {},
              summary: responseText,
              confidence: 0.5
            }
          };
        }

        return new Response(JSON.stringify({ ok: true, data: result }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
    }

    // If run failed or no response
    return new Response(JSON.stringify({ 
      ok: false, 
      error: `Assistant run failed: ${run.status}`,
      details: run.last_error 
    }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });

  } catch (e) {
    const message = e instanceof Error ? e.message : "Processing error";
    console.error("API analyze error:", e);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}