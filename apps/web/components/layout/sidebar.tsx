"use client";

import { BarChart3, Code2, FileText, Gauge, Map, Moon, Shield, Sparkles, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "../ui/button";

const nav = [
  { label: "Command", icon: Gauge },
  { label: "Interviews", icon: Sparkles },
  { label: "Coding", icon: Code2 },
  { label: "Resume", icon: FileText },
  { label: "Roadmap", icon: Map },
  { label: "Analytics", icon: BarChart3 },
  { label: "Admin", icon: Shield }
];

export function Sidebar() {
  const { theme, setTheme } = useTheme();
  return (
    <aside className="flex min-h-screen w-64 shrink-0 flex-col border-r border-border bg-card px-4 py-5 max-lg:hidden">
      <div className="mb-8 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-primary text-sm font-black text-primary-foreground">DE</div>
        <div>
          <p className="text-sm font-bold">DevElevate AI</p>
          <p className="text-xs text-muted-foreground">Career operating system</p>
        </div>
      </div>
      <nav className="space-y-1">
        {nav.map((item) => (
          <a
            href={`#${item.label.toLowerCase()}`}
            key={item.label}
            className="flex h-10 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </a>
        ))}
      </nav>
      <Button
        className="mt-auto bg-muted text-foreground"
        title="Toggle color theme"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        Theme
      </Button>
    </aside>
  );
}
