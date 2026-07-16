import { create } from "zustand";

type SessionState = {
  accessToken?: string;
  mode: "anonymous" | "demo" | "authenticated";
  setSession: (token?: string, mode?: SessionState["mode"]) => void;
  clearSession: () => void;
};

const storageKey = "develevate-session";

function loadSession() {
  if (typeof window === "undefined") return { accessToken: undefined, mode: "anonymous" as const };
  try {
    const value = window.localStorage.getItem(storageKey);
    if (!value) return { accessToken: undefined, mode: "anonymous" as const };
    const parsed = JSON.parse(value) as Pick<SessionState, "accessToken" | "mode">;
    return parsed.accessToken ? { accessToken: parsed.accessToken, mode: parsed.mode ?? "authenticated" } : { accessToken: undefined, mode: "anonymous" as const };
  } catch {
    return { accessToken: undefined, mode: "anonymous" as const };
  }
}

function persistSession(accessToken: string | undefined, mode: SessionState["mode"]) {
  if (typeof window === "undefined") return;
  if (!accessToken || mode === "anonymous") {
    window.localStorage.removeItem(storageKey);
    return;
  }
  window.localStorage.setItem(storageKey, JSON.stringify({ accessToken, mode }));
}

export const useSession = create<SessionState>((set) => ({
  ...loadSession(),
  setSession: (accessToken, mode = "authenticated") => {
    persistSession(accessToken, accessToken ? mode : "anonymous");
    set({ accessToken, mode: accessToken ? mode : "anonymous" });
  },
  clearSession: () => {
    persistSession(undefined, "anonymous");
    set({ accessToken: undefined, mode: "anonymous" });
  }
}));
