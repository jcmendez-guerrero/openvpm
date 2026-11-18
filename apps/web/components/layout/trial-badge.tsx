"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { AlertTriangle, Clock, CreditCard, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTranslations } from "use-intl";
import { cn } from "@/lib/utils";
import { trialCalendarDaysLeft } from "@/lib/billing/trial-days";

/**
 * Trial countdown / read-only indicator in the TopBar. Admin-only and hidden on
 * self-host (billing not enforced) or once a paid subscription is active.
 * During the trial the badge opens the single native billing surface where the
 * clinic can compare monthly and annual billing before entering Stripe.
 */
export function TrialBadge() {
  const t = useTranslations("shell.trial");
  const { data: session, status } = useSession();
  const isAdmin = status === "authenticated" && session?.user?.role === "admin";

  const { data, isLoading, error } = trpc.subscription.get.useQuery(undefined, {
    enabled: isAdmin,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  if (!isAdmin) return null;

  if (isLoading) {
    return (
      <span
        aria-label={t("checking")}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t("billing")}
      </span>
    );
  }

  if (error || !data) {
    return (
      <Link
        href="/settings?tab=billing"
        className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        {t("unavailable")}
      </Link>
    );
  }

  if (!data.billingEnforced || data.billingStatus === "active") {
    return null;
  }

  if (data.billingStatus === "past_due") {
    return (
      <Link
        href="/settings?tab=billing"
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100"
      >
        <CreditCard className="h-3.5 w-3.5" />
        {t("pastDue")}
      </Link>
    );
  }

  if (data.billingStatus === "unpaid") {
    return (
      <Link
        href="/settings?tab=billing"
        className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
      >
        <CreditCard className="h-3.5 w-3.5" />
        {t("unpaid")}
      </Link>
    );
  }

  // A Stripe subscription can legitimately remain `trialing` after Checkout
  // while the saved card waits for the free trial to end. Never offer another
  // Checkout in that state; it could create a duplicate subscription.
  if (data.hasSubscription) {
    return (
      <Link
        href="/settings?tab=billing"
        className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800 transition-colors hover:bg-teal-100"
      >
        <CreditCard className="h-3.5 w-3.5" />
        {t("connected")}
      </Link>
    );
  }

  if (data.previewActive && data.previewEndsAt) {
    return (
      <Link
        href="/settings?tab=billing"
        className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800 transition-colors hover:bg-teal-100"
      >
        <Clock className="h-3.5 w-3.5" />
        {t("previewStart", {
          timeLeft: (() => {
            const left = previewTimeLeft(data.previewEndsAt);
            return "hours" in left
              ? t("previewHours", { hours: left.hours })
              : t("previewDays", { days: left.days });
          })(),
        })}
      </Link>
    );
  }

  if (data.billingStatus === "none" && !data.trialEndsAt) {
    return (
      <Link
        href="/settings?tab=billing"
        className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800 transition-colors hover:bg-teal-100"
      >
        <CreditCard className="h-3.5 w-3.5" />
        {t("startTrial")}
      </Link>
    );
  }

  const trialing = data.billingStatus === "trialing" && data.trialEndsAt;
  if (trialing) {
    const days = trialCalendarDaysLeft(data.trialEndsAt, data.timezone) ?? 0;
    const urgent = days <= 3;
    return (
      <Link
        href="/settings?tab=billing"
        aria-label={t("activate")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
          urgent
            ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
            : "border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100",
        )}
      >
        <Clock className="h-3.5 w-3.5" />
        {days === 0 ? t("endsToday") : t("daysLeft", { days })}
        <span className="font-semibold">{t("activateSuffix")}</span>
      </Link>
    );
  }

  // Billing enforced, not trialing, no full access → lapsed / read-only.
  if (!data.hasFullAccess) {
    return (
      <Link
        href="/settings?tab=billing"
        className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
      >
        <Clock className="h-3.5 w-3.5" />
        {t("ended")}
      </Link>
    );
  }

  return null;
}

/** Preview time left: hours on the last day, otherwise days. */
export function previewTimeLeft(
  endsAt: Date | string,
  now: Date = new Date(),
): { hours: number } | { days: number } {
  const msLeft = new Date(endsAt).getTime() - now.getTime();
  const hours = Math.max(1, Math.ceil(msLeft / (60 * 60 * 1000)));
  if (hours < 24) return { hours };
  return { days: Math.ceil(hours / 24) };
}
