"use client";

import { ChangeEvent, useState } from "react";
import { FileUp, SearchCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useSession } from "@/store/session";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type ResumeAnalysis = {
  atsScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  improvements: string[];
};

export function ResumeAnalyzer() {
  const accessToken = useSession((state) => state.accessToken);
  const mode = useSession((state) => state.mode);
  const [file, setFile] = useState<File>();
  const [jobDescription, setJobDescription] = useState("");
  const [analysis, setAnalysis] = useState<ResumeAnalysis>();
  const [status, setStatus] = useState("Upload after sign-in to save resume analysis.");
  const [loading, setLoading] = useState(false);

  function useDemoAnalysis(message = "Demo analysis generated locally. Start the API to save real resume analysis.") {
    const keywords = extractKeywords(jobDescription);
    setAnalysis({
      atsScore: keywords.length ? Math.min(88, 62 + keywords.length * 5) : 62,
      matchedKeywords: keywords.slice(0, 4),
      missingKeywords: keywords.length ? ["Measurable impact", "Production metrics"] : ["Add a job description to compare role-specific keywords"],
      improvements: keywords.length ? [`Align resume bullets more directly with ${keywords.slice(0, 3).join(", ")}.`] : ["Upload a resume and add a job description for a meaningful ATS comparison."]
    });
    setStatus(message);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0]);
  }

  async function analyzeResume() {
    if (!file) {
      setAnalysis(undefined);
      setStatus("Choose a resume file before analyzing.");
      return;
    }
    if (!accessToken || mode !== "authenticated") {
      useDemoAnalysis("Local analysis generated from the job description. Sign in with a running API to parse and save uploads.");
      return;
    }
    const formData = new FormData();
    formData.set("resume", file);
    formData.set("jobDescription", jobDescription);
    setLoading(true);
    setStatus("Analyzing resume...");
    try {
      const result = await api<ResumeAnalysis>("/resume/analyze", {
        accessToken,
        method: "POST",
        body: formData
      });
      setAnalysis(result);
      setStatus("Resume analysis saved to backend.");
    } catch (error) {
      useDemoAnalysis(isUnauthorizedError(error) ? "Sign in to save resume analysis. Showing local analysis for now." : "Unable to save resume analysis. Showing local analysis for now.");
    } finally {
      setLoading(false);
    }
  }

  const keywords = analysis?.matchedKeywords ?? [];

  return (
    <section id="resume" className="space-y-4">
      <h2 className="text-xl font-semibold">AI resume analyzer</h2>
      <Card className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-md border border-dashed border-border p-6">
          <FileUp className="h-8 w-8 text-primary" />
          <p className="mt-4 font-semibold">Upload PDF, DOCX, text, or Markdown resume</p>
          <p className="text-sm text-muted-foreground">Extract skills, projects, ATS score, and job-description alignment.</p>
          <input
            accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
            className="mt-5 block w-full text-sm"
            onChange={onFileChange}
            type="file"
          />
          <textarea
            className="mt-4 min-h-24 w-full rounded-md border border-border bg-background p-3 text-sm outline-none focus:ring-4 focus:ring-primary/30"
            onChange={(event) => setJobDescription(event.target.value)}
            placeholder="Paste the target job description or role requirements here."
            value={jobDescription}
          />
          <Button className="mt-4" disabled={loading} onClick={analyzeResume}>
            {loading ? "Analyzing..." : "Analyze resume"}
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">{status}</p>
        </div>
        <div>
          <div className="flex items-center gap-3">
            <div className="grid h-20 w-20 place-items-center rounded-full border-8 border-primary text-xl font-bold">{analysis?.atsScore ?? "--"}</div>
            <div>
              <p className="font-semibold">ATS match score</p>
              <p className="text-sm text-muted-foreground">{analysis?.improvements?.[0] ?? "Upload a resume and add the target job description to generate analysis."}</p>
            </div>
          </div>
          {keywords.length ? (
            <div className="mt-5 grid grid-cols-2 gap-2">
              {keywords.map((keyword) => (
                <span className="inline-flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm" key={keyword}>
                  <SearchCheck className="h-4 w-4 text-success" />
                  {keyword}
                </span>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No keywords analyzed yet.</div>
          )}
          {!!analysis?.missingKeywords?.length && <p className="mt-4 text-sm text-muted-foreground">Missing: {analysis.missingKeywords.join(", ")}</p>}
        </div>
      </Card>
    </section>
  );
}

function extractKeywords(jobDescription: string) {
  const normalized = jobDescription.toLowerCase();
  const keywords = [
    "TypeScript",
    "JavaScript",
    "React",
    "Next.js",
    "Node.js",
    "Express.js",
    "NestJS",
    "PostgreSQL",
    "MongoDB",
    "Redis",
    "Docker",
    "CI/CD",
    "AWS",
    "Azure",
    "Testing",
    "Observability",
    "System design"
  ];

  return keywords.filter((keyword) => normalized.includes(keyword.toLowerCase().replace(".", "")) || normalized.includes(keyword.toLowerCase()));
}

function isUnauthorizedError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.message.includes("401") || error.message.toLowerCase().includes("unauthorized");
}
