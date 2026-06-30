import { create } from "zustand";

type SessionState = {
  accessToken?: string;
  setAccessToken: (token?: string) => void;
};

export const useSession = create<SessionState>((set) => ({
  accessToken: undefined,
  setAccessToken: (accessToken) => set({ accessToken })
}));
