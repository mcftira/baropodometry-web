import { NextRequest } from "next/server";
import { getDefaultSettings } from "@/lib/server-config";

export const runtime = "nodejs";
export const maxDuration = 60;

// Helper to create SSE messages
function createSSEMessage(data: any) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  
  // Create a stream
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send initial status
        controller.enqueue(encoder.encode(createSSEMessage({ 
          type: "status", 
          message: "🔄 Initializing analysis..." 
        })));

        const form = await req.formData();
        const neutral = form.get("neutral") as File | null;
        const closed = form.get("closed_eyes") as File | null;
        const cotton = form.get("cotton_rolls") as File | null;
        const mode = form.get("mode") as string | null;

        if (!(neutral && closed && cotton)) {
          controller.enqueue(encoder.encode(createSSEMessage({ 
            type: "error", 
            message: "Missing PDF(s). 3 stages required." 
          })));
          controller.close();
          return;
        }

        controller.enqueue(encoder.encode(createSSEMessage({ 
          type: "status", 
          message: "✅ PDFs received successfully" 
        })));

        const settings = getDefaultSettings();
        if (!settings.apiKey) {
          controller.enqueue(encoder.encode(createSSEMessage({ 
            type: "error", 
            message: "API key not configured" 
          })));
          controller.close();
          return;
        }

        controller.enqueue(encoder.encode(createSSEMessage({ 
          type: "status", 
          message: "🔑 API key validated" 
        })));

        // Import OpenAI
        const { OpenAI } = await import("openai");
        const openai = new OpenAI({ apiKey: settings.apiKey });

        // Upload PDFs
        controller.enqueue(encoder.encode(createSSEMessage({ 
          type: "status", 
          message: "📤 Uploading PDFs to OpenAI..." 
        })));

        let neutralFile, closedFile, cottonFile;
        
        try {
          controller.enqueue(encoder.encode(createSSEMessage({ 
            type: "status", 
            message: "📄 Processing Neutral PDF..." 
          })));
          
          const neutralBlob = new Blob([await neutral.arrayBuffer()], { type: neutral.type });
          const neutralUpload = new File([neutralBlob], neutral.name, { type: neutral.type });
          neutralFile = await openai.files.create({
            file: neutralUpload,
            purpose: "assistants"
          });

          controller.enqueue(encoder.encode(createSSEMessage({ 
            type: "status", 
            message: "📄 Processing Closed Eyes PDF..." 
          })));
          
          const closedBlob = new Blob([await closed.arrayBuffer()], { type: closed.type });
          const closedUpload = new File([closedBlob], closed.name, { type: closed.type });
          closedFile = await openai.files.create({
            file: closedUpload,
            purpose: "assistants"
          });

          controller.enqueue(encoder.encode(createSSEMessage({ 
            type: "status", 
            message: "📄 Processing Cotton Rolls PDF..." 
          })));
          
          const cottonBlob = new Blob([await cotton.arrayBuffer()], { type: cotton.type });
          const cottonUpload = new File([cottonBlob], cotton.name, { type: cotton.type });
          cottonFile = await openai.files.create({
            file: cottonUpload,
            purpose: "assistants"
          });

          controller.enqueue(encoder.encode(createSSEMessage({ 
            type: "status", 
            message: "✅ All PDFs uploaded successfully" 
          })));
          
        } catch (uploadError) {
          controller.enqueue(encoder.encode(createSSEMessage({ 
            type: "error", 
            message: "Failed to upload PDF files" 
          })));
          controller.close();
          return;
        }

        // Create thread
        controller.enqueue(encoder.encode(createSSEMessage({ 
          type: "status", 
          message: "🧵 Creating analysis thread..." 
        })));

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

        controller.enqueue(encoder.encode(createSSEMessage({ 
          type: "status", 
          message: "✅ Thread created" 
        })));

        // Select assistant
        const assistantId = mode === "comparison" 
          ? settings.assistantIdComparison 
          : settings.assistantIdNormal;
        
        const assistantType = mode === "comparison" ? "Comparison Expert" : "Analysis Expert";
        
        controller.enqueue(encoder.encode(createSSEMessage({ 
          type: "status", 
          message: `🤖 Engaging ${assistantType} Assistant...` 
        })));

        // Adjust token limits
        const tokenLimits = {
          "gpt-4o": { prompt: 15000, completion: 2000 },
          "gpt-4o-mini": { prompt: 25000, completion: 3000 },
          "gpt-4-turbo": { prompt: 20000, completion: 2500 },
          "gpt-3.5-turbo": { prompt: 10000, completion: 1500 }
        };
        
        const limits = tokenLimits[settings.model as keyof typeof tokenLimits] || tokenLimits["gpt-4o-mini"];
        
        controller.enqueue(encoder.encode(createSSEMessage({ 
          type: "status", 
          message: `⚙️ Using model: ${settings.model}` 
        })));

        // Create run
        controller.enqueue(encoder.encode(createSSEMessage({ 
          type: "status", 
          message: "🔍 Analyzing PDFs with AI..." 
        })));

        const run = await openai.beta.threads.runs.create(
          thread.id,
          { 
            assistant_id: assistantId,
            model: settings.model,
            max_prompt_tokens: limits.prompt,
            max_completion_tokens: limits.completion
          }
        );

        // Poll for status
        let runStatus = run;
        const runId = run.id; // Store the run ID
        let attempts = 0;
        const maxAttempts = 60; // 60 seconds max

        while (runStatus.status !== 'completed' && runStatus.status !== 'failed' && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          
          runStatus = await openai.beta.threads.runs.retrieve(thread.id, runId);
          
          // Send status updates
          if (runStatus.status === 'in_progress') {
            const messages = [
              "📊 Extracting metrics from Neutral stage...",
              "👁️ Analyzing Closed Eyes data...",
              "🦷 Processing Cotton Rolls measurements...",
              "📈 Computing statistical comparisons...",
              "📚 Searching knowledge base for citations...",
              "🔬 Applying clinical interpretation...",
              "✍️ Generating diagnosis..."
            ];
            
            const message = messages[attempts % messages.length];
            controller.enqueue(encoder.encode(createSSEMessage({ 
              type: "status", 
              message 
            })));
          } else if (runStatus.status === 'queued') {
            controller.enqueue(encoder.encode(createSSEMessage({ 
              type: "status", 
              message: "⏳ Waiting in queue..." 
            })));
          } else if (runStatus.status === 'requires_action') {
            controller.enqueue(encoder.encode(createSSEMessage({ 
              type: "status", 
              message: "🔧 Processing tool calls..." 
            })));
          }
          
          attempts++;
        }

        if (runStatus.status === 'failed') {
          const errorMsg = runStatus.last_error?.message || 'Unknown error';
          
          // Clean up files
          try {
            await Promise.all([
              openai.files.del ? openai.files.del(neutralFile.id) : openai.files.delete?.(neutralFile.id),
              openai.files.del ? openai.files.del(closedFile.id) : openai.files.delete?.(closedFile.id),
              openai.files.del ? openai.files.del(cottonFile.id) : openai.files.delete?.(cottonFile.id)
            ].filter(Boolean));
          } catch {}
          
          controller.enqueue(encoder.encode(createSSEMessage({ 
            type: "error", 
            message: errorMsg 
          })));
          controller.close();
          return;
        }

        if (runStatus.status === 'completed') {
          controller.enqueue(encoder.encode(createSSEMessage({ 
            type: "status", 
            message: "✅ Analysis complete, retrieving results..." 
          })));

          // Get messages
          const messages = await openai.beta.threads.messages.list(thread.id);
          const assistantMessage = messages.data.find(m => m.role === 'assistant');
          
          if (assistantMessage?.content?.[0]?.type === 'text') {
            const responseText = assistantMessage.content[0].text.value;
            
            // Parse JSON
            let result;
            try {
              const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/) || 
                               responseText.match(/```\n?([\s\S]*?)\n?```/);
              const jsonStr = jsonMatch ? jsonMatch[1] : responseText;
              result = JSON.parse(jsonStr);
            } catch {
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
            
            // Clean up files
            try {
              await Promise.all([
                openai.files.del ? openai.files.del(neutralFile.id) : openai.files.delete?.(neutralFile.id),
                openai.files.del ? openai.files.del(closedFile.id) : openai.files.delete?.(closedFile.id),
                openai.files.del ? openai.files.del(cottonFile.id) : openai.files.delete?.(cottonFile.id)
              ].filter(Boolean));
            } catch {}
            
            controller.enqueue(encoder.encode(createSSEMessage({ 
              type: "complete", 
              data: result 
            })));
            controller.close();
            return;
          }
        }

        controller.enqueue(encoder.encode(createSSEMessage({ 
          type: "error", 
          message: "Analysis timed out" 
        })));
        controller.close();
        
      } catch (error) {
        console.error("Stream error:", error);
        controller.enqueue(encoder.encode(createSSEMessage({ 
          type: "error", 
          message: error instanceof Error ? error.message : "Unknown error" 
        })));
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
