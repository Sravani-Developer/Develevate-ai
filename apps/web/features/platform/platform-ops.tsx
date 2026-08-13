"use client";

import { useState } from "react";
import { api, getFriendlyErrorMessage } from "@/lib/api";
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
  const mode = useSession((state) => state.mode);
  const [subscription, setSubscription] = useState<Subscription>();
  const [admin, setAdmin] = useState<AdminOverview>();
  const [adminStatus, setAdminStatus] = useState("Admin-only platform overview endpoint.");
  const [adminStatusTone, setAdminStatusTone] = useState<"info" | "success" | "error">("info");
  const [subscriptionStatus, setSubscriptionStatus] = useState("Free and pro plan boundaries with checkout endpoint.");
  const [subscriptionStatusTone, setSubscriptionStatusTone] = useState<"info" | "success" | "error">("info");
  const [loading, setLoading] = useState<"subscription" | "admin">();

  async function activateSubscription() {
    if (!accessToken || mode !== "authenticated") {
      setSubscription(undefined);
      setSubscriptionStatus("Sign in to activate a subscription.");
      setSubscriptionStatusTone("error");
      return;
    }
    setLoading("subscription");
    setSubscriptionStatus("Activating pro plan...");
    setSubscriptionStatusTone("info");
    try {
      const result = await api<Subscription>("/subscriptions/checkout", {
        accessToken,
        method: "POST",
        body: JSON.stringify({ plan: "pro" })
      });
      setSubscription(result);
      setSubscriptionStatus("Pro plan activated in local/test mode.");
      setSubscriptionStatusTone("success");
    } catch (error) {
      setSubscription(undefined);
      setSubscriptionStatus(getFriendlyErrorMessage(error, "Unable to activate subscription. Try again later."));
      setSubscriptionStatusTone("error");
    } finally {
      setLoading(undefined);
    }
  }

  async function loadAdminOverview() {
    if (!accessToken || mode !== "authenticated") {
      setAdmin(undefined);
      setAdminStatus("Sign in as an ADMIN user to load platform overview.");
      setAdminStatusTone("error");
      return;
    }
    setLoading("admin");
    setAdminStatus("Loading admin overview...");
    setAdminStatusTone("info");
    try {
      const result = await api<AdminOverview>("/admin/overview", { accessToken });
      setAdmin(result);
      setAdminStatus("Admin overview loaded from backend.");
      setAdminStatusTone("success");
    } catch (error) {
      setAdmin(undefined);
      setAdminStatus(getFriendlyErrorMessage(error, "Only ADMIN users can load the platform overview."));
      setAdminStatusTone("error");
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
        <StatusMessage message={adminStatus} tone={adminStatusTone} />
      </Card>
      <Card>
        <p className="font-semibold">Subscription system</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {subscription ? `${subscription.plan} plan is ${subscription.status}.` : "Free and pro plan boundaries with checkout endpoint."}
        </p>
        <Button className="mt-4 w-full" disabled={loading === "subscription"} onClick={activateSubscription}>
          {loading === "subscription" ? "Activating..." : "Activate pro"}
        </Button>
        <StatusMessage message={subscriptionStatus} tone={subscriptionStatusTone} />
      </Card>
      <Card>
        <p className="font-semibold">Enterprise safeguards</p>
        <p className="mt-2 text-sm text-muted-foreground">Rate limiting, Helmet, sanitization, secure cookies, RBAC, logging, and typed config.</p>
        <p className="mt-4 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">Protected routes, RBAC, and subscription calls show inline success/error states.</p>
      </Card>
    </section>
  );
}

function StatusMessage({ message, tone }: { message: string; tone: "info" | "success" | "error" }) {
  return (
    <p
      aria-live="polite"
      className={`mt-3 rounded-md border px-3 py-2 text-sm ${
        tone === "error"
          ? "border-red-300 bg-red-50 text-red-700"
          : tone === "success"
            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
            : "border-border bg-muted text-muted-foreground"
      }`}
      role={tone === "error" ? "alert" : "status"}
    >
      {message}
    </p>
  );
}
