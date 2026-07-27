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
