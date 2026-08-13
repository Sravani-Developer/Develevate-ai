"use client";

import Editor from "@monaco-editor/react";
import { ClipboardCheck, MessageSquare, Play, Sparkles, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { API_URL, api, getFriendlyErrorMessage } from "@/lib/api";
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
  const [reviewStatus, setReviewStatus] = useState("");
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
    setReviewStatus("");
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
        : `${getFriendlyErrorMessage(error, "Unable to create a live collaboration room.")} Using local room for now.`;
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
    const shouldRunJavaScriptLocally = language === "javascript" && currentRoom.id === "local-room";

    if (shouldRunJavaScriptLocally || !accessToken || mode !== "authenticated") {
      setLoading("run");
      setOutput(
        language === "javascript"
          ? "Running JavaScript locally..."
          : `Sign in to execute ${language} through the backend runner.\nstdin:\n${stdin || "(empty)"}\n\nExpected output:\n${challenge.sample.output}`
      );
      try {
        if (language === "javascript") {
          const result = await executeJavaScriptLocally(code, stdin);
          setOutput(formatExecutionResult(result));
        }
        setReview(reviewCodeLocally(code, challenge));
      } finally {
        setLoading(undefined);
      }
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
      setOutput(formatExecutionResult(result));
      setReview(reviewCodeLocally(code, challenge));
    } catch (error) {
      setOutput(getFriendlyErrorMessage(error, "Unable to execute code. Check the room and try again."));
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
      const message = "Generate a challenge first so the review can evaluate against the selected role, topic, and difficulty.";
      setReview([message]);
      setReviewStatus(message);
      setOutput(message);
      return;
    }
    const nextReview = reviewCodeLocally(code, challenge);
    setReview(nextReview);
    setReviewStatus("Local code review updated.");
    setOutput(`Local review updated:\n${nextReview.map((item) => `- ${item}`).join("\n")}`);
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
            {reviewStatus ? <p className="mt-2 text-sm text-primary" role="status">{reviewStatus}</p> : null}
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
            <pre aria-live="polite" className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-primary/10 p-3 font-mono text-xs" role="status">
              {output}
            </pre>
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
  const variantIndex = getTopicVariant(roleKind, normalizedTopic, variant);
  topic = getRoleAlignedTopic(roleKind, normalizedTopic, topic, variantIndex);

  if (roleKind === "frontend") {
    if (variantIndex === 1) {
      return {
        title: formatChallengeTitle(topic, "UI Validation"),
        difficulty,
        prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "validation"))} helper. Given filter rules and selected values, return the invalid filter names in the order they appear.`,
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
        title: formatChallengeTitle(topic, "UI Navigation"),
        difficulty,
        prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "navigation"))} helper. Given user permissions and navigation items in the format "permission label", return labels the user can see, preserving navigation order.`,
        constraints: [`Use ${limit}`, "Permissions are case-sensitive", "Ignore malformed rows", difficulty === "HARD" ? "Explain how this avoids client-only authorization mistakes" : "Return visible labels as comma-separated text"],
        sample: {
          stdin: "read,export\n5\nread Dashboard\nadmin Users\nexport Reports\nbilling Billing\nread Profile",
          output: "Dashboard,Reports,Profile"
        },
        reviewSignals: ["input parsing", "permissions", "filtering", "order", "output"]
      };
    }
    return {
      title: formatChallengeTitle(topic, "UI State"),
      difficulty,
      prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "UI state"))} helper. Given a selected role, selected status, and UI rows in the format "role status label", return the visible labels that match both filters in their original order.`,
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
        title: formatChallengeTitle(topic, "API Window"),
        difficulty,
        prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "sliding window"))} helper. Given a time window, request limit, and request rows in the format "client second", return clients that exceed the limit within the window.`,
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
        title: formatChallengeTitle(topic, "API Audit"),
        difficulty,
        prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "audit"))} helper. Given endpoint quotas and request rows in the format "endpoint count", return endpoints whose total request count exceeds their quota.`,
        constraints: [`Use ${limit}`, "Ignore endpoints without a quota", "Preserve quota declaration order", difficulty === "HARD" ? "Explain storage and cache invalidation choices" : "Return endpoint names as comma-separated text"],
        sample: {
          stdin: "3\n/login 100\n/search 120\n/export 30\n6\n/login 40\n/search 70\n/export 20\n/login 80\n/export 15\n/profile 200",
          output: "/login,/export"
        },
        reviewSignals: ["input parsing", "map", "aggregation", "quota", "output"]
      };
    }
    return {
      title: formatChallengeTitle(topic, "API Policy"),
      difficulty,
      prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "backend"))} helper. Given a request limit and API request rows in the format "client endpoint count", return each client whose total request count is greater than the limit, preserving first-seen order.`,
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
        title: formatChallengeTitle(topic, "Capacity Check"),
        difficulty,
        prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "capacity"))} checker. Given a CPU threshold and service rows in the format "service cpuPercent replicas", return services whose average CPU per replica exceeds the threshold.`,
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
        title: formatChallengeTitle(topic, "Rollback Signal"),
        difficulty,
        prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "rollback"))} helper. Given deployment rows in the format "service version errors requests", return services whose error rate is above the allowed percentage.`,
        constraints: [`Use ${limit}`, "Avoid floating-point precision by cross-multiplying", "Ignore rows with zero requests", difficulty === "HARD" ? "Explain rollout gates and rollback automation" : "Return service names in input order"],
        sample: {
          stdin: "5\n4\napi v2 10 100\nweb v4 2 100\nworker v8 9 90\ncache v1 0 50",
          output: "api,worker"
        },
        reviewSignals: ["input parsing", "percentage", "threshold", "filtering", "output"]
      };
    }
    return {
      title: formatChallengeTitle(topic, "Release Readiness"),
      difficulty,
      prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "readiness"))} checker. Given service rows in the format "service status latencyMs", return services that are not healthy or exceed the latency threshold.`,
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
        title: formatChallengeTitle(topic, "Data Trend"),
        difficulty,
        prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "trend"))} helper. Given metric rows in the format "day metric value", return the day with the largest increase for the requested metric.`,
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
        title: formatChallengeTitle(topic, "Segment Ranking"),
        difficulty,
        prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "segment ranking"))} helper. Given rows in the format "segment conversions visits", return segments sorted by conversion rate descending.`,
        constraints: [`Use ${limit}`, "Use cross multiplication for rate comparison", "Keep first-seen order for ties", difficulty === "HARD" ? "Explain confidence and sample-size tradeoffs" : "Return comma-separated segment names"],
        sample: {
          stdin: "4\nenterprise 20 100\nstartup 15 50\nmidmarket 30 100\nstudent 3 20",
          output: "startup,midmarket,enterprise,student"
        },
        reviewSignals: ["input parsing", "sorting", "rate", "tie", "output"]
      };
    }
    return {
      title: formatChallengeTitle(topic, "Data Aggregation"),
      difficulty,
      prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "aggregation"))} helper. Given metric rows in the format "segment metric value", return the segment with the highest total value for the requested metric.`,
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
        title: formatChallengeTitle(topic, "Flaky Test Detector"),
        difficulty,
        prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "flaky test"))} helper. Given test result rows in the format "testName run result", return tests that have both pass and fail results.`,
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
        title: formatChallengeTitle(topic, "Release Risk"),
        difficulty,
        prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "release risk"))} helper. Given bug rows in the format "feature severity status", return open critical or high-severity features without duplicates.`,
        constraints: [`Use ${limit}`, "Preserve first-seen feature order", "Only include open bugs", difficulty === "HARD" ? "Explain release-blocking criteria" : "Return comma-separated feature names"],
        sample: {
          stdin: "6\nlogin critical open\nfilters medium open\ncharts high closed\nrbac high open\nlogin critical open\nexport low open",
          output: "login,rbac"
        },
        reviewSignals: ["input parsing", "severity", "status", "deduplication", "output"]
      };
    }
    return {
      title: formatChallengeTitle(topic, "Test Coverage"),
      difficulty,
      prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "coverage"))} helper. Given test rows in the format "feature result severity", return high-severity features that failed, preserving first-seen order and removing duplicates.`,
      constraints: [`Use ${limit}`, "Only include failed high-severity rows", "Deduplicate by feature", difficulty === "HARD" ? "Explain how this informs release gating" : "Return comma-separated feature names"],
      sample: {
        stdin: "6\nlogin pass high\nfilters fail high\ncharts fail medium\nfilters fail high\nrbac fail high\nexport pass high",
        output: "filters,rbac"
      },
      reviewSignals: ["input parsing", "deduplication", "filtering", "severity", "output"]
    };
  }

  if (roleKind === "product") {
    if (variantIndex === 1) {
      return {
        title: formatChallengeTitle(topic, "Product RICE Ranking"),
        difficulty,
        prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "RICE scoring"))} helper. Given feature rows in the format "feature reach impact confidence effort", return features sorted by priority score descending.`,
        constraints: [`Use ${limit}`, "Priority score is reach * impact * confidence / effort", "Use integer division rounded down", difficulty === "HARD" ? "Explain how you would handle strategic bets and qualitative overrides" : "Keep first-seen order for ties"],
        sample: {
          stdin: "4\ncheckout 1000 3 80 4\nsearch 800 4 70 2\nprofile 300 2 90 1\nbilling 700 5 50 5",
          output: "search,profile,checkout,billing"
        },
        reviewSignals: ["input parsing", "priority", "score", "tie", "output"]
      };
    }
    if (variantIndex === 2) {
      return {
        title: formatChallengeTitle(topic, "MVP Scope Selector"),
        difficulty,
        prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "MVP scope"))} helper. Given a capacity limit and feature rows in the format "feature effort impact", return the highest-impact features that fit within capacity, preserving input order after selection.`,
        constraints: [`Use ${limit}`, "Prefer higher impact first", "If impact ties, prefer lower effort", difficulty === "HARD" ? "Explain roadmap tradeoffs when dependencies exist" : "Return selected feature names as comma-separated text"],
        sample: {
          stdin: "7\n5\nlogin 2 8\nfilters 3 9\nexport 4 7\nsharing 2 6\nalerts 1 5",
          output: "filters,login,alerts"
        },
        reviewSignals: ["input parsing", "impact", "effort", "capacity", "output"]
      };
    }
    return {
      title: formatChallengeTitle(topic, "Feedback Prioritization"),
      difficulty,
      prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "feedback prioritization"))} helper. Given feedback rows in the format "customerSegment feature severity", return features with the highest weighted severity score.`,
      constraints: [`Use ${limit}`, "Enterprise feedback has weight 3, midmarket 2, selfserve 1", "Severity values are low, medium, high", difficulty === "HARD" ? "Explain how this supports roadmap decisions without blindly following volume" : "Return the top feature name"],
      sample: {
        stdin: "5\nenterprise export high\nselfserve themes high\nmidmarket export medium\nenterprise filters low\nmidmarket filters high",
        output: "export"
      },
      reviewSignals: ["input parsing", "segment", "severity", "priority", "output"]
    };
  }

  if (roleKind === "marketing") {
    if (variantIndex === 1) {
      return {
        title: formatChallengeTitle(topic, "Channel Attribution"),
        difficulty,
        prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "attribution"))} helper. Given campaign rows in the format "channel conversions cost", return the channel with the lowest cost per conversion.`,
        constraints: [`Use ${limit}`, "Ignore rows with zero conversions", "If rates tie, return the channel seen first", difficulty === "HARD" ? "Explain attribution-window and assisted-conversion tradeoffs" : "Return only the channel name"],
        sample: {
          stdin: "5\nseo 40 400\npaid 80 1200\nemail 30 210\nsocial 20 500\nseo 10 90",
          output: "email"
        },
        reviewSignals: ["input parsing", "channel", "conversion", "cost", "output"]
      };
    }
    if (variantIndex === 2) {
      return {
        title: formatChallengeTitle(topic, "Campaign ROI"),
        difficulty,
        prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "ROI"))} helper. Given campaign rows in the format "campaign revenue spend", return campaigns with positive ROI sorted by ROI descending.`,
        constraints: [`Use ${limit}`, "ROI is revenue - spend", "Keep first-seen order for ties", difficulty === "HARD" ? "Explain how CAC and LTV would change this decision" : "Return campaign names as comma-separated text"],
        sample: {
          stdin: "4\nlaunch 900 500\nretargeting 300 350\nwebinar 700 250\nnewsletter 200 100",
          output: "webinar,launch,newsletter"
        },
        reviewSignals: ["input parsing", "campaign", "revenue", "spend", "output"]
      };
    }
    return {
      title: formatChallengeTitle(topic, "Lead Score"),
      difficulty,
      prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "lead scoring"))} helper. Given lead events in the format "lead event", return leads whose score reaches the qualification threshold.`,
      constraints: [`Use ${limit}`, "visit is 1 point, download is 3, demo is 5", "Preserve first qualified order", difficulty === "HARD" ? "Explain decay and spam-event handling" : "Return comma-separated lead names"],
      sample: {
        stdin: "6\n7\nacme visit\nbeta demo\nacme download\nacme demo\ncoda visit\nbeta download",
        output: "beta,acme"
      },
      reviewSignals: ["input parsing", "lead", "score", "threshold", "output"]
    };
  }

  if (roleKind === "sales") {
    if (variantIndex === 1) {
      return {
        title: formatChallengeTitle(topic, "Pipeline Priority"),
        difficulty,
        prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "pipeline"))} helper. Given deal rows in the format "account stage amount", return accounts sorted by weighted pipeline value.`,
        constraints: [`Use ${limit}`, "proposal weight is 3, discovery 2, prospect 1", "If weighted values tie, keep first-seen order", difficulty === "HARD" ? "Explain forecast risk and stale-opportunity handling" : "Return account names comma-separated"],
        sample: {
          stdin: "5\nacme proposal 100\nbeta discovery 180\ncoda prospect 500\nacme discovery 50\ndelta proposal 70",
          output: "coda,acme,beta,delta"
        },
        reviewSignals: ["input parsing", "account", "stage", "pipeline", "output"]
      };
    }
    if (variantIndex === 2) {
      return {
        title: formatChallengeTitle(topic, "Quota Tracker"),
        difficulty,
        prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "quota"))} helper. Given rep rows in the format "rep closedAmount quota", return reps who reached quota, preserving first-seen order.`,
        constraints: [`Use ${limit}`, "Aggregate closed amount by rep", "Use the latest quota seen for a rep", difficulty === "HARD" ? "Explain partial-period and team-rollup tradeoffs" : "Return rep names as comma-separated text"],
        sample: {
          stdin: "5\nava 400 1000\nliam 900 1000\nava 650 1000\nnoah 300 500\nliam 120 1000",
          output: "ava,liam"
        },
        reviewSignals: ["input parsing", "rep", "quota", "aggregation", "output"]
      };
    }
    return {
      title: formatChallengeTitle(topic, "Account Prioritization"),
      difficulty,
      prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "account priority"))} helper. Given account rows in the format "account intent fit contractValue", return the best account by priority score.`,
      constraints: [`Use ${limit}`, "Score is intent + fit + contractValue", "Ignore malformed rows", difficulty === "HARD" ? "Explain how renewal risk or buying committee coverage would change scoring" : "If tied, return first seen account"],
      sample: {
        stdin: "4\nacme 8 7 90\nbeta 9 5 80\ncoda 7 8 120\ndelta 6 9 70",
        output: "coda"
      },
      reviewSignals: ["input parsing", "account", "score", "priority", "output"]
    };
  }

  if (roleKind === "recruiting") {
    if (variantIndex === 1) {
      return {
        title: formatChallengeTitle(topic, "Candidate Screen"),
        difficulty,
        prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "candidate screen"))} helper. Given candidate rows in the format "candidate mustHaveScore interviewScore status", return candidates eligible for the next round.`,
        constraints: [`Use ${limit}`, "Require mustHaveScore >= 70 and interviewScore >= 75", "Only include active candidates", difficulty === "HARD" ? "Explain bias checks and auditability" : "Preserve input order"],
        sample: {
          stdin: "5\nava 80 82 active\nliam 65 90 active\nnoah 75 70 active\nmia 90 88 withdrawn\nzoe 72 79 active",
          output: "ava,zoe"
        },
        reviewSignals: ["input parsing", "candidate", "score", "status", "output"]
      };
    }
    if (variantIndex === 2) {
      return {
        title: formatChallengeTitle(topic, "Hiring Funnel"),
        difficulty,
        prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "funnel"))} helper. Given hiring-stage rows in the format "role stage count", return the stage with the largest drop-off for the requested role.`,
        constraints: [`Use ${limit}`, "Stages are listed in funnel order", "Ignore rows for other roles", difficulty === "HARD" ? "Explain conversion-rate and small-sample tradeoffs" : "Return only the stage name"],
        sample: {
          stdin: "frontend\n5\nfrontend applied 100\nfrontend screen 50\nbackend applied 80\nfrontend onsite 20\nfrontend offer 10",
          output: "screen"
        },
        reviewSignals: ["input parsing", "role", "stage", "dropoff", "output"]
      };
    }
    return {
      title: formatChallengeTitle(topic, "Interview Schedule"),
      difficulty,
      prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "scheduling"))} helper. Given interviewer availability rows in the format "interviewer day slots", return the first day with enough total slots.`,
      constraints: [`Use ${limit}`, "Aggregate slots by day", "Days appear in priority order", difficulty === "HARD" ? "Explain timezone and interviewer-load fairness" : "Return only the day"],
      sample: {
        stdin: "4\n5\nava Mon 1\nliam Tue 2\nnoah Mon 2\nmia Wed 4\nzoe Tue 1",
        output: "Mon"
      },
      reviewSignals: ["input parsing", "schedule", "slots", "aggregation", "output"]
    };
  }

  if (roleKind === "finance") {
    if (variantIndex === 1) {
      return {
        title: formatChallengeTitle(topic, "Budget Variance"),
        difficulty,
        prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "budget variance"))} helper. Given department rows in the format "department budget actual", return departments over budget sorted by variance descending.`,
        constraints: [`Use ${limit}`, "Variance is actual - budget", "Ignore departments not over budget", difficulty === "HARD" ? "Explain accrual and forecasting tradeoffs" : "Return department names comma-separated"],
        sample: {
          stdin: "4\nmarketing 1000 1200\nsales 900 850\nops 500 650\nit 700 700",
          output: "marketing,ops"
        },
        reviewSignals: ["input parsing", "budget", "actual", "variance", "output"]
      };
    }
    if (variantIndex === 2) {
      return {
        title: formatChallengeTitle(topic, "Invoice Aging"),
        difficulty,
        prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "invoice aging"))} helper. Given invoice rows in the format "customer daysPastDue amount", return customers whose overdue total exceeds the threshold.`,
        constraints: [`Use ${limit}`, "Only include invoices more than 30 days past due", "Aggregate amount by customer", difficulty === "HARD" ? "Explain credit-risk and collections-priority tradeoffs" : "Preserve first-seen customer order"],
        sample: {
          stdin: "1000\n5\nacme 45 600\nbeta 20 900\nacme 60 500\ncoda 31 1200\nbeta 35 200",
          output: "acme,coda"
        },
        reviewSignals: ["input parsing", "invoice", "overdue", "amount", "output"]
      };
    }
    return {
      title: formatChallengeTitle(topic, "Expense Policy"),
      difficulty,
      prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "expense policy"))} helper. Given expense rows in the format "employee category amount", return employees with policy violations.`,
      constraints: [`Use ${limit}`, "travel limit is 500, meal 100, software 300", "Deduplicate employees", difficulty === "HARD" ? "Explain audit logging and exception approval flow" : "Preserve first violation order"],
      sample: {
        stdin: "5\nava travel 650\nliam meal 80\nava software 200\nnoah software 450\nmia meal 130",
        output: "ava,noah,mia"
      },
      reviewSignals: ["input parsing", "policy", "expense", "limit", "output"]
    };
  }

  if (roleKind === "healthcare") {
    if (variantIndex === 1) {
      return {
        title: formatChallengeTitle(topic, "Patient Triage"),
        difficulty,
        prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "triage"))} helper. Given patient rows in the format "patient severity waitMinutes", return patients sorted by urgency.`,
        constraints: [`Use ${limit}`, "critical beats high, high beats medium, medium beats low", "If severity ties, longer wait comes first", difficulty === "HARD" ? "Explain fairness, auditability, and escalation tradeoffs" : "Return patient names comma-separated"],
        sample: {
          stdin: "4\nava high 20\nliam critical 5\nnoah high 45\nmia medium 90",
          output: "liam,noah,ava,mia"
        },
        reviewSignals: ["input parsing", "patient", "severity", "wait", "output"]
      };
    }
    if (variantIndex === 2) {
      return {
        title: formatChallengeTitle(topic, "Compliance Check"),
        difficulty,
        prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "compliance"))} helper. Given record rows in the format "record consent encrypted reviewed", return records that fail compliance checks.`,
        constraints: [`Use ${limit}`, "All three flags must be yes", "Preserve input order", difficulty === "HARD" ? "Explain privacy, audit trail, and false-positive tradeoffs" : "Return record ids comma-separated"],
        sample: {
          stdin: "4\nr1 yes yes yes\nr2 no yes yes\nr3 yes no yes\nr4 yes yes no",
          output: "r2,r3,r4"
        },
        reviewSignals: ["input parsing", "record", "consent", "compliance", "output"]
      };
    }
    return {
      title: formatChallengeTitle(topic, "Appointment Priority"),
      difficulty,
      prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "appointment priority"))} helper. Given appointment rows in the format "patient urgency availableSlot", return the first patient for the earliest high-priority slot.`,
      constraints: [`Use ${limit}`, "Urgency values are routine, urgent, critical", "critical beats urgent, urgent beats routine", difficulty === "HARD" ? "Explain waitlist and clinical-safety tradeoffs" : "If priority ties, use earlier slot"],
      sample: {
        stdin: "4\nava routine 10\nliam urgent 8\nnoah critical 12\nmia urgent 7",
        output: "noah"
      },
      reviewSignals: ["input parsing", "patient", "urgency", "slot", "output"]
    };
  }

  if (roleKind === "education") {
    if (variantIndex === 1) {
      return {
        title: formatChallengeTitle(topic, "Quiz Mastery"),
        difficulty,
        prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "quiz mastery"))} helper. Given quiz rows in the format "student skill score", return students below the mastery threshold for the requested skill.`,
        constraints: [`Use ${limit}`, "Average multiple attempts per student", "Ignore other skills", difficulty === "HARD" ? "Explain retake and intervention tradeoffs" : "Preserve first-seen student order"],
        sample: {
          stdin: "fractions 80\n5\nava fractions 70\nliam algebra 90\nava fractions 90\nnoah fractions 60\nmia fractions 85",
          output: "noah"
        },
        reviewSignals: ["input parsing", "student", "skill", "score", "output"]
      };
    }
    if (variantIndex === 2) {
      return {
        title: formatChallengeTitle(topic, "Attendance Risk"),
        difficulty,
        prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "attendance risk"))} helper. Given attendance rows in the format "student attended total", return students below the required attendance percentage.`,
        constraints: [`Use ${limit}`, "Use cross multiplication instead of floating point", "Aggregate attendance by student", difficulty === "HARD" ? "Explain early-warning and privacy tradeoffs" : "Return student names comma-separated"],
        sample: {
          stdin: "75\n4\nava 7 10\nliam 8 10\nava 5 10\nnoah 6 8",
          output: "ava"
        },
        reviewSignals: ["input parsing", "student", "attendance", "percentage", "output"]
      };
    }
    return {
      title: formatChallengeTitle(topic, "Learning Path Progress"),
      difficulty,
      prompt: `For a ${targetRole}, build ${withArticle(cleanHelperTopic(topic, "learning path"))} helper. Given module rows in the format "student module completed", return students who completed all required modules.`,
      constraints: [`Use ${limit}`, "Required modules are intro, practice, assessment", "Ignore rows where completed is no", difficulty === "HARD" ? "Explain prerequisite and remediation handling" : "Preserve first-seen student order"],
      sample: {
        stdin: "6\nava intro yes\nava practice yes\nliam intro yes\nava assessment yes\nliam practice no\nnoah intro yes",
        output: "ava"
      },
      reviewSignals: ["input parsing", "student", "module", "completion", "output"]
    };
  }

  if (/(dashboard|filter|chart|auth|role|access|metric)/i.test(normalizedTopic)) {
    if (variantIndex === 1) {
      return {
        title: formatChallengeTitle(topic, "Rules Engine"),
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
        title: formatChallengeTitle(topic, "Access Summary"),
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
      title: formatChallengeTitle(topic, "Metrics"),
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
    cpp: `using namespace std;\n\nstring solve(const string& input) {\n    // ${comment}\n    return "";\n}\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n\n    string input;\n    string line;\n    while (getline(cin, line)) {\n        input += line;\n        input += "\\n";\n    }\n\n    cout << solve(input) << "\\n";\n    return 0;\n}\n`
  };

  return starters[language];
}

function reviewCodeLocally(source: string, challenge: Challenge) {
  const normalized = source.toLowerCase();
  const roleKind = inferRoleKindFromChallenge(challenge);
  const roleSignals = getCodingRoleSignals(roleKind);
  const feedback: string[] = [];
  const starterOnly = /return\s+["']{2};?\s*}/.test(source) || source.trim().length < 180;

  if (starterOnly) {
    feedback.push("Code is still close to the starter template. Implement parsing, role-specific filtering/aggregation, and final output.");
  }

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

  const matchedRoleSignals = roleSignals.terms.filter((term) => normalized.includes(term));
  if (matchedRoleSignals.length) {
    feedback.push(`${roleSignals.label}: code includes ${matchedRoleSignals.slice(0, 3).join(", ")} signals.`);
  } else {
    feedback.push(`${roleSignals.label}: add logic or naming that reflects ${roleSignals.terms.slice(0, 4).join(", ")}.`);
  }

  if (/return\s+|console\.log|print\(|system\.out|cout/.test(source)) {
    feedback.push("Output handling is present for runner-based validation.");
  } else {
    feedback.push("Return or print the final answer exactly as the expected output format requires.");
  }

  if (challenge.difficulty !== "EASY" && !/(edge|invalid|malformed|empty|tie|error)/i.test(source)) {
    feedback.push("For this difficulty, add explicit handling for malformed, empty, or tie cases.");
  }

  return [...feedback, ...detectGenericCodeGaps(source, challenge, roleSignals)].slice(0, 7);
}

function toTitleCase(value: string) {
  const acronyms = new Set(["api", "ui", "roi", "mvp", "rice", "qa", "ci", "cd", "kpi", "ats"]);
  return value
    .trim()
    .split(/\s+/)
    .map((word) => {
      const normalizedWord = word.toLowerCase();
      if (acronyms.has(normalizedWord)) return normalizedWord.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function cleanTitlePrefix(value: string, suffix: string) {
  const normalizedValue = value.trim().replace(/\s+/g, " ");
  if (normalizedValue.toLowerCase().includes(suffix.trim().toLowerCase())) {
    return toTitleCase(normalizedValue);
  }

  const suffixWords = new Set(suffix.toLowerCase().split(/\s+/));
  const noiseWords = new Set(["and", "with", "for"]);
  const words = toTitleCase(normalizedValue)
    .split(/\s+/)
    .filter((word) => !suffixWords.has(word.toLowerCase()));
  const compact = words.filter((word, index) => index === 0 || !noiseWords.has(word.toLowerCase()));
  return compact.join(" ") || suffix;
}

function formatChallengeTitle(topic: string, suffix: string) {
  const normalizedTopic = topic.trim().replace(/\s+/g, " ");
  const normalizedSuffix = suffix.trim().replace(/\s+/g, " ");
  const normalizedTopicLower = normalizedTopic.toLowerCase();
  const normalizedSuffixLower = normalizedSuffix.toLowerCase();
  const suffixWords = normalizedSuffixLower.split(/\s+/);
  const topicWords = normalizedTopicLower.split(/\s+/);
  const overlapCount = suffixWords.filter((word) => topicWords.some((topicWord) => wordsOverlap(topicWord, word))).length;

  if (normalizedTopicLower.includes(normalizedSuffixLower) || overlapCount >= Math.min(2, suffixWords.length)) {
    return toTitleCase(normalizedTopic);
  }
  return `${cleanTitlePrefix(normalizedTopic, normalizedSuffix)} ${normalizedSuffix}`;
}

function cleanHelperTopic(value: string, helperKind: string) {
  const topic = value.trim().replace(/\s+/g, " ");
  const helperWords = helperKind.trim().toLowerCase().split(/\s+/);
  const topicWords = topic.split(/\s+/);
  const topicWordSet = new Set(topicWords.map((word) => word.toLowerCase()));
  const missingHelperWords = helperWords.filter((word) => !topicWordSet.has(word) && !topicWords.some((topicWord) => wordsOverlap(topicWord, word)));
  return formatTopicPhrase([...topicWords, ...missingHelperWords].join(" "));
}

function withArticle(value: string) {
  const firstWord = value.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  const vowelSoundAcronyms = new Set(["api", "mvp", "sre", "ml", "ai", "ats"]);
  const article = /^[aeiou]/i.test(firstWord) || vowelSoundAcronyms.has(firstWord) ? "an" : "a";
  return `${article} ${value}`;
}

function formatTopicPhrase(value: string) {
  const acronyms = new Set(["api", "ui", "roi", "mvp", "rice", "qa", "ci", "cd", "kpi", "ats"]);
  return value
    .split(/\s+/)
    .map((word) => {
      const normalizedWord = word.toLowerCase();
      return acronyms.has(normalizedWord) ? normalizedWord.toUpperCase() : word;
    })
    .join(" ");
}

function getRoleAlignedTopic(roleKind: string, normalizedTopic: string, topic: string, variantIndex: number) {
  const fallbackTopics: Record<string, string[]> = {
    marketing: ["lead scoring", "channel attribution", "campaign ROI"],
    sales: ["account prioritization", "pipeline prioritization", "quota tracking"],
    recruiting: ["interview scheduling", "candidate screening", "hiring funnel"],
    finance: ["expense policy", "budget variance", "invoice aging"],
    healthcare: ["appointment priority", "patient triage", "compliance records"],
    education: ["learning path progress", "quiz mastery", "attendance risk"]
  };
  const roleKeywords: Record<string, RegExp> = {
    marketing: /(campaign|channel|conversion|lead|roi|attribution|funnel|cac|seo|email|social)/,
    sales: /(account|pipeline|quota|rep|stage|deal|forecast|opportunity|territory)/,
    recruiting: /(candidate|screen|interview|schedule|slot|hiring|funnel|talent|stage)/,
    finance: /(budget|variance|invoice|aging|expense|policy|audit|forecast|payroll|amount)/,
    healthcare: /(patient|triage|appointment|urgency|clinical|compliance|consent|record|care)/,
    education: /(student|quiz|mastery|attendance|learning|module|course|skill|training)/
  };

  if (!fallbackTopics[roleKind] || roleKeywords[roleKind]?.test(normalizedTopic)) {
    return topic;
  }

  return fallbackTopics[roleKind][variantIndex] ?? topic;
}

function wordsOverlap(left: string, right: string) {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  const stemA = wordStem(a);
  const stemB = wordStem(b);
  if (a === b) return true;
  if (stemA === stemB && stemA.length >= 4) return true;
  if (a === `${b}ing` || b === `${a}ing`) return true;
  if (a.startsWith(b) && b.length >= 5) return true;
  if (b.startsWith(a) && a.length >= 5) return true;
  if (a.replace(/ization$/, "ity") === b) return true;
  if (b.replace(/ization$/, "ity") === a) return true;
  return false;
}

function wordStem(value: string) {
  return value
    .replace(/prioritization$/, "priority")
    .replace(/scheduling$/, "schedule")
    .replace(/ization$/, "ity")
    .replace(/ing$/, "")
    .replace(/er$/, "")
    .replace(/or$/, "")
    .replace(/ion$/, "")
    .replace(/ity$/, "");
}

function getTopicVariant(roleKind: string, normalizedTopic: string, variant: number) {
  const topicVariantRules: Record<string, Array<[RegExp, number]>> = {
    frontend: [
      [/(validat|form|input|rule|error)/, 1],
      [/(nav|menu|permission|route|access)/, 2],
      [/(state|filter|visible|dashboard|table)/, 0]
    ],
    backend: [
      [/(window|rate|limit|throttle|request)/, 1],
      [/(quota|audit|endpoint)/, 2],
      [/(policy|client|api|aggregation)/, 0]
    ],
    devops: [
      [/(capacity|cpu|scale|autoscal)/, 1],
      [/(rollback|error|deploy|release|failure)/, 2],
      [/(readiness|health|latency|alert)/, 0]
    ],
    data: [
      [/(trend|increase|growth|time|day)/, 1],
      [/(rank|ranking|conversion|rate|segment)/, 2],
      [/(aggregate|aggregation|kpi|metric|total)/, 0]
    ],
    qa: [
      [/(flaky|stability|rerun)/, 1],
      [/(risk|bug|defect|release)/, 2],
      [/(coverage|test|severity|regression)/, 0]
    ],
    product: [
      [/(rice|score|scoring|rank|ranking)/, 1],
      [/(mvp|scope|capacity|effort|release)/, 2],
      [/(feedback|priorit|customer|segment|roadmap)/, 0]
    ],
    marketing: [
      [/(attribution|channel|conversion|cpc|cac)/, 1],
      [/(roi|return|campaign|spend|revenue)/, 2],
      [/(lead|score|qualification|funnel|mql)/, 0]
    ],
    sales: [
      [/(pipeline|forecast|stage|opportunit)/, 1],
      [/(quota|attainment|rep|target)/, 2],
      [/(account|priorit|intent|fit)/, 0]
    ],
    recruiting: [
      [/(screen|candidate|shortlist|eligib)/, 1],
      [/(funnel|drop|stage|conversion)/, 2],
      [/(schedule|slot|interview|availability)/, 0]
    ],
    finance: [
      [/(budget|variance|actual|forecast)/, 1],
      [/(invoice|aging|overdue|collection)/, 2],
      [/(expense|policy|audit|limit)/, 0]
    ],
    healthcare: [
      [/(triage|severity|wait|queue)/, 1],
      [/(compliance|consent|record|privacy)/, 2],
      [/(appointment|patient|urgency|slot)/, 0]
    ],
    education: [
      [/(quiz|mastery|score|skill)/, 1],
      [/(attendance|absence|risk|percentage)/, 2],
      [/(learning|module|path|completion)/, 0]
    ]
  };

  const matchedRule = topicVariantRules[roleKind]?.find(([pattern]) => pattern.test(normalizedTopic));
  return matchedRule?.[1] ?? variant % 3;
}

function getRoleKind(role: string) {
  const normalized = role.toLowerCase();
  if (/(qa|test|quality)/.test(normalized)) return "qa";
  if (/(product manager|program manager|project manager|product owner|pm\b)/.test(normalized)) return "product";
  if (/(marketing|growth|seo|content|campaign|demand generation)/.test(normalized)) return "marketing";
  if (/(sales|account executive|account manager|customer success|revenue)/.test(normalized)) return "sales";
  if (/(recruit|talent|hr|human resources|people operations|people ops)/.test(normalized)) return "recruiting";
  if (/(finance|financial|finops|accounting|accountant|audit|controller|billing|bookkeeper|payroll)/.test(normalized)) return "finance";
  if (/(healthcare|clinical|patient|medical|hospital|care coordinator)/.test(normalized)) return "healthcare";
  if (/(education|teacher|trainer|training|instructional|learning|curriculum)/.test(normalized)) return "education";
  if (/(frontend|front-end|react|ui|web)/.test(normalized)) return "frontend";
  if (/(backend|back-end|api|server|node|java|spring|nestjs)/.test(normalized)) return "backend";
  if (/(devops|sre|cloud|platform|infrastructure)/.test(normalized)) return "devops";
  if (/(data|analytics|machine learning|ml|bi)/.test(normalized)) return "data";
  return "general";
}

function inferRoleKindFromChallenge(challenge: Challenge) {
  const signalText = challenge.reviewSignals.join(" ").toLowerCase();
  if (/(metric|segment|trend|rate|aggregate|aggregation)/.test(signalText)) return "data";
  if (/(severity|flaky|coverage|test|release)/.test(signalText)) return "qa";
  if (/(priority|impact|effort|capacity|mvp|rice)/.test(signalText)) return "product";
  if (/(campaign|channel|conversion|lead|spend|roi)/.test(signalText)) return "marketing";
  if (/(account|quota|pipeline|rep|stage)/.test(signalText)) return "sales";
  if (/(candidate|schedule|slots|hiring|interview)/.test(signalText)) return "recruiting";
  if (/(budget|invoice|expense|policy|variance|overdue)/.test(signalText)) return "finance";
  if (/(patient|urgency|consent|compliance|appointment)/.test(signalText)) return "healthcare";
  if (/(student|skill|attendance|module|completion)/.test(signalText)) return "education";
  if (/(health|latency|deploy|rollback|threshold)/.test(signalText)) return "devops";
  if (/(cache|quota|request|response|service|retry)/.test(signalText)) return "backend";
  if (/(state|visible|label|permission|ui)/.test(signalText)) return "frontend";

  const text = `${challenge.title} ${challenge.prompt}`.toLowerCase();
  if (/(qa|test|quality|automation|coverage|flaky|risk)/.test(text)) return "qa";
  if (/(product manager|prioritization|roadmap|mvp|rice|feature|customer segment)/.test(text)) return "product";
  if (/(marketing|campaign|channel|conversion|lead|roi)/.test(text)) return "marketing";
  if (/(sales|account|quota|pipeline|rep)/.test(text)) return "sales";
  if (/(recruit|candidate|hiring|interview schedule|talent)/.test(text)) return "recruiting";
  if (/(finance|budget|invoice|expense|variance|overdue)/.test(text)) return "finance";
  if (/(healthcare|patient|clinical|appointment|compliance)/.test(text)) return "healthcare";
  if (/(education|student|quiz|attendance|learning path|curriculum)/.test(text)) return "education";
  if (/(data|analytics|analyst|metric|segment|trend)/.test(text)) return "data";
  if (/(devops|sre|cloud|platform|infrastructure|release|deployment)/.test(text)) return "devops";
  if (/(backend|back-end|api|server|node|java|spring|nestjs)/.test(text)) return "backend";
  if (/(frontend|front-end|react|ui|web)/.test(text)) return "frontend";
  return "general";
}

function getCodingRoleSignals(roleKind: string) {
  const signals: Record<string, { label: string; terms: string[] }> = {
    frontend: { label: "Frontend review", terms: ["state", "filter", "visible", "label", "permission", "sort", "order"] },
    backend: { label: "Backend review", terms: ["cache", "limit", "request", "response", "status", "service", "retry"] },
    devops: { label: "Platform review", terms: ["health", "latency", "threshold", "deploy", "version", "rollback", "error"] },
    data: { label: "Data review", terms: ["metric", "segment", "total", "rate", "trend", "aggregate", "sort"] },
    qa: { label: "QA review", terms: ["test", "fail", "pass", "severity", "coverage", "risk", "flaky", "release"] },
    product: { label: "Product review", terms: ["feature", "priority", "impact", "effort", "segment", "roadmap", "capacity"] },
    marketing: { label: "Marketing review", terms: ["campaign", "channel", "conversion", "lead", "score", "revenue", "spend"] },
    sales: { label: "Sales review", terms: ["account", "pipeline", "quota", "rep", "stage", "score", "priority"] },
    recruiting: { label: "Recruiting review", terms: ["candidate", "interview", "schedule", "stage", "score", "status", "slots"] },
    finance: { label: "Finance review", terms: ["budget", "actual", "invoice", "expense", "policy", "variance", "amount"] },
    healthcare: { label: "Healthcare review", terms: ["patient", "severity", "urgency", "consent", "compliance", "slot", "record"] },
    education: { label: "Education review", terms: ["student", "skill", "score", "attendance", "module", "completion", "threshold"] },
    general: { label: "Problem review", terms: ["parse", "map", "set", "count", "filter", "result"] }
  };
  return signals[roleKind] ?? signals.general!;
}

function detectGenericCodeGaps(source: string, challenge: Challenge, roleSignals: { terms: string[] }) {
  const normalized = source.toLowerCase();
  const gaps: string[] = [];
  const starterOnly = /return\s+["']{2};?\s*}/.test(source) || source.trim().length < 180;

  if (starterOnly) {
    gaps.push("Starter template detected: replace the empty return with the actual solution logic.");
  }
  if (!/(if\s*\(|continue|throw|try|catch|Number\.isNaN|isnan|invalid|malformed)/i.test(source)) {
    gaps.push("Add defensive handling for malformed input rows.");
  }
  if (challenge.difficulty !== "EASY" && !/(map|set|object|record|dict|hashmap|unordered_map)/i.test(source)) {
    gaps.push("Use a map/set style structure where it reduces complexity or handles duplicates cleanly.");
  }
  if (roleSignals.terms.filter((term) => normalized.includes(term)).length < 2) {
    gaps.push(`Use clearer domain names from the challenge, such as ${roleSignals.terms.slice(0, 4).join(", ")}.`);
  }

  return gaps.slice(0, 3);
}

function formatDifficulty(value: Difficulty) {
  return value[0] + value.slice(1).toLowerCase();
}

function isUnauthorizedError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.message.includes("401") || error.message.toLowerCase().includes("unauthorized");
}

function formatExecutionResult(result: ExecuteResponse) {
  const stdout = result.stdout?.trim();
  const stderr = result.stderr?.trim();
  const compileOutput = result.compile_output?.trim();

  if (result.status === "completed") {
    if (stdout && stderr) return `${stdout}\n\nWarnings:\n${stderr}`;
    if (stdout) return stdout;
    if (stderr) return `Execution completed with warnings:\n${stderr}`;
  }

  if (stdout) return stdout;
  if (stderr) return `Runtime error:\n${result.stderr}`;
  if (compileOutput) return `Compile error:\n${result.compile_output}`;
  if (result.status) return `Execution finished with status: ${result.status}`;
  return "Execution finished, but no output was returned. Check whether your code prints the final answer.";
}

function executeJavaScriptLocally(sourceCode: string, stdin: string): Promise<ExecuteResponse> {
  if (typeof Worker === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined") {
    return Promise.resolve({ stderr: "Local JavaScript execution is not available in this browser environment." });
  }

  const workerSource = `
    self.onmessage = (event) => {
      const { sourceCode, stdin } = event.data;
      const logs = [];
      const safeConsole = {
        log: (...args) => logs.push(args.map((item) => String(item)).join(" ")),
        error: (...args) => logs.push(args.map((item) => String(item)).join(" "))
      };
      const require = (name) => {
        if (name === "fs") {
          return { readFileSync: () => stdin };
        }
        throw new Error("Only fs.readFileSync(0, 'utf8') is available in local JavaScript runs.");
      };

      try {
        Function("require", "console", sourceCode)(require, safeConsole);
        self.postMessage({ stdout: logs.join("\\n") });
      } catch (error) {
        self.postMessage({ stderr: error instanceof Error ? error.message : String(error) });
      }
    };
  `;

  return new Promise((resolve) => {
    const blobUrl = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
    const worker = new Worker(blobUrl);
    const timeout = window.setTimeout(() => {
      worker.terminate();
      URL.revokeObjectURL(blobUrl);
      resolve({ stderr: "Local JavaScript execution timed out after 2 seconds." });
    }, 2000);

    worker.onmessage = (event: MessageEvent<ExecuteResponse>) => {
      window.clearTimeout(timeout);
      worker.terminate();
      URL.revokeObjectURL(blobUrl);
      resolve(event.data);
    };
    worker.onerror = (event) => {
      window.clearTimeout(timeout);
      worker.terminate();
      URL.revokeObjectURL(blobUrl);
      resolve({ stderr: event.message || "Local JavaScript execution failed." });
    };
    worker.postMessage({ sourceCode, stdin });
  });
}
