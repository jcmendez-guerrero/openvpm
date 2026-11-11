"use client";

import { useTranslations } from "use-intl";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, Check, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  MessagingWizard,
  type MessagingSetupLocation,
} from "@/components/settings/messaging-wizard";
import type { StepHandle } from "../journey-types";

/**
 * Optional step: text-enable a phone number so the clinic can send reminders and
 * two-way texts. Reuses the self-contained MessagingWizard (it layers above this
 * overlay), so nothing is lost — Continue always advances (this step is skippable).
 */
export function SetUpTextingStep({
  register,
}: {
  register: (h: StepHandle) => void;
}) {
  const t = useTranslations("onboarding.texting");
  const status = trpc.messaging.getStatus.useQuery(undefined, { retry: false });
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    // Skippable: Continue never blocks.
    register({ onContinue: async () => true });
  }, [register]);

  // Prefer the primary location; fall back to the first one. Map into the exact
  // MessagingSetupLocation shape (getStatus adds a `provider` field the wizard
  // doesn't take).
  const location: MessagingSetupLocation | null = (() => {
    const locs = status.data?.locations ?? [];
    if (locs.length === 0) return null;
    const l = locs.find((loc) => loc.isPrimary) ?? locs[0]!;
    return {
      locationId: l.locationId,
      name: l.name,
      isPrimary: l.isPrimary,
      existingPhone: l.existingPhone,
      messaging: l.messaging
        ? {
            senderE164: l.messaging.senderE164,
            messagingProfileId: l.messaging.messagingProfileId,
            numberSource: l.messaging.numberSource,
            registrationStatus: l.messaging.registrationStatus ?? "not_started",
            registrationDetail: l.messaging.registrationDetail,
            enabled: l.messaging.enabled ?? false,
            launchEligible: l.messaging.launchEligible,
          }
        : null,
    };
  })();

  const messaging = location?.messaging ?? null;
  const hosted = status.data?.launch.hosted ?? false;
  const setupAvailable = status.data?.launch.setupAvailable;
  const setupCapabilityKnown = Boolean(status.data);
  const hasAnyNumber = Boolean(
    status.data?.locations.some(
      (loc) =>
        loc.messaging?.senderE164?.trim() &&
        loc.messaging.registrationStatus !== "failed",
    ),
  );
  const setupDisabled = setupAvailable === false;
  const setupUnavailable = setupAvailable === false && !hasAnyNumber;
  const hasSender = Boolean(
    messaging?.senderE164?.trim() && messaging?.messagingProfileId?.trim(),
  );
  const isFailed = messaging?.registrationStatus === "failed";
  const isConfigured = hasSender && !isFailed;
  const isActive =
    messaging?.registrationStatus === "active" &&
    !!messaging?.enabled &&
    messaging.launchEligible !== false;
  const statusDetail = (() => {
    if (!messaging) return null;
    if (isFailed) {
      return t("detail.failed");
    }
    if (messaging.registrationStatus === "not_started" && hasSender) {
      return t("detail.notSubmitted");
    }
    if (messaging.registrationStatus === "pending") {
      return t("detail.pending");
    }
    if (messaging.registrationStatus === "active" && !messaging.enabled) {
      return t("detail.approvedNotEnabled");
    }
    if (
      messaging.registrationStatus === "active" &&
      messaging.enabled &&
      messaging.launchEligible === false
    ) {
      return hosted
        ? t("carrierRegistrationIsApprovedBut")
        : t("carrierRegistrationIsApprovedBut2");
    }
    if (isActive) return t("detail.active");
    if (messaging.registrationStatus === "action_required") {
      return t("detail.actionRequired");
    }
    if (messaging.registrationStatus === "suspended") {
      return hosted
        ? t("textingIsSuspendedReviewMessaging")
        : t("textingIsSuspendedReviewMessaging2");
    }
    return t("detail.notReady");
  })();

  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-slate-600">
        {!setupCapabilityKnown ? (
          <>
            {t("textingSetupIsOptionalWe")}
          </>
        ) : setupDisabled ? (
          hosted ? (
            <>
              {hasAnyNumber
                ? t("yourClinicHasAnExisting")
                : t("textingSetupIsCurrentlyA")}
              {t("pilot.remindersReview")}{" "}
              <Link
                href="/settings?tab=messaging"
                className="font-medium text-emerald-700 underline underline-offset-2"
              >
                {t("messagingSettings")}
              </Link>{" "}
              {t("pilot.or")}{" "}
              <a
                href="mailto:support@openvpm.com?subject=OpenVPM%20texting%20pilot"
                className="font-medium text-emerald-700 underline underline-offset-2"
              >
                {t("contactOpenvpmSupport")}
              </a>{" "}
              {hasAnyNumber
                ? t("pilot.forExisting")
                : t("pilot.whenReady")}
            </>
          ) : (
            <>
              {t("textingNumberSetupIsDisabled")}
            </>
          )
        ) : (
          <>
            {t("intro")}
          </>
        )}
      </p>

      <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
            <MessageSquare className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            {status.isLoading ? (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("checkingYourTextingSetup")}
              </p>
            ) : status.error ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900">
                  {t("unableToCheckTextingSetup")}
                </p>
                <p className="text-xs text-slate-500">
                  {t("retryThisStepBeforeStarting")}
                </p>
              </div>
            ) : setupUnavailable ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900">
                  {hosted
                    ? t("textingSetupIsInA")
                    : t("textingNumberSetupIsDisabled2")}
                </p>
                <p className="text-xs text-slate-500">
                  {hosted
                    ? t("emailAppointmentRemindersRemainAvailable")
                    : t("emailAppointmentRemindersRemainAvailable2")}
                </p>
              </div>
            ) : setupDisabled && !messaging ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900">
                  {t("newNumberSetupIsUnavailable")}
                </p>
                <p className="text-xs text-slate-500">
                  {t("reviewExisting")}
                </p>
              </div>
            ) : messaging ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900">
                  {messaging.senderE164 ?? t("textingSetupNeedsAttention")}
                </p>
                <p className="text-xs text-slate-500">{statusDetail}</p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900">
                  {t("textingIsNotSetUp")}
                </p>
                <p className="text-xs text-slate-500">
                  {t("setUpNumberFor", { name: location?.name ?? t("yourClinic") })}
                </p>
              </div>
            )}
          </div>
          {!status.isLoading && !status.error && location ? (
            setupAvailable === false || messaging ? (
              <Button asChild type="button" variant="outline" size="sm">
                <Link href="/settings?tab=messaging">
                  {isConfigured ? <Check className="mr-1.5 h-4 w-4" /> : null}
                  {t("messagingSettings")}
                </Link>
              </Button>
            ) : setupAvailable ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => setWizardOpen(true)}
              >
                {t("setUpTexting")}
              </Button>
            ) : null
          ) : null}
        </div>
      </div>

      {setupAvailable ? (
        <MessagingWizard
          location={location}
          hosted={hosted}
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          onChanged={() => void status.refetch()}
        />
      ) : null}
    </div>
  );
}
