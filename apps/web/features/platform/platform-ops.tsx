"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useSession } from "@/store/session";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Subscription = {
  plan: string;
  status: string;
  currentPeriodEnd?: string;
};

type AdminOverview = {
  users: number;
  interviews: number;
  resumes: number;
  rooms: number;
};

export function PlatformOps() {
  const accessToken = useSession((state) => state.accessToken);
  const [subscription, setSubscription] = useState<Subscription>();
  const [admin, setAdmin] = useState<AdminOverview>();
  const [status, setStatus] = useState("Subscription and admin calls are ready after sign-in.");
  const [loading, setLoading] = useState<"subscription" | "admin">();

  async function activateSubscription() {
    if (!accessToken) {
      setStatus("Sign in first to activate a subscription.");
      return;
    }
    setLoading("subscription");
    try {
      const result = await api<Subscription>("/subscriptions/checkout", {
        accessToken,
        method: "POST",
        body: JSON.stringify({ plan: "pro" })
      });
      setSubscription(result);
      setStatus("Subscription endpoint responded successfully.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to activate subscription.");
    } finally {
      setLoading(undefined);
    }
  }

  async function loadAdminOverview() {
    if (!accessToken) {
      setStatus("Sign in as an admin to load platform overview.");
      return;
    }
    setLoading("admin");
    try {
      const result = await api<AdminOverview>("/admin/overview", { accessToken });
      setAdmin(result);
      setStatus("Admin overview loaded from backend.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load admin overview.");
    } finally {
      setLoading(undefined);
    }
  }

  return (
    <section id="admin" className="grid gap-4 lg:grid-cols-3">
      <Card>
        <p className="font-semibold">Admin dashboard</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {admin ? `${admin.users} users, ${admin.interviews} interviews, ${admin.resumes} resumes, ${admin.rooms} rooms.` : "Admin-only platform overview endpoint."}
        </p>
        <Button className="mt-4 w-full" disabled={loading === "admin"} onClick={loadAdminOverview}>
          {loading === "admin" ? "Loading..." : "Load overview"}
        </Button>
      </Card>
      <Card>
        <p className="font-semibold">Subscription system</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {subscription ? `${subscription.plan} plan is ${subscription.status}.` : "Free and pro plan boundaries with checkout endpoint."}
        </p>
        <Button className="mt-4 w-full" disabled={loading === "subscription"} onClick={activateSubscription}>
          {loading === "subscription" ? "Activating..." : "Activate pro"}
        </Button>
      </Card>
      <Card>
        <p className="font-semibold">Enterprise safeguards</p>
        <p className="mt-2 text-sm text-muted-foreground">Rate limiting, Helmet, sanitization, secure cookies, RBAC, logging, and typed config.</p>
        <p className="mt-4 text-xs text-muted-foreground">{status}</p>
      </Card>
    </section>
  );
}
