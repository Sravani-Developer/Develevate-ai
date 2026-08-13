const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type ApiInit = RequestInit & {
  accessToken?: string;
};

export async function api<T>(path: string, init?: ApiInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("content-type") && init?.body && !(init.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }
  if (init?.accessToken) {
    headers.set("authorization", `Bearer ${init.accessToken}`);
  }

  const response = await fetch(`${API_URL}/api${path}`, {
    credentials: "include",
    ...init,
    headers
  });
  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || `Request failed with ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export { API_URL };

export function getFriendlyErrorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  if (!message || normalized === "undefined" || normalized === "null") return fallback;
  if (normalized.includes("failed to fetch") || normalized.includes("networkerror")) {
    return "Service is temporarily unavailable. If you are running locally, start the API server and try again.";
  }
  if (normalized.includes("invalid credentials")) return "Invalid email or password.";
  if (normalized.includes("invalid refresh token")) return "Your session expired. Please sign in again.";
  if (normalized.includes("unauthorized") || normalized.includes("401")) return "Please sign in again to continue.";
  if (normalized.includes("forbidden") || normalized.includes("403")) return "You do not have permission to perform this action.";
  if (normalized.includes("too many requests") || normalized.includes("429")) return "Too many requests. Wait a minute and try again.";
  if (normalized.includes("payload too large") || normalized.includes("413")) return "The uploaded file is too large. Try a smaller file.";
  if (normalized.includes("unsupported") || normalized.includes("resume upload supports")) return message;
  if (normalized.includes("judge0 is not configured")) return "Code execution is in local preview mode. Configure Judge0 to run code remotely.";
  if (message.trim().startsWith("{") || message.includes("\"statusCode\"")) return fallback;

  return message;
}

async function readErrorMessage(response: Response) {
  const text = await response.text();
  if (!text) return "";
  try {
    const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
    const value = extractMessage(parsed.error) ?? extractMessage(parsed.message);
    return value ?? text;
  } catch {
    return text;
  }
}

function extractMessage(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string").join(", ");
  if (value && typeof value === "object" && "message" in value) {
    const message = (value as { message?: unknown }).message;
    return extractMessage(message);
  }
  return undefined;
}
