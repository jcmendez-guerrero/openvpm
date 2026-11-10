"use client";

import { useState } from "react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import type { useOfflineNoteDraft } from "@/lib/records/use-offline-note-draft";

export function OfflineNoteDraftControls({
  recovery,
  disabled = false,
}: {
  recovery: ReturnType<typeof useOfflineNoteDraft>;
  disabled?: boolean;
}) {
  const t = useTranslations("patients.draft");
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [expanded, setExpanded] = useState(false);
  if (!recovery.enabled) return null;
  const locked = recovery.mode === "locked";
  const ready = recovery.mode === "ready";
  return (
    <div className="space-y-2 rounded-md border border-border p-3 text-sm">
      {ready ? (
        <p role="status">
          {recovery.localStatus === "saved"
            ? t("saved")
            : recovery.localStatus === "saving"
              ? t("saving")
              : recovery.localStatus === "error"
                ? t("error")
                : t("on")}
        </p>
      ) : recovery.mode === "loading" ? (
        <p role="status">{t("checking")}</p>
      ) : recovery.mode === "bypassed" ? (
        <p role="status">
          {t("bypassed")}
        </p>
      ) : recovery.mode !== "unavailable" ? (
        <>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || recovery.busy}
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
          >
            {locked
              ? t("unlock")
              : t("keep")}
          </Button>
          {locked ? (
            <Button
              type="button"
              variant="ghost"
              disabled={disabled || recovery.busy}
              onClick={recovery.startSeparateNote}
            >
              {t("separate")}
            </Button>
          ) : null}
          {expanded ? (
            <div className="space-y-3">
              <p className="text-muted-foreground">
                {t("explainOffline")}
              </p>
              <p className="text-muted-foreground">
                {t("explainSafety")}
              </p>
              <p id="draft-passphrase-help" className="text-muted-foreground">
                {t("passphraseHelp")}
              </p>
              <label className="block font-medium">
                {t("passphrase")}
                <input
                  type="password"
                  autoComplete="off"
                  maxLength={1024}
                  aria-describedby="draft-passphrase-help"
                  value={passphrase}
                  disabled={disabled || recovery.busy}
                  onChange={(event) => setPassphrase(event.target.value)}
                  className="mt-1 block w-full rounded-md border border-input bg-background p-2"
                />
              </label>
              {!locked ? (
                <label className="block font-medium">
                  {t("confirmPassphrase")}
                  <input
                    type="password"
                    autoComplete="off"
                    value={confirmPassphrase}
                    disabled={disabled || recovery.busy}
                    onChange={(event) =>
                      setConfirmPassphrase(event.target.value)
                    }
                    className="mt-1 block w-full rounded-md border border-input bg-background p-2"
                  />
                </label>
              ) : null}
              <Button
                type="button"
                disabled={
                  disabled ||
                  recovery.busy ||
                  passphrase.length < 12 ||
                  (!locked && passphrase !== confirmPassphrase)
                }
                onClick={async () => {
                  const secret = passphrase;
                  setPassphrase("");
                  setConfirmPassphrase("");
                  await recovery.unlock(secret);
                }}
              >
                {recovery.busy
                  ? t("opening")
                  : locked
                    ? t("recover")
                    : t("enable")}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
      {recovery.message ? (
        <p role="alert" className="text-destructive">
          {recovery.message}
        </p>
      ) : null}
    </div>
  );
}
