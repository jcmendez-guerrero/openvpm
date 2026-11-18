"use client";

import { useTranslations } from "use-intl";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  AUTH_PASSWORD_MAX_LENGTH,
  AUTH_PASSWORD_MIN_LENGTH,
} from "@/lib/auth-password-policy";

function AcceptInviteInner() {
  const t = useTranslations("auth");
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);

  const accept = trpc.auth.acceptInvite.useMutation({
    onSuccess: () => setDone(true),
    onError: (err) => toast.error(err.message),
  });
  const passwordMeetsPolicy =
    password.length >= AUTH_PASSWORD_MIN_LENGTH &&
    password.length <= AUTH_PASSWORD_MAX_LENGTH;
  const canSubmit = passwordMeetsPolicy && password === confirm;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8">
        <div className="mb-6 text-center">
          <h1 className="font-heading text-2xl font-bold text-foreground">OpenVPM</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("invite.subtitle")}</p>
        </div>

        {done ? (
          <div className="text-center">
            <p className="text-sm text-foreground">
              {t("invite.done")}
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t("common.signIn")}
            </Link>
          </div>
        ) : !token ? (
          <p className="text-center text-sm text-destructive">
            {t("invite.invalid")}
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!passwordMeetsPolicy) {
                toast.error(
                  t("common.passwordLength", { min: AUTH_PASSWORD_MIN_LENGTH, max: AUTH_PASSWORD_MAX_LENGTH })
                );
                return;
              }
              if (password !== confirm) {
                toast.error(t("invite.mismatch"));
                return;
              }
              accept.mutate({ token, password });
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground">
                {t("invite.password")}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={AUTH_PASSWORD_MIN_LENGTH}
                maxLength={AUTH_PASSWORD_MAX_LENGTH}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={t("common.passwordPlaceholder", { min: AUTH_PASSWORD_MIN_LENGTH })}
              />
            </div>
            <div>
              <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-foreground">
                {t("invite.confirm")}
              </label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={AUTH_PASSWORD_MIN_LENGTH}
                maxLength={AUTH_PASSWORD_MAX_LENGTH}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={t("invite.confirmPlaceholder")}
              />
            </div>
            <button
              type="submit"
              disabled={!canSubmit || accept.isPending}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {accept.isPending ? t("invite.submitting") : t("invite.submit")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteInner />
    </Suspense>
  );
}
