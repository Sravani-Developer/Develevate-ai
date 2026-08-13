"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, getFriendlyErrorMessage } from "@/lib/api";
import { useSession } from "@/store/session";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type AnalyticsResponse = {
  totalInterviews: number;
  averageScore: number;
  scoreSeries: Array<{ date: string; score: number }>;
  weakAreas: Record<string, number>;
  latestResumeScore: number | null;
  roadmaps: number;
};

export function AnalyticsDashboard() {
  const accessToken = useSession((state) => state.accessToken);
  const mode = useSession((state) => state.mode);
  const setSession = useSession((state) => state.setSession);
  const [analytics, setAnalytics] = useState<AnalyticsResponse>();
  const [status, setStatus] = useState("Sign in to load saved analytics.");
  const [statusTone, setStatusTone] = useState<"info" | "success" | "error">("info");
  const [loading, setLoading] = useState(false);

  async function loadAnalytics() {
    if (!accessToken || mode !== "authenticated") {
      setAnalytics(undefined);
      setStatus(mode === "demo" ? "Local mode is active. Sign in to load saved analytics." : "Sign in to load saved analytics.");
      setStatusTone("info");
      return;
    }
    setLoading(true);
    setStatus("Loading analytics...");
    setStatusTone("info");
    try {
      const result = await api<AnalyticsResponse>("/analytics", { accessToken });
      setAnalytics(result);
      setStatus("Analytics loaded from backend.");
      setStatusTone("success");
    } catch (error) {
      if (isUnauthorizedError(error)) {
        try {
          const refreshed = await api<{ accessToken: string }>("/auth/refresh", { method: "POST" });
          setSession(refreshed.accessToken, "authenticated");
          const result = await api<AnalyticsResponse>("/analytics", { accessToken: refreshed.accessToken });
          setAnalytics(result);
          setStatus("Session restored. Analytics loaded from backend.");
          setStatusTone("success");
          return;
        } catch {
          setAnalytics(undefined);
          setStatus("Your session expired. Please sign in again.");
          setStatusTone("error");
          return;
        }
      }
      setAnalytics(undefined);
      setStatus(getFriendlyErrorMessage(error, "Unable to load analytics. Try again later."));
      setStatusTone("error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAnalytics();
    // loadAnalytics intentionally depends on accessToken only for initial section hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, mode]);

  const scoreData = useMemo(
    () =>
      analytics?.scoreSeries?.length
        ? analytics.scoreSeries.map((item) => ({ day: new Date(item.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }), score: item.score }))
        : [],
    [analytics?.scoreSeries]
  );
  const weaknessData = useMemo(
    () => (analytics?.weakAreas ? Object.entries(analytics.weakAreas).map(([name, value]) => ({ name, value })) : []),
    [analytics?.weakAreas]
  );

  return (
    <section id="analytics" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Analytics dashboard</h2>
        <div className="flex items-center gap-3">
          <p
            aria-live="polite"
            className={`rounded-md border px-3 py-2 text-sm ${
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
          <Button className="bg-muted text-foreground" disabled={loading} onClick={loadAnalytics} type="button">
            <RefreshCcw className="h-4 w-4" />
            {loading ? "Refreshing..." : "Refresh analytics"}
          </Button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {[
          ["Interviews", analytics ? String(analytics.totalInterviews) : "--"],
          ["Avg score", analytics ? String(analytics.averageScore) : "--"],
          ["Resume ATS", analytics?.latestResumeScore == null ? "--" : String(analytics.latestResumeScore)]
        ].map(([label, value]) => (
          <Card key={label}>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <p className="mb-4 font-semibold">Performance progress</p>
          {scoreData.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={scoreData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-60 place-items-center rounded-md border border-dashed border-border text-sm text-muted-foreground">No interview score history yet.</div>
          )}
        </Card>
        <Card>
          <p className="mb-4 font-semibold">Weak area analysis</p>
          {weaknessData.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={weaknessData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--warning))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-60 place-items-center rounded-md border border-dashed border-border text-sm text-muted-foreground">No weak-area data yet.</div>
          )}
        </Card>
      </div>
    </section>
  );
}

function isUnauthorizedError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.message.includes("401") || error.message.toLowerCase().includes("unauthorized") || error.message.toLowerCase().includes("sign in again");
}
