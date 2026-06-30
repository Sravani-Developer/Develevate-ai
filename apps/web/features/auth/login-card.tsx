"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Github, LogIn } from "lucide-react";
import { useForm } from "react-hook-form";
import { authSchemas, type LoginInput } from "@develevate/shared";
import { api } from "@/lib/api";
import { useSession } from "@/store/session";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function LoginCard() {
  const setAccessToken = useSession((state) => state.setAccessToken);
  const form = useForm<LoginInput>({
    resolver: zodResolver(authSchemas.login),
    defaultValues: { email: "demo@develevate.ai", password: "Password123!" }
  });

  async function onSubmit(values: LoginInput) {
    const result = await api<{ accessToken: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(values)
    });
    setAccessToken(result.accessToken);
  }

  return (
    <Card id="auth">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Secure access</h2>
          <p className="text-sm text-muted-foreground">JWT cookies, refresh rotation, OAuth-ready.</p>
        </div>
        <LogIn className="h-5 w-5 text-primary" />
      </div>
      <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
        <Input placeholder="Email" {...form.register("email")} />
        <Input placeholder="Password" type="password" {...form.register("password")} />
        <Button className="w-full" type="submit">
          <LogIn className="h-4 w-4" />
          Sign in
        </Button>
        <Button className="w-full bg-muted text-foreground" type="button">
          <Github className="h-4 w-4" />
          Continue with Google
        </Button>
      </form>
    </Card>
  );
}
