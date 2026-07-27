import { create } from "zustand";

type SessionState = {
  accessToken?: string;
  mode: "anonymous" | "demo" | "authenticated";
  setSession: (token?: string, mode?: SessionState["mode"]) => void;
  clearSession: () => void;
};

function loadSession() {
  return { accessToken: undefined, mode: "anonymous" as const };
}

function persistSession(accessToken: string | undefined, mode: SessionState["mode"]) {
  void accessToken;
  void mode;
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
