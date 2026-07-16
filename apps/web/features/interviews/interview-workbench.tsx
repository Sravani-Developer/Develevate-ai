"use client";

import { useMemo, useState } from "react";
import { Mic, Play, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { useSession } from "@/store/session";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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

const fallbackQuestion: InterviewQuestion = { id: "q1", prompt: "Design a rate limiter for a public API.", category: "systems" };
const fallbackQuestions: InterviewQuestion[] = [
  fallbackQuestion,
  { id: "q2", prompt: "Tell me about a time you improved system reliability.", category: "behavioral" },
  { id: "q3", prompt: "How would you evaluate tradeoffs between SQL and NoSQL?", category: "technical" }
];

export function InterviewWorkbench() {
  const accessToken = useSession((state) => state.accessToken);
  const [active, setActive] = useState(0);
  const [answer, setAnswer] = useState("");
  const [interview, setInterview] = useState<Interview>();
  const [loading, setLoading] = useState<"create" | "evaluate">();
  const [status, setStatus] = useState("Sign in, then generate a real interview from the API.");

  const questions = interview?.questions?.length ? interview.questions : fallbackQuestions;
  const activeQuestion = questions[active] ?? fallbackQuestion;
  const score = useMemo(() => interview?.score ?? 78 + active * 4, [active, interview?.score]);

  function useDemoInterview(difficulty: "EASY" | "MEDIUM" | "HARD") {
    setInterview({
      id: "demo-interview",
      questions: fallbackQuestions.map((question, index) => ({
        ...question,
        prompt: difficulty === "HARD" && index === 0 ? "Design a distributed rate limiter with Redis and failure handling." : question.prompt
      }))
    });
    setActive(0);
    setAnswer("");
    setStatus("Demo interview generated locally. Start the API to save it.");
  }

  async function createInterview(difficulty: "EASY" | "MEDIUM" | "HARD") {
    if (!accessToken) {
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
          role: "Full-stack developer",
          stack: ["TypeScript", "React", "NestJS", "PostgreSQL"],
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
    if (!answer.trim()) {
      setStatus("Write an answer before evaluation.");
      return;
    }
    setLoading("evaluate");
    setStatus("Evaluating answer...");
    if (!accessToken || interview.id === "demo-interview") {
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
        <Button title="Start voice interview">
          <Mic className="h-4 w-4" />
          Voice
        </Button>
      </div>
      <Card className="grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
        <div>
          <div className="mb-3 inline-flex rounded-md border border-border bg-muted p-1">
            {(["EASY", "MEDIUM", "HARD"] as const).map((level, index) => (
              <button
                className={`h-8 rounded px-3 text-sm ${active === index ? "bg-card text-foreground shadow-panel" : "text-muted-foreground"}`}
                disabled={loading === "create"}
                key={level}
                onClick={() => {
                  setActive(index);
                  void createInterview(level);
                }}
              >
                {level[0] + level.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <div className="rounded-md border border-border p-4">
            <p className="text-sm text-muted-foreground">
              Question {active + 1} {activeQuestion.category ? `- ${activeQuestion.category}` : ""}
            </p>
            <p className="mt-2 text-lg font-semibold">{activeQuestion.prompt}</p>
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
          <div className="mt-4 text-4xl font-bold">{score}</div>
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
