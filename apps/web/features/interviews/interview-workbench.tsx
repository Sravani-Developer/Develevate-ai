"use client";

import { useMemo, useState } from "react";
import { Play, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
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

  const questions = interview?.questions ?? [];
  const activeQuestion = questions[active];
  const score = useMemo(() => interview?.score ?? (interview ? 78 + active * 4 : undefined), [active, interview]);
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
    setStatus("Demo interview generated locally. Start the API to save it.");
  }

  async function createInterview(difficulty: "EASY" | "MEDIUM" | "HARD") {
    setSelectedDifficulty(difficulty);
    if (!canGenerate) {
      setInterview(undefined);
      setActive(0);
      setAnswer("");
      setStatus("Enter both target role and interview stack before generating questions.");
      return;
    }
    if (!accessToken || mode !== "authenticated") {
      useDemoInterview(difficulty);
      return;
    }
    setLoading("create");
    setStatus("Generating interview questions...");
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
    } catch (error) {
      useDemoInterview(difficulty);
      setStatus(error instanceof Error ? `Backend unavailable, showing demo questions. ${error.message}` : "Backend unavailable, showing demo questions.");
    } finally {
      setLoading(undefined);
    }
  }

  async function evaluateAnswer() {
    if (!interview?.id) {
      setStatus("Generate an interview before evaluating an answer.");
      return;
    }
    if (!activeQuestion) {
      setStatus("Choose a generated question before evaluating an answer.");
      return;
    }
    if (!answer.trim()) {
      setStatus("Write an answer before evaluation.");
      return;
    }
    setLoading("evaluate");
    setStatus("Evaluating answer...");
    if (!accessToken || mode !== "authenticated" || interview.id === "demo-interview") {
      setInterview({
        ...interview,
        score: Math.min(95, 82 + Math.floor(answer.length / 120)),
        suggestions: ["Demo feedback: add concrete metrics, edge cases, and a short tradeoff summary."]
      });
      setStatus("Demo evaluation generated locally. Start the API to save real AI feedback.");
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
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to evaluate answer.");
    } finally {
      setLoading(undefined);
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
                    setSelectedDifficulty(level);
                  }}
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
            Backend evaluation
          </div>
          <div className="mt-4 text-4xl font-bold">{score ?? "--"}</div>
          <p className="text-sm text-muted-foreground">
            {interview?.suggestions?.[0] ?? interview?.weaknesses?.[0] ?? "Generate and evaluate to replace demo scoring with saved AI feedback."}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">{status}</p>
          <Button className="mt-5 w-full" disabled={loading === "evaluate"} onClick={evaluateAnswer}>
            <Play className="h-4 w-4" />
            {loading === "evaluate" ? "Evaluating..." : "Evaluate answer"}
          </Button>
        </div>
      </Card>
    </section>
  );
}

function createDemoQuestions(difficulty: "EASY" | "MEDIUM" | "HARD", role: string, stack: string[], focus?: string): InterviewQuestion[] {
  const stackText = stack.length ? stack.slice(0, 4).join(", ") : "your stack";
  const roleText = role.trim();
  const focusText = focus?.trim() || `${roleText} interview readiness`;
  const prompts = {
    EASY: [
      `For ${focusText}, explain how you would build a small ${roleText} feature using ${stackText}. Focus on clear steps, data flow, and edge cases.`,
      `For ${focusText}, what frontend and backend responsibilities would you separate in a ${roleText} feature?`,
      `How would you test a simple ${focusText} feature built with ${stackText}?`
    ],
    MEDIUM: [
      `Design an authenticated ${focusText} workflow for a ${roleText} role using ${stackText}. Include API boundaries, data flow, testing, and tradeoffs.`,
      `How would you model data and validation for a medium-complexity ${focusText} feature?`,
      `A user reports intermittent failures in a ${focusText} workflow built with ${stackText}. How would you debug it?`
    ],
    HARD: [
      `Design a production-ready ${focusText} feature for a ${roleText} role using ${stackText}. Include scaling limits, failure modes, observability, and tradeoffs.`,
      `How would you handle high traffic, retries, and partial failures in a ${focusText} system using ${stackText}?`,
      `Create a rollout and monitoring plan for a risky ${focusText} release.`
    ]
  }[difficulty];

  return prompts.map((prompt, index) => ({
    id: `demo-${difficulty.toLowerCase()}-${index + 1}`,
    prompt,
    category: index === 0 ? "technical" : index === 1 ? "systems" : "debugging"
  }));
}
