import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const envVars = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? "Set (hidden)" : "Not set",
    MODEL: process.env.MODEL || "Not set",
    LANGUAGE: process.env.LANGUAGE || "Not set",
    VECTOR_STORE_ID: process.env.VECTOR_STORE_ID || "Not set",
    VERBOSE_OPENAI: process.env.VERBOSE_OPENAI || "Not set",
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    NETLIFY: process.env.NETLIFY,
  };

  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: envVars,
    headers: {
      host: req.headers.get("host"),
      "user-agent": req.headers.get("user-agent"),
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return NextResponse.json({
      status: "healthy",
      method: "POST",
      received: body,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
}
