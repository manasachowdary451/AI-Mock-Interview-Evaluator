"use client";
import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { chatSession } from "@/utils/GeminiAIModal";
import { LoaderCircle, Sparkles } from "lucide-react";
import { MockInterview } from "@/utils/schema";
import { v4 as uuidv4 } from 'uuid';
import { db } from "@/utils/db";
import { useUser } from "@clerk/nextjs";
import moment from "moment";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
// import ResumeUpload from "@/components/ResumeUpload";

// Job Role Suggestions
const JOB_ROLE_SUGGESTIONS = [
  'Full Stack Developer',
  'Frontend Developer',
  'Backend Developer',
  'Software Engineer',
  'DevOps Engineer',
  'Data Scientist',
  'Machine Learning Engineer',
  'Cloud Engineer',
  'Mobile App Developer',
  'UI/UX Designer'
];

// Tech Stack Suggestions
const TECH_STACK_SUGGESTIONS = {
  'Full Stack Developer': 'React, Node.js, Express, MongoDB, TypeScript',
  'Frontend Developer': 'React, Vue.js, Angular, TypeScript, Tailwind CSS',
  'Backend Developer': 'Python, Django, Flask, Java Spring, PostgreSQL',
  'Software Engineer': 'Java, C++, Python, AWS, Microservices',
  'DevOps Engineer': 'Docker, Kubernetes, Jenkins, AWS, Azure',
  'Data Scientist': 'Python, TensorFlow, PyTorch, Pandas, NumPy',
  'Machine Learning Engineer': 'Python, scikit-learn, Keras, TensorFlow',
  'Cloud Engineer': 'AWS, Azure, GCP, Terraform, Kubernetes',
  'Mobile App Developer': 'React Native, Flutter, Swift, Kotlin',
  'UI/UX Designer': 'Figma, Sketch, Adobe XD, InVision'
};

function AddNewInterview() {
  const [openDialog, setOpenDialog] = useState(false);
  const [jobPosition, setJobPosition] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobExperience, setJobExperience] = useState("");
  const [resumeFile, setResumeFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const { user } = useUser();
  const router = useRouter();

  // Auto-suggest tech stack based on job role
  const autoSuggestTechStack = (role) => {
     const suggestion = TECH_STACK_SUGGESTIONS[role];
    if (suggestion) {
      setJobDescription(suggestion);
      toast.info(`Auto-filled tech stack for ${role}`);
    } else {
      toast("No automated suggestion for this role");
    }
  };

  const handleResumeUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Basic client-side validation
    const allowed = [".pdf", ".doc", ".docx"];
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["pdf", "doc", "docx"].includes(ext)) {
      toast.error("Please upload a PDF or Word document (.pdf, .doc, .docx).");
      return;
    }
    setResumeFile(file);
    toast.success(`Resume selected: ${file.name}`);
  };

  const onSubmit = async (e) => {
    e.preventDefault();

    if (!jobPosition || !jobDescription || jobExperience === "") {
      toast.error("Please fill all required fields.");
      return;
    }
    setLoading(true);

    const mockId = uuidv4();
  
    const inputPrompt = `
Job Position: ${jobPosition}
Job Description: ${jobDescription}
Years of Experience: ${jobExperience}

Generate exactly 10 interview questions and answers in the following distribution:
- 2 aptitude questions
- 2 coding questions
- 3 technical questions (specific to the job role and tech stack)
- 2 HR questions
- 1 logical thinking question

Return the output strictly in valid JSON format as an array of objects.
Each object must follow this structure:
{
  "category": "aptitude | coding | technical | hr | logical",
  "question": "string",
  "answer": "string"
}

Do NOT include any text outside the JSON.
Do NOT include code block markers like \`\`\`.
Return ONLY the JSON.
`;
  
try {
      const aiResult = await chatSession.sendMessage(inputPrompt);
      const rawText = await aiResult.response.text();
      // Remove stray ``` if any and parse JSON
      const cleaned = rawText.replace(/```json\n?|```/g, "").trim();
      const mockJson = JSON.parse(cleaned);

      // 2) Send resume + meta + mock JSON to server endpoint for ATS analysis
      // Prepare FormData so file upload works
      const fd = new FormData();
      fd.append("mockId", mockId); // send our client mockId
      fd.append("role", jobPosition);
      fd.append("description", jobDescription);
      fd.append("experience", jobExperience);
      fd.append("mockJson", JSON.stringify(mockJson));
      if (resumeFile) fd.append("resume", resumeFile);

      const uploadRes = await fetch("/api/resumeATS", {
        method: "POST",
        body: fd,
      });

      const uploadJson = await uploadRes.json();

      console.log("UPLOAD JSON FULL:", uploadJson);
      console.log("UPLOAD ATS RESULT:", uploadJson.atsResult);


      if (uploadJson?.atsResult?.ats_score !== null) {
        localStorage.setItem(
          `atsResult:${mockId}`,
          JSON.stringify(uploadJson.atsResult)
        );
      } else {
        console.error("❌ ATS RESULT MISSING OR NULL", uploadJson);
      }

      const atsResult = uploadJson.atsResult || null;

      // 3) Save MockInterview row locally (Drizzle). Keep same mockId so front-end routes align.
      // This was your previous behavior — adapt if your schema differs.
      try {
        await db.insert(MockInterview).values({
          mockId,
          jsonMockResp: JSON.stringify(mockJson),
          jobPosition: jobPosition,
          jobDesc: jobDescription,
          jobExperience: jobExperience,
          createdBy: user?.primaryEmailAddress?.emailAddress || user?.id || "anonymous",
          createdAt: moment().format("DD-MM-YYYY"),
        });
      } catch (dbErr) {
        // If DB insert fails, still proceed — it's not fatal for the user flow.
        console.warn("Local DB insert failed:", dbErr);
      }

      toast.success("Interview created — questions generated and resume analyzed!");

      // 5) Navigate to interview dashboard/start — adjust route as your app expects.
      // You previously used: router.push(`dashboard/interview/${res[0]?.mockId}`)
      // We'll route to dashboard/interview/:mockId
      setOpenDialog(false);
      router.push(`/interview/${mockId}/feedback`);
      router.push(`/dashboard/interview/${mockId}`);
    } catch (err) {
      console.error("Add New Interview error:", err);
      toast.error(`Failed: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div
        className="p-10 border rounded-lg bg-secondary hover:scale-105 hover:shadow-md cursor-pointer transition-all"
        onClick={() => setOpenDialog(true)}
      >
        <h1 className="font-bold text-lg text-center">+ Add New</h1>
      </div>
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-bold text-2xl">
              Create Your Interview Preparation
            </DialogTitle>
          </DialogHeader>
          <DialogDescription>
            <form onSubmit={onSubmit}>
              <div className="mt-7 my-3">
                  <label>Job Role/Position</label>
                  <div className="flex items-center space-x-2">
                    <Input
                      placeholder="Ex. Full Stack Developer"
                      value={jobPosition}
                      required
                      onChange={(e) => setJobPosition(e.target.value)}
                      list="jobRoles"
                    />
                    <datalist id="jobRoles">
                      {JOB_ROLE_SUGGESTIONS.map(role => (
                        <option key={role} value={role} />
                      ))}
                    </datalist>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => autoSuggestTechStack(jobPosition)}
                      disabled={!jobPosition}
                      title="Auto-fill tech stack"
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="my-3">
                  <label className="block mb-2">Job Description/Tech Stack</label>
                  <Textarea
                    placeholder="Ex. React, Angular, NodeJs, MySql etc"
                    value={jobDescription}
                    required
                    onChange={(e) => setJobDescription(e.target.value)}
                  />
                </div>
                <div className="my-3">
                  <label className="block mb-2">Years of Experience</label>
                  <Input
                    placeholder="Ex. 5"
                    type="number"
                    min="0"
                    max="70"
                    value={jobExperience}
                    required
                    onChange={(e) => setJobExperience(e.target.value)}
                  />
                </div>

                <div className="my-3">
                <label className="block mb-2">Upload Resume (optional)</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleResumeUpload}
                  className="w-full"
                />
                {resumeFile && (
                  <p className="mt-2 text-sm text-gray-600">Selected: {resumeFile.name}</p>
                )}
              </div>
              <div className="flex gap-5 justify-end">
                <Button type="button" variant="ghost" onClick={() => setOpenDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <LoaderCircle className="animate-spin mr-2" /> Generating
                    </>
                  ) : (
                    'Start Interview'
                  )}
                </Button>
              </div>
            </form>
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AddNewInterview;