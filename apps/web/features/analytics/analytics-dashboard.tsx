"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";

const scoreData = [
  { day: "Mon", score: 62 },
  { day: "Tue", score: 68 },
  { day: "Wed", score: 74 },
  { day: "Thu", score: 81 },
  { day: "Fri", score: 86 }
];

const weaknessData = [
  { name: "Systems", value: 6 },
  { name: "Behavioral", value: 3 },
  { name: "DSA", value: 4 }
];

export function AnalyticsDashboard() {
  return (
    <section id="analytics" className="space-y-4">
      <h2 className="text-xl font-semibold">Analytics dashboard</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        {[
          ["Interviews", "24"],
          ["Avg score", "82"],
          ["Resume ATS", "84"]
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
