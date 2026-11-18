"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "use-intl";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes-guard";
import { formatClinicalDateTime } from "@/lib/records/clinical-dates";
import { useOnlineStatus } from "@/lib/use-online-status";
import { useOfflineNoteDraft } from "@/lib/records/use-offline-note-draft";
import type { NoteDraftScope } from "@/lib/records/offline-note-draft";
import { OfflineNoteDraftControls } from "./offline-note-draft-controls";
import {
  PATIENT_NOTE_MAX_LENGTH,
  PATIENT_NOTE_TYPES,
} from "@/lib/records/patient-note-policy";

export function PatientNotes({
  patientId,
  timeZone,
  canWrite,
  draftScope = null,
}: {
  patientId: string;
  timeZone: string | null;
  canWrite: boolean;
  draftScope?: NoteDraftScope | null;
}) {
  const t = useTranslations("patients.notes");
  const locale = useLocale();
  const recovery = useOfflineNoteDraft(canWrite ? draftScope : null);
  const { content, noteType, operationId } = recovery.draft;
  const isOnline = useOnlineStatus();
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const utils = trpc.useUtils();
  const notes = trpc.patientNotes.list.useInfiniteQuery(
    { patientId },
    { getNextPageParam: (page) => page.nextCursor },
  );
  // Do not leave a paused mutation holding the editor or replay it silently.
  // Browser connectivity is only a hint; server failures still preserve the draft.
  const create = trpc.patientNotes.create.useMutation({
    networkMode: "always",
    retry: false,
  });
  useUnsavedChangesGuard(
    Boolean(content) || saving,
    t("leaveWarning"),
  );
  const tooLong = content.trim().length > PATIENT_NOTE_MAX_LENGTH;
  const editorLocked =
    saving ||
    Boolean(operationId) ||
    recovery.busy ||
    recovery.mode === "locked" ||
    recovery.mode === "loading";

  async function save() {
    const text = content.trim();
    if (
      !text ||
      tooLong ||
      savingRef.current ||
      !isOnline ||
      !canWrite ||
      recovery.mode === "locked" ||
      recovery.mode === "loading"
    )
      return;
    savingRef.current = true;
    setSaving(true);
    try {
      const pending = await recovery.beginSave();
      await create.mutateAsync({
        patientId,
        ...pending,
      });
      await recovery.acknowledgeSave();
      toast.success(t("saved"));
      await Promise.all([
        notes.refetch(),
        utils.records.searchPatientHistory.invalidate({ patientId }),
      ]);
    } catch {
      /* Mutation error is shown next to the preserved draft. */
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <section
      id="patient-notes"
      className="mt-6 space-y-4 rounded-lg border border-border bg-card p-4"
      aria-labelledby="patient-notes-heading"
    >
      <div>
        <h3 id="patient-notes-heading" className="font-heading font-semibold">
          {t("title")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("intro")}
        </p>
      </div>
      {canWrite ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          className="space-y-3"
        >
          <OfflineNoteDraftControls
            recovery={recovery}
            disabled={saving || Boolean(operationId)}
          />
          {!isOnline ? (
            <p role="status" className="text-sm text-muted-foreground">
              {t("offline")}
            </p>
          ) : null}
          <label className="block text-sm font-medium">
            {t("noteType")}
            <select
              value={noteType}
              onChange={(event) =>
                recovery.update({
                  noteType: event.target.value as typeof noteType,
                })
              }
              disabled={editorLocked}
              className="mt-1 block h-10 rounded-md border border-input bg-background px-3"
            >
              {PATIENT_NOTE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`types.${type}`)}
                </option>
              ))}
            </select>
          </label>
          <label
            className="block text-sm font-medium"
            htmlFor="patient-note-content"
          >
            {t("note")}
          </label>
          <textarea
            id="patient-note-content"
            value={content}
            onChange={(event) =>
              recovery.update({ content: event.target.value })
            }
            readOnly={editorLocked}
            rows={6}
            placeholder={t("placeholder")}
            className="block w-full rounded-md border border-input bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-describedby="patient-note-help"
          />
          <p id="patient-note-help" className="text-xs text-muted-foreground">
            {t("help")}
          </p>
          {tooLong ? (
            <p role="alert" className="text-sm text-destructive">
              {t("tooLong", { max: PATIENT_NOTE_MAX_LENGTH.toLocaleString(locale) })}
            </p>
          ) : null}
          {create.error ? (
            <p role="alert" className="text-sm text-destructive">
              {t("saveFailed", { message: create.error.message })}
            </p>
          ) : null}
          {operationId && !saving ? (
            <p role="status" className="text-sm text-muted-foreground">
              {t("unconfirmed")}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={
              !content.trim() ||
              tooLong ||
              saving ||
              !isOnline ||
              recovery.busy ||
              recovery.mode === "locked" ||
              recovery.mode === "loading"
            }
          >
            {saving
              ? t("saving")
              : operationId
                ? t("retry")
                : t("save")}
          </Button>
        </form>
      ) : null}
      {notes.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : notes.error ? (
        <div role="alert">
          <p className="text-sm text-destructive">
            {t("loadFailed", { message: notes.error.message })}
          </p>
          <Button variant="outline" onClick={() => void notes.refetch()}>
            {t("retryLoad")}
          </Button>
        </div>
      ) : !notes.data?.pages[0]?.items.length ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        notes.data.pages
          .flatMap((page) => page.items)
          .map((note) => (
            <article
              key={note.id}
              className="space-y-2 border-t border-border pt-4"
            >
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <strong>{t(`types.${note.noteType}`)}</strong>
                <span className="text-muted-foreground">
                  {note.authorName ?? t("unknownAuthor")} ·{" "}
                  {formatClinicalDateTime(note.createdAt, timeZone, undefined, locale)}
                </span>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm">
                {note.content}
              </p>
            </article>
          ))
      )}
      {notes.hasNextPage ? (
        <Button
          variant="outline"
          disabled={notes.isFetchingNextPage}
          onClick={() => void notes.fetchNextPage()}
        >
          {notes.isFetchingNextPage ? t("loadingMore") : t("loadOlder")}
        </Button>
      ) : null}
    </section>
  );
}
