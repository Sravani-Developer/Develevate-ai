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

  function useDemoSubscription(message = "Demo subscription activated locally. Start the API to save billing state.") {
    setSubscription({ plan: "pro", status: "ACTIVE" });
    setStatus(message);
  }

  function useDemoAdmin(message = "Demo admin overview loaded locally. Backend admin access requires an ADMIN account.") {
    setAdmin({ users: 12, interviews: 24, resumes: 8, rooms: 5 });
    setStatus(message);
  }

  async function activateSubscription() {
    if (!accessToken) {
      useDemoSubscription("Demo subscription activated locally. Sign in with a running API to save it.");
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
      useDemoSubscription(error instanceof Error ? `Backend unavailable, using demo subscription. ${error.message}` : "Backend unavailable, using demo subscription.");
    } finally {
      setLoading(undefined);
    }
  }

  async function loadAdminOverview() {
    if (!accessToken) {
      useDemoAdmin("Demo admin overview loaded locally. Sign in as ADMIN with a running API for real data.");
      return;
    }
    setLoading("admin");
    try {
      const result = await api<AdminOverview>("/admin/overview", { accessToken });
      setAdmin(result);
      setStatus("Admin overview loaded from backend.");
    } catch (error) {
      useDemoAdmin(error instanceof Error ? `Backend unavailable or not admin, using demo overview. ${error.message}` : "Backend unavailable, using demo overview.");
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
