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

    // Convert PDFs to base64 for processing
    const [neutralBuffer, closedBuffer, cottonBuffer] = await Promise.all([
      neutral.arrayBuffer(),
      closed.arrayBuffer(),
      cotton.arrayBuffer()
    ]);

    const neutralB64 = Buffer.from(neutralBuffer).toString('base64');
    const closedB64 = Buffer.from(closedBuffer).toString('base64');
    const cottonB64 = Buffer.from(cottonBuffer).toString('base64');

    // Call OpenAI Assistant API
    const { OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: settings.apiKey });

    // Create thread
    const thread = await openai.beta.threads.create();

    // Build message content
    const messageContent = `
Please analyze these 3 PDF reports (one per stage):

1. NEUTRAL stage PDF (base64): ${neutralB64.substring(0, 100)}... [truncated for processing]
2. CLOSED EYES stage PDF (base64): ${closedB64.substring(0, 100)}... [truncated for processing]  
3. COTTON ROLLS stage PDF (base64): ${cottonB64.substring(0, 100)}... [truncated for processing]

Extract metrics from each stage and compute comparisons (Romberg = Closed Eyes / Neutral, Cotton Effect = Cotton Rolls / Closed Eyes).

Return a JSON object with stages data and comparisons.
`;

    // Add message to thread
    await openai.beta.threads.messages.create(
      thread.id,
      {
        role: "user",
        content: messageContent
      }
    );

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