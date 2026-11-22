import { FieldApp } from "./field-app";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { IntlProvider, useTranslations } from "use-intl";
import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import superjson from "superjson";
import { z } from "zod";
import type { AppRouter } from "../server/routers/_app";
import { Button } from "../components/ui/button";
import { SoapNoteEditor } from "../components/SoapNoteEditor";
import { soapSectionText } from "../lib/records/soap-content";
import { useOnlineStatus } from "../lib/use-online-status";
import {
  addPreparedChart,
  beginSoapSync,
  chartHasChanges,
  completeSoapSync,
  hasWorkspaceChanges,
  offlineAccessValid,
  openWorkspace,
  sameIdentity,
  SOAP_FIELDS,
  workspaceExists,
  type OfflineChart,
  type OfflineWorkspace,
  type WorkspaceIdentity,
} from "../lib/offline/workspace";
import type {
  EncryptedDeviceVault,
  EncryptedVaultRecovery,
} from "../lib/offline/encrypted-vault";
import { prepareOfflineShell } from "./prepare-shell";
import { OFFLINE_MESSAGES } from "./messages.generated";
import { DEFAULT_LANGUAGE, languageCookieFromHeader, type Language } from "../i18n/config";

const api = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      methodOverride: "POST",
      fetch: (url, init) =>
        fetch(url, { ...init, cache: "no-store", credentials: "same-origin" }),
    }),
  ],
});
type OfflineT = ReturnType<typeof useTranslations<"offline">>;
// The release flag is fixed at build time; while it is off the shell stays English.
function shellLanguage(): Language {
  if (process.env.LANGUAGE_SELECTION_ENABLED?.trim() !== "true") return DEFAULT_LANGUAGE;
  return languageCookieFromHeader(document.cookie) ?? DEFAULT_LANGUAGE;
}
const inputClass =
  "mt-1 block w-full rounded-md border border-input bg-background p-3";
function errorText(error: unknown, t: OfflineT) {
  if (authFailure(error))
    return t("errors.signIn");
  if (error instanceof TRPCClientError && !error.data)
    return t("errors.unreachable");
  if (error instanceof z.ZodError)
    return t("errors.tooLong");
  return error instanceof Error
    ? error.message
    : t("errors.generic");
}
function authFailure(error: unknown) {
  return (
    error instanceof TRPCClientError &&
    ["UNAUTHORIZED", "FORBIDDEN"].includes(error.data?.code)
  );
}
function selectedTarget() {
  const params = new URLSearchParams(location.hash.slice(1));
  const patientId = params.get("patientId"),
    appointmentId = params.get("appointmentId");
  return patientId &&
    z.string().uuid().safeParse(patientId).success &&
    (!appointmentId || z.string().uuid().safeParse(appointmentId).success)
    ? { patientId, ...(appointmentId ? { appointmentId } : {}) }
    : null;
}

function OfflineApp() {
  const t = useTranslations("offline");
  const labels = {
    subjective: t("labels.subjective"),
    objective: t("labels.objective"),
    assessment: t("labels.assessment"),
    plan: t("labels.plan"),
  };
  const online = useOnlineStatus();
  const [target, setTarget] = useState(selectedTarget);
  const [exists, setExists] = useState<boolean | null>(null);
  const [workspace, setWorkspace] = useState<OfflineWorkspace | null>(null);
  const current = useRef<OfflineWorkspace | null>(null);
  const vault = useRef<EncryptedDeviceVault<OfflineWorkspace> | null>(null);
  const recovery = useRef<EncryptedVaultRecovery | null>(null);
  const [recoveryWarning, setRecoveryWarning] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const version = useRef(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [disk, setDisk] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [shellReady, setShellReady] = useState(false);
  const chart = workspace?.charts.find((item) => item.key === selected) ?? null;

  useEffect(() => {
    const changed = () => setTarget(selectedTarget());
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);

  useEffect(() => {
    void workspaceExists()
      .then(setExists)
      .catch((error) => {
        setMessage(errorText(error, t));
        setExists(false);
      });
  }, []);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (
        recovery.current ||
        (current.current && (hasWorkspaceChanges(current.current) || busyRef.current))
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, []);
  // Recheck account changes without sending clinical content or replaying writes.
  useEffect(() => {
    if (!workspace) return;
    let active = true;
    const check = async () => {
      const value = current.current;
      if (!value || busyRef.current) return;
      if (!offlineAccessValid(value.identity)) {
        await lock(true);
        if (active)
          setMessage(t("errors.renew"));
        return;
      }
      if (!navigator.onLine) return;
      try {
        const identity = await api.offline.session.query();
        if (
          active &&
          current.current &&
          !sameIdentity(current.current.identity, identity)
        ) {
          await lock(true);
          setMessage(t("errors.accountChanged"));
        }
      } catch (error) {
        if (active && authFailure(error)) {
          await lock(true);
          setMessage(t("errors.signInAgain"));
        }
      }
    };
    const interval = setInterval(() => void check(), 60_000);
    const visible = () => {
      if (document.visibilityState === "visible") void check();
    };
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [Boolean(workspace)]);

  function show(next: OfflineWorkspace) {
    current.current = next;
    setWorkspace(next);
  }
  async function persist(value: OfflineWorkspace) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!vault.current) throw new Error(t("errors.unlockFirst"));
    const write = ++version.current;
    setDisk("saving");
    try {
      await vault.current.save(value);
      if (write === version.current) setDisk("saved");
    } catch (error) {
      setDisk("error");
      throw error;
    }
  }
  async function commit(next: OfflineWorkspace) {
    await persist(next);
    show(next);
  }
  async function lock(force = false) {
    try {
      if (current.current) await persist(current.current);
    } catch (error) {
      if (!force) throw error;
      if (vault.current && current.current) {
        try {
          recovery.current = await vault.current.sealForRecovery(current.current);
          setRecoveryWarning("The newest changes are encrypted only in this open tab. Keep this tab open, restore device storage, then unlock as the workspace owner to recover them.");
        } catch {
          setRecoveryWarning("The newest changes could not be secured. Only the last successfully saved device copy can be recovered. Keep SOAP sections within the stated size limit.");
        }
      }
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    vault.current = null;
    current.current = null;
    setWorkspace(null);
    setPassphrase("");
    setConfirmation("");
    setSelected(null);
    setExists(true);
  }
  async function action(work: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage(null);
    setNotice(null);
    try {
      await work();
    } catch (error) {
      setMessage(errorText(error, t));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function verifiedIdentity(): Promise<WorkspaceIdentity> {
    let identity: WorkspaceIdentity;
    try {
      identity = await api.offline.session.query();
    } catch (error) {
      if (authFailure(error)) await lock(true);
      throw error;
    }
    if (current.current && !sameIdentity(current.current.identity, identity)) {
      await lock(true);
      throw new Error(t("errors.wrongPerson"));
    }
    return identity;
  }
  async function unlock() {
    const secret = passphrase;
    setPassphrase("");
    setConfirmation("");
    const opened = await openWorkspace(
      secret,
      undefined,
      recovery.current ?? undefined,
    );
    let identity: WorkspaceIdentity | null = null;
    try {
      identity = await api.offline.session.query();
    } catch (error) {
      if (
        authFailure(error) ||
        !opened.value ||
        !offlineAccessValid(opened.value.identity)
      )
        throw new Error(t("errors.connectToOpen"));
    }
    if (
      opened.value &&
      identity &&
      !sameIdentity(opened.value.identity, identity)
    )
      throw new Error(t("errors.wrongPerson"));
    if (!opened.value && (!identity || !identity.enabled))
      throw new Error(t("errors.notEnabled"));
    const value = opened.value
      ? { ...opened.value, identity: identity ?? opened.value.identity }
      : { version: 1 as const, identity: identity!, charts: [] };
    vault.current = opened.vault;
    try {
      await commit(value);
    } catch (error) {
      vault.current = null;
      throw error;
    }
    recovery.current = null;
    setRecoveryWarning(null);
    setExists(true);
    setSelected(value.charts[0]?.key ?? null);
    setNotice(t("notice.unlocked"));
  }
  async function prepare(patientId: string, appointmentId?: string) {
    const identity = await verifiedIdentity();
    await prepareOfflineShell(t);
    setShellReady(true);
    const result = await api.offline.prepareChart.query({
      patientId,
      appointmentId,
    });
    if (!sameIdentity(identity, result.identity) || !current.current)
      throw new Error(t("errors.accountSwitched"));
    const next = addPreparedChart(
      current.current,
      result.chart,
      result.identity,
    );
    await commit(next);
    setSelected(next.charts.at(-1)!.key);
    setNotice(t("notice.prepared"));
  }
  function edit(field: (typeof SOAP_FIELDS)[number], html: string) {
    const value = current.current;
    const item = value?.charts.find((entry) => entry.key === selected);
    if (
      !value ||
      !item ||
      !item.snapshot.visit ||
      item.pending ||
      item.conflict ||
      busyRef.current
    )
      return;
    const next = {
      ...value,
      charts: value.charts.map((entry) =>
        entry.key === selected
          ? { ...entry, sections: { ...entry.sections, [field]: html } }
          : entry,
      ),
    };
    version.current++;
    show(next);
    setDisk("saving");
    setMessage(null);
    setNotice(null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void persist(next).catch((error) => setMessage(errorText(error, t)));
    }, 300);
  }
  async function sync() {
    const identity = await verifiedIdentity();
    const value = current.current;
    const item = value?.charts.find((entry) => entry.key === selected);
    if (!value || !item) return;
    const pending = beginSoapSync(item);
    const prepared = {
      ...value,
      identity,
      charts: value.charts.map((entry) =>
        entry.key === item.key ? pending : entry,
      ),
    };
    // Commit the immutable request before sending it, including the revision.
    await commit(prepared);
    const result = await api.offline.saveSoapDraft.mutate({
      userId: identity.userId,
      practiceId: identity.practiceId,
      request: pending.pending!,
    });
    const completed = completeSoapSync(pending, result);
    await commit({
      ...prepared,
      charts: prepared.charts.map((entry) =>
        entry.key === item.key ? completed : entry,
      ),
    });
    setNotice(
      result.outcome === "saved"
        ? t("notice.draftSaved")
        : t("notice.serverChanged"),
    );
  }
  async function removeChart(item: OfflineChart) {
    if (!current.current || chartHasChanges(item))
      throw new Error(t("errors.saveBeforeRemove"));
    if (
      !window.confirm(t("confirm.remove"))
    )
      return;
    const next = {
      ...current.current,
      charts: current.current.charts.filter((entry) => entry.key !== item.key),
    };
    await commit(next);
    setSelected(next.charts[0]?.key ?? null);
  }
  async function copyLocal(item: OfflineChart) {
    await navigator.clipboard.writeText(
      SOAP_FIELDS.map(
        (field) => `${labels[field]}\n${soapSectionText(item.sections[field])}`,
      ).join("\n\n"),
    );
    setNotice(t("notice.copied"));
  }
  async function resolveConflict(item: OfflineChart) {
    if (!current.current || !item.conflict) return;
    await verifiedIdentity();
    if (
      !window.confirm(t("confirm.resolve"))
    )
      return;
    const next = {
      ...current.current!,
      charts: current.current!.charts.filter((entry) => entry.key !== item.key),
    };
    await commit(next);
    setSelected(next.charts[0]?.key ?? null);
  }

  return (
    <div className="min-h-screen bg-muted/30 text-foreground">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <a href="/" className="font-heading text-lg font-semibold">
              OpenVPM
            </a>
            <p className="text-sm text-muted-foreground">{t("header.workspace")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span role="status" className="text-sm">
              {online ? t("header.connected") : t("header.offline")}
            </span>
            <a className="text-sm underline" href="/login">
              {t("header.signIn")}
            </a>
            {workspace ? (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void action(() => lock())}
              >
                {t("header.lock")}
              </Button>
            ) : null}
          </div>
        </div>
      </header>
      <main
        id="main-content"
        className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6"
      >
        {recoveryWarning ? (
          <p role="alert" className="rounded-lg border border-amber-500 bg-background p-4 text-sm">
            {recoveryWarning}
          </p>
        ) : null}
        {message ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-background p-4 text-sm text-destructive"
          >
            {message}
          </div>
        ) : null}
        {notice ? (
          <p
            role="status"
            className="rounded-lg border bg-background p-4 text-sm"
          >
            {notice}
          </p>
        ) : null}
        {!workspace ? (
          <section className="mx-auto max-w-xl rounded-xl border bg-background p-6">
            <h1 className="font-heading text-2xl font-semibold">
              {exists
                ? t("unlock.titleExisting")
                : t("unlock.titleNew")}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {t("unlock.intro")}
            </p>
            <form
              className="mt-6 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void action(unlock);
              }}
            >
              <label className="block text-sm font-medium">
                {t("unlock.passphrase")}
                <input
                  className={inputClass}
                  type="password"
                  autoComplete="off"
                  maxLength={1024}
                  value={passphrase}
                  disabled={busy}
                  onChange={(event) => setPassphrase(event.target.value)}
                />
              </label>
              {!exists ? (
                <label className="block text-sm font-medium">
                  {t("unlock.confirm")}
                  <input
                    className={inputClass}
                    type="password"
                    autoComplete="off"
                    maxLength={1024}
                    value={confirmation}
                    disabled={busy}
                    onChange={(event) => setConfirmation(event.target.value)}
                  />
                </label>
              ) : null}
              <p className="text-sm text-muted-foreground">
                {t("unlock.rules")}
              </p>
              <Button
                type="submit"
                disabled={
                  busy ||
                  exists === null ||
                  passphrase.length < 12 ||
                  (!exists && passphrase !== confirmation)
                }
              >
                {busy
                  ? t("unlock.opening")
                  : exists
                    ? t("unlock.unlock")
                    : t("unlock.create")}
              </Button>
            </form>
          </section>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="font-heading text-2xl font-semibold">
                  {workspace.identity.practiceName}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {t("workspace.preparedBy", {
                    name: workspace.identity.userName,
                    until: new Date(workspace.identity.expiresAt).toLocaleString(),
                  })}
                </p>
              </div>
              <p role="status" className="text-sm">
                {disk === "saving"
                  ? t("disk.saving")
                  : disk === "saved"
                    ? t("disk.saved")
                    : disk === "error"
                      ? t("disk.error")
                      : t("disk.idle")}
              </p>
            </div>
            {target ? (
              <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-4">
                <div>
                  <h2 className="font-semibold">
                    {target.appointmentId ? t("target.visit") : t("target.chart")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t("target.hint")}
                  </p>
                </div>
                <Button
                  disabled={busy || !online || !workspace.identity.enabled}
                  onClick={() =>
                    void action(() =>
                      prepare(target.patientId, target.appointmentId),
                    )
                  }
                >
                  {busy ? t("target.working") : t("target.prepare")}
                </Button>
              </section>
            ) : null}
            {!shellReady && workspace.charts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("empty.howToAdd")}
              </p>
            ) : null}
            <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
              <nav aria-label={t("list.label")} className="space-y-2">
                <h2 className="mb-3 font-semibold">
                  {t("list.title", { count: workspace.charts.length })}
                </h2>
                {workspace.charts.map((item) => (
                  <button
                    key={item.key}
                    disabled={busy}
                    aria-current={selected === item.key ? "page" : undefined}
                    onClick={() => {
                      setSelected(item.key);
                      setNotice(null);
                    }}
                    className={`block w-full rounded-lg border p-3 text-left ${selected === item.key ? "border-primary bg-primary/10" : "bg-background"}`}
                  >
                    <span className="block font-medium">
                      {item.snapshot.patient.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {item.snapshot.visit
                        ? t("list.visit", {
                            date: new Date(item.snapshot.visit.startTime).toLocaleDateString(),
                          })
                        : t("list.summary")}
                      {chartHasChanges(item) ? ` · ${t("list.localNote")}` : ""}
                    </span>
                  </button>
                ))}
              </nav>
              {chart ? (
                <article className="min-w-0 space-y-4">
                  <section className="rounded-xl border bg-background p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="font-heading text-xl font-semibold">
                          {chart.snapshot.patient.name}
                        </h2>
                        <p className="text-sm">
                          {[
                            chart.snapshot.patient.species,
                            chart.snapshot.patient.breed,
                            chart.snapshot.patient.sex,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {chart.snapshot.patient.dob ? (
                          <p className="text-sm">
                            {t("chart.born", { dob: chart.snapshot.patient.dob })}
                          </p>
                        ) : null}
                      </div>
                      <a
                        className="text-sm underline"
                        href={`/patients/${chart.snapshot.patient.id}`}
                      >
                        {t("chart.openLive")}
                      </a>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {t("chart.snapshot", {
                        date: new Date(chart.snapshot.capturedAt).toLocaleString(),
                      })}
                    </p>
                    <h3 className="mt-4 font-semibold">{t("chart.allergies")}</h3>
                    {chart.snapshot.allergies.length ? (
                      <ul className="mt-2 space-y-2">
                        {chart.snapshot.allergies.map((allergy, i) => (
                          <li
                            key={i}
                            className="rounded-md border border-destructive/30 p-3"
                          >
                            <strong>{allergy.allergen}</strong> ·{" "}
                            {allergy.severity}
                            {allergy.reaction ? (
                              <p className="text-sm">{allergy.reaction}</p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t("chart.noAllergies")}
                      </p>
                    )}
                  </section>
                  {chart.snapshot.visit ? (
                    <section className="space-y-4 rounded-xl border bg-background p-5">
                      <h2 className="font-heading text-lg font-semibold">
                        {t("visit.title")}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {t("visit.intro")}
                      </p>
                      {chart.pending && !chart.conflict ? (
                        <p
                          role="status"
                          className="rounded-md border p-3 text-sm"
                        >
                          {t("visit.pending")}
                        </p>
                      ) : null}
                      {SOAP_FIELDS.map((field) => (
                        <section
                          key={`${chart.key}:${field}`}
                          aria-label={labels[field]}
                        >
                          <h3 className="mb-2 font-medium">{labels[field]}</h3>
                          <SoapNoteEditor
                            value={chart.sections[field]}
                            onChange={(html) => edit(field, html)}
                            ariaLabel={labels[field]}
                            editable={
                              !busy && !chart.pending && !chart.conflict
                            }
                          />
                        </section>
                      ))}
                      {chart.conflict ? (
                        <div
                          role="alert"
                          className="space-y-3 rounded-lg border border-amber-500 p-4"
                        >
                          <h3 className="font-semibold">
                            {chart.conflict.kind === "already_finalized"
                              ? t("visit.signedOnline")
                              : t("visit.newerDraft")}
                          </h3>
                          <p className="text-sm">
                            {t("visit.conflictHelp")}
                          </p>
                          <details>
                            <summary className="cursor-pointer font-medium">
                              {t("visit.showServer")}
                            </summary>
                            {SOAP_FIELDS.map((field) => (
                              <div key={field} className="mt-3">
                                <strong>{labels[field]}</strong>
                                <p className="whitespace-pre-wrap break-words text-sm">
                                  {soapSectionText(
                                    chart.conflict!.sections[field],
                                  ) || "—"}
                                </p>
                              </div>
                            ))}
                          </details>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              disabled={busy}
                              onClick={() =>
                                void action(() => copyLocal(chart))
                              }
                            >
                              {t("visit.copyLocal")}
                            </Button>
                            <Button
                              variant="outline"
                              disabled={busy || !online}
                              onClick={() =>
                                void action(() => resolveConflict(chart))
                              }
                            >
                              {t("visit.removeResolved")}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          disabled={
                            busy ||
                            !online ||
                            Boolean(chart.conflict) ||
                            disk === "error" ||
                            !chartHasChanges(chart)
                          }
                          onClick={() => void action(sync)}
                        >
                          {busy
                            ? t("visit.saving")
                            : chart.conflict
                              ? t("visit.reviewConflict")
                              : chart.pending
                                ? t("visit.retry")
                                : t("visit.save")}
                        </Button>
                        <a
                          className="text-sm underline"
                          href={`/records/new-soap/${chart.snapshot.patient.id}?appointmentId=${chart.snapshot.visit.appointmentId}`}
                        >
                          {t("visit.reviewOnline")}
                        </a>
                      </div>
                    </section>
                  ) : (
                    <p className="rounded-lg border bg-background p-4 text-sm">
                      {t("visit.howToStart")}
                    </p>
                  )}
                  <section className="rounded-xl border bg-background p-5">
                    <h2 className="mb-3 font-heading text-lg font-semibold">
                      {t("notes.title")}
                    </h2>
                    {chart.snapshot.notes.length ? (
                      chart.snapshot.notes.map((note, i) => (
                        <div
                          key={i}
                          className="mb-4 border-b pb-4 last:mb-0 last:border-0"
                        >
                          <p className="text-xs text-muted-foreground">
                            {note.type.replaceAll("_", " ")} ·{" "}
                            {new Date(note.at).toLocaleString()}
                          </p>
                          <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                            {note.content}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t("notes.empty")}
                      </p>
                    )}
                  </section>
                  <section className="rounded-xl border bg-background p-5">
                    <h2 className="mb-3 font-heading text-lg font-semibold">
                      {t("soapHistory.title")}
                    </h2>
                    {chart.snapshot.soapHistory.map((note, i) => (
                      <details key={i} className="mb-3">
                        <summary className="cursor-pointer text-sm">
                          {new Date(note.at).toLocaleString()} · {note.author}
                        </summary>
                        {SOAP_FIELDS.map((field) => (
                          <div key={field} className="mt-3">
                            <strong className="text-sm">{labels[field]}</strong>
                            <p className="whitespace-pre-wrap break-words text-sm">
                              {soapSectionText(note.sections[field]) || "—"}
                            </p>
                          </div>
                        ))}
                      </details>
                    ))}
                    {!chart.snapshot.soapHistory.length ? (
                      <p className="text-sm text-muted-foreground">
                        {t("soapHistory.empty")}
                      </p>
                    ) : null}
                  </section>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      disabled={
                        busy ||
                        !online ||
                        chartHasChanges(chart) ||
                        !workspace.identity.enabled
                      }
                      onClick={() =>
                        void action(() =>
                          prepare(
                            chart.snapshot.patient.id,
                            chart.snapshot.visit?.appointmentId,
                          ),
                        )
                      }
                    >
                      {t("actions.refresh")}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy || chartHasChanges(chart)}
                      onClick={() => void action(() => removeChart(chart))}
                    >
                      {t("actions.remove")}
                    </Button>
                  </div>
                </article>
              ) : (
                <section className="rounded-xl border bg-background p-6">
                  <h2 className="font-semibold">
                    {t("none.title")}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t("none.body")}
                  </p>
                </section>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

const language = shellLanguage();
document.documentElement.lang = language;
createRoot(document.getElementById("offline-root")!).render(
  <IntlProvider locale={language} messages={OFFLINE_MESSAGES[language]}>
    {location.pathname === "/offline/field.html" ? <FieldApp /> : <OfflineApp />}
  </IntlProvider>,
);
