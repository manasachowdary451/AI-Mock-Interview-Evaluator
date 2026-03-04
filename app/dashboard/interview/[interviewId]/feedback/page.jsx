"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/utils/db";
import { UserAnswer } from "@/utils/schema";
import { eq } from "drizzle-orm";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle, CardHeader } from "@/components/ui/card";
import {
  CheckCircle2,
  XCircle,
  ChevronsUpDown,
  Activity,
  Target,
} from "lucide-react";

const Feedback = ({ params }) => {
  const interviewId = params?.interviewId;
  const router = useRouter();

  const [feedbackList, setFeedbackList] = useState([]);
  const [averageRating, setAverageRating] = useState(null);
  const [loading, setLoading] = useState(true);
  const [atsResult, setAtsResult] = useState(() => {
    if (typeof window === "undefined") return null;
    const saved = localStorage.getItem(`atsResult:${params.interviewId}`);
    return saved ? JSON.parse(saved) : null;
  });
  const [error, setError] = useState(null);

  // Helper to color ratings
  const getRatingColor = (rating) => {
    const numRating = parseFloat(rating);
    if (!numRating && numRating !== 0) return "text-gray-600";
    if (numRating >= 8) return "text-green-600";
    if (numRating >= 5) return "text-yellow-600";
    return "text-red-600";
  };

  // Fetch interview answers/feedback from Drizzle DB
  const GetFeedback = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await db
        .select()
        .from(UserAnswer)
        .where(eq(UserAnswer.mockIdRef, interviewId))
        .orderBy(UserAnswer.id);

      setFeedbackList(result || []);

      const validRatings = (result || [])
        .map((item) => parseFloat(item.rating))
        .filter((r) => !isNaN(r));

      const totalRating = validRatings.reduce((sum, r) => sum + r, 0);
      const avgRating =
        validRatings.length > 0 ? (totalRating / validRatings.length).toFixed(1) : null;

      setAverageRating(avgRating);
    } catch (err) {
      console.error("GetFeedback error:", err);
      setError("Failed to load interview feedback.");
      setFeedbackList([]);
      setAverageRating(null);
    } finally {
      setLoading(false);
    }
  };

useEffect(() => {
  console.log("FEEDBACK PAGE interviewId:", interviewId);
  if (!interviewId) return;
  // Try to load ATS result from server; fallback to localStorage if not found
  const loadAtsResult = async () => {
    try {
      const res = await fetch(`/api/interview/${interviewId}/ats`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.atsResult) {
          setAtsResult(data.atsResult);
          return;
        }
      }
    } catch (e) {
      console.warn("Server ATS fetch failed, falling back to localStorage", err);
    }

    console.log("READING ATS KEY:", `atsResult:${interviewId}`);

    // Fallback to localStorage keyed by interviewId
    const saved = localStorage.getItem(`atsResult:${interviewId}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      console.log("ATS FROM LOCALSTORAGE:", parsed);
      console.log("LOOKING FOR ATS KEY:", `atsResult:${interviewId}`);
      setAtsResult(parsed);
    } else {
      console.warn("NO ATS FOUND IN LOCALSTORAGE");
      setAtsResult(null);
    }
    };
    
    GetFeedback();

  }, [interviewId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Activity className="mx-auto h-12 w-12 text-indigo-600 animate-pulse" />
          <p className="mt-4 text-gray-600">Loading your interview feedback...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Error */}
      {error && (
        <div className="max-w-4xl mx-auto mb-6">
          <Card>
            <CardContent>
              <p className="text-red-600 font-medium">{error}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Resume / ATS Card */}
      <div className="max-w-4xl mx-auto mb-8">
        {atsResult ? (
          <div className="p-6 border rounded-lg bg-white shadow">
            <h2 className="text-2xl font-bold text-indigo-600">Resume Analysis</h2>

            <div className="mt-4">
              <p className="text-gray-700 font-semibold">
                ATS Score: <span className="font-bold">{atsResult?.ats_score !== null ? atsResult.ats_score : "N/A"}</span>/100
              </p>
              <div className="w-full bg-gray-200 rounded-full h-4 mt-2">
                <div
                  className="h-4 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.max(0, atsResult.ats_score ?? 0))}%`,
                    backgroundColor:
                      (atsResult.ats_score ?? 0) >= 75
                        ? "#22c55e"
                        : (atsResult.ats_score ?? 0) >= 50
                        ? "#facc15"
                        : "#ef4444",
                  }}
                />
              </div>
            </div>

            <p className="mt-4 text-gray-700">
              <span className="font-semibold">Summary:</span>{" "}
              {atsResult.candidate_summary ?? "No summary available."}
            </p>

                  {/* ⚠️ Scanned Resume Warning */}
                  {atsResult?.isScannedResume && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg mt-4">
                      <p className="text-red-700 font-semibold">
                        ⚠️ Resume text could not be extracted.
                      </p>
                      <p className="text-sm text-red-600">
                      Please upload a text-based PDF (not scanned).
                      </p>
                    </div>
                  )}


            {atsResult.suggestions?.length > 0 && (
              <div className="mt-4">
                <p className="font-semibold text-gray-700">Suggestions:</p>
                <ul className="mt-2 list-disc pl-6 text-gray-700">
                  {atsResult.suggestions.map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {atsResult?.suggested_roles?.length > 0 && (
              <div className="mt-6">
                <p className="font-semibold text-gray-700">
                  Suggested Job Roles (Based on Your Resume)
                </p>
                
              <div className="flex flex-wrap gap-3 mt-3">
                {atsResult.suggested_roles.map((role, idx) => (
                  <span
                    key={idx}
                    className="px-4 py-2 rounded-full bg-indigo-100 text-indigo-700 text-sm font-medium"
                  >
                    {role}
                  </span>
                ))}
              </div>
            </div>

          )}

            <div className="mt-4 flex gap-3">
              <Button variant="ghost" onClick={() => router.push("/dashboard")}>
                Update Resume
              </Button>
              <Button onClick={() => {
                // allow quick navigation to interview start or details
                router.push(`/interview/${interviewId}/start`);
              }}>
                Re-take Interview
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-6 border rounded-lg bg-yellow-50 shadow">
            <h2 className="text-xl font-bold text-yellow-700">Resume Missing</h2>
            <p className="mt-2 text-gray-700">
              No resume uploaded yet. Upload your resume to get ATS feedback and suggestions.
            </p>
            <div className="mt-4">
              <Button onClick={() => router.push("/dashboard")}>Upload Resume</Button>
            </div>
          </div>
        )}
      </div>

      {/* Soft Skills Feedback */}
      <div className="max-w-4xl mx-auto mb-8">
        <h3 className="text-xl font-semibold text-gray-700 mb-4">Soft Skills Feedback</h3>

        <div className="grid gap-6 md:grid-cols-2">
          {(atsResult?.softSkills && atsResult.softSkills.length > 0
            ? atsResult.softSkills
            : [
                // default fallback soft skills if none present
                { category: "Voice Clarity", score: 72, suggestion: "Speak slower for clarity." },
                { category: "Body Posture", score: 65, suggestion: "Sit upright, avoid fidgeting." },
                { category: "Confidence", score: 80, suggestion: "Good confidence, reduce filler words." },
                { category: "Communication", score: 70, suggestion: "Give structured answers." },
              ]
          ).map((skill, idx) => (
            <Card key={idx} className="rounded-2xl shadow-md">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">{skill.category}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Score</span>
                  <span className="text-sm font-medium text-gray-800">
                    {skill.score}/100
                  </span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="h-3 rounded-full transition-all duration-500"
                    style={{
                      width: `${skill.score}%`,
                      backgroundColor:
                        skill.score >= 75 ? "#22c55e" : skill.score >= 50 ? "#facc15" : "#ef4444",
                    }}
                  />
                </div>

                <p className="text-sm text-gray-600 mt-2">{skill.suggestion}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Detailed Interview Feedback */}
      {feedbackList.length === 0 ? (
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <XCircle className="mx-auto h-16 w-16 text-red-500" />
            <h2 className="text-2xl font-bold text-gray-800 mt-4">No Interview Feedback Available</h2>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-6">
              It seems like no feedback has been generated for this interview yet.
            </p>
            <Button variant="outline" onClick={() => router.replace("/dashboard")} className="w-full">
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="max-w-4xl mx-auto mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center gap-4">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
                <div>
                  <h2 className="text-3xl font-bold text-green-600">Great Job!</h2>
                  <p className="text-gray-600">You've completed your mock interview.</p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Overall Rating</p>
                    <p className={`text-2xl font-bold ${getRatingColor(averageRating)}`}>
                      {averageRating ? `${averageRating}/10` : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Questions</p>
                    <p className="text-2xl font-bold text-indigo-600">
                      {feedbackList.length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="max-w-4xl mx-auto space-y-4">
            <h3 className="text-xl font-semibold text-gray-700">Detailed Interview Feedback</h3>
            {feedbackList.map((item, index) => (
              <Collapsible key={index} className="border rounded-lg overflow-hidden">
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between p-4 bg-gray-100 hover:bg-gray-200">
                    <div className="flex items-center gap-3">
                      <Target
                        className={`h-5 w-5 ${
                          parseFloat(item.rating) >= 7 ? "text-green-500" : parseFloat(item.rating) >= 4 ? "text-yellow-500" : "text-red-500"
                        }`}
                      />
                      <span className="font-medium text-gray-800 line-clamp-1">{item.question}</span>
                    </div>
                    <ChevronsUpDown className="h-4 text-gray-500" />
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent className="p-4 bg-white">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2">Your Answer</h4>
                      <p className="bg-red-50 p-3 rounded-lg text-sm text-red-900 border border-red-200">
                        {item.userAns || "No answer provided"}
                      </p>
                    </div>

                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2">Correct Answer</h4>
                      <p className="bg-green-50 p-3 rounded-lg text-sm text-green-900 border border-green-200">
                        {item.correctAns}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <h4 className="font-semibold text-gray-700 mb-2">Feedback</h4>
                    <p className="bg-blue-50 p-3 rounded-lg text-sm border border-blue-200">
                      {item.feedback}
                    </p>
                  </div>

                  <div className="mt-4 text-right">
                    <span className={`font-bold ${getRatingColor(item.rating)}`}>
                      Rating: {item.rating}/10
                    </span>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Feedback;
