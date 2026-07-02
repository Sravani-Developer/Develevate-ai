"use client";

import Editor from "@monaco-editor/react";
import { MessageSquare, Play, Users } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { useSession } from "@/store/session";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type CodingRoomResponse = {
  id: string;
  title: string;
  language: string;
};

type ExecuteResponse = {
  status?: string;
  stdout?: string;
  stderr?: string;
  compile_output?: string;
  time?: string | number | null;
};

export function CodingRoom() {
  const accessToken = useSession((state) => state.accessToken);
  const [code, setCode] = useState("function twoSum(nums, target) {\n  const seen = new Map();\n  return [];\n}\n");
  const [room, setRoom] = useState<CodingRoomResponse>();
  const [output, setOutput] = useState("Create a room and run code to see Judge0/backend output.");
  const [loading, setLoading] = useState<"room" | "run">();

  async function createRoom() {
    if (!accessToken) {
      setOutput("Sign in first to create a saved coding room.");
      return;
    }
    setLoading("room");
    try {
      const created = await api<CodingRoomResponse>("/coding/rooms", {
        accessToken,
        method: "POST",
        body: JSON.stringify({ title: "Two Sum practice", language: "javascript" })
      });
      setRoom(created);
      setOutput(`Room created: ${created.title}`);
    } catch (error) {
      setOutput(error instanceof Error ? error.message : "Unable to create room.");
    } finally {
      setLoading(undefined);
    }
  }

  async function runCode() {
    if (!room?.id) {
      await createRoom();
      return;
    }
    setLoading("run");
    setOutput("Running code...");
    try {
      const result = await api<ExecuteResponse>("/coding/execute", {
        accessToken,
        method: "POST",
        body: JSON.stringify({ roomId: room.id, language: "javascript", sourceCode: code, stdin: "" })
      });
      setOutput(result.stdout || result.stderr || result.compile_output || JSON.stringify(result, null, 2));
    } catch (error) {
      setOutput(error instanceof Error ? error.message : "Unable to execute code.");
    } finally {
      setLoading(undefined);
    }
  }

  return (
    <section id="coding" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Real-time coding room</h2>
        <div className="flex gap-2">
          <Button className="bg-muted text-foreground" disabled={loading === "room"} onClick={createRoom}>
            <Users className="h-4 w-4" />
            {room ? "Room ready" : loading === "room" ? "Creating..." : "Create room"}
          </Button>
          <Button disabled={loading === "run"} onClick={runCode}>
            <Play className="h-4 w-4" />
            {loading === "run" ? "Running..." : "Run"}
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
            Backend output
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <p className="rounded-md bg-muted p-3">Room: {room?.id ?? "not created"}</p>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-primary/10 p-3 font-mono text-xs">{output}</pre>
          </div>
          <input className="mt-auto h-10 rounded-md border border-border bg-background px-3 text-sm" placeholder="Chat wiring is next step" />
        </div>
      </Card>
    </section>
  );
}
