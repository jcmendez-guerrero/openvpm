"use client";

import { useTranslations } from "use-intl";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  AUTH_EMAIL_MAX_LENGTH,
  isAuthEmailLengthValid,
} from "@/lib/auth-input-policy";
import { isValidEmail } from "@/lib/utils";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const request = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => setSent(true),
    onError: (err) => toast.error(err.message),
  });
  const canSubmit = isAuthEmailLengthValid(email) && isValidEmail(email);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8">
        <div className="mb-6 text-center">
          <h1 className="font-heading text-2xl font-bold text-foreground">OpenVPM</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("forgot.subtitle")}</p>
        </div>

        {sent ? (
          <p className="text-center text-sm text-muted-foreground">
            {t.rich("forgot.sent", { email, strong: (chunks) => <strong>{chunks}</strong> })}
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!canSubmit) return;
              request.mutate({ email: email.trim().toLowerCase() });
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">
                {t("common.email")}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={AUTH_EMAIL_MAX_LENGTH}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={t("common.emailPlaceholder")}
              />
            </div>
            <button
              type="submit"
              disabled={!canSubmit || request.isPending}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {request.isPending ? t("forgot.submitting") : t("forgot.submit")}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">
            {t("forgot.back")}
          </Link>
        </p>
      </div>
    </div>
  );
}
