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

    const settings = getDefaultSettings();
    if (!settings.apiKey) {
      console.error("No API key available");
      return new Response(JSON.stringify({ ok: false, error: "API key not configured" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    // Call OpenAI Assistant API
    const { OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: settings.apiKey });

    // Upload PDFs as files for the Assistant
    console.log("Uploading PDF files to OpenAI...");
    
    let neutralFile, closedFile, cottonFile;
    
    try {
      // Convert File objects to Blobs for upload
      const neutralBlob = new Blob([await neutral.arrayBuffer()], { type: neutral.type });
      const closedBlob = new Blob([await closed.arrayBuffer()], { type: closed.type });
      const cottonBlob = new Blob([await cotton.arrayBuffer()], { type: cotton.type });
      
      // Create File-like objects with proper names
      const neutralUpload = new File([neutralBlob], neutral.name, { type: neutral.type });
      const closedUpload = new File([closedBlob], closed.name, { type: closed.type });
      const cottonUpload = new File([cottonBlob], cotton.name, { type: cotton.type });
      
      [neutralFile, closedFile, cottonFile] = await Promise.all([
        openai.files.create({
          file: neutralUpload,
          purpose: "assistants"
        }),
        openai.files.create({
          file: closedUpload,
          purpose: "assistants"
        }),
        openai.files.create({
          file: cottonUpload,
          purpose: "assistants"
        })
      ]);
      
      console.log("Files uploaded successfully:", {
        neutral: neutralFile.id,
        closed: closedFile.id,
        cotton: cottonFile.id
      });
    } catch (uploadError) {
      console.error("Error uploading files:", uploadError);
      return new Response(JSON.stringify({ 
        ok: false, 
        error: "Failed to upload PDF files. Please try again." 
      }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

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
    console.log("Model:", settings.model);
    console.log("Thread ID:", thread.id);
    
    // Adjust token limits based on model
    const tokenLimits = {
      "gpt-4o": { prompt: 15000, completion: 2000 },
      "gpt-4o-mini": { prompt: 25000, completion: 3000 },
      "gpt-4-turbo": { prompt: 20000, completion: 2500 },
      "gpt-3.5-turbo": { prompt: 10000, completion: 1500 }
    };
    
    const limits = tokenLimits[settings.model as keyof typeof tokenLimits] || tokenLimits["gpt-4o-mini"];
    
    const run = await openai.beta.threads.runs.createAndPoll(
      thread.id,
      { 
        assistant_id: assistantId,
        model: settings.model, // Override assistant's default model
        max_prompt_tokens: limits.prompt,
        max_completion_tokens: limits.completion
      }
    );

    console.log("Run status:", run.status);
    if (run.status === 'failed') {
      console.error("Run failed:", run);
      console.error("Last error:", run.last_error);
      
      // Clean up uploaded files
      try {
        await Promise.all([
          openai.files.del ? openai.files.del(neutralFile.id) : openai.files.delete?.(neutralFile.id),
          openai.files.del ? openai.files.del(closedFile.id) : openai.files.delete?.(closedFile.id),
          openai.files.del ? openai.files.del(cottonFile.id) : openai.files.delete?.(cottonFile.id)
        ].filter(Boolean));
      } catch (cleanupError) {
        console.error("Error cleaning up files:", cleanupError);
      }
      
      return new Response(JSON.stringify({ 
        ok: false, 
        error: `Assistant run failed: ${run.last_error?.message || 'Unknown error'}` 
      }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
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
              cotton_rolls: { textMetrics: {}, visionMetrics: {} }
            },
            interpretation: {
              vision_findings: responseText,
              clinical_interpretation: "Unable to parse structured response",
              evidence_status: "VALID"
            }
          };
        }
        
        // Clean up uploaded files after successful processing
        // Note: OpenAI SDK v4 uses 'delete' instead of 'del'
        try {
          await Promise.all([
            openai.files.del ? openai.files.del(neutralFile.id) : openai.files.delete?.(neutralFile.id),
            openai.files.del ? openai.files.del(closedFile.id) : openai.files.delete?.(closedFile.id),
            openai.files.del ? openai.files.del(cottonFile.id) : openai.files.delete?.(cottonFile.id)
          ].filter(Boolean));
        } catch (cleanupError) {
          console.error("Error cleaning up files:", cleanupError);
          // Not critical, continue
        }
        
        return new Response(JSON.stringify({ ok: true, data: result }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
    }

    throw new Error(`Assistant run ended with unexpected status: ${run.status}`);
    
  } catch (error) {
    console.error("Error in analyze route:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}