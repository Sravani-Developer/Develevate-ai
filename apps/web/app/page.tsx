import { Activity, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { AnalyticsDashboard } from "@/features/analytics/analytics-dashboard";
import { LoginCard } from "@/features/auth/login-card";
import { CodingRoom } from "@/features/coding/coding-room";
import { InterviewWorkbench } from "@/features/interviews/interview-workbench";
import { ResumeAnalyzer } from "@/features/resume/resume-analyzer";
import { RoadmapBuilder } from "@/features/roadmap/roadmap-builder";

const capabilityCards = [
  { Icon: Sparkles, label: "AI feedback" },
  { Icon: Zap, label: "Realtime rooms" },
  { Icon: ShieldCheck, label: "Secure auth" },
  { Icon: Activity, label: "Progress analytics" }
];

export default function Page() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
        <header id="command" className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div>
            <p className="text-sm font-semibold text-primary">Production AI SaaS workspace</p>
            <h1 className="mt-2 max-w-4xl text-4xl font-bold tracking-normal sm:text-5xl">DevElevate AI</h1>
            <p className="mt-4 max-w-2xl text-base text-muted-foreground">
              Interview practice, collaborative coding, resume intelligence, career roadmaps, analytics, subscriptions, and admin operations in one developer career platform.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-4">
              {capabilityCards.map(({ Icon, label }) => (
                <Card className="p-4" key={label}>
                  <Icon className="h-5 w-5 text-primary" />
                  <p className="mt-3 text-sm font-semibold">{label}</p>
                </Card>
              ))}
            </div>
          </div>
          <LoginCard />
        </header>
        <InterviewWorkbench />
        <CodingRoom />
        <ResumeAnalyzer />
        <RoadmapBuilder />
        <AnalyticsDashboard />
        <section id="admin" className="grid gap-4 lg:grid-cols-3">
          <Card>
            <p className="font-semibold">Admin dashboard</p>
            <p className="mt-2 text-sm text-muted-foreground">User counts, room activity, subscriptions, and platform usage rollups.</p>
          </Card>
          <Card>
            <p className="font-semibold">Subscription system</p>
            <p className="mt-2 text-sm text-muted-foreground">Free and pro plan boundaries with provider-ready checkout endpoint.</p>
          </Card>
          <Card>
            <p className="font-semibold">Enterprise safeguards</p>
            <p className="mt-2 text-sm text-muted-foreground">Rate limiting, Helmet, sanitization, secure cookies, RBAC, logging, and typed config.</p>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
