"use client";

import Editor from "@monaco-editor/react";
import { MessageSquare, Play, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function CodingRoom() {
  const [code, setCode] = useState("function twoSum(nums, target) {\\n  const seen = new Map();\\n  return [];\\n}\\n");
  return (
    <section id="coding" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Real-time coding room</h2>
        <div className="flex gap-2">
          <Button className="bg-muted text-foreground">
            <Users className="h-4 w-4" />
            3 live
          </Button>
          <Button>
            <Play className="h-4 w-4" />
            Run
          </Button>
        </div>
      </div>
      <Card className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-md border border-border">
          <Editor
            height="420px"
            language="javascript"
            theme="vs-dark"
            value={code}
            options={{ minimap: { enabled: false }, fontSize: 14 }}
            onChange={(value) => setCode(value ?? "")}
          />
        </div>
        <div className="flex min-h-80 flex-col rounded-md border border-border p-4">
          <div className="flex items-center gap-2 font-semibold">
            <MessageSquare className="h-4 w-4 text-primary" />
            Interview chat
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <p className="rounded-md bg-muted p-3">Interviewer: Talk through complexity before coding.</p>
            <p className="rounded-md bg-primary/10 p-3">Candidate: I will use a hash map for O(n).</p>
          </div>
          <input className="mt-auto h-10 rounded-md border border-border bg-background px-3 text-sm" placeholder="Message" />
        </div>
      </Card>
    </section>
  );
}
