"use client";

import { ChangeEvent, useState } from "react";
import { Clipboard, FileUp, SearchCheck } from "lucide-react";
import { api, getFriendlyErrorMessage } from "@/lib/api";
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
  const [statusTone, setStatusTone] = useState<"info" | "success" | "error">("info");
  const [loading, setLoading] = useState(false);

  async function useDemoAnalysis(message = "Local analysis generated from available resume/JD evidence.") {
    const resumeText = await readLocalResumeText(file);
    const report = analyzeResumeLocally(resumeText, jobDescription);
    const breakdown = createLocalBreakdown(jobDescription, report.matchedKeywords.length, resumeText);
    setAnalysis({
      atsScore: breakdown.total,
      matchedKeywords: report.matchedKeywords.slice(0, 10),
      missingKeywords: report.missingKeywords.length ? report.missingKeywords.slice(0, 10) : ["Add more specific role evidence from the job description"],
      improvements: [
        `Score breakdown: Skills ${breakdown.skills}/40, JD alignment ${breakdown.alignment}/30, proof ${breakdown.proof}/20, readability ${breakdown.readability}/10.`,
        report.evidence,
        report.rewriteSuggestion,
        report.confidence,
        "Rewrite bullets using this formula: action + role-specific skill + measurable result."
      ]
    });
    setStatus(message);
    setStatusTone("success");
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0]);
  }

  async function analyzeResume() {
    if (!file) {
      setAnalysis(undefined);
      setStatus("Choose a resume file before analyzing.");
      setStatusTone("error");
      return;
    }
    if (!accessToken || mode !== "authenticated") {
      await useDemoAnalysis("Local analysis generated from the resume/JD text available in the browser. Sign in with a running API to parse and save uploads.");
      return;
    }
    const formData = new FormData();
    formData.set("resume", file);
    formData.set("jobDescription", jobDescription);
    setLoading(true);
    setStatus("Analyzing resume...");
    setStatusTone("info");
    try {
      const result = await api<ResumeAnalysis>("/resume/analyze", {
        accessToken,
        method: "POST",
        body: formData
      });
      setAnalysis(result);
      setStatus("Resume analysis saved to backend.");
      setStatusTone("success");
    } catch (error) {
      await useDemoAnalysis(`${getFriendlyErrorMessage(error, "Unable to save resume analysis.")} Showing local analysis for now.`);
    } finally {
      setLoading(false);
    }
  }

  async function copyResumeReport() {
    if (!analysis) {
      setStatus("Analyze a resume before copying the report.");
      setStatusTone("error");
      return;
    }
    try {
      await navigator.clipboard.writeText(buildResumeReport(file?.name, jobDescription, analysis));
      setStatus("Resume analysis report copied.");
      setStatusTone("success");
    } catch {
      setStatus("Could not copy automatically. Select the recommendations and copy them manually.");
      setStatusTone("error");
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
          <Button className="ml-2 mt-4 bg-muted text-foreground" disabled={!analysis} onClick={copyResumeReport} type="button">
            <Clipboard className="h-4 w-4" />
            Copy report
          </Button>
          <p
            aria-live="polite"
            className={`mt-3 rounded-md border px-3 py-2 text-sm ${
              statusTone === "error"
                ? "border-red-300 bg-red-50 text-red-700"
                : statusTone === "success"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-border bg-muted text-muted-foreground"
            }`}
            role={statusTone === "error" ? "alert" : "status"}
          >
            {status}
          </p>
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
          {!!analysis?.improvements?.length && (
            <div className="mt-5 rounded-md border border-border p-4">
              <p className="text-sm font-semibold">Evidence-based recommendations</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {analysis.improvements.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}

function extractKeywords(jobDescription: string, includeRoleTerms = false) {
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

  const matched = keywords.filter((keyword) => normalized.includes(keyword.toLowerCase().replace(".", "")) || normalized.includes(keyword.toLowerCase()));
  if (!includeRoleTerms) return matched;

  const roleTerms = normalized
    .split(/[^a-z0-9+#./-]+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 3 && !new Set(["this", "that", "with", "from", "will", "role", "team", "work", "using", "build"]).has(term))
    .slice(0, 8)
    .map((term) => term.replace(/(^\w|\s\w)/g, (letter) => letter.toUpperCase()));
  return [...matched, ...roleTerms];
}

function createLocalBreakdown(jobDescription: string, matchedCount: number, resumeText: string) {
  const hasJobDescription = jobDescription.trim().length > 40;
  const skills = Math.min(40, matchedCount * 5);
  const alignment = hasJobDescription ? Math.min(30, 12 + matchedCount * 3) : 8;
  const proof = /(metric|performance|scale|users|revenue|latency|test|deploy|production|ci\/cd|docker|cloud|\d+%|\d+\+)/i.test(resumeText) ? 18 : 9;
  const readability = resumeText.length > 350 ? 8 : 5;
  return {
    skills,
    alignment,
    proof,
    readability,
    total: Math.max(42, Math.min(92, skills + alignment + proof + readability))
  };
}

async function readLocalResumeText(file: File | undefined) {
  if (!file) return "";
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "txt" || extension === "md" || file.type.startsWith("text/")) {
    try {
      return await file.text();
    } catch {
      return "";
    }
  }
  return `Uploaded ${extension?.toUpperCase() ?? "resume"} file: ${file.name}. Browser local mode uses filename plus job description; backend mode extracts full PDF/DOCX text.`;
}

function analyzeResumeLocally(resumeText: string, jobDescription: string) {
  const jdTerms = unique([...extractKeywords(jobDescription, true), ...extractImportantTerms(jobDescription)]).slice(0, 18);
  const resume = resumeText.toLowerCase();
  const matchedKeywords = jdTerms.filter((term) => resume.includes(term.toLowerCase()) || extractKeywords(resumeText).includes(term));
  const missingKeywords = jdTerms.filter((term) => !matchedKeywords.some((matched) => matched.toLowerCase() === term.toLowerCase())).slice(0, 10);
  const strongest = matchedKeywords.slice(0, 4);
  const missing = missingKeywords.slice(0, 4);
  const topMissing = missing[0] ?? "role-specific impact";

  return {
    matchedKeywords,
    missingKeywords,
    evidence: strongest.length
      ? `Evidence: matched JD language found in resume/local text: ${strongest.join(", ")}.`
      : "Evidence: local mode did not find strong resume/JD overlap; add exact role terms from the JD.",
    rewriteSuggestion: `Bullet rewrite target: show ${topMissing} with one action, one tool/process, and one measurable outcome.`,
    confidence:
      resumeText.length > 200 && jobDescription.length > 200
        ? "Confidence: Medium-high because both resume text and job description content were available locally."
        : "Confidence: Medium because browser local mode has limited resume parsing for PDF/DOCX; backend mode gives deeper extraction."
  };
}

function extractImportantTerms(text: string) {
  const stopWords = new Set(["about", "after", "also", "and", "are", "build", "candidate", "company", "developer", "experience", "for", "from", "have", "into", "join", "role", "team", "that", "the", "this", "using", "with", "will", "work", "you", "your"]);
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#./-]+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 3 && !stopWords.has(term) && !/^\d+$/.test(term))
    .slice(0, 18)
    .map(toDisplayTerm);
}

function toDisplayTerm(term: string) {
  const known = extractKeywords(term, false)[0];
  if (known) return known;
  return term.replace(/(^[a-z]|\s[a-z])/g, (letter) => letter.toUpperCase());
}

function unique(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildResumeReport(fileName: string | undefined, jobDescription: string, analysis: ResumeAnalysis) {
  return [
    "DevElevate AI Resume Analysis",
    `Resume: ${fileName ?? "Uploaded resume"}`,
    `ATS match score: ${analysis.atsScore}`,
    "",
    "Matched keywords:",
    analysis.matchedKeywords.length ? analysis.matchedKeywords.map((item) => `- ${item}`).join("\n") : "- None yet",
    "",
    "Missing keywords:",
    analysis.missingKeywords.length ? analysis.missingKeywords.map((item) => `- ${item}`).join("\n") : "- None",
    "",
    "Recommendations:",
    analysis.improvements.length ? analysis.improvements.map((item) => `- ${item}`).join("\n") : "- No recommendations generated",
    "",
    jobDescription.trim() ? `Job description length: ${jobDescription.trim().length} characters` : "No job description provided"
  ].join("\n");
}
