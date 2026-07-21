"use client";

import Editor from "@monaco-editor/react";
import { ClipboardCheck, MessageSquare, Play, Users } from "lucide-react";
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

const challenge = {
  title: "Two Sum",
  difficulty: "Easy",
  prompt: "Given an array of integers and a target, return the indices of the two numbers that add up to the target.",
  constraints: ["Exactly one valid answer exists", "Each input may be used once", "Aim for O(n) time and O(n) space"],
  sample: {
    stdin: "9\n2 7 11 15",
    output: "0 1"
  }
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
  const [review, setReview] = useState<string[]>([
    "Create a room, add your solution, then run or review it for interview-style feedback."
  ]);
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
      setReview(reviewCodeLocally(code));
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

  function reviewCode() {
    setReview(reviewCodeLocally(code));
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
          <Button className="bg-muted text-foreground" onClick={reviewCode}>
            <ClipboardCheck className="h-4 w-4" />
            Review code
          </Button>
        </div>
      </div>
      <Card className="grid gap-4 xl:grid-cols-[260px_1fr_340px]">
        <div className="rounded-md border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">{challenge.title}</p>
            <span className="rounded bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{challenge.difficulty}</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{challenge.prompt}</p>
          <div className="mt-4">
            <p className="text-sm font-semibold">Constraints</p>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              {challenge.constraints.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>
          <div className="mt-4 rounded-md bg-muted p-3 text-xs">
            <p className="font-semibold">Sample stdin</p>
            <pre className="mt-2 whitespace-pre-wrap">{challenge.sample.stdin}</pre>
            <p className="mt-3 font-semibold">Expected output</p>
            <pre className="mt-2 whitespace-pre-wrap">{challenge.sample.output}</pre>
          </div>
        </div>
        <div className="space-y-4">
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
          <div className="rounded-md border border-border p-4">
            <div className="flex items-center gap-2 font-semibold">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              Local code review
            </div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {review.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>
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

function reviewCodeLocally(source: string) {
  const normalized = source.toLowerCase();
  const feedback: string[] = [];

  if (/new\s+map|{}/i.test(source)) {
    feedback.push("Good direction: a hash map/object lookup supports the expected O(n) solution.");
  } else {
    feedback.push("Consider using a hash map to store seen values and avoid nested loops.");
  }

  if (/for\s*\(|for\s+.*of|while\s*\(/i.test(source)) {
    feedback.push("The solution includes iteration over the input, which is needed for this challenge.");
  } else {
    feedback.push("Add a loop over the input array and check each number against the target complement.");
  }

  if (normalized.includes("target") && (normalized.includes("need") || normalized.includes("complement"))) {
    feedback.push("Good interview signal: complement logic is visible and easy to explain.");
  } else {
    feedback.push("Make the complement calculation explicit so the interviewer can follow your reasoning.");
  }

  if (/return\s+\[/.test(source)) {
    feedback.push("Return shape appears aligned with the expected pair of indices.");
  } else {
    feedback.push("Return the two matching indices as an array when the pair is found.");
  }

  if (/console\.log|print\(|system\.out|cout/.test(source)) {
    feedback.push("Output handling is present for local execution testing.");
  } else {
    feedback.push("Add output handling if you want to test through stdin/stdout runners.");
  }

  return feedback.slice(0, 5);
}
