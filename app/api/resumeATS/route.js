// app/api/resumeATS/route.js
import { NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import { randomUUID } from "crypto";

// Drizzle DB imports - adjust path if needed
import { db } from "@/utils/db";
import { MockInterview } from "@/utils/schema";

/**
 * POST /api/resumeATS
 * Accepts FormData:
 *  - mockId (optional)  -> string
 *  - role               -> string
 *  - description        -> string (job description / tech stack)
 *  - experience         -> string or number
 *  - resume             -> File (PDF preferred)
 *
 * Returns:
 *  { success: true, atsResult: {...} }
 */
export async function POST(req) {
  try {
    // Read multi-part form (Request.formData works in App Router)
    const form = await req.formData();

    const mockId = (form.get("mockId") && String(form.get("mockId"))) || randomUUID();
    const role = (form.get("role") && String(form.get("role"))) || "";
    const description = (form.get("description") && String(form.get("description"))) || "";
    const experience = (form.get("experience") && String(form.get("experience"))) || "";
    const resumeFile = form.get("resume"); // may be null

    // Extract resume text (support PDF; for non-PDF we fall back to empty text)
    let resumeText = "";
    if (resumeFile && typeof resumeFile !== "string") {
      try {
        // A File from formData supports arrayBuffer()
        const ab = await resumeFile.arrayBuffer();
        const buffer = Buffer.from(ab);

        // Try parse as PDF (pdf-parse). If parse fails, resumeText remains empty.
        const pdfData = await pdfParse(buffer);
        resumeText = (pdfData && pdfData.text) ? String(pdfData.text) : "";
      } catch (err) {
        // If pdf parse fails (or file is not PDF), we silently continue with empty resumeText
        console.warn("resumeATS: resume parse failed:", err?.message || err);
        resumeText = "";
      }
    }

    // 🔎 Detect scanned / image-based resume
    const isScanned = !resumeText || resumeText.length < 50;


    // 🔍 DEBUG: check if text is actually extracted
    console.log("RESUME TEXT LENGTH:", resumeText.length);
    console.log("RESUME SAMPLE:", resumeText.slice(0, 200));


    // --- Simple ATS scoring logic ---
    // Build a list of keywords from the job description
    const rawKeywords = description
  .toLowerCase()
  .replace(/[^a-z0-9 ]/g, " ")
  .split(/\s+/)
  .filter(word => word.length > 2);

    // Fallback to role words if no description keywords
    if (rawKeywords.length === 0 && role) {
      rawKeywords.push(...role.split(/\s+/).map((s) => s.trim()).filter(Boolean));
    }

    const resumeLower = (resumeText || "").toLowerCase();
    let matchCount = 0;
    const matchedKeywords = [];

    for (const kw of rawKeywords) {
      if (kw.length > 1 && resumeLower.includes(kw.toLowerCase())) {
        matchCount++;
        matchedKeywords.push(kw);
      }
    }

    const denominator = Math.max(1, rawKeywords.length);
    let score = Math.round((matchCount / denominator) * 100);

    if (!resumeText || resumeText.length < 100 || isScanned) {
      score = 0;
    } else {
      // ✅ Baseline for valid resumes (prevents 0)
      if (resumeText.length > 500 && score < 35) {
        score = 35;
      }

      const skillKeywords = [
        "html", "css", "javascript", "java", "python",
        "node", "mysql", "mongodb", "git"
      ];
      
      let skillMatches = 0;
      const resumeLower = resumeText.toLowerCase();
      
      skillKeywords.forEach(skill => {
        if (resumeLower.includes(skill)) {
          skillMatches++;
        }
      });

      score = score + skillMatches * 3;
      // small bonus for presence of "certified"
      if (resumeLower.includes("certified")) {
        score = score + 5;
      }
    }

    score = Math.max(0, Math.min(100, score));

    const roleSkillMap = {
      "Frontend Developer": ["html", "css", "javascript", "react"],
      "Backend Developer": ["node", "express", "java", "spring", "python"],
      "Full Stack Developer": ["html", "css", "javascript", "react", "node", "mongodb"],
      "Software Engineer": ["java", "python", "c++", "data structures"],
      "Data Analyst": ["python", "pandas", "sql", "excel"],
      "DevOps Engineer": ["docker", "kubernetes", "aws", "linux"],
    };
    
    const roleScores = {};
    
    for (const role in roleSkillMap) {
      let roleMatchCount = 0;
      
      roleSkillMap[role].forEach(skill => {
        if (resumeLower.includes(skill)) {
          roleMatchCount++;
        }
      });

      if (roleMatchCount > 0) {
        roleScores[role] = roleMatchCount;
      }
    }

    // Pick top 3 matching roles
    const suggestedRoles = Object.entries(roleScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([role]) => role);

    const atsResult = {
      interviewId: mockId,
      ats_score: score,
      matched_keywords: matchedKeywords,
      resume_text_length: resumeText.length,
      candidate_summary:
      !isScanned && resumeText.length > 50
      ? resumeText.slice(0, 600).replace(/\s+/g, " ")
      : "Resume text could not be extracted. Please upload a text-based PDF.",

  // Keyword & resume metadata
      matched_keywords: matchedKeywords,
      resume_text_length: resumeText.length,

  // Scanned resume detection
      isScannedResume: isScanned,
      warnings: isScanned
      ? ["Your resume appears to be image-based. Please upload a text-based PDF."]
      : [],

  // Improvement suggestions
      suggestions:
      score < 60
      ? [
          "Add more job-specific keywords and technologies to the resume.",
          "Emphasize relevant projects and achievements in the experience section.",
        ]
      : ["Good match — highlight the matched skills near the top of your resume."],

      suggested_roles: suggestedRoles,
      created_at: new Date().toISOString(),
    };

    // 🔍 DEBUG: verify ATS result on server
    console.log("FINAL ATS RESULT:", atsResult);

    return NextResponse.json({
      success: true,
      atsResult,
    });


    // --- Persist ATS to DB (Drizzle) ---
    // The MockInterview table / column names may differ in your project.
    // Try to insert/update a row to include ATS info. If your table doesn't have these columns,
    // the insert/update will throw; we catch the error and continue returning the ATS result.
    try {
      // First try to find an existing record with mockId
      const existing = await db
        .select()
        .from(MockInterview)
        .where(MockInterview.mockId.eq(mockId))
        .limit(1);

      if (existing && existing.length > 0) {
        // Update existing row (attempt). Adapt column names if your schema differs.
        await db
          .update(MockInterview)
          .set({
            ats_score: atsResult.ats_score,
            ats_result: JSON.stringify(atsResult),
            resume_text: resumeText ? resumeText.slice(0, 4000) : null,
          })
          .where(MockInterview.mockId.eq(mockId));
      } else {
        // Insert a new row (you may already insert the mock interview on the client as you did earlier).
        await db.insert(MockInterview).values({
          mockId,
          jsonMockResp: null,
          jobPosition: role,
          jobDesc: description,
          jobExperience: experience,
          createdBy: null,
          createdAt: new Date().toISOString(),
          // ATS fields (ensure these exist or adapt names)
          ats_score: atsResult.ats_score,
          ats_result: JSON.stringify(atsResult),
          resume_text: resumeText ? resumeText.slice(0, 4000) : null,
        });
      }
    } catch (dbErr) {
      // If DB schema doesn't match or insert fails, just log and continue
      console.warn("resumeATS: DB persist failed — adapt MockInterview schema if you want persistence.", dbErr?.message || dbErr);
    }

    // Return the ATS result to the client
    return NextResponse.json({ success: true, atsResult });
  } catch (err) {
    console.error("resumeATS: unexpected error:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
