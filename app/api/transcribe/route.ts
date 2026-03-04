import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("audio") as File;

    if (!file) {
      return NextResponse.json({ error: "No audio file uploaded" }, { status: 400 });
    }

    // Convert file to buffer for Whisper
    const buffer = Buffer.from(await file.arrayBuffer());

    // Send to Whisper for transcription
    const response = await client.audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "verbose_json", // gives timestamps & multiple speakers info
    });

    return NextResponse.json({
      text: response.text,
      segments: response.segments, // optional detailed transcription
    });
  } catch (error: any) {
    console.error("❌ Whisper error:", error);
    return NextResponse.json(
      { error: "Failed to transcribe audio", details: error.message },
      { status: 500 }
    );
  }
}
