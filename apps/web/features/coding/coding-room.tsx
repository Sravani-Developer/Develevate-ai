"use client";

import Editor from "@monaco-editor/react";
import { MessageSquare, Play, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { API_URL, api } from "@/lib/api";
import { useSession } from "@/store/session";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Language = "javascript" | "typescript" | "python" | "java" | "cpp";

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

type ChatMessage = {
  author: string;
  message: string;
  sentAt: string;
};

const languageOptions: Array<{ label: string; value: Language; editor: string }> = [
  { label: "JavaScript", value: "javascript", editor: "javascript" },
  { label: "TypeScript", value: "typescript", editor: "typescript" },
  { label: "Python", value: "python", editor: "python" },
  { label: "Java", value: "java", editor: "java" },
  { label: "C++", value: "cpp", editor: "cpp" }
];

const socketUrl = `${API_URL.replace(/\/$/, "")}/coding`;

export function CodingRoom() {
  const accessToken = useSession((state) => state.accessToken);
  const [code, setCode] = useState("function twoSum(nums, target) {\n  const seen = new Map();\n  return [];\n}\n");
  const [room, setRoom] = useState<CodingRoomResponse>();
  const [output, setOutput] = useState("Create a room and run code to see Judge0/backend output.");
  const [loading, setLoading] = useState<"room" | "run">();
  const [language, setLanguage] = useState<Language>("javascript");
  const [stdin, setStdin] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const isRemoteCodeRef = useRef(false);

  function createDemoRoom() {
    const demoRoom = { id: "demo-room", title: "Two Sum practice", language: "javascript" };
    setRoom(demoRoom);
    setConnected(false);
    setMessages([{ author: "System", message: "Demo room is active locally. Start the backend for live collaboration.", sentAt: new Date().toISOString() }]);
    setOutput("Demo room created locally. Start the API to save rooms and enable Judge0 execution.");
    return demoRoom;
  }

  function connectToRoom(currentRoom: CodingRoomResponse) {
    socketRef.current?.disconnect();
    if (currentRoom.id === "demo-room") return;

    const socket = io(socketUrl, { transports: ["websocket"], withCredentials: true });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("room:join", { roomId: currentRoom.id });
      setMessages((items) => [
        ...items,
        { author: "System", message: `Connected to ${currentRoom.title}.`, sentAt: new Date().toISOString() }
      ]);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("code:updated", (payload: { roomId: string; code: string }) => {
      if (payload.roomId !== currentRoom.id) return;
      isRemoteCodeRef.current = true;
      setCode(payload.code);
    });

    socket.on("chat:message", (payload: ChatMessage & { roomId: string }) => {
      if (payload.roomId !== currentRoom.id) return;
      setMessages((items) => [...items, { author: payload.author, message: payload.message, sentAt: payload.sentAt }]);
    });
  }

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!room || room.id === "demo-room" || !connected) return;
    if (isRemoteCodeRef.current) {
      isRemoteCodeRef.current = false;
      return;
    }
    const timeout = window.setTimeout(() => {
      socketRef.current?.emit("code:update", { roomId: room.id, code });
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [code, connected, room]);

  async function createRoom() {
    if (!accessToken) {
      createDemoRoom();
      return undefined;
    }
    setLoading("room");
    try {
      const created = await api<CodingRoomResponse>("/coding/rooms", {
        accessToken,
        method: "POST",
        body: JSON.stringify({ title: "Two Sum practice", language })
      });
      setRoom(created);
      setMessages([]);
      connectToRoom(created);
      setOutput(`Room created: ${created.title}`);
    } catch (error) {
      createDemoRoom();
      setOutput(error instanceof Error ? `Backend unavailable, using demo room. ${error.message}` : "Backend unavailable, using demo room.");
    } finally {
      setLoading(undefined);
    }
    return undefined;
  }

  async function runCode() {
    const currentRoom = room ?? createDemoRoom();
    if (currentRoom.id === "demo-room" || !accessToken) {
      setOutput(`Demo run completed for ${language}.\nstdin:\n${stdin || "(empty)"}\n\nJudge0 execution is available when the backend API and JUDGE0 keys are configured.`);
      return;
    }
    setLoading("run");
    setOutput("Running code...");
    try {
      const result = await api<ExecuteResponse>("/coding/execute", {
        accessToken,
        method: "POST",
        body: JSON.stringify({ roomId: currentRoom.id, language, sourceCode: code, stdin })
      });
      setOutput(result.stdout || result.stderr || result.compile_output || JSON.stringify(result, null, 2));
    } catch (error) {
      setOutput(error instanceof Error ? error.message : "Unable to execute code.");
    } finally {
      setLoading(undefined);
    }
  }

  function sendMessage() {
    const trimmed = message.trim();
    if (!trimmed) return;
    const payload = { roomId: room?.id ?? "demo-room", message: trimmed, author: "Candidate" };
    if (!room || room.id === "demo-room" || !socketRef.current?.connected) {
      setMessages((items) => [...items, { author: payload.author, message: payload.message, sentAt: new Date().toISOString() }]);
    } else {
      socketRef.current.emit("chat:send", payload);
    }
    setMessage("");
  }

  const editorLanguage = languageOptions.find((item) => item.value === language)?.editor ?? "javascript";

  return (
    <section id="coding" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">Real-time coding room</h2>
        <div className="flex flex-wrap gap-2">
          <select
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            value={language}
            onChange={(event) => setLanguage(event.target.value as Language)}
          >
            {languageOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
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
            language={editorLanguage}
            theme="vs-dark"
            value={code}
            options={{ minimap: { enabled: false }, fontSize: 14 }}
            onChange={(value) => setCode(value ?? "")}
          />
        </div>
        <div className="flex min-h-80 flex-col rounded-md border border-border p-4">
          <div className="flex items-center gap-2 font-semibold">
            <MessageSquare className="h-4 w-4 text-primary" />
            Collaboration
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <p className="rounded-md bg-muted p-3">
              Room: {room?.id ?? "not created"} <span className="text-muted-foreground">({connected ? "live" : "local/demo"})</span>
            </p>
            <textarea
              className="min-h-20 rounded-md border border-border bg-background p-3 text-sm"
              placeholder="stdin for your run"
              value={stdin}
              onChange={(event) => setStdin(event.target.value)}
            />
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-primary/10 p-3 font-mono text-xs">{output}</pre>
          </div>
          <div className="mt-4 max-h-32 space-y-2 overflow-auto rounded-md border border-border p-3 text-sm">
            {messages.length ? (
              messages.map((item, index) => (
                <p key={`${item.sentAt}-${index}`}>
                  <span className="font-semibold">{item.author}:</span> {item.message}
                </p>
              ))
            ) : (
              <p className="text-muted-foreground">Chat messages appear here after a room is created.</p>
            )}
          </div>
          <div className="mt-auto flex gap-2 pt-3">
            <input
              className="h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm"
              placeholder="Send a room message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") sendMessage();
              }}
            />
            <Button className="px-3" onClick={sendMessage}>
              Send
            </Button>
          </div>
        </div>
      </Card>
    </section>
  );
}
