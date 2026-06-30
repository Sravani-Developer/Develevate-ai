"use client";

import { useMemo, useState } from "react";
import { Mic, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const questions = [
  "Design a rate limiter for a public API.",
  "Tell me about a time you improved system reliability.",
  "How would you evaluate tradeoffs between SQL and NoSQL?"
];

export function InterviewWorkbench() {
  const [active, setActive] = useState(0);
  const score = useMemo(() => 78 + active * 4, [active]);
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
            {["Easy", "Medium", "Hard"].map((level, index) => (
              <button
                className={`h-8 rounded px-3 text-sm ${active === index ? "bg-card text-foreground shadow-panel" : "text-muted-foreground"}`}
                key={level}
                onClick={() => setActive(index)}
              >
                {level}
              </button>
            ))}
          </div>
          <div className="rounded-md border border-border p-4">
            <p className="text-sm text-muted-foreground">Question {active + 1}</p>
            <p className="mt-2 text-lg font-semibold">{questions[active]}</p>
            <textarea
              className="mt-4 min-h-32 w-full rounded-md border border-border bg-background p-3 text-sm outline-none focus:ring-4 focus:ring-primary/30"
              placeholder="Answer with structure, constraints, tradeoffs, and measurable impact."
            />
          </div>
        </div>
        <div className="rounded-md bg-muted p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            Streaming evaluation
          </div>
          <div className="mt-4 text-4xl font-bold">{score}</div>
          <p className="text-sm text-muted-foreground">Strong systems framing. Add more failure mode coverage and quantify prior impact.</p>
          <Button className="mt-5 w-full">
            <Play className="h-4 w-4" />
            Evaluate answer
          </Button>
        </div>
      </Card>
    </section>
  );
}
