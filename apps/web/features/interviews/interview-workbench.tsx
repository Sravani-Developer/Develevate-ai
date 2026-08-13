"use client";

import { useMemo, useState } from "react";
import { Clipboard, Play, Sparkles } from "lucide-react";
import { api, getFriendlyErrorMessage } from "@/lib/api";
import { useSession } from "@/store/session";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type InterviewQuestion = {
  id: string;
  prompt: string;
  category?: string;
};

type Interview = {
  id: string;
  questions: InterviewQuestion[];
  score?: number | null;
  strengths?: string[];
  weaknesses?: string[];
  suggestions?: string[];
};

type RubricItem = {
  label: string;
  score: number;
  guidance: string;
};

export function InterviewWorkbench() {
  const accessToken = useSession((state) => state.accessToken);
  const mode = useSession((state) => state.mode);
  const [active, setActive] = useState(0);
  const [selectedDifficulty, setSelectedDifficulty] = useState<"EASY" | "MEDIUM" | "HARD">("EASY");
  const [role, setRole] = useState("");
  const [stack, setStack] = useState("");
  const [focus, setFocus] = useState("");
  const [answer, setAnswer] = useState("");
  const [interview, setInterview] = useState<Interview>();
  const [loading, setLoading] = useState<"create" | "evaluate">();
  const [status, setStatus] = useState("Enter a target role and stack, then choose a difficulty to generate questions.");
  const [statusTone, setStatusTone] = useState<"info" | "success" | "error">("info");
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  const questions = interview?.questions ?? [];
  const activeQuestion = questions[active];
  const score = useMemo(() => interview?.score ?? (interview ? 78 + active * 4 : undefined), [active, interview]);
  const rubric = useMemo(() => (answer.trim() ? scoreAnswerRubric(answer, activeQuestion?.prompt ?? "", role) : []), [answer, activeQuestion?.prompt, role]);
  const stackList = stack
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);
  const canGenerate = Boolean(role.trim() && stackList.length);

  function useDemoInterview(difficulty: "EASY" | "MEDIUM" | "HARD") {
    setSelectedDifficulty(difficulty);
    setInterview({
      id: "demo-interview",
      questions: createDemoQuestions(difficulty, role.trim(), stackList, focus.trim())
    });
    setActive(0);
    setAnswer("");
    setStatus("Local interview generated from your role, stack, focus, and difficulty.");
    setStatusTone("success");
  }

  async function createInterview(difficulty: "EASY" | "MEDIUM" | "HARD") {
    setSelectedDifficulty(difficulty);
    if (!canGenerate) {
      setInterview(undefined);
      setActive(0);
      setAnswer("");
      setStatus("Enter both target role and interview stack before generating questions.");
      setStatusTone("error");
      return;
    }
    if (!accessToken || mode !== "authenticated") {
      useDemoInterview(difficulty);
      return;
    }
    setLoading("create");
    setStatus("Generating interview questions...");
    setStatusTone("info");
    try {
      const created = await api<Interview>("/interviews", {
        accessToken,
        method: "POST",
        body: JSON.stringify({
          role: role.trim(),
          stack: stackList,
          focus: focus.trim() || undefined,
          difficulty,
          type: "MIXED"
        })
      });
      setInterview(created);
      setActive(0);
      setAnswer("");
      setStatus("Interview generated from backend.");
      setStatusTone("success");
    } catch (error) {
      useDemoInterview(difficulty);
      setStatus(`${getFriendlyErrorMessage(error, "Backend unavailable.")} Showing local questions for now.`);
      setStatusTone("error");
    } finally {
      setLoading(undefined);
    }
  }

  async function evaluateAnswer() {
    if (!interview?.id) {
      setStatus("Generate an interview before evaluating an answer.");
      setStatusTone("error");
      return;
    }
    if (!activeQuestion) {
      setStatus("Choose a generated question before evaluating an answer.");
      setStatusTone("error");
      return;
    }
    if (!answer.trim()) {
      setStatus("Write an answer before evaluation.");
      setStatusTone("error");
      return;
    }
    setLoading("evaluate");
    setStatus("Evaluating answer...");
    setStatusTone("info");
    if (!accessToken || mode !== "authenticated" || interview.id === "demo-interview") {
      const localRubric = scoreAnswerRubric(answer, activeQuestion.prompt, role);
      const antiGenericFeedback = detectGenericAnswerGaps(answer, activeQuestion.prompt, role);
      const averageScore = Math.round(localRubric.reduce((total, item) => total + item.score, 0) / localRubric.length);
      setInterview({
        ...interview,
        score: averageScore,
        strengths: localRubric.filter((item) => item.score >= 80).map((item) => `${item.label}: ${item.guidance}`),
        weaknesses: [...localRubric.filter((item) => item.score < 75).map((item) => `${item.label}: ${item.guidance}`), ...antiGenericFeedback],
        suggestions: [
          "Rubric-based local evaluation: improve the lowest scoring category first.",
          "Add one project example with measurable impact to make the answer more credible."
        ]
      });
      setStatus("Local rubric evaluation completed from your answer and role context.");
      setStatusTone("success");
      setLoading(undefined);
      return;
    }
    try {
      const evaluated = await api<Interview>(`/interviews/${interview.id}/answers`, {
        accessToken,
        method: "POST",
        body: JSON.stringify({ questionId: activeQuestion.id, answer })
      });
      setInterview(evaluated);
      setStatus("Evaluation saved to backend.");
      setStatusTone("success");
    } catch (error) {
      setStatus(getFriendlyErrorMessage(error, "Unable to evaluate answer. Try again."));
      setStatusTone("error");
    } finally {
      setLoading(undefined);
    }
  }

  async function copyInterviewFeedback() {
    if (!activeQuestion || !interview) {
      setStatus("Generate and answer a question before copying feedback.");
      setStatusTone("error");
      return;
    }
    try {
      await navigator.clipboard.writeText(
        buildInterviewReport({
          role,
          stack,
          focus,
          difficulty: selectedDifficulty,
          question: activeQuestion.prompt,
          answer,
          score,
          rubric,
          strengths: interview.strengths ?? [],
          weaknesses: interview.weaknesses ?? [],
          suggestions: interview.suggestions ?? []
        })
      );
      setCopiedFeedback(true);
      setStatus("Interview feedback copied.");
      setStatusTone("success");
      window.setTimeout(() => setCopiedFeedback(false), 2500);
    } catch {
      setCopiedFeedback(false);
      setStatus("Could not copy automatically. Select the feedback and copy it manually.");
      setStatusTone("error");
    }
  }

  return (
    <section id="interviews" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">AI mock interview</h2>
      </div>
      <Card className="grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
        <div>
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <label className="block text-xs font-medium text-muted-foreground">
              <span className="mb-2 block">Target role</span>
              <Input aria-label="Interview target role" onChange={(event) => setRole(event.target.value)} placeholder="Example: Senior Frontend Developer" value={role} />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              <span className="mb-2 block">Interview stack</span>
              <Input aria-label="Interview stack" onChange={(event) => setStack(event.target.value)} placeholder="Example: React, Next.js, TypeScript, PostgreSQL" value={stack} />
            </label>
            <label className="block text-xs font-medium text-muted-foreground md:col-span-2">
              <span className="mb-2 block">Question focus</span>
              <Input aria-label="Interview focus" onChange={(event) => setFocus(event.target.value)} placeholder="Example: authentication, resume analyzer, system design, deployment" value={focus} />
            </label>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-md border border-border bg-muted p-1">
              {(["EASY", "MEDIUM", "HARD"] as const).map((level) => (
                <button
                  className={`h-8 rounded px-3 text-sm ${selectedDifficulty === level ? "bg-card text-foreground shadow-panel" : "text-muted-foreground"}`}
                  disabled={loading === "create"}
                  key={level}
                  onClick={() => {
                    if (canGenerate) {
                      void createInterview(level);
                    } else {
                      setSelectedDifficulty(level);
                    }
                  }}
                  type="button"
                >
                  {level[0] + level.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            <Button disabled={!canGenerate || loading === "create"} onClick={() => void createInterview(selectedDifficulty)}>
              <Sparkles className="h-4 w-4" />
              {loading === "create" ? "Generating..." : "Generate questions"}
            </Button>
            <p className="text-xs text-muted-foreground">Questions are generated from the role, stack, focus, and difficulty you enter.</p>
          </div>
          {!!questions.length && (
            <div className="mb-3 flex flex-wrap gap-2">
              {questions.map((question, index) => (
                <button
                  className={`rounded-md border px-3 py-2 text-xs ${active === index ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}
                  key={question.id}
                  onClick={() => {
                    setActive(index);
                    setAnswer("");
                  }}
                  type="button"
                >
                  Q{index + 1} {question.category ? `- ${question.category}` : ""}
                </button>
              ))}
            </div>
          )}
          <div className="rounded-md border border-border p-4">
            {activeQuestion ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Question {active + 1} {activeQuestion.category ? `- ${activeQuestion.category}` : ""}
                </p>
                <p className="mt-2 text-lg font-semibold">{activeQuestion.prompt}</p>
              </>
            ) : (
              <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground">No question generated yet. Enter role, stack, and optional focus, then select Easy, Medium, or Hard.</div>
            )}
            <textarea
              className="mt-4 min-h-32 w-full rounded-md border border-border bg-background p-3 text-sm outline-none focus:ring-4 focus:ring-primary/30"
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="Answer with structure, constraints, tradeoffs, and measurable impact."
              value={answer}
            />
          </div>
        </div>
        <div className="rounded-md bg-muted p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            Evaluation
          </div>
          <div className="mt-4 text-4xl font-bold">{score ?? "--"}</div>
          <p className="text-sm text-muted-foreground">
            {interview?.suggestions?.[0] ?? interview?.weaknesses?.[0] ?? "Generate questions and evaluate an answer to see role-specific feedback."}
          </p>
          <p
            aria-live="polite"
            className={`mt-3 rounded-md border px-3 py-2 text-sm ${
              statusTone === "error"
                ? "border-red-300 bg-red-50 text-red-700"
                : statusTone === "success"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-border bg-background/60 text-muted-foreground"
            }`}
            role={statusTone === "error" ? "alert" : "status"}
          >
            {status}
          </p>
          {!!rubric.length && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Rubric preview</p>
              {rubric.map((item) => (
                <div className="rounded-md border border-border bg-background/60 p-2" key={item.label}>
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>{item.label}</span>
                    <span>{item.score}/100</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.guidance}</p>
                </div>
              ))}
            </div>
          )}
          {!!interview?.strengths?.length && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Strong signals</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {interview.strengths.slice(0, 3).map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>
          )}
          {!!interview?.weaknesses?.length && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Gaps to fix</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {interview.weaknesses.slice(0, 3).map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>
          )}
          <Button className="mt-5 w-full" disabled={loading === "evaluate"} onClick={evaluateAnswer}>
            <Play className="h-4 w-4" />
            {loading === "evaluate" ? "Evaluating..." : "Evaluate answer"}
          </Button>
          <Button className="mt-3 w-full bg-background text-foreground" disabled={!interview || !activeQuestion} onClick={copyInterviewFeedback} type="button">
            <Clipboard className="h-4 w-4" />
            {copiedFeedback ? "Copied feedback" : "Copy feedback"}
          </Button>
        </div>
      </Card>
    </section>
  );
}

function scoreAnswerRubric(answer: string, prompt: string, role: string): RubricItem[] {
  const normalized = answer.toLowerCase();
  const promptText = prompt.toLowerCase();
  const roleKind = getInterviewRoleKind(role);
  const roleSignals = getInterviewRoleSignals(roleKind);
  const lengthBonus = Math.min(18, Math.floor(answer.trim().length / 90));
  const hasStructure = /(first|second|third|step|approach|clarify|design|then|finally)/i.test(answer);
  const hasTradeoffs = /(tradeoff|trade-off|pros|cons|alternative|cost|latency|complexity)/i.test(answer);
  const hasFailureModes = /(edge|failure|error|fallback|retry|rollback|empty|invalid)/i.test(answer);
  const hasMetrics = /(metric|measure|kpi|latency|conversion|coverage|users|requests|%|\d+)/i.test(answer);
  const hasTesting = /(test|unit|integration|e2e|playwright|jest|vitest|coverage)/i.test(answer);
  const hasPromptTerms = promptText
    .split(/[^a-z0-9+#.]+/)
    .filter((term) => term.length > 4)
    .slice(0, 10)
    .filter((term) => normalized.includes(term)).length;

  return [
    {
      label: "Structure",
      score: clampScore(52 + lengthBonus + (hasStructure ? 28 : 0)),
      guidance: hasStructure ? "Answer has a clear sequence." : "Use a clear sequence: requirements, design, risks, tests, metrics."
    },
    {
      label: roleSignals.label,
      score: clampScore(44 + hasPromptTerms * 5 + countMatches(normalized, roleSignals.terms) * 10),
      guidance:
        countMatches(normalized, roleSignals.terms) >= 2
          ? `Answer includes ${roleKind}-specific signals.`
          : `Add ${roleKind}-specific depth: ${roleSignals.terms.slice(0, 4).join(", ")}.`
    },
    {
      label: "Tradeoffs",
      score: clampScore(48 + (hasTradeoffs ? 34 : 0) + (normalized.includes("because") ? 8 : 0)),
      guidance: hasTradeoffs ? "Tradeoff thinking is visible." : "Explain why one design choice is better than another."
    },
    {
      label: "Failure and testing",
      score: clampScore(46 + (hasFailureModes ? 22 : 0) + (hasTesting ? 22 : 0)),
      guidance: hasFailureModes && hasTesting ? "Covers validation and failure paths." : "Add edge cases, failure modes, and concrete test coverage."
    },
    {
      label: "Measurable impact",
      score: clampScore(44 + (hasMetrics ? 36 : 0) + (/\d/.test(answer) ? 8 : 0)),
      guidance: hasMetrics ? "Includes measurable success criteria." : "Close with metrics such as latency, conversion, coverage, or adoption."
    }
  ];
}

function clampScore(score: number) {
  return Math.max(35, Math.min(96, score));
}

function detectGenericAnswerGaps(answer: string, prompt: string, role: string) {
  const normalized = answer.toLowerCase();
  const roleSignals = getInterviewRoleSignals(getInterviewRoleKind(role));
  const promptTerms = prompt
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((term) => term.length > 5)
    .slice(0, 12);
  const gaps: string[] = [];

  if (answer.trim().length < 220) {
    gaps.push("Answer is too short for a production interview. Add architecture, edge cases, tests, and success metrics.");
  }
  if (countMatches(normalized, promptTerms) < 2) {
    gaps.push("Answer is not tied closely enough to the actual question. Reuse the role, feature, and stack terms from the prompt.");
  }
  if (countMatches(normalized, roleSignals.terms) < 2) {
    gaps.push(`Answer is generic for this role. Add ${roleSignals.terms.slice(0, 4).join(", ")}.`);
  }
  if (!/(because|tradeoff|trade-off|risk|instead|alternative)/i.test(answer)) {
    gaps.push("Add decision reasoning. Explain why you chose one approach over another.");
  }
  if (!/(metric|measure|latency|coverage|conversion|retention|cost|time|%|\d+)/i.test(answer)) {
    gaps.push("Add measurable impact. Close with a metric the interviewer can evaluate.");
  }

  return gaps.slice(0, 4);
}

function getInterviewRoleKind(role: string) {
  const normalized = role.toLowerCase();
  if (/(frontend|front-end|react|ui|web)/.test(normalized)) return "frontend";
  if (/(backend|back-end|api|server|node|java|spring|nestjs)/.test(normalized)) return "backend";
  if (/(devops|sre|cloud|platform|infrastructure)/.test(normalized)) return "devops";
  if (/(data|analytics|analyst|machine learning|ml|bi)/.test(normalized)) return "data";
  if (/(qa|test|quality|automation)/.test(normalized)) return "qa";
  if (/(product manager|program manager|project manager|pm\b|scrum)/.test(normalized)) return "product";
  return "general";
}

function getInterviewRoleSignals(roleKind: string) {
  const signals: Record<string, { label: string; terms: string[] }> = {
    frontend: { label: "Frontend depth", terms: ["accessibility", "state", "render", "component", "responsive", "performance", "loading", "empty", "error"] },
    backend: { label: "Backend depth", terms: ["api", "database", "schema", "transaction", "cache", "queue", "authorization", "rate limit", "idempotency"] },
    devops: { label: "Platform depth", terms: ["deployment", "ci", "pipeline", "monitoring", "rollback", "infrastructure", "container", "alert"] },
    data: { label: "Data depth", terms: ["sql", "metric", "dashboard", "model", "quality", "segment", "trend", "insight", "stakeholder"] },
    qa: { label: "Quality depth", terms: ["test", "automation", "coverage", "regression", "flaky", "scenario", "assertion", "release"] },
    product: { label: "Product depth", terms: ["user", "priority", "metric", "scope", "tradeoff", "stakeholder", "experiment", "launch"] },
    general: { label: "Role relevance", terms: ["user", "requirement", "design", "risk", "test", "metric", "tradeoff", "delivery"] }
  };
  return signals[roleKind] ?? signals.general!;
}

function countMatches(text: string, terms: string[]) {
  return terms.filter((term) => text.includes(term)).length;
}

function buildInterviewReport(input: {
  role: string;
  stack: string;
  focus: string;
  difficulty: string;
  question: string;
  answer: string;
  score: number | undefined;
  rubric: RubricItem[];
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}) {
  return [
    "DevElevate AI Interview Feedback",
    `Role: ${input.role || "Not specified"}`,
    `Stack: ${input.stack || "Not specified"}`,
    `Focus: ${input.focus || "Not specified"}`,
    `Difficulty: ${input.difficulty}`,
    `Score: ${input.score ?? "--"}`,
    "",
    "Question:",
    input.question,
    "",
    "Answer:",
    input.answer || "No answer provided",
    "",
    "Rubric:",
    input.rubric.length ? input.rubric.map((item) => `- ${item.label}: ${item.score}/100 - ${item.guidance}`).join("\n") : "- No rubric generated",
    "",
    "Strong signals:",
    input.strengths.length ? input.strengths.map((item) => `- ${item}`).join("\n") : "- Generate evaluation to capture strengths",
    "",
    "Gaps to fix:",
    input.weaknesses.length ? input.weaknesses.map((item) => `- ${item}`).join("\n") : "- Generate evaluation to capture gaps",
    "",
    "Suggestions:",
    input.suggestions.length ? input.suggestions.map((item) => `- ${item}`).join("\n") : "- No suggestions generated"
  ].join("\n");
}

function createDemoQuestions(difficulty: "EASY" | "MEDIUM" | "HARD", role: string, stack: string[], focus?: string): InterviewQuestion[] {
  const stackText = stack.length ? stack.slice(0, 4).join(", ") : "your stack";
  const roleText = role.trim();
  const focusText = focus?.trim() || `${roleText} interview readiness`;
  const prompts = {
    EASY: [
      `Easy fundamentals: for ${focusText}, explain the simplest useful ${roleText} feature you would build with ${stackText}. Cover user flow, basic state, and one validation rule.`,
      `Easy boundaries: for ${focusText}, list what belongs in the UI, what belongs in the API, and what data contract you would expect.`,
      `Easy testing: describe the happy path and two error cases you would test for ${focusText} using ${stackText}.`
    ],
    MEDIUM: [
      `Medium implementation: design an authenticated ${focusText} workflow for a ${roleText} using ${stackText}. Include API boundaries, state ownership, caching, testing, and tradeoffs.`,
      `Medium data modeling: how would you model filters, permissions, validation, and persisted user preferences for ${focusText}?`,
      `Medium debugging: users report intermittent failures in ${focusText}. Walk through reproduction, logs, metrics, likely root causes, and a safe fix plan.`
    ],
    HARD: [
      `Hard architecture: design a production-ready ${focusText} system for a ${roleText} using ${stackText}. Include scaling limits, failure modes, observability, security, and measurable success metrics.`,
      `Hard reliability: how would you handle high traffic, stale permissions, retries, partial failures, and backward-compatible API changes for ${focusText}?`,
      `Hard launch strategy: create a phased rollout, alerting, rollback, and incident-response plan for a risky ${focusText} release.`
    ]
  }[difficulty];

  return prompts.map((prompt, index) => ({
    id: `demo-${difficulty.toLowerCase()}-${index + 1}`,
    prompt,
    category: index === 0 ? "technical" : index === 1 ? "systems" : "debugging"
  }));
}
