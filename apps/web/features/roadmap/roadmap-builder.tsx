"use client";

import { useState } from "react";
import { CheckCircle2, Map } from "lucide-react";
import { api } from "@/lib/api";
import { useSession } from "@/store/session";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Milestone = {
  week?: number;
  focus?: string;
  deliverables?: string[];
  metrics?: string[];
};

type Roadmap = {
  milestones: Milestone[];
};

export function RoadmapBuilder() {
  const accessToken = useSession((state) => state.accessToken);
  const [targetRole, setTargetRole] = useState("");
  const [currentSkills, setCurrentSkills] = useState("");
  const [roadmap, setRoadmap] = useState<Roadmap>();
  const [status, setStatus] = useState("Enter a target role and current skills to generate a personalized roadmap.");
  const [loading, setLoading] = useState(false);

  function useDemoRoadmap(message = "Demo roadmap generated locally. Start the API to save personalized plans.") {
    setRoadmap({
      milestones: createLocalMilestones(targetRole.trim(), parseSkills(currentSkills), 12)
    });
    setStatus(message);
  }

  async function generateRoadmap() {
    const skills = parseSkills(currentSkills);
    if (!targetRole.trim() || !skills.length) {
      setRoadmap(undefined);
      setStatus("Enter both target role and current skills before generating a roadmap.");
      return;
    }
    if (!accessToken) {
      useDemoRoadmap("Demo roadmap generated locally. Sign in with a running API to save it.");
      return;
    }
    setLoading(true);
    setStatus("Generating roadmap...");
    try {
      const result = await api<Roadmap>("/roadmaps", {
        accessToken,
        method: "POST",
        body: JSON.stringify({
          targetRole: targetRole.trim(),
          currentSkills: skills,
          timelineWeeks: 12
        })
      });
      setRoadmap(result);
      setStatus("Roadmap saved to backend.");
    } catch (error) {
      useDemoRoadmap(error instanceof Error ? `Backend unavailable, showing demo roadmap. ${error.message}` : "Backend unavailable, showing demo roadmap.");
    } finally {
      setLoading(false);
    }
  }

  const milestones = roadmap?.milestones ?? [];

  return (
    <section id="roadmap" className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Map className="h-5 w-5 text-primary" />
          Career roadmap generator
        </h2>
        <div className="grid w-full max-w-4xl gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-muted-foreground">
            <span className="mb-2 block">Target role</span>
            <Input aria-label="Target role" className="focus:ring-2" onChange={(event) => setTargetRole(event.target.value)} placeholder="Example: Senior Frontend Developer" value={targetRole} />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            <span className="mb-2 block">Current skills</span>
            <Input aria-label="Current skills" className="focus:ring-2" onChange={(event) => setCurrentSkills(event.target.value)} placeholder="Example: React, Next.js, TypeScript, PostgreSQL" value={currentSkills} />
          </label>
          <Button className="sm:col-span-2 sm:justify-self-end" disabled={loading} onClick={generateRoadmap}>
            {loading ? "Generating..." : "Generate"}
          </Button>
        </div>
      </div>
      <Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {milestones.length ? (
            milestones.map((milestone, index) => (
              <div className="rounded-md border border-border p-4" key={`${milestone.week ?? index}-${milestone.focus}`}>
                <CheckCircle2 className="h-5 w-5 text-success" />
                <p className="mt-3 text-sm font-semibold">Week {milestone.week ?? index + 1}</p>
                <p className="mt-1 text-sm text-muted-foreground">{milestone.focus ?? milestone.deliverables?.[0] ?? "Career milestone"}</p>
                {!!milestone.deliverables?.length && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deliverables</p>
                    <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                      {milestone.deliverables.slice(0, 3).map((item) => (
                        <li key={item}>- {item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {!!milestone.metrics?.length && (
                  <div className="mt-3 rounded-md bg-muted p-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Metric: </span>
                    {milestone.metrics[0]}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
              No roadmap generated yet. Add the role you want, list your current skills, and click Generate.
            </div>
          )}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">{status}</p>
      </Card>
    </section>
  );
}

function parseSkills(value: string) {
  return value
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function createLocalMilestones(targetRole: string, currentSkills: string[], timelineWeeks: number): Milestone[] {
  const skills = currentSkills.slice(0, 5).join(", ");
  const role = targetRole || "target role";
  const stack = skills || "selected skills";
  const plans = [
    [`Map ${role} requirements against ${stack}`, ["Skills inventory", "Gap list", "Interview baseline"], ["Identify top 5 missing capabilities"]],
    [`Build fundamentals needed for ${role}`, ["Learning plan", "DSA refresh", "Core concept notes"], ["Complete one timed practice set"]],
    [`Create a portfolio feature using ${stack}`, ["Feature scope", "Working UI", "API contract"], ["Demo one user flow end to end"]],
    [`Add persistence and validation for ${role} work`, ["Data model", "Validation rules", "Error states"], ["Explain schema and edge cases clearly"]],
    [`Improve quality for ${stack}`, ["Unit tests", "Integration path", "Bug checklist"], ["Typecheck and tests pass"]],
    [`Prepare system design for ${role}`, ["Architecture notes", "Tradeoff matrix", "Scaling limits"], ["Explain design in under 5 minutes"]],
    [`Add production readiness to the portfolio project`, ["Auth or access control", "Logging plan", "Failure handling"], ["Show graceful failure behavior"]],
    [`Strengthen resume proof for ${role}`, ["Role-specific bullets", "Keyword pass", "Impact metrics"], ["ATS score above 85"]],
    [`Practice interviews using ${stack}`, ["Mock question set", "Answer review", "STAR stories"], ["Complete 2 recorded mock rounds"]],
    [`Polish deployment and documentation`, ["README", "Setup guide", "Demo script"], ["Fresh setup works from docs"]],
    [`Build recruiter pipeline for ${role}`, ["Target company list", "Referral message", "Application tracker"], ["Apply to 15 targeted roles"]],
    [`Launch final ${role} application package`, ["Final resume", "Pinned GitHub repos", "Portfolio walkthrough"], ["Demo project in under 7 minutes"]]
  ];

  return plans.slice(0, Math.max(4, Math.min(12, timelineWeeks))).map(([focus, deliverables, metrics], index) => ({
    week: index + 1,
    focus: focus as string,
    deliverables: deliverables as string[],
    metrics: metrics as string[]
  }));
}
