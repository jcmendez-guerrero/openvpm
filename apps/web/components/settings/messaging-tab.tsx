"use client";

import { useLocale, useTranslations } from "use-intl";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Loader2,
  MessageSquare,
  Phone,
  Send,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  MessagingWizard,
  type MessagingSetupLocation,
} from "@/components/settings/messaging-wizard";
import {
  isMessagingPhoneInputValid,
  MESSAGING_PHONE_MAX_LENGTH,
} from "@/lib/messaging/policy";
import { toast } from "sonner";
import { MessagingRegistrationForm } from "@/components/settings/messaging-registration-form";

const REGISTRATION_BADGE: Record<
  NonNullable<MessagingSetupLocation["messaging"]>["registrationStatus"],
  "success" | "warning" | "destructive" | "secondary"
> = {
  // Labels are catalog keys: settings.messaging.status.<status>.
  not_started: "secondary",
  pending: "warning",
  active: "success",
  action_required: "warning",
  failed: "destructive",
  suspended: "destructive",
};

const EMPTY_MESSAGING_LOCATIONS: MessagingSetupLocation[] = [];
const APPOINTMENT_REMINDER_LEAD_OPTIONS = [24, 48, 72] as const;

function confirmReminderCatchUp(
  action: "enable" | "expand",
  leadHours: (typeof APPOINTMENT_REMINDER_LEAD_OPTIONS)[number],
  t: (key: string, values?: Record<string, number>) => string,
) {
  return window.confirm(
    action === "enable"
      ? t("catchUpEnable")
      : t("catchUpExpand", { hours: leadHours }),
  );
}

function hasConfiguredSender(
  messaging: NonNullable<MessagingSetupLocation["messaging"]>,
) {
  return Boolean(
    messaging.senderE164?.trim() || messaging.messagingProfileId?.trim(),
  );
}

export function MessagingTab() {
  const t = useTranslations("settings.messaging");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const { data, isLoading, error, refetch } =
    trpc.messaging.getStatus.useQuery();
  const utils = trpc.useUtils();
  const updateReminderSettings =
    trpc.messaging.setAppointmentReminderSettings.useMutation({
      onSuccess: async (_result, variables) => {
        await utils.messaging.getStatus.invalidate();
        toast.success(
          variables.enabled
            ? t("appointmentRemindersEnabled")
            : t("appointmentRemindersTurnedOff"),
        );
      },
      onError: (mutationError) => toast.error(mutationError.message),
    });
  const [wizardLocation, setWizardLocation] =
    useState<MessagingSetupLocation | null>(null);
  const openedSetupParam = useRef(false);

  const statusLocations = data?.locations as
    | MessagingSetupLocation[]
    | undefined;
  const setupLocations = statusLocations ?? EMPTY_MESSAGING_LOCATIONS;

  useEffect(() => {
    if (openedSetupParam.current) return;
    if (searchParams.get("setup") !== "texting") return;
    if (!data?.launch.setupAvailable) return;
    const loc = setupLocations.find((l) => !l.messaging) ?? setupLocations[0];
    if (!loc) return;
    openedSetupParam.current = true;
    setWizardLocation(loc);
  }, [data?.launch.setupAvailable, setupLocations, searchParams]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <MessagingLoadError
        message={error.message}
        onRetry={() => void refetch()}
      />
    );
  }

  if (!data) {
    return (
      <MessagingLoadError
        message={t("statusUnavailable")}
        onRetry={() => void refetch()}
      />
    );
  }

  const locations = data.locations as MessagingSetupLocation[];
  const usage = data.usage;
  const consent = data.consent;
  const reminderSettings = data.appointmentReminders;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <MessageSquare className="h-5 w-5" /> {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("intro")}
        </p>
      </div>

      {data.launch.hosted && !data.launch.setupAvailable ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">{t("textingIsAControlledClinic")}</p>
          <p className="mt-1">
            {t("numberSetupIsNotEnabled")}
          </p>
        </div>
      ) : data.launch.hosted && !data.launch.pilotEnabled ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">{t("outboundTextingIsSafelyOff")}</p>
          <p className="mt-1">
            {t("yourClinicCanContinueSetup")}
          </p>
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-medium">{t("automaticAppointmentReminders")}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t("remindersIntro")}
            </p>
          </div>
          <Checkbox
            aria-label={t("enableAutomaticAppointmentReminders")}
            checked={reminderSettings.enabled}
            disabled={updateReminderSettings.isPending}
            onChange={(event) => {
              const enabled = event.target.checked;
              if (
                enabled &&
                !confirmReminderCatchUp(
                  "enable",
                  reminderSettings.leadHours as 24 | 48 | 72,
                  t,
                )
              ) {
                return;
              }
              updateReminderSettings.mutate({
                enabled,
                leadHours: reminderSettings.leadHours as 24 | 48 | 72,
              });
            }}
          />
        </div>

        <label className="mt-4 block max-w-xs space-y-1.5 text-sm">
          <span className="font-medium">{t("sendApproximately")}</span>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            value={reminderSettings.leadHours}
            disabled={updateReminderSettings.isPending}
            onChange={(event) => {
              const leadHours = Number(event.target.value) as 24 | 48 | 72;
              if (
                reminderSettings.enabled &&
                leadHours > reminderSettings.leadHours &&
                !confirmReminderCatchUp("expand", leadHours, t)
              ) {
                return;
              }
              updateReminderSettings.mutate({
                enabled: reminderSettings.enabled,
                leadHours,
              });
            }}
          >
            {APPOINTMENT_REMINDER_LEAD_OPTIONS.map((hours) => (
              <option key={hours} value={hours}>
                {hours} hours before the appointment
              </option>
            ))}
          </select>
        </label>

        <p className="mt-3 text-xs text-muted-foreground">
          {reminderSettings.enabled
            ? t("automaticRemindersAreOn")
            : t("offByDefaultNoAutomatic")}
          {t("catchUpNote")}
        </p>
      </div>

      {/* Usage + consent summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryStat
          label={t("smsThisMonth")}
          value={
            usage
              ? usage.includedSms != null
                ? `${usage.smsUsed} / ${usage.includedSms.toLocaleString(locale)}`
                : String(usage.smsUsed)
              : "—"
          }
          hint={usage?.includedSms != null ? t("included") : undefined}
        />
        <SummaryStat
          label={t("clientsOptedIn")}
          value={String(consent?.optedIn ?? 0)}
        />
        <SummaryStat
          label={t("doNotTextNumbers")}
          value={String(consent?.suppressed ?? 0)}
        />
      </div>

      {/* Per-location setup */}
      <div className="space-y-4">
        {locations.map((loc) => (
          <LocationCard
            key={loc.locationId}
            loc={loc}
            hosted={data.launch.hosted}
            setupAvailable={data.launch.setupAvailable}
            testSendAllowed={data.launch.testSendAllowed}
            onStartSetup={() => setWizardLocation(loc)}
          />
        ))}
        {locations.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            {t("addALocationInPractice")}
          </p>
        )}
      </div>

      {data.launch.setupAvailable ||
      locations.some((location) => location.messaging) ? (
        <MessagingRegistrationForm />
      ) : null}

      {data.launch.setupAvailable ? (
        <MessagingWizard
          location={wizardLocation}
          hosted={data.launch.hosted}
          open={Boolean(wizardLocation)}
          onOpenChange={(open) => {
            if (!open) setWizardLocation(null);
          }}
          onChanged={() => utils.messaging.getStatus.invalidate()}
        />
      ) : null}
    </div>
  );
}

function MessagingLoadError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const t = useTranslations("settings.messaging");
  return (
    <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">{t("unableToLoadMessagingSettings")}</p>
          <p className="mt-1">{message}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="mt-3"
          >
            {t("retry")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">
        {value}
        {hint && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            {hint}
          </span>
        )}
      </p>
    </div>
  );
}

function LocationCard({
  loc,
  hosted,
  setupAvailable,
  testSendAllowed,
  onStartSetup,
}: {
  loc: MessagingSetupLocation;
  hosted: boolean;
  setupAvailable: boolean;
  testSendAllowed: boolean;
  onStartSetup: () => void;
}) {
  const t = useTranslations("settings.messaging");
  const utils = trpc.useUtils();
  const refresh = () => utils.messaging.getStatus.invalidate();

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-medium">{loc.name}</span>
          {loc.isPrimary && <Badge variant="secondary">{t("primary")}</Badge>}
        </div>
        {loc.messaging && (
          <Badge
            variant={
              REGISTRATION_BADGE[loc.messaging.registrationStatus]
            }
          >
            {t(`status.${loc.messaging.registrationStatus}`)}
          </Badge>
        )}
      </div>

      {loc.messaging ? (
        <ConfiguredLocation
          loc={loc}
          hosted={hosted}
          setupAvailable={setupAvailable}
          testSendAllowed={testSendAllowed}
          onChanged={refresh}
        />
      ) : (
        <UnconfiguredLocation
          loc={loc}
          hosted={hosted}
          setupAvailable={setupAvailable}
          onStartSetup={onStartSetup}
        />
      )}
    </div>
  );
}

function ConfiguredLocation({
  loc,
  hosted,
  setupAvailable,
  testSendAllowed,
  onChanged,
}: {
  loc: MessagingSetupLocation;
  hosted: boolean;
  setupAvailable: boolean;
  testSendAllowed: boolean;
  onChanged: () => void;
}) {
  const t = useTranslations("settings.messaging");
  const m = loc.messaging!;
  const [testTo, setTestTo] = useState("");
  const senderLabel =
    m.senderE164?.trim() || m.messagingProfileId?.trim() || "—";
  const canEnableSending =
    m.registrationStatus === "active" &&
    hasConfiguredSender(m) &&
    m.launchEligible !== false &&
    m.providerProfileAttestationFresh !== false;
  const waitingForProviderVerification =
    m.registrationStatus === "active" &&
    hasConfiguredSender(m) &&
    m.launchEligible !== false &&
    m.providerProfileAttestationFresh === false;
  const canSendTest =
    testSendAllowed &&
    m.enabled &&
    canEnableSending &&
    isMessagingPhoneInputValid(testTo);

  const setEnabled = trpc.messaging.setEnabled.useMutation({
    onSuccess: () => onChanged(),
    onError: (e) => toast.error(e.message),
  });
  const testSend = trpc.messaging.testSend.useMutation({
    onSuccess: () => toast.success(t("testMessageSent")),
    onError: (e) => toast.error(e.message),
  });
  const reconcileSetup = trpc.messaging.provisionNumber.useMutation({
    onSuccess: () => {
      toast.success(
        t("providerSetupReconciledNoAdditional"),
      );
      onChanged();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Phone className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{senderLabel}</span>
        {m.numberSource && (
          <Badge variant="outline">
            {m.numberSource === "hosted"
              ? t("yourExistingNumber")
              : m.numberSource === "purchased"
                ? t("newLocalNumber")
                : t("tollFree")}
          </Badge>
        )}
      </div>

      {m.registrationDetail && m.registrationStatus !== "active" && (
        <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          {m.registrationDetail}
        </p>
      )}

      {waitingForProviderVerification ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
          <p className="font-medium">{t("providerSafetyCheckRequired")}</p>
          <p className="mt-1">
            {t("safetyCheckBody")}
          </p>
        </div>
      ) : null}

      {m.registrationStatus === "failed" && !m.enabled && setupAvailable ? (
        <Button
          variant="outline"
          disabled={reconcileSetup.isPending}
          onClick={() =>
            reconcileSetup.mutate({
              locationId: loc.locationId,
              mode: "buy",
              action: "resume",
            })
          }
        >
          {reconcileSetup.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {t("reconcile")}
        </Button>
      ) : m.registrationStatus === "failed" && !m.enabled ? (
        <p className="text-xs text-muted-foreground">
          {hosted
            ? t("openvpmSupportMustReviewThis")
            : t("yourOpenvpmAdministratorMustEnable")}
        </p>
      ) : null}

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={m.enabled}
          disabled={setEnabled.isPending || (!m.enabled && !canEnableSending)}
          onChange={(e) =>
            setEnabled.mutate({
              locationId: loc.locationId,
              enabled: e.target.checked,
            })
          }
        />
        {t("sendingEnabled")}
      </label>

      {testSendAllowed ? (
        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {t("sendATestMessageTo")}
            </span>
            <Input
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              maxLength={MESSAGING_PHONE_MAX_LENGTH}
              placeholder="+1 555 555 0123"
              className="w-48"
            />
          </label>
          <Button
            variant="outline"
            disabled={!canSendTest || testSend.isPending}
            onClick={() =>
              testSend.mutate({
                locationId: loc.locationId,
                to: testTo.trim(),
                requestId: crypto.randomUUID(),
              })
            }
          >
            {testSend.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {t("sendTest")}
          </Button>
        </div>
      ) : (
        <p className="border-t border-border pt-4 text-xs text-muted-foreground">
          {t("arbitraryTestDestinationsAreDisabled")}
        </p>
      )}
    </div>
  );
}

function UnconfiguredLocation({
  loc,
  hosted,
  setupAvailable,
  onStartSetup,
}: {
  loc: MessagingSetupLocation;
  hosted: boolean;
  setupAvailable: boolean;
  onStartSetup: () => void;
}) {
  const t = useTranslations("settings.messaging");
  return (
    <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/20 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium">{t("textingIsNotSetUp")}</p>
          <p className="text-sm text-muted-foreground">
            {setupAvailable
              ? t("startAGuidedSetupAnd")
              : hosted
                ? t("openvpmWillEnableNumberSetup")
                : t("numberSetupIsDisabledBy")}
          </p>
          {loc.existingPhone ? (
            <p className="text-xs text-muted-foreground">
              Existing phone on file: {loc.existingPhone}
            </p>
          ) : null}
        </div>
        {setupAvailable ? (
          <Button onClick={onStartSetup} className="shrink-0">
            {t("setUpTexting")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
