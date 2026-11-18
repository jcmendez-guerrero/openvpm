"use client";

import { useTranslations } from "use-intl";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type State = "ready" | "saving" | "saved" | "error";

export function EmailPreferenceForm({ token }: { token: string }) {
  const t = useTranslations("emailPreferences");
  const [state, setState] = useState<State>(token ? "ready" : "error");
  const [error, setError] = useState(
    token ? "" : t("thisEmailPreferenceLinkIs"),
  );

  async function unsubscribe() {
    setState("saving");
    setError("");
    try {
      const response = await fetch(
        `/api/email-preferences/unsubscribe?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: "List-Unsubscribe=One-Click",
        },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? t("weCouldNotSaveThat"));
      }
      setState("saved");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("weCouldNotSaveThat2"),
      );
      setState("error");
    }
  }

  if (state === "saved") {
    return (
      <div
        className="mt-6 flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"
        role="status"
      >
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="text-sm font-medium">{t("preferenceSaved")}</p>
          <p className="mt-1 text-xs leading-5">
            {t("optionalOpenvpmEmailsAreNow")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      <Button
        type="button"
        onClick={unsubscribe}
        disabled={!token || state === "saving"}
        className="w-full"
      >
        {state === "saving" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : null}
        {t("turnOff")}
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          {t("immediateNoSignInRequired")}
        </p>
      )}
    </div>
  );
}
