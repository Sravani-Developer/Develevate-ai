"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Github, LogIn, LogOut, RefreshCcw, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { authSchemas, type LoginInput, type RegisterInput } from "@develevate/shared";
import { api, getFriendlyErrorMessage } from "@/lib/api";
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
  const [status, setStatus] = useState("Use backend auth or local intelligence mode.");
  const [statusTone, setStatusTone] = useState<"info" | "success" | "error">("info");
  const [restoringSession, setRestoringSession] = useState(true);
  const [formVersion, setFormVersion] = useState(0);

  const loginForm = useForm<LoginInput>({
    resolver: zodResolver(authSchemas.login),
    defaultValues: { email: "", password: "" }
  });
  const registerForm = useForm<RegisterInput>({
    resolver: zodResolver(authSchemas.register),
    defaultValues: { name: "", email: "", password: "" }
  });

  async function login(values: LoginInput) {
    setStatus("Signing in...");
    setStatusTone("info");
    try {
      const result = await api<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(values)
      });
      setSession(result.accessToken, "authenticated");
      setStatus("Signed in with backend session.");
      setStatusTone("success");
    } catch (error) {
      setStatus(getFriendlyErrorMessage(error, "Unable to sign in. Check your details and try again."));
      setStatusTone("error");
    }
  }

  async function register(values: RegisterInput) {
    setStatus("Creating account...");
    setStatusTone("info");
    try {
      const result = await api<AuthResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify(values)
      });
      setSession(result.accessToken, "authenticated");
      setStatus("Account created and signed in.");
      setStatusTone("success");
    } catch (error) {
      setStatus(getFriendlyErrorMessage(error, "Unable to create account. Check the form and try again."));
      setStatusTone("error");
    }
  }

  async function refresh() {
    setStatus("Refreshing session...");
    setStatusTone("info");
    try {
      const result = await api<AuthResponse>("/auth/refresh", { method: "POST" });
      setSession(result.accessToken, "authenticated");
      setStatus("Session refreshed.");
      setStatusTone("success");
    } catch (error) {
      setStatus(getFriendlyErrorMessage(error, "Unable to refresh your session. Please sign in again."));
      setStatusTone("error");
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
    loginForm.reset({ email: "", password: "" });
    registerForm.reset({ name: "", email: "", password: "" });
    setView("login");
    setFormVersion((version) => version + 1);
    setStatus("Signed out.");
    setStatusTone("success");
  }

  function startDemoSession() {
    setSession("demo-access-token", "demo");
    setStatus("Local intelligence mode started. Core workflows run without paid API keys.");
    setStatusTone("success");
  }

  const isLoggedIn = Boolean(accessToken);

  useEffect(() => {
    if (accessToken || mode !== "anonymous") {
      setRestoringSession(false);
      return;
    }

    let cancelled = false;
    async function restoreSession() {
      setRestoringSession(true);
      setStatus("Restoring session...");
      setStatusTone("info");
      try {
        const result = await api<AuthResponse>("/auth/refresh", { method: "POST" });
        if (cancelled) return;
        setSession(result.accessToken, "authenticated");
        setStatus("Backend session restored.");
        setStatusTone("success");
      } catch {
        if (cancelled) return;
        setStatus("Register a new account or sign in with your credentials.");
        setStatusTone("info");
      } finally {
        if (!cancelled) setRestoringSession(false);
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, [accessToken, mode, setSession]);

  return (
    <Card id="auth">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Secure access</h2>
          <p className="text-sm text-muted-foreground">{isLoggedIn ? `${mode === "demo" ? "Local intelligence" : "Backend"} session active.` : "Register a new account or sign in with your credentials."}</p>
        </div>
        <LogIn className="h-5 w-5 text-primary" />
      </div>

      {!isLoggedIn && !restoringSession && (
        <div className="mb-3 grid grid-cols-2 rounded-md border border-border bg-muted p-1">
          {(["login", "register"] as const).map((item) => (
            <button className={`h-8 rounded text-sm ${view === item ? "bg-card font-semibold shadow-panel" : "text-muted-foreground"}`} key={item} onClick={() => setView(item)} type="button">
              {item === "login" ? "Login" : "Register"}
            </button>
          ))}
        </div>
      )}

      {restoringSession ? (
        <div className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
          Restoring your backend session...
        </div>
      ) : isLoggedIn ? (
        <div className="space-y-3">
          <div className="rounded-md border border-border bg-primary/10 p-3 text-sm">
            {mode === "demo" ? "Local intelligence mode is active. You can test the app without paid API keys." : "Backend session is active. You can switch to local mode for no-cost testing."}
          </div>
          {mode !== "demo" && (
            <Button className="w-full bg-muted text-foreground" onClick={startDemoSession} type="button">
              <Github className="h-4 w-4" />
              Switch to local mode
            </Button>
          )}
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
        <form autoComplete="off" className="space-y-3" key={`login-${formVersion}`} onSubmit={loginForm.handleSubmit(login)}>
          <div>
            <Input aria-invalid={!!loginForm.formState.errors.email} autoComplete="username" placeholder="Email" {...loginForm.register("email")} />
            {loginForm.formState.errors.email && <p className="mt-1 text-xs text-warning">Enter a valid email address.</p>}
          </div>
          <div>
            <Input aria-invalid={!!loginForm.formState.errors.password} autoComplete="current-password" placeholder="Password" type="password" {...loginForm.register("password")} />
            {loginForm.formState.errors.password && <p className="mt-1 text-xs text-warning">Password is required.</p>}
          </div>
          <Button className="w-full" type="submit">
            <LogIn className="h-4 w-4" />
            Sign in
          </Button>
        </form>
      ) : (
        <form autoComplete="off" className="space-y-3" key={`register-${formVersion}`} onSubmit={registerForm.handleSubmit(register)}>
          <div>
            <Input aria-invalid={!!registerForm.formState.errors.name} autoComplete="name" placeholder="Name" {...registerForm.register("name")} />
            {registerForm.formState.errors.name && <p className="mt-1 text-xs text-warning">Name must be at least 2 characters.</p>}
          </div>
          <div>
            <Input aria-invalid={!!registerForm.formState.errors.email} autoComplete="email" placeholder="Email" {...registerForm.register("email")} />
            {registerForm.formState.errors.email && <p className="mt-1 text-xs text-warning">Enter a valid email address.</p>}
          </div>
          <div>
            <Input aria-invalid={!!registerForm.formState.errors.password} autoComplete="new-password" placeholder="Password" type="password" {...registerForm.register("password")} />
            {registerForm.formState.errors.password && <p className="mt-1 text-xs text-warning">Use at least 10 characters.</p>}
          </div>
          <Button className="w-full" type="submit">
            <UserPlus className="h-4 w-4" />
            Create account
          </Button>
        </form>
      )}

      {!isLoggedIn && !restoringSession && (
        <Button className="mt-3 w-full bg-muted text-foreground" onClick={startDemoSession} type="button">
          <Github className="h-4 w-4" />
          Start local mode
        </Button>
      )}
      <p
        aria-live="polite"
        className={`mt-3 rounded-md border px-3 py-2 text-sm ${
          statusTone === "error"
            ? "border-red-300 bg-red-50 text-red-700"
            : statusTone === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
              : "border-border bg-muted text-muted-foreground"
        }`}
        role={statusTone === "error" ? "alert" : "status"}
      >
        {status}
      </p>
    </Card>
  );
}
