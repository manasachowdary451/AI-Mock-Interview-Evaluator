// app/api/softskills/route.js
import { NextResponse } from "next/server";

// Example: Mock scoring function
function analyzeSoftSkills(data) {
  // Later replace with Python/ML service
  return [
    { category: "Voice Clarity", score: Math.floor(Math.random() * 40) + 60, suggestion: "Try to articulate more clearly." },
    { category: "Body Posture", score: Math.floor(Math.random() * 40) + 60, suggestion: "Maintain an upright sitting position." },
    { category: "Confidence", score: Math.floor(Math.random() * 40) + 60, suggestion: "Keep steady eye contact with the camera." },
    { category: "Communication", score: Math.floor(Math.random() * 40) + 60, suggestion: "Use structured answers with examples." },
  ];
}

export async function POST(req) {
  try {
    const body = await req.json(); // input data from frontend (like audio/video analysis result)
    const softSkills = analyzeSoftSkills(body);

    return NextResponse.json({ softSkills });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
