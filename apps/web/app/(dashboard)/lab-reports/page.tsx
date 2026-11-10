"use client";

import { useLocale, useTranslations } from "use-intl";

import Link from "next/link";
import { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";
import { LAB_REPORT_MAX_BYTES } from "@/lib/upload-limits";
import { trpc } from "@/lib/trpc";
import { useSpeciesLabel } from "@/lib/patients/use-species-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { LabNavigation } from "@/components/labs/lab-navigation";
import { ArrowLeft, FileText, Upload } from "lucide-react";
import {
  selectManagedUploadFile,
  type ManagedUploadAttempt,
} from "@/lib/managed-upload-attempt";

type Report =
  inferRouterOutputs<AppRouter>["labReports"]["list"]["items"][number];

function UploadReport({
  previous,
  onDone,
  onCancel,
}: {
  previous: Report | null;
  onDone: (reportId: string) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("labs.reports");
  const [attempt, setAttempt] = useState<ManagedUploadAttempt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  async function upload() {
    if (!attempt || inFlight.current) return;
    if (attempt.file.size > LAB_REPORT_MAX_BYTES) {
      setError(
        t("tooLargeHelp"),
      );
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.set("file", attempt.file);
      body.set("category", "lab-results");
      if (previous) body.set("supersedesId", previous.id);
      const response = await fetch("/api/upload", {
        method: "POST",
        body,
        headers: { "Idempotency-Key": attempt.idempotencyKey },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          data?.error ||
            (response.status === 413
              ? t("tooLarge")
              : t("importFailed")),
        );
      if (!data?.reportId)
        throw new Error(
          t("unclear"),
        );
      toast.success(
        data.duplicate
          ? t("duplicate")
          : t("uploaded"),
      );
      setAttempt(null);
      if (fileInput.current) fileInput.current.value = "";
      onDone(data.reportId);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : t("interrupted"),
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <Card id="import-report">
      <CardHeader>
        <CardTitle className="text-lg">
          {previous ? t("uploadRevised") : t("uploadLab")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {t("uploadIntro")}
        </p>
        {previous ? (
          <p className="break-words text-sm">
            {t("revises", { fileName: previous.fileName })}
          </p>
        ) : null}
        <label className="block text-sm font-medium">
          {t("fileLabel")}
          <Input
            ref={fileInput}
            autoFocus
            className="mt-2"
            type="file"
            accept="application/pdf,.pdf"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              setAttempt(file ? selectManagedUploadFile(null, file) : null);
              setError("");
            }}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button onClick={upload} disabled={!attempt || busy}>
            {busy ? t("uploading") : error ? t("retryUpload") : t("uploadPdf")}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {t("cancel")}
          </Button>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ReportCard({
  report,
  canManage,
  canReview,
  revise,
  detailHref,
  expanded,
}: {
  report: Report;
  canManage: boolean;
  canReview: boolean;
  revise: (report: Report) => void;
  detailHref: (id: string) => string;
  expanded: boolean;
}) {
  const t = useTranslations("labs.reports");
  const locale = useLocale();
  const speciesLabel = useSpeciesLabel();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<{ id: string; label: string } | null>(
    null,
  );
  const [checked, setChecked] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [correction, setCorrection] = useState<
    "unmatched" | "dismissed" | null
  >(null);
  const [reason, setReason] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const attempt = useRef<{ payload: string; id: string } | null>(null);
  const people = trpc.patients.search.useQuery(
    { query: search },
    {
      enabled:
        expanded &&
        canManage &&
        report.state === "unmatched" &&
        search.trim().length >= 2,
    },
  );
  const history = trpc.labReports.history.useQuery(
    { id: report.id },
    { enabled: historyOpen },
  );
  const decide = trpc.labReports.decide.useMutation({
    retry: false,
    networkMode: "always",
    onSuccess: async () => {
      setCorrection(null);
      setReviewOpen(false);
      setChecked(false);
      setChosen(null);
      attempt.current = null;
      await Promise.all([
        utils.labReports.list.invalidate(),
        utils.labReports.history.invalidate(),
      ]);
      toast.success(t("updated"));
    },
  });
  function save(
    state: "matched" | "reviewed" | "unmatched" | "dismissed",
    patientId: string | null,
    note = "",
  ) {
    const input = {
      id: report.id,
      expectedVersion: report.version,
      state,
      patientId,
      reason: note,
    };
    const payload = JSON.stringify(input);
    if (attempt.current?.payload !== payload)
      attempt.current = { payload, id: crypto.randomUUID() };
    decide.mutate({ ...input, operationId: attempt.current.id });
  }
  const unavailable = report.storageStatus !== "available";
  return (
    <Card id={`report-${report.id}`}>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="min-w-0 break-all text-base">
            {report.fileName}
          </CardTitle>
          <Badge
            variant={report.state === "reviewed" ? "secondary" : "outline"}
          >
            {t(`states.${report.state}`)}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("imported", { date: new Date(report.receivedAt).toLocaleString(locale) })}
          {report.patientName
            ? ` · ${report.patientName} · ${report.ownerFirstName ?? ""} ${report.ownerLastName ?? ""}`
            : ""}
        </p>
        {report.supersedesId ? (
          <p className="text-sm">
            {t("revised")} ·{" "}
            <Link className="underline" href={detailHref(report.supersedesId)}>
              {t("previousVersion")}
            </Link>
          </p>
        ) : null}
        {report.revisionIds.length ? (
          <p className="text-sm font-medium">
            {t("newerImported")}{" "}
            {report.revisionIds.map((id) => (
              <Link key={id} className="mr-2 underline" href={detailHref(id)}>
                {t("openRevision")}
              </Link>
            ))}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {!expanded ? (
            <Button asChild size="sm">
              <Link href={detailHref(report.id)}>
                {canManage && report.state === "unmatched"
                  ? t("matchPatient")
                  : canReview && report.state === "matched"
                    ? t("reviewReport")
                    : t("viewReport")}
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm">
            <a href={report.fileUrl} target="_blank" rel="noopener noreferrer">
              {t("openPdf")}
            </a>
          </Button>
          {expanded && report.patientId ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/patients/${report.patientId}?tab=records`}>
                {t("patientChart")}
              </Link>
            </Button>
          ) : null}
        </div>
        {unavailable ? (
          <p role="alert" className="text-sm text-destructive">
            {t("storage")}
          </p>
        ) : null}
        {expanded && canManage && report.state === "unmatched" ? (
          <div className="space-y-3 rounded-md border p-3">
            <p className="text-sm">
              {t("checkPatient")}
            </p>
            <FormField
              label={t("find")}
              htmlFor={`patient-search-${report.id}`}
            >
              <Input
                id={`patient-search-${report.id}`}
                className="mt-1"
                value={search}
                maxLength={100}
                placeholder={t("findPlaceholder")}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setChosen(null);
                  setChecked(false);
                }}
              />
            </FormField>
            {people.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {t("searchFailed")}
              </p>
            ) : null}
            {people.isFetching ? <p className="text-sm">{t("searching")}</p> : null}
            {!people.isFetching &&
            search.trim().length >= 2 &&
            people.data?.length === 0 ? (
              <p className="text-sm">{t("noPatients")}</p>
            ) : null}
            {people.data && search.trim().length >= 2 ? (
              <div className="flex flex-col gap-1">
                {people.data.map((patient) => {
                  const label = `${patient.name} · ${speciesLabel(patient.species)} · ${patient.clientFirstName ?? ""} ${patient.clientLastName ?? ""}`;
                  return (
                    <Button
                      key={patient.id}
                      variant={
                        chosen?.id === patient.id ? "secondary" : "ghost"
                      }
                      className="h-auto justify-start whitespace-normal text-left"
                      aria-pressed={chosen?.id === patient.id}
                      onClick={() => {
                        setChosen({ id: patient.id, label });
                        setChecked(false);
                      }}
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>
            ) : null}
            {chosen ? (
              <>
                <p className="text-sm font-medium">{t("selected", { label: chosen.label })}</p>
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox
                    className="mt-0.5 shrink-0"
                    checked={checked}
                    onChange={(e) => setChecked(e.target.checked)}
                  />
                  {t("checked")}
                </label>
              </>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={
                  !chosen || !checked || decide.isPending || unavailable
                }
                onClick={() => save("matched", chosen!.id)}
              >
                {t("confirmMatch")}
              </Button>
            </div>
          </div>
        ) : null}
        {expanded && report.state === "matched" ? (
          <p className="text-sm text-muted-foreground">
            {canReview
              ? t("readyReview")
              : t("needsReviewer")}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {expanded &&
          canReview &&
          report.state === "matched" &&
          !reviewOpen ? (
            <Button
              size="sm"
              disabled={unavailable || decide.isPending}
              onClick={() => setReviewOpen(true)}
            >
              {t("reviewReport")}
            </Button>
          ) : null}
        </div>
        {reviewOpen ? (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm">
              {t("confirmReviewHelp")}
            </p>
            <Button
              size="sm"
              disabled={decide.isPending || unavailable}
              onClick={() => save("reviewed", report.patientId)}
            >
              {t("confirmReview")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setReviewOpen(false)}
            >
              {t("cancel")}
            </Button>
          </div>
        ) : null}
        {expanded ? (
          <details className="border-t pt-3">
            <summary className="cursor-pointer text-sm font-medium">
              {t("more")}
            </summary>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                aria-expanded={historyOpen}
                onClick={() => setHistoryOpen(!historyOpen)}
              >
                {historyOpen ? t("hideHistory") : t("history")}
              </Button>
              {canManage ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revise(report)}
                  >
                    {t("importRevision")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={decide.isPending}
                    onClick={() => {
                      setReason("");
                      setReviewOpen(false);
                      setCorrection(
                        report.state === "unmatched"
                          ? "dismissed"
                          : "unmatched",
                      );
                    }}
                  >
                    {report.state === "unmatched"
                      ? t("dismiss")
                      : report.state === "dismissed"
                        ? t("reopen")
                        : t("correctMatch")}
                  </Button>
                </>
              ) : null}
            </div>
          </details>
        ) : null}
        {correction ? (
          <div className="space-y-2 rounded-md border p-3">
            <label className="block text-sm font-medium">
              {correction === "dismissed"
                ? t("reasonDismiss")
                : report.state === "dismissed"
                  ? t("reasonReopen")
                  : t("reasonCorrect")}
              <Input
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <p className="text-sm text-muted-foreground">
              {t("historyKept")}
              {correction === "unmatched" && report.state !== "dismissed"
                ? ` ${t("clearsMatch")}`
                : ""}
            </p>
            <Button
              size="sm"
              disabled={!reason.trim() || decide.isPending}
              onClick={() => save(correction, null, reason.trim())}
            >
              {correction === "dismissed"
                ? t("dismiss")
                : report.state === "dismissed"
                  ? t("reopen")
                  : t("clearMatch")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCorrection(null)}
            >
              {t("cancel")}
            </Button>
          </div>
        ) : null}
        {decide.error ? (
          <p role="alert" className="text-sm text-destructive">
            {decide.error.message}{" "}
            <button
              className="underline"
              onClick={() => utils.labReports.list.invalidate()}
            >
              {t("refreshReports")}
            </button>
          </p>
        ) : null}
        {historyOpen ? (
          <div className="space-y-2 border-t pt-3">
            <h3 className="text-sm font-medium">{t("history")}</h3>
            {history.isLoading ? (
              <p className="text-sm">{t("loading")}</p>
            ) : history.error ? (
              <p role="alert">{t("historyFailed")}</p>
            ) : history.data?.length ? (
              history.data.map((event) => (
                <p key={event.id} className="break-words text-sm">
                  {t(`states.${event.state}`)} · {event.actorName}
                  {event.patientName ? ` · ${event.patientName}` : ""} ·{" "}
                  {new Date(event.createdAt).toLocaleString(locale)}
                  {event.reason ? ` — ${event.reason}` : ""}
                </p>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("noDecisions")}
              </p>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ReportInbox() {
  const params = useSearchParams();
  const router = useRouter();
  const t = useTranslations("labs.reports");
  const { data: session, status: sessionStatus } = useSession();
  const patientId = params.get("patientId") ?? undefined;
  const reportId = params.get("reportId") ?? undefined;
  const filterParam = params.get("filter");
  const filter =
    filterParam === "all" || filterParam === "unreviewed"
      ? filterParam
      : patientId
        ? "all"
        : "unmatched";
  const parsedOffset = Number(params.get("offset") ?? 0);
  const offset =
    Number.isInteger(parsedOffset) &&
    parsedOffset >= 0 &&
    parsedOffset <= 100000
      ? parsedOffset
      : 0;
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previous, setPrevious] = useState<Report | null>(null);
  const role = session?.user.role;
  const enabled = process.env.NEXT_PUBLIC_LAB_REPORT_INTAKE_ENABLED === "true";
  const canRead =
    !!role && ["admin", "veterinarian", "technician", "viewer"].includes(role);
  const canManage = canRead && role !== "viewer";
  const canReview = role === "admin" || role === "veterinarian";
  const reports = trpc.labReports.list.useQuery(
    {
      filter: reportId ? "all" : filter,
      offset: reportId ? 0 : offset,
      // Keep a selected report visible after correcting its patient match.
      patientId: reportId ? undefined : patientId,
      reportId,
    },
    { enabled: enabled && canRead },
  );
  const patient = trpc.patients.getById.useQuery(
    { id: patientId! },
    { enabled: enabled && canRead && !!patientId },
  );
  const utils = trpc.useUtils();
  function inboxHref(
    options: { reportId?: string; filter?: string; offset?: number } = {},
  ) {
    const query = new URLSearchParams();
    if (patientId) query.set("patientId", patientId);
    query.set("filter", options.filter ?? filter);
    if (options.reportId) query.set("reportId", options.reportId);
    if (options.offset) query.set("offset", String(options.offset));
    return `/lab-reports?${query}`;
  }
  function closeUpload() {
    setUploadOpen(false);
    setPrevious(null);
  }
  if (!enabled)
    return <p>{t("disabled")}</p>;
  if (sessionStatus === "loading")
    return <p role="status">{t("loadingReports")}</p>;
  if (!canRead)
    return <p>{t("noAccess")}</p>;
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("intro")}
          </p>
        </div>
        {canManage && !uploadOpen ? (
          <Button
            onClick={() => {
              setPrevious(null);
              setUploadOpen(true);
            }}
          >
            <Upload
              data-icon="inline-start"
              className="mr-2 size-4"
              aria-hidden="true"
            />
            {t("uploadPdf")}
          </Button>
        ) : null}
      </div>
      <LabNavigation active="reports" />
      {patientId ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <Link
            className="inline-flex items-center gap-2 underline"
            href={`/patients/${patientId}?tab=documents`}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {patient.data
              ? t("patientDocuments", { name: patient.data.name })
              : t("patientDocumentsGeneric")}
          </Link>
          <Link className="underline" href="/lab-reports">
            {t("allReports")}
          </Link>
        </div>
      ) : null}
      {reportId ? (
        <Link
          className="inline-flex items-center gap-2 text-sm underline"
          href={inboxHref({ offset })}
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> {t("back")}
        </Link>
      ) : null}
      {uploadOpen && canManage ? (
        <UploadReport
          key={previous?.id ?? "new"}
          previous={previous}
          onCancel={closeUpload}
          onDone={(id) => {
            closeUpload();
            void utils.labReports.list.invalidate();
            router.push(inboxHref({ reportId: id }));
          }}
        />
      ) : null}
      {!reportId ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <nav className="flex flex-wrap gap-2" aria-label={t("filters")}>
            {(
              (patientId
                ? ["all", "unreviewed"]
                : ["unmatched", "unreviewed", "all"]) as string[]
            ).map((value) => (
              <Button
                key={value}
                asChild
                variant={filter === value ? "secondary" : "ghost"}
                size="sm"
              >
                <Link
                  href={inboxHref({ filter: value })}
                  aria-current={filter === value ? "page" : undefined}
                >
                  {t(`filter.${value}`)}
                </Link>
              </Button>
            ))}
          </nav>
          <Button
            variant="ghost"
            size="sm"
            disabled={reports.isFetching}
            onClick={() => reports.refetch()}
          >
            {reports.isFetching ? t("refreshing") : t("refresh")}
          </Button>
        </div>
      ) : null}
      {reports.isLoading ? (
        <p role="status">{t("loadingList")}</p>
      ) : reports.error ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
          <p>{t("loadFailed")}</p>
          <Button variant="outline" size="sm" onClick={() => reports.refetch()}>
            {t("tryAgain")}
          </Button>
        </div>
      ) : !reports.data?.items.length ? (
        <Card>
          <CardHeader>
            <FileText
              className="mb-2 size-6 text-muted-foreground"
              aria-hidden="true"
            />
            <CardTitle>
              {reportId
                ? t("empty.unavailable")
                : patientId
                  ? t("empty.view")
                  : filter === "unmatched"
                    ? t("empty.unmatched")
                    : filter === "unreviewed"
                      ? t("empty.unreviewed")
                      : t("empty.none")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {reportId
                ? t("emptyHelp.unavailable")
                : patientId
                  ? t("emptyHelp.view")
                  : filter === "unreviewed"
                    ? t("emptyHelp.unreviewed")
                    : t("emptyHelp.none")}
            </p>
          </CardContent>
        </Card>
      ) : (
        reports.data.items.map((report) => (
          <ReportCard
            key={`${report.id}:${report.version}:${!!reportId}`}
            report={report}
            expanded={!!reportId}
            canManage={canManage}
            canReview={canReview}
            detailHref={(id) => inboxHref({ reportId: id, offset })}
            revise={(report) => {
              setPrevious(report);
              setUploadOpen(true);
            }}
          />
        ))
      )}
      {!reportId && (offset > 0 || reports.data?.hasMore) ? (
        <nav className="flex gap-2" aria-label={t("pages")}>
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() =>
              router.push(inboxHref({ offset: Math.max(0, offset - 25) }))
            }
          >
            {t("previous")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!reports.data?.hasMore}
            onClick={() => router.push(inboxHref({ offset: offset + 25 }))}
          >
            {t("next")}
          </Button>
        </nav>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {t("footer")}
      </p>
    </div>
  );
}
function LabReportsRoute() {
  const params = useSearchParams();
  return <ReportInbox key={params.toString()} />;
}

export default function LabReportsPage() {
  const t = useTranslations("labs.reports");
  return (
    <Suspense fallback={<p>{t("loadingReports")}</p>}>
      <LabReportsRoute />
    </Suspense>
  );
}
