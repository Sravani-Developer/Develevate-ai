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
};

type Roadmap = {
  milestones: Milestone[];
};

const fallbackMilestones: Milestone[] = [
  { week: 1, focus: "Close fundamentals gaps and refresh DSA patterns" },
  { week: 3, focus: "Build production projects with tests, CI, PostgreSQL, Redis" },
  { week: 7, focus: "Mock interviews, resume targeting, system design drills" },
  { week: 11, focus: "Applications, recruiter pipeline, final polish" }
];

export function RoadmapBuilder() {
  const accessToken = useSession((state) => state.accessToken);
  const [targetRole, setTargetRole] = useState("Full-stack developer");
  const [currentSkills, setCurrentSkills] = useState("React, TypeScript, Node.js");
  const [roadmap, setRoadmap] = useState<Roadmap>();
  const [status, setStatus] = useState("Sign in to generate and save a personalized roadmap.");
  const [loading, setLoading] = useState(false);

  function useDemoRoadmap(message = "Demo roadmap generated locally. Start the API to save personalized plans.") {
    setRoadmap({
      milestones: [
        { week: 1, focus: `Map gaps for ${targetRole}`, deliverables: ["Skills inventory", "Interview baseline"] },
        { week: 3, focus: "Build portfolio proof", deliverables: ["Full-stack feature", "Tests and CI"] },
        { week: 7, focus: "Practice interviews", deliverables: ["Mock interview loop", "Resume iteration"] },
        { week: 12, focus: "Launch applications", deliverables: ["Final resume", "Recruiter pipeline"] }
      ]
    });
    setStatus(message);
  }

  async function generateRoadmap() {
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
          targetRole,
          currentSkills: currentSkills.split(",").map((skill) => skill.trim()).filter(Boolean),
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

  const milestones = roadmap?.milestones?.length ? roadmap.milestones : fallbackMilestones;

  return (
    <section id="roadmap" className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Map className="h-5 w-5 text-primary" />
          Career roadmap generator
        </h2>
        <div className="grid gap-2 sm:grid-cols-[200px_260px_auto]">
          <Input onChange={(event) => setTargetRole(event.target.value)} value={targetRole} />
          <Input onChange={(event) => setCurrentSkills(event.target.value)} value={currentSkills} />
          <Button disabled={loading} onClick={generateRoadmap}>{loading ? "Generating..." : "Generate"}</Button>
        </div>
      </div>
      <Card>
        <div className="grid gap-4 lg:grid-cols-4">
          {milestones.map((milestone, index) => (
            <div className="rounded-md border border-border p-4" key={`${milestone.week ?? index}-${milestone.focus}`}>
              <CheckCircle2 className="h-5 w-5 text-success" />
              <p className="mt-3 text-sm font-semibold">Week {milestone.week ?? index + 1}</p>
              <p className="mt-1 text-sm text-muted-foreground">{milestone.focus ?? milestone.deliverables?.[0] ?? "Career milestone"}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">{status}</p>
      </Card>
    </section>
  );
}
