"use client";

import { useTranslations, useLocale } from "use-intl";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  Mail,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldCheck,
  Syringe,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/common/empty-state";

const MAX_BATCH_SIZE = 100;

function canOperateRecalls(role?: string | null): boolean {
  return (
    role === "admin" || role === "veterinarian" || role === "front_desk"
  );
}

function clinicalDate(value: string, locale = "en-US"): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function VaccinationRecallsPage() {
  const t = useTranslations("reminders.recalls");
  const locale = useLocale();
  const { data: session, status: sessionStatus } = useSession();
  const canOperate = canOperateRecalls(session?.user?.role);
  const utils = trpc.useUtils();
  const preview = trpc.notifications.getVaccinationRecallPreview.useQuery(
    undefined,
    { enabled: sessionStatus === "authenticated" && canOperate }
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const eligibleRecipients = useMemo(
    () =>
      preview.data?.recipients.filter(
        (recipient) => recipient.status === "eligible"
      ) ?? [],
    [preview.data]
  );
  const selectedEligibleIds = eligibleRecipients
    .map((recipient) => recipient.patientId)
    .filter((patientId) => selected.has(patientId))
    .slice(0, MAX_BATCH_SIZE);
  const allEligibleSelected =
    eligibleRecipients.length > 0 &&
    eligibleRecipients
      .slice(0, MAX_BATCH_SIZE)
      .every((recipient) => selected.has(recipient.patientId));

  const sendReminders = trpc.notifications.sendVaccinationReminders.useMutation({
    onSuccess: async (result) => {
      setSelected(new Set());
      await utils.notifications.getVaccinationRecallPreview.invalidate();
      const summary = [
        t("summary.sent", { count: result.sent }),
        result.deduped ? t("summary.deduped", { count: result.deduped }) : null,
        result.blocked ? t("summary.blocked", { count: result.blocked }) : null,
        result.failed ? t("summary.failed", { count: result.failed }) : null,
      ]
        .filter(Boolean)
        .join(" · ");
      if (result.failed > 0) toast.error(summary);
      else toast.success(summary);
    },
    onError: (error) => toast.error(error.message),
  });

  const sendPatients = (patientIds: string[]) => {
    if (patientIds.length === 0 || sendReminders.isPending) return;
    const count = patientIds.length;
    if (
      !window.confirm(
        t("confirmSend", { count })
      )
    ) {
      return;
    }
    sendReminders.mutate({ patientIds });
  };

  if (sessionStatus === "loading") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("checkingRecallAccess")}
      </div>
    );
  }

  if (!canOperate) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title={t("vaccinationRecallsAreRestricted")}
        description={t("administratorsVeterinariansAndFrontDesk")}
      />
    );
  }

  if (preview.isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("buildingTheRecallPreview")}
      </div>
    );
  }

  if (preview.error || !preview.data) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title={t("couldNotLoadVaccinationRecalls")}
        description={preview.error?.message ?? t("thePreviewReturnedNoData")}
        action={{ label: t("retry"), onClick: () => preview.refetch() }}
      />
    );
  }

  const data = preview.data;
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold">
            {t("vaccinationRecalls")}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t("reviewOverduePatientsBeforeAnything")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => preview.refetch()}
          disabled={preview.isFetching || sendReminders.isPending}
        >
          <RefreshCw
            className={`h-4 w-4 ${preview.isFetching ? "animate-spin" : ""}`}
          />
          {t("refreshPreview")}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <RecallMetric label={t("overduePatients")} value={data.total} icon={Syringe} />
        <RecallMetric
          label={t("readyToSend")}
          value={data.eligible}
          icon={CheckCircle2}
        />
        <RecallMetric label={t("blocked")} value={data.blocked} icon={AlertTriangle} />
        <RecallMetric
          label={t("alreadyReminded")}
          value={data.alreadySent}
          icon={Clock3}
        />
      </div>

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div>
            <CardTitle>{t("recipientPreview")}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("previewIntro", { max: MAX_BATCH_SIZE })}
            </p>
          </div>
          <Button
            className="gap-2"
            disabled={selectedEligibleIds.length === 0 || sendReminders.isPending}
            onClick={() => sendPatients(selectedEligibleIds)}
          >
            {sendReminders.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {t("sendSelectedCount", { count: selectedEligibleIds.length })}
          </Button>
        </CardHeader>
        <CardContent>
          {data.recipients.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title={t("noOverdueVaccinationRecalls")}
              description={t("activePatientsWithALatest")}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="w-10 py-3 pr-3 font-medium">
                      <Checkbox
                        aria-label={t("selectAllEligibleRecallRecipients")}
                        checked={allEligibleSelected}
                        disabled={eligibleRecipients.length === 0}
                        onChange={(event) => {
                          if (event.target.checked) {
                            setSelected(
                              new Set(
                                eligibleRecipients
                                  .slice(0, MAX_BATCH_SIZE)
                                  .map((recipient) => recipient.patientId)
                              )
                            );
                          } else {
                            setSelected(new Set());
                          }
                        }}
                      />
                    </th>
                    <th className="py-3 pr-4 font-medium">{t("patientClient")}</th>
                    <th className="py-3 pr-4 font-medium">{t("overdueVaccines")}</th>
                    <th className="py-3 pr-4 font-medium">{t("delivery")}</th>
                    <th className="py-3 pr-4 font-medium">{t("eligibility")}</th>
                    <th className="py-3 text-right font-medium">{t("action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recipients.map((recipient) => {
                    const eligible = recipient.status === "eligible";
                    return (
                      <tr
                        key={recipient.patientId}
                        className="border-b border-border align-top last:border-0"
                      >
                        <td className="py-4 pr-3">
                          <Checkbox
                            aria-label={t("selectPatient", { name: recipient.patientName })}
                            checked={eligible && selected.has(recipient.patientId)}
                            disabled={!eligible || sendReminders.isPending}
                            onChange={(event) =>
                              setSelected((current) => {
                                const next = new Set(current);
                                if (event.target.checked) next.add(recipient.patientId);
                                else next.delete(recipient.patientId);
                                return next;
                              })
                            }
                          />
                        </td>
                        <td className="py-4 pr-4">
                          <Link
                            href={`/patients/${recipient.patientId}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {recipient.patientName}
                          </Link>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {recipient.clientName}
                          </p>
                        </td>
                        <td className="py-4 pr-4">
                          <ul className="space-y-1">
                            {recipient.vaccines.map((vaccine) => (
                              <li key={vaccine.recordId}>
                                <span className="font-medium">
                                  {vaccine.vaccineName}
                                </span>{" "}
                                <span className="text-xs text-muted-foreground">
                                  {t("dueOn", {
                                    date: clinicalDate(vaccine.nextDueDate, locale),
                                  })}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className="py-4 pr-4">
                          {recipient.channel === "sms" ? (
                            <Badge variant="info" className="gap-1">
                              <MessageSquare className="h-3 w-3" /> SMS
                            </Badge>
                          ) : recipient.channel === "email" ? (
                            <Badge variant="secondary" className="gap-1">
                              <Mail className="h-3 w-3" /> {t("emailBadge")}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                          {eligible && recipient.blockMessage ? (
                            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                              {recipient.blockMessage}
                            </p>
                          ) : null}
                        </td>
                        <td className="py-4 pr-4">
                          {eligible ? (
                            <Badge variant="success">{t("ready")}</Badge>
                          ) : recipient.status === "already_sent" ? (
                            <div>
                              <Badge variant="outline">{t("alreadyReminded")}</Badge>
                              {recipient.lastSentAt ? (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {new Date(recipient.lastSentAt).toLocaleString(locale)}
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <div className="max-w-xs">
                              <Badge variant="warning">{t("blocked")}</Badge>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {recipient.blockMessage}
                              </p>
                            </div>
                          )}
                        </td>
                        <td className="py-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!eligible || sendReminders.isPending}
                            onClick={() => sendPatients([recipient.patientId])}
                          >
                            {t("send")}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RecallMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
