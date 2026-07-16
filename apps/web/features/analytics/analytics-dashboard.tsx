"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
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

const fallbackScoreData = [
  { day: "Mon", score: 62 },
  { day: "Tue", score: 68 },
  { day: "Wed", score: 74 },
  { day: "Thu", score: 81 },
  { day: "Fri", score: 86 }
];

const fallbackWeaknessData = [
  { name: "Systems", value: 6 },
  { name: "Behavioral", value: 3 },
  { name: "DSA", value: 4 }
];

export function AnalyticsDashboard() {
  const accessToken = useSession((state) => state.accessToken);
  const [analytics, setAnalytics] = useState<AnalyticsResponse>();
  const [status, setStatus] = useState("Sign in to load saved analytics.");
  const [loading, setLoading] = useState(false);

  async function loadAnalytics() {
    if (!accessToken) {
      setStatus("Showing demo analytics. Start a demo session or backend API to refresh.");
      return;
    }
    setLoading(true);
    setStatus("Loading analytics...");
    try {
      const result = await api<AnalyticsResponse>("/analytics", { accessToken });
      setAnalytics(result);
      setStatus("Analytics loaded from backend.");
    } catch (error) {
      setStatus(error instanceof Error ? `Backend unavailable, showing demo analytics. ${error.message}` : "Backend unavailable, showing demo analytics.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAnalytics();
    // loadAnalytics intentionally depends on accessToken only for initial section hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const scoreData = useMemo(
    () =>
      analytics?.scoreSeries?.length
        ? analytics.scoreSeries.map((item) => ({ day: new Date(item.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }), score: item.score }))
        : fallbackScoreData,
    [analytics?.scoreSeries]
  );
  const weaknessData = useMemo(
    () => (analytics?.weakAreas ? Object.entries(analytics.weakAreas).map(([name, value]) => ({ name, value })) : fallbackWeaknessData),
    [analytics?.weakAreas]
  );

  return (
    <section id="analytics" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Analytics dashboard</h2>
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">{status}</p>
          <Button className="bg-muted text-foreground" disabled={loading} onClick={loadAnalytics} type="button">
            <RefreshCcw className="h-4 w-4" />
            {loading ? "Refreshing..." : "Refresh analytics"}
          </Button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {[
          ["Interviews", String(analytics?.totalInterviews ?? 24)],
          ["Avg score", String(analytics?.averageScore ?? 82)],
          ["Resume ATS", String(analytics?.latestResumeScore ?? 84)]
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
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={scoreData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <p className="mb-4 font-semibold">Weak area analysis</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={weaknessData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(var(--warning))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </section>
  );
}
