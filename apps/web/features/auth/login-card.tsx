"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Github, LogIn, LogOut, RefreshCcw, UserPlus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { authSchemas, type LoginInput, type RegisterInput } from "@develevate/shared";
import { api } from "@/lib/api";
import { useSession } from "@/store/session";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type AuthResponse = {
  accessToken: string;
};

export function LoginCard() {
  const accessToken = useSession((state) => state.accessToken);
  const mode = useSession((state) => state.mode);
  const setSession = useSession((state) => state.setSession);
  const clearSession = useSession((state) => state.clearSession);
  const [view, setView] = useState<"login" | "register">("login");
  const [status, setStatus] = useState("Use backend auth or start demo mode.");

  const loginForm = useForm<LoginInput>({
    resolver: zodResolver(authSchemas.login),
    defaultValues: { email: "demo@develevate.ai", password: "Password123!" }
  });
  const registerForm = useForm<RegisterInput>({
    resolver: zodResolver(authSchemas.register),
    defaultValues: { name: "Sravani", email: "demo@develevate.ai", password: "Password123!" }
  });

  async function login(values: LoginInput) {
    setStatus("Signing in...");
    try {
      const result = await api<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(values)
      });
      setSession(result.accessToken, "authenticated");
      setStatus("Signed in with backend session.");
    } catch (error) {
      setStatus(error instanceof Error ? `Backend login failed: ${error.message}` : "Backend login failed.");
    }
  }

  async function register(values: RegisterInput) {
    setStatus("Creating account...");
    try {
      const result = await api<AuthResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify(values)
      });
      setSession(result.accessToken, "authenticated");
      setStatus("Account created and signed in.");
    } catch (error) {
      setStatus(error instanceof Error ? `Registration failed: ${error.message}` : "Registration failed.");
    }
  }

  async function refresh() {
    setStatus("Refreshing session...");
    try {
      const result = await api<AuthResponse>("/auth/refresh", { method: "POST" });
      setSession(result.accessToken, "authenticated");
      setStatus("Session refreshed.");
    } catch (error) {
      setStatus(error instanceof Error ? `Refresh failed: ${error.message}` : "Refresh failed.");
    }
  }

  async function logout() {
    if (accessToken && mode === "authenticated") {
      try {
        await api("/auth/logout", { accessToken, method: "POST" });
      } catch {
        // Local logout should still clear a stale browser session.
      }
    }
    clearSession();
    setStatus("Signed out.");
  }

  function startDemoSession() {
    setSession("demo-access-token", "demo");
    setStatus("Demo mode started. API calls fall back to local demo data if the backend is off.");
  }

  const isLoggedIn = Boolean(accessToken);

  return (
    <Card id="auth">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Secure access</h2>
          <p className="text-sm text-muted-foreground">{isLoggedIn ? `${mode === "demo" ? "Demo" : "Backend"} session active.` : "JWT cookies, refresh rotation, OAuth-ready."}</p>
        </div>
        <LogIn className="h-5 w-5 text-primary" />
      </div>

      {!isLoggedIn && (
        <div className="mb-3 grid grid-cols-2 rounded-md border border-border bg-muted p-1">
          {(["login", "register"] as const).map((item) => (
            <button className={`h-8 rounded text-sm ${view === item ? "bg-card font-semibold shadow-panel" : "text-muted-foreground"}`} key={item} onClick={() => setView(item)} type="button">
              {item === "login" ? "Login" : "Register"}
            </button>
          ))}
        </div>
      )}

      {isLoggedIn ? (
        <div className="space-y-3">
          <Button className="w-full" onClick={refresh} type="button">
            <RefreshCcw className="h-4 w-4" />
            Refresh session
          </Button>
          <Button className="w-full bg-muted text-foreground" onClick={logout} type="button">
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      ) : view === "login" ? (
        <form className="space-y-3" onSubmit={loginForm.handleSubmit(login)}>
          <Input placeholder="Email" {...loginForm.register("email")} />
          <Input placeholder="Password" type="password" {...loginForm.register("password")} />
          <Button className="w-full" type="submit">
            <LogIn className="h-4 w-4" />
            Sign in
          </Button>
        </form>
      ) : (
        <form className="space-y-3" onSubmit={registerForm.handleSubmit(register)}>
          <Input placeholder="Name" {...registerForm.register("name")} />
          <Input placeholder="Email" {...registerForm.register("email")} />
          <Input placeholder="Password" type="password" {...registerForm.register("password")} />
          <Button className="w-full" type="submit">
            <UserPlus className="h-4 w-4" />
            Create account
          </Button>
        </form>
      )}

      {!isLoggedIn && (
        <Button className="mt-3 w-full bg-muted text-foreground" onClick={startDemoSession} type="button">
          <Github className="h-4 w-4" />
          Start demo mode
        </Button>
      )}
      <p className="mt-3 text-xs text-muted-foreground">{status}</p>
    </Card>
  );
}
