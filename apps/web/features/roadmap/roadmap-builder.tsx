import { CheckCircle2, Map } from "lucide-react";
import { Card } from "@/components/ui/card";

const milestones = [
  ["Weeks 1-2", "Close fundamentals gaps and refresh DSA patterns"],
  ["Weeks 3-6", "Build production projects with tests, CI, PostgreSQL, Redis"],
  ["Weeks 7-10", "Mock interviews, resume targeting, system design drills"],
  ["Weeks 11-12", "Applications, recruiter pipeline, final polish"]
];

export function RoadmapBuilder() {
  return (
    <section id="roadmap" className="space-y-4">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <Map className="h-5 w-5 text-primary" />
        Career roadmap generator
      </h2>
      <Card>
        <div className="grid gap-4 lg:grid-cols-4">
          {milestones.map(([time, title]) => (
            <div className="rounded-md border border-border p-4" key={time}>
              <CheckCircle2 className="h-5 w-5 text-success" />
              <p className="mt-3 text-sm font-semibold">{time}</p>
              <p className="mt-1 text-sm text-muted-foreground">{title}</p>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}
