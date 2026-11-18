"use client";

import * as React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/components/common/report-client-error";
import type { ClientErrorSource } from "@/lib/client-error-report";
import { useTranslations } from "use-intl";

type ErrorCopy = { title: string; body: string; retry: string };
type ErrorViewProps = {
  error: Error & { digest?: string };
  reset: () => void;
  source: ClientErrorSource;
};

/** global-error renders outside the root layout and its language provider. */
const ENGLISH_COPY: ErrorCopy = {
  title: "Something went wrong",
  body: "We logged the error. Try again, or return to the dashboard if it keeps happening.",
  retry: "Try Again",
};

export function AppErrorView(props: ErrorViewProps) {
  const t = useTranslations("errorPages.app");
  return <AppErrorBody {...props} copy={{ title: t("title"), body: t("body"), retry: t("retry") }} />;
}

export function AppErrorBody({
  error,
  reset,
  source,
  copy = ENGLISH_COPY,
}: ErrorViewProps & { copy?: ErrorCopy }) {
  React.useEffect(() => {
    reportClientError(source, error);
  }, [error, source]);

  return (
    <main
      id="main-content"
      role="alert"
      aria-labelledby="app-error-title"
      className="flex min-h-screen flex-col items-center justify-center bg-surface p-8"
    >
      <div className="rounded-full bg-destructive/10 p-3">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <div className="mt-4 text-center">
        <h1
          id="app-error-title"
          className="font-heading text-2xl font-semibold"
        >
          {copy.title}
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {copy.body}
        </p>
      </div>
      <Button onClick={reset} className="mt-6 gap-2">
        <RotateCcw className="h-4 w-4" />
        {copy.retry}
      </Button>
    </main>
  );
}
