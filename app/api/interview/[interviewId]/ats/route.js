export const dynamic = "force-dynamic";
// app/api/interview/[interviewId]/ats/route.js
import { NextResponse } from "next/server";
// Drizzle imports
import { db } from "@/utils/db";
import { MockInterview } from "@/utils/schema";
import { eq } from "drizzle-orm";

export async function GET(req, { params }) {
  try {
    const { interviewId } = params;

    // Query by mockId (adjust column name if different)
    const rows = await db.select().from(MockInterview).where(eq(MockInterview.mockId, interviewId)).limit(1);

    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const row = rows[0];

    // If you stored ats_result as JSON string:
    let ats = null;
    if (row.ats_result) {
      try {
        ats = JSON.parse(row.ats_result);
      } catch (e) {
        console.warn("Failed parsing ats_result:", e);
      }
    }

    // Build a fallback ats object from columns if ats_result not present
    if (!ats) {
      ats = {
        interviewId,
        ats_score: row.ats_score ?? null,
        candidate_summary: row.resume_text ?? null,
        suggestions: row.ats_suggestions ? JSON.parse(row.ats_suggestions) : [],
      };
    }

    return NextResponse.json({ success: true, atsResult: ats });
  } catch (err) {
    console.error("GET /api/interview/[id]/ats error:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
