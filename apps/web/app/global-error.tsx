"use client";

import { AppErrorBody } from "@/components/common/app-error-view";
import "@/styles/globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <AppErrorBody error={error} reset={reset} source="global-error" />
      </body>
    </html>
  );
}
