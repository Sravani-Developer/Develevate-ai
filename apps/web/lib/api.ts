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
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}
