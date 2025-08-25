import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  return NextResponse.json({
    ok: true,
    message: "API routes are working!",
    timestamp: new Date().toISOString(),
    env: {
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      model: process.env.MODEL || "not set",
      language: process.env.LANGUAGE || "not set",
      vectorStoreId: process.env.VECTOR_STORE_ID || "not set"
    }
  });
}

export async function POST(req: NextRequest) {
  return NextResponse.json({
    ok: true,
    message: "POST endpoint working!",
    timestamp: new Date().toISOString()
  });
}
