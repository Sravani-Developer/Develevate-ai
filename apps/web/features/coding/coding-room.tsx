"use client";

import Editor from "@monaco-editor/react";
import { ClipboardCheck, MessageSquare, Play, Sparkles, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { API_URL, api } from "@/lib/api";
import { useSession } from "@/store/session";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Language = "javascript" | "typescript" | "python" | "java" | "cpp";
type Difficulty = "EASY" | "MEDIUM" | "HARD";

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

type Challenge = {
  title: string;
  difficulty: Difficulty;
  prompt: string;
  constraints: string[];
  sample: {
    stdin: string;
    output: string;
  };
  reviewSignals: string[];
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
  const mode = useSession((state) => state.mode);
  const [code, setCode] = useState("");
  const [room, setRoom] = useState<CodingRoomResponse>();
  const [output, setOutput] = useState("Generate a challenge, then run code to see backend output.");
  const [loading, setLoading] = useState<"room" | "run">();
  const [language, setLanguage] = useState<Language>("javascript");
  const [difficulty, setDifficulty] = useState<Difficulty>("EASY");
  const [targetRole, setTargetRole] = useState("");
  const [topic, setTopic] = useState("");
  const [challenge, setChallenge] = useState<Challenge>();
  const [stdin, setStdin] = useState("");
  const [review, setReview] = useState<string[]>(["Generate a challenge, add your solution, then run or review it for interview-style feedback."]);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const isRemoteCodeRef = useRef(false);
  const generationCountRef = useRef<Record<string, number>>({});

  const canGenerate = Boolean(targetRole.trim() && topic.trim());

  function generateChallenge() {
    if (!canGenerate) {
      setOutput("Enter both target role and coding topic before generating a challenge.");
      return;
    }
    const generationKey = `${targetRole.trim().toLowerCase()}|${topic.trim().toLowerCase()}|${difficulty}`;
    const variant = generationCountRef.current[generationKey] ?? 0;
    generationCountRef.current[generationKey] = variant + 1;
    const nextChallenge = createChallenge(targetRole.trim(), topic.trim(), difficulty, variant);
    const starter = createStarterCode(language, nextChallenge);
    setChallenge(nextChallenge);
    setCode(starter);
    setStdin(nextChallenge.sample.stdin);
    setRoom(undefined);
    setConnected(false);
    setMessages([]);
    setReview([`Challenge generated for ${targetRole.trim()} using ${topic.trim()}. Write the solution, then run or review it.`]);
    setOutput("Challenge generated. Create a room for collaboration or run locally through the backend.");
  }

  function createLocalRoom(currentChallenge: Challenge, message = "Local room is active. Sign in to create a live collaboration room.") {
    const localRoom = { id: "local-room", title: currentChallenge.title, language };
    setRoom(localRoom);
    setConnected(false);
    setMessages([{ author: "System", message, sentAt: new Date().toISOString() }]);
    setOutput(message);
    return localRoom;
  }

  function connectToRoom(currentRoom: CodingRoomResponse) {
    socketRef.current?.disconnect();
    if (currentRoom.id === "local-room") return;

    const socket = io(socketUrl, { transports: ["websocket"], withCredentials: true });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("room:join", { roomId: currentRoom.id });
      setMessages((items) => [...items, { author: "System", message: `Connected to ${currentRoom.title}.`, sentAt: new Date().toISOString() }]);
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
    if (!challenge) return;
    setCode(createStarterCode(language, challenge));
    setRoom(undefined);
    setConnected(false);
  }, [language, challenge]);

  useEffect(() => {
    if (!room || room.id === "local-room" || !connected) return;
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
    if (!challenge) {
      setOutput("Generate a challenge before creating a room.");
      return undefined;
    }
    if (!accessToken || mode !== "authenticated") {
      createLocalRoom(challenge);
      return undefined;
    }
    setLoading("room");
    try {
      const created = await api<CodingRoomResponse>("/coding/rooms", {
        accessToken,
        method: "POST",
        body: JSON.stringify({ title: challenge.title, language, code })
      });
      setRoom(created);
      setMessages([]);
      connectToRoom(created);
      setOutput(`Room created: ${created.title}`);
    } catch (error) {
      const message = isUnauthorizedError(error)
        ? "Sign in again to create a live collaboration room. Using local room for now."
        : "Unable to create a live collaboration room. Using local room for now.";
      createLocalRoom(challenge, message);
    } finally {
      setLoading(undefined);
    }
    return undefined;
  }

  async function runCode() {
    if (!challenge) {
      setOutput("Generate a challenge before running code.");
      return;
    }
    const currentRoom = room ?? createLocalRoom(challenge);
    if (currentRoom.id === "local-room" || !accessToken || mode !== "authenticated") {
      setOutput(`Local run prepared for ${language}.\nstdin:\n${stdin || "(empty)"}\n\nExpected output:\n${challenge.sample.output}\n\nJudge0 execution is available when the backend API and JUDGE0 keys are configured.`);
      setReview(reviewCodeLocally(code, challenge));
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
      setReview(reviewCodeLocally(code, challenge));
    } catch (error) {
      setOutput(error instanceof Error ? error.message : "Unable to execute code.");
    } finally {
      setLoading(undefined);
    }
  }

  function sendMessage() {
    const trimmed = message.trim();
    if (!trimmed) return;
    const payload = { roomId: room?.id ?? "local-room", message: trimmed, author: "Candidate" };
    if (!room || room.id === "local-room" || !socketRef.current?.connected) {
      setMessages((items) => [...items, { author: payload.author, message: payload.message, sentAt: new Date().toISOString() }]);
    } else {
      socketRef.current.emit("chat:send", payload);
    }
    setMessage("");
  }

  function reviewCode() {
    if (!challenge) {
      setReview(["Generate a challenge first so the review can evaluate against the selected role, topic, and difficulty."]);
      return;
    }
    setReview(reviewCodeLocally(code, challenge));
  }

  const editorLanguage = languageOptions.find((item) => item.value === language)?.editor ?? "javascript";

  return (
    <section id="coding" className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <h2 className="text-xl font-semibold">Real-time coding room</h2>
          <div className="grid gap-3 md:grid-cols-4 xl:min-w-[900px]">
            <label className="block text-xs font-medium text-muted-foreground">
              <span className="mb-2 block">Target role</span>
              <Input aria-label="Coding target role" onChange={(event) => setTargetRole(event.target.value)} placeholder="Example: Frontend Developer" value={targetRole} />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              <span className="mb-2 block">Coding topic</span>
              <Input aria-label="Coding topic" onChange={(event) => setTopic(event.target.value)} placeholder="Example: dashboard filtering" value={topic} />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              <span className="mb-2 block">Difficulty</span>
              <select className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm" value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)}>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              <span className="mb-2 block">Language</span>
              <select className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm" value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
                {languageOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!canGenerate} onClick={generateChallenge}>
            <Sparkles className="h-4 w-4" />
            Generate challenge
          </Button>
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
      <Card className="grid gap-4 xl:grid-cols-[300px_1fr_340px]">
        <div className="rounded-md border border-border p-4">
          {challenge ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{challenge.title}</p>
                <span className="rounded bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{formatDifficulty(challenge.difficulty)}</span>
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
            </>
          ) : (
            <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
              No coding challenge generated yet. Enter a role and topic, choose difficulty/language, then click Generate challenge.
            </div>
          )}
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
              Room: {room?.id ?? "not created"} <span className="text-muted-foreground">({connected ? "live" : "local"})</span>
            </p>
            <textarea className="min-h-20 rounded-md border border-border bg-background p-3 text-sm" placeholder="stdin for your run" value={stdin} onChange={(event) => setStdin(event.target.value)} />
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
            <p className="text-muted-foreground">Messages appear here after a local or live room is created.</p>
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

function createChallenge(targetRole: string, topic: string, difficulty: Difficulty, variant = 0): Challenge {
  const normalizedTopic = topic.toLowerCase();
  const titlePrefix = toTitleCase(topic);
  const limit = difficulty === "EASY" ? "O(n) time" : difficulty === "MEDIUM" ? "O(n log n) time or better" : "O(n) or O(n log n) time with clear tradeoffs";
  const roleKind = getRoleKind(targetRole);
  const variantIndex = variant % 3;

  if (roleKind === "frontend") {
    if (variantIndex === 1) {
      return {
        title: `${cleanTitlePrefix(topic, "Validation")} UI Validation`,
        difficulty,
        prompt: `For a ${targetRole}, build a ${topic} validation helper. Given filter rules and selected values, return the invalid filter names in the order they appear.`,
        constraints: [`Use ${limit}`, "A rule is valid when the selected value is one of its allowed values", "Ignore malformed rules", difficulty === "HARD" ? "Explain how this integrates with form state and URL query params" : "Return comma-separated invalid names"],
        sample: {
          stdin: "3\nrole admin,manager,viewer\nstatus active,inactive\nrange 7d,30d\nrole admin\nstatus archived\nrange 30d",
          output: "status"
        },
        reviewSignals: ["input parsing", "validation", "filtering", "order", "output"]
      };
    }
    if (variantIndex === 2) {
      return {
        title: `${cleanTitlePrefix(topic, "Navigation")} UI Navigation`,
        difficulty,
        prompt: `For a ${targetRole}, build a ${topic} navigation helper. Given user permissions and navigation items in the format "permission label", return labels the user can see, preserving navigation order.`,
        constraints: [`Use ${limit}`, "Permissions are case-sensitive", "Ignore malformed rows", difficulty === "HARD" ? "Explain how this avoids client-only authorization mistakes" : "Return visible labels as comma-separated text"],
        sample: {
          stdin: "read,export\n5\nread Dashboard\nadmin Users\nexport Reports\nbilling Billing\nread Profile",
          output: "Dashboard,Reports,Profile"
        },
        reviewSignals: ["input parsing", "permissions", "filtering", "order", "output"]
      };
    }
    return {
      title: `${cleanTitlePrefix(topic, "State")} UI State`,
      difficulty,
      prompt: `For a ${targetRole}, build a ${topic} UI-state helper. Given a selected role, selected status, and UI rows in the format "role status label", return the visible labels that match both filters in their original order.`,
      constraints: [`Use ${limit}`, "Ignore malformed rows", "Preserve original row order", difficulty === "HARD" ? "Explain how this maps to memoized selectors and URL query state" : "Keep the filter logic easy to unit test"],
      sample: {
        stdin: "admin active\n5\nadmin active Revenue\nmanager active Pipeline\nadmin inactive Audit\nadmin active Users\nviewer active Profile",
        output: "Revenue,Users"
      },
      reviewSignals: ["input parsing", "filtering", "order", "state", "output"]
    };
  }

  if (roleKind === "backend") {
    if (variantIndex === 1) {
      return {
        title: `${cleanTitlePrefix(topic, "Window")} API Window`,
        difficulty,
        prompt: `For a ${targetRole}, build a ${topic} sliding-window helper. Given a time window, request limit, and request rows in the format "client second", return clients that exceed the limit within the window.`,
        constraints: [`Use ${limit}`, "Rows are sorted by second", "Preserve first client violation order", difficulty === "HARD" ? "Explain distributed counter consistency tradeoffs" : "Return comma-separated client names"],
        sample: {
          stdin: "10 3\n8\nweb 1\nweb 2\napi 3\nweb 8\napi 9\nweb 10\napi 12\napi 13",
          output: "web"
        },
        reviewSignals: ["input parsing", "window", "queue", "limit", "output"]
      };
    }
    if (variantIndex === 2) {
      return {
        title: `${cleanTitlePrefix(topic, "Audit")} API Audit`,
        difficulty,
        prompt: `For a ${targetRole}, build a ${topic} audit helper. Given endpoint quotas and request rows in the format "endpoint count", return endpoints whose total request count exceeds their quota.`,
        constraints: [`Use ${limit}`, "Ignore endpoints without a quota", "Preserve quota declaration order", difficulty === "HARD" ? "Explain storage and cache invalidation choices" : "Return endpoint names as comma-separated text"],
        sample: {
          stdin: "3\n/login 100\n/search 120\n/export 30\n6\n/login 40\n/search 70\n/export 20\n/login 80\n/export 15\n/profile 200",
          output: "/login,/export"
        },
        reviewSignals: ["input parsing", "map", "aggregation", "quota", "output"]
      };
    }
    return {
      title: `${cleanTitlePrefix(topic, "Policy")} API Policy`,
      difficulty,
      prompt: `For a ${targetRole}, build a ${topic} backend helper. Given a request limit and API request rows in the format "client endpoint count", return each client whose total request count is greater than the limit, preserving first-seen order.`,
      constraints: [`Use ${limit}`, "Aggregate counts per client", "Ignore malformed rows", difficulty === "HARD" ? "Explain how this extends to distributed rate limiting" : "Return one comma-separated line"],
      sample: {
        stdin: "100\n6\nweb /login 40\napi /search 70\nweb /dashboard 75\nmobile /login 20\napi /export 45\nworker /sync 100",
        output: "web,api"
      },
      reviewSignals: ["input parsing", "map", "aggregation", "limit", "output"]
    };
  }

  if (roleKind === "devops") {
    if (variantIndex === 1) {
      return {
        title: `${cleanTitlePrefix(topic, "Capacity")} Capacity Check`,
        difficulty,
        prompt: `For a ${targetRole}, build a ${topic} capacity checker. Given a CPU threshold and service rows in the format "service cpuPercent replicas", return services whose average CPU per replica exceeds the threshold.`,
        constraints: [`Use ${limit}`, "Ignore malformed rows", "Use integer division rounded down", difficulty === "HARD" ? "Explain autoscaling and alert thresholds" : "Return comma-separated service names"],
        sample: {
          stdin: "70\n4\napi 320 4\nweb 180 3\nworker 160 2\ncache 60 1",
          output: "worker"
        },
        reviewSignals: ["input parsing", "threshold", "division", "filtering", "output"]
      };
    }
    if (variantIndex === 2) {
      return {
        title: `${cleanTitlePrefix(topic, "Rollback")} Rollback Signal`,
        difficulty,
        prompt: `For a ${targetRole}, build a ${topic} rollback helper. Given deployment rows in the format "service version errors requests", return services whose error rate is above the allowed percentage.`,
        constraints: [`Use ${limit}`, "Avoid floating-point precision by cross-multiplying", "Ignore rows with zero requests", difficulty === "HARD" ? "Explain rollout gates and rollback automation" : "Return service names in input order"],
        sample: {
          stdin: "5\n4\napi v2 10 100\nweb v4 2 100\nworker v8 9 90\ncache v1 0 50",
          output: "api,worker"
        },
        reviewSignals: ["input parsing", "percentage", "threshold", "filtering", "output"]
      };
    }
    return {
      title: `${cleanTitlePrefix(topic, "Readiness")} Release Readiness`,
      difficulty,
      prompt: `For a ${targetRole}, build a ${topic} readiness checker. Given service rows in the format "service status latencyMs", return services that are not healthy or exceed the latency threshold.`,
      constraints: [`Use ${limit}`, "Preserve service order", "Ignore malformed rows", difficulty === "HARD" ? "Explain alerting and rollback criteria" : "Return comma-separated service names"],
      sample: {
        stdin: "250\n5\napi healthy 180\nweb healthy 320\nworker degraded 140\ndb healthy 90\ncache down 40",
        output: "web,worker,cache"
      },
      reviewSignals: ["input parsing", "threshold", "status", "filtering", "output"]
    };
  }

  if (roleKind === "data") {
    if (variantIndex === 1) {
      return {
        title: `${cleanTitlePrefix(topic, "Trend")} Data Trend`,
        difficulty,
        prompt: `For a ${targetRole}, build a ${topic} trend helper. Given metric rows in the format "day metric value", return the day with the largest increase for the requested metric.`,
        constraints: [`Use ${limit}`, "Rows are sorted by day", "Ignore rows for other metrics", difficulty === "HARD" ? "Explain missing-day handling and anomaly detection" : "Return only the day label"],
        sample: {
          stdin: "revenue\n5\nMon revenue 100\nTue revenue 130\nWed users 80\nWed revenue 125\nThu revenue 170",
          output: "Thu"
        },
        reviewSignals: ["input parsing", "metric", "difference", "tracking", "output"]
      };
    }
    if (variantIndex === 2) {
      return {
        title: `${cleanTitlePrefix(topic, "Segment")} Segment Ranking`,
        difficulty,
        prompt: `For a ${targetRole}, build a ${topic} segment-ranking helper. Given rows in the format "segment conversions visits", return segments sorted by conversion rate descending.`,
        constraints: [`Use ${limit}`, "Use cross multiplication for rate comparison", "Keep first-seen order for ties", difficulty === "HARD" ? "Explain confidence and sample-size tradeoffs" : "Return comma-separated segment names"],
        sample: {
          stdin: "4\nenterprise 20 100\nstartup 15 50\nmidmarket 30 100\nstudent 3 20",
          output: "startup,midmarket,enterprise,student"
        },
        reviewSignals: ["input parsing", "sorting", "rate", "tie", "output"]
      };
    }
    return {
      title: `${cleanTitlePrefix(topic, "Aggregation")} Data Aggregation`,
      difficulty,
      prompt: `For a ${targetRole}, build a ${topic} aggregation helper. Given metric rows in the format "segment metric value", return the segment with the highest total value for the requested metric.`,
      constraints: [`Use ${limit}`, "If totals tie, return the segment seen first", "Ignore malformed rows", difficulty === "HARD" ? "Explain batch and streaming tradeoffs" : "Return only the segment name"],
      sample: {
        stdin: "revenue\n5\nenterprise revenue 90\nstartup revenue 40\nenterprise users 10\nmidmarket revenue 75\nstartup revenue 80",
        output: "startup"
      },
      reviewSignals: ["input parsing", "aggregation", "metric", "tie", "output"]
    };
  }

  if (roleKind === "qa") {
    if (variantIndex === 1) {
      return {
        title: `${cleanTitlePrefix(topic, "Flaky")} Flaky Test Detector`,
        difficulty,
        prompt: `For a ${targetRole}, build a ${topic} flaky-test helper. Given test result rows in the format "testName run result", return tests that have both pass and fail results.`,
        constraints: [`Use ${limit}`, "Preserve first-seen test order", "Ignore malformed rows", difficulty === "HARD" ? "Explain how this affects CI quarantine decisions" : "Return comma-separated test names"],
        sample: {
          stdin: "6\nlogin 1 pass\nfilters 1 fail\nlogin 2 pass\nfilters 2 pass\ncharts 1 fail\ncharts 2 fail",
          output: "filters"
        },
        reviewSignals: ["input parsing", "set", "deduplication", "flaky", "output"]
      };
    }
    if (variantIndex === 2) {
      return {
        title: `${cleanTitlePrefix(topic, "Risk")} Release Risk`,
        difficulty,
        prompt: `For a ${targetRole}, build a ${topic} release-risk helper. Given bug rows in the format "feature severity status", return open critical or high-severity features without duplicates.`,
        constraints: [`Use ${limit}`, "Preserve first-seen feature order", "Only include open bugs", difficulty === "HARD" ? "Explain release-blocking criteria" : "Return comma-separated feature names"],
        sample: {
          stdin: "6\nlogin critical open\nfilters medium open\ncharts high closed\nrbac high open\nlogin critical open\nexport low open",
          output: "login,rbac"
        },
        reviewSignals: ["input parsing", "severity", "status", "deduplication", "output"]
      };
    }
    return {
      title: `${cleanTitlePrefix(topic, "Coverage")} Test Coverage`,
      difficulty,
      prompt: `For a ${targetRole}, build a ${topic} coverage helper. Given test rows in the format "feature result severity", return high-severity features that failed, preserving first-seen order and removing duplicates.`,
      constraints: [`Use ${limit}`, "Only include failed high-severity rows", "Deduplicate by feature", difficulty === "HARD" ? "Explain how this informs release gating" : "Return comma-separated feature names"],
      sample: {
        stdin: "6\nlogin pass high\nfilters fail high\ncharts fail medium\nfilters fail high\nrbac fail high\nexport pass high",
        output: "filters,rbac"
      },
      reviewSignals: ["input parsing", "deduplication", "filtering", "severity", "output"]
    };
  }

  if (/(dashboard|filter|chart|auth|role|access|metric)/i.test(normalizedTopic)) {
    if (variantIndex === 1) {
      return {
        title: `${cleanTitlePrefix(topic, "Rules")} Rules Engine`,
        difficulty,
        prompt: `For a ${targetRole}, build a ${topic} rules helper. Given user attributes and rule rows in the format "field operator value label", return labels for rules that match the user.`,
        constraints: [`Use ${limit}`, "Supported operators are equals and not_equals", "Ignore malformed rules", difficulty === "HARD" ? "Explain how this becomes configurable safely" : "Preserve rule order"],
        sample: {
          stdin: "role=admin status=active\n4\nrole equals admin AdminPanel\nstatus equals inactive Reengage\nrole not_equals viewer Export\nteam equals growth GrowthOnly",
          output: "AdminPanel,Export"
        },
        reviewSignals: ["input parsing", "rules", "filtering", "operators", "output"]
      };
    }
    if (variantIndex === 2) {
      return {
        title: `${cleanTitlePrefix(topic, "Summary")} Access Summary`,
        difficulty,
        prompt: `For a ${targetRole}, build a ${topic} summary helper. Given access rows in the format "user role resource", return how many unique resources are available for the requested role.`,
        constraints: [`Use ${limit}`, "Count unique resources only", "Ignore malformed rows", difficulty === "HARD" ? "Explain memory tradeoffs for large access logs" : "Return only the count"],
        sample: {
          stdin: "admin\n5\nu1 admin reports\nu2 manager pipeline\nu3 admin users\nu4 admin reports\nu5 viewer profile",
          output: "2"
        },
        reviewSignals: ["input parsing", "set", "filtering", "deduplication", "output"]
      };
    }
    return {
      title: `${cleanTitlePrefix(topic, "Metrics")} Metrics`,
      difficulty,
      prompt: `For a ${targetRole}, build a ${topic} helper. Given a required role, required status, and event rows in the format "role status value", return the total value for rows that match both filters.`,
      constraints: [`Use ${limit}`, "Ignore malformed rows", "Values are non-negative integers", difficulty === "HARD" ? "Explain how you would extend this for streaming dashboard updates" : "Keep parsing and aggregation easy to test"],
      sample: {
        stdin: "admin active\n5\nadmin active 40\nmanager active 30\nadmin inactive 10\nadmin active 60\nviewer active 15",
        output: "100"
      },
      reviewSignals: ["input parsing", "filtering", "aggregation", "edge cases", "output"]
    };
  }

  if (/(array|list|sort|search|number|dsa)/i.test(normalizedTopic)) {
    if (variantIndex === 1) {
      return {
        title: `${titlePrefix} Range Query`,
        difficulty,
        prompt: `For a ${targetRole}, solve this ${topic} problem. Given a min and max value plus a list of integers, return how many numbers fall inside the inclusive range.`,
        constraints: [`Use ${limit}`, "Input may contain duplicate values", "Return only the count", difficulty === "HARD" ? "Explain how sorting helps repeated queries" : "Handle empty lists"],
        sample: {
          stdin: "5 12\n7\n3 5 8 12 13 5 20",
          output: "4"
        },
        reviewSignals: ["input parsing", "comparison", "range", "count", "output"]
      };
    }
    if (variantIndex === 2) {
      return {
        title: `${titlePrefix} Frequency Check`,
        difficulty,
        prompt: `For a ${targetRole}, solve this ${topic} problem. Given a list of integers, return the value with the highest frequency. If tied, return the value seen first.`,
        constraints: [`Use ${limit}`, "Preserve first-seen tie behavior", "Return only one number", difficulty === "HARD" ? "Discuss memory tradeoffs for large streams" : "Handle duplicates"],
        sample: {
          stdin: "8\n4 7 4 2 7 7 4 9",
          output: "4"
        },
        reviewSignals: ["input parsing", "map", "frequency", "tie", "output"]
      };
    }
    return {
      title: `${titlePrefix} Analyzer`,
      difficulty,
      prompt: `For a ${targetRole}, solve this ${topic} problem. Given a target number and a list of integers, return how many values are greater than or equal to the target.`,
      constraints: [`Use ${limit}`, "Input may contain duplicate values", "Return only the count", difficulty === "HARD" ? "Discuss how this changes for millions of records" : "Handle empty lists"],
      sample: {
        stdin: "10\n6\n4 10 12 7 10 18",
        output: "4"
      },
      reviewSignals: ["input parsing", "loop", "comparison", "count", "output"]
    };
  }

  if (/(string|text|word|search|slug)/i.test(normalizedTopic)) {
    if (variantIndex === 1) {
      return {
        title: `${titlePrefix} Keyword Search`,
        difficulty,
        prompt: `For a ${targetRole}, implement a ${topic} utility. Given a keyword and text lines, return line numbers that contain the keyword case-insensitively.`,
        constraints: [`Use ${limit}`, "Line numbers are 1-based", "Return comma-separated line numbers", difficulty === "HARD" ? "Explain indexing tradeoffs for repeated searches" : "Return empty string when no lines match"],
        sample: {
          stdin: "dashboard\n4\nLogin page\nDashboard filters\nprofile settings\nanalytics dashboard",
          output: "2,4"
        },
        reviewSignals: ["input parsing", "lowercase", "search", "line", "output"]
      };
    }
    if (variantIndex === 2) {
      return {
        title: `${titlePrefix} Word Count`,
        difficulty,
        prompt: `For a ${targetRole}, implement a ${topic} utility. Given text, return the most frequent word after lowercasing and removing punctuation.`,
        constraints: [`Use ${limit}`, "If tied, return the word seen first", "Ignore empty tokens", difficulty === "HARD" ? "Explain tokenization and locale tradeoffs" : "Return a single word"],
        sample: {
          stdin: "React, react dashboards need filters. Filters need state.",
          output: "react"
        },
        reviewSignals: ["normalization", "map", "frequency", "tie", "output"]
      };
    }
    return {
      title: `${titlePrefix} Text Normalizer`,
      difficulty,
      prompt: `For a ${targetRole}, implement a ${topic} utility. Given a phrase, normalize it by lowercasing, trimming spaces, replacing one or more spaces with hyphens, and returning the normalized value.`,
      constraints: [`Use ${limit}`, "Do not remove letters or numbers", "Collapse repeated spaces", difficulty === "HARD" ? "Explain unicode and localization tradeoffs" : "Return a single line"],
      sample: {
        stdin: "  Product Analytics Dashboard  ",
        output: "product-analytics-dashboard"
      },
      reviewSignals: ["string normalization", "trim", "lowercase", "replace", "output"]
    };
  }

  if (variantIndex === 1) {
    return {
      title: `${titlePrefix} Threshold Summary`,
      difficulty,
      prompt: `For a ${targetRole}, build a coding solution for ${topic}. Given a threshold and rows in the format "name value", return names whose total value is greater than or equal to the threshold.`,
      constraints: [`Use ${limit}`, "Aggregate duplicate names", "Preserve first-seen name order", difficulty === "HARD" ? "Explain memory usage for high-cardinality names" : "Ignore malformed rows"],
      sample: {
        stdin: "8\n5\nlogin 3\nsearch 4\nlogin 5\ncheckout 6\nsearch 6",
        output: "login,search"
      },
      reviewSignals: ["map", "aggregation", "threshold", "order", "output"]
    };
  }
  if (variantIndex === 2) {
    return {
      title: `${titlePrefix} Latest Event`,
      difficulty,
      prompt: `For a ${targetRole}, build a coding solution for ${topic}. Given rows in the format "name timestamp status", return each name's latest status in first-seen name order.`,
      constraints: [`Use ${limit}`, "Higher timestamp means newer", "Ignore malformed rows", difficulty === "HARD" ? "Explain ordering and idempotency tradeoffs" : "Return name=status pairs comma-separated"],
      sample: {
        stdin: "5\nlogin 10 pass\nsearch 12 fail\nlogin 13 fail\nexport 9 pass\nsearch 8 pass",
        output: "login=fail,search=fail,export=pass"
      },
      reviewSignals: ["map", "timestamp", "update", "order", "output"]
    };
  }
  return {
    title: `${titlePrefix} Event Summary`,
    difficulty,
    prompt: `For a ${targetRole}, build a coding solution for ${topic}. Given event rows in the format "name value", return the name with the highest total value across all rows.`,
    constraints: [`Use ${limit}`, "Names are case-sensitive", "If totals tie, return the name that appeared first", difficulty === "HARD" ? "Describe how you would process this in batches" : "Ignore malformed rows"],
    sample: {
      stdin: "5\nlogin 3\nsearch 4\nlogin 5\ncheckout 6\nsearch 1",
      output: "login"
    },
    reviewSignals: ["map", "aggregation", "tie handling", "input parsing", "output"]
  };
}

function createStarterCode(language: Language, challenge: Challenge) {
  const comment = `Solve: ${challenge.title}`;
  const starters: Record<Language, string> = {
    javascript: `const fs = require("fs");\n\nconst input = fs.readFileSync(0, "utf8");\n\nfunction solve(input) {\n  // ${comment}\n  return "";\n}\n\nconsole.log(solve(input));\n`,
    typescript: `import fs from "fs";\n\nconst input = fs.readFileSync(0, "utf8");\n\nfunction solve(input: string): string {\n  // ${comment}\n  return "";\n}\n\nconsole.log(solve(input));\n`,
    python: `import sys\n\ninput_data = sys.stdin.read()\n\ndef solve(input_data: str) -> str:\n    # ${comment}\n    return ""\n\nprint(solve(input_data))\n`,
    java: `import java.io.*;\n\npublic class Main {\n    public static String solve(String input) {\n        // ${comment}\n        return "";\n    }\n\n    public static void main(String[] args) throws Exception {\n        String input = new String(System.in.readAllBytes());\n        System.out.println(solve(input));\n    }\n}\n`,
    cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nstring solve(const string& input) {\n    // ${comment}\n    return "";\n}\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n\n    string input((istreambuf_iterator<char>(cin)), istreambuf_iterator<char>());\n    cout << solve(input) << "\\n";\n    return 0;\n}\n`
  };

  return starters[language];
}

function reviewCodeLocally(source: string, challenge: Challenge) {
  const normalized = source.toLowerCase();
  const feedback: string[] = [];

  if (/readfilesync|stdin|scanner|bufferedreader|sys\.stdin|cin|readallbytes/i.test(source)) {
    feedback.push("Input handling is present, which is required for the generated challenge.");
  } else {
    feedback.push("Add stdin parsing so the solution can run against the sample input.");
  }

  if (/for\s*\(|for\s+.*of|while\s*\(|map\(|reduce\(|for\s+\w+\s+in/i.test(source)) {
    feedback.push("The solution includes iteration or aggregation logic.");
  } else {
    feedback.push("Add iteration over the parsed records or values.");
  }

  if (challenge.reviewSignals.some((signal) => normalized.includes(signal.split(" ")[0] ?? signal))) {
    feedback.push(`Good direction: the code includes logic related to ${challenge.reviewSignals.slice(0, 3).join(", ")}.`);
  } else {
    feedback.push(`Make the ${challenge.reviewSignals.slice(0, 3).join(", ")} logic explicit.`);
  }

  if (/return\s+|console\.log|print\(|system\.out|cout/.test(source)) {
    feedback.push("Output handling is present for runner-based validation.");
  } else {
    feedback.push("Return or print the final answer exactly as the expected output format requires.");
  }

  if (challenge.difficulty !== "EASY" && !/(edge|invalid|malformed|empty|tie|error)/i.test(source)) {
    feedback.push("For this difficulty, add explicit handling for malformed, empty, or tie cases.");
  }

  return feedback.slice(0, 5);
}

function toTitleCase(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function cleanTitlePrefix(value: string, suffix: string) {
  const suffixWords = new Set(suffix.toLowerCase().split(/\s+/));
  const noiseWords = new Set(["and", "with", "for"]);
  const words = toTitleCase(value)
    .split(/\s+/)
    .filter((word) => !suffixWords.has(word.toLowerCase()));
  const compact = words.filter((word, index) => index === 0 || !noiseWords.has(word.toLowerCase()));
  return compact.join(" ") || suffix;
}

function getRoleKind(role: string) {
  const normalized = role.toLowerCase();
  if (/(frontend|front-end|react|ui|web)/.test(normalized)) return "frontend";
  if (/(backend|back-end|api|server|node|java|spring|nestjs)/.test(normalized)) return "backend";
  if (/(devops|sre|cloud|platform|infrastructure)/.test(normalized)) return "devops";
  if (/(data|analytics|machine learning|ml|bi)/.test(normalized)) return "data";
  if (/(qa|test|quality)/.test(normalized)) return "qa";
  return "general";
}

function formatDifficulty(value: Difficulty) {
  return value[0] + value.slice(1).toLowerCase();
}

function isUnauthorizedError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.message.includes("401") || error.message.toLowerCase().includes("unauthorized");
}
