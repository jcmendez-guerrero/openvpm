"use client";

import { useTranslations } from "use-intl";
import { LanguageSwitch } from "@/components/common/language-switch";

import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { PawMark } from "@/components/brand/paw-mark";
import { trpc } from "@/lib/trpc";
import { hexToHslString, initials } from "@/lib/utils";
import { DEFAULT_PORTAL_BRAND_COLOR } from "@/lib/portal/branding";

type PortalThemeStyle = CSSProperties & {
  "--primary"?: string;
  "--ring"?: string;
};

export function PortalShell({ children }: { children: ReactNode }) {
  const t = useTranslations("portal.shell");
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);
  const isAccessExchange = pathname.startsWith("/portal/access/");
  const client = trpc.portal.getClient.useQuery(
    {},
    {
      enabled: !isAccessExchange,
      retry: false,
      staleTime: 5 * 60 * 1000,
    },
  );
  const practice = client.data?.practice;
  const brandHsl = hexToHslString(
    practice?.brandColor ?? DEFAULT_PORTAL_BRAND_COLOR,
  );
  const themeStyle: PortalThemeStyle | undefined = brandHsl
    ? { "--primary": brandHsl, "--ring": brandHsl }
    : undefined;
  const practiceName = practice?.name ?? "OpenVPM";

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch("/api/portal/session", { method: "DELETE" });
    } finally {
      window.location.replace("/");
    }
  }

  return (
    <div className="min-h-screen bg-white" style={themeStyle}>
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {practice?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={practice.logoUrl}
                alt={t("logoAlt", { name: practiceName })}
                className="h-10 w-10 shrink-0 rounded-lg border border-gray-200 bg-white object-contain p-0.5"
              />
            ) : practice ? (
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground"
              >
                {initials(practiceName) || "VP"}
              </span>
            ) : (
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
              >
                <PawMark className="h-5 w-5" />
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">
                {practiceName}
              </p>
              <p className="text-sm font-medium text-primary">{t("petPortal")}</p>
            </div>
          </div>
          {/* Writes only this browser's cookie, never the client record. */}
          <LanguageSwitch className="ml-auto shrink-0" />
          {client.data ? (
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="shrink-0 text-sm font-medium text-gray-500 hover:text-gray-800 disabled:opacity-60"
            >
              {signingOut ? t("signingOut") : t("signOut")}
            </button>
          ) : null}
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-4xl px-4 py-6">
        {children}
      </main>
      <footer className="mt-12 border-t border-gray-100">
        <div className="mx-auto max-w-4xl px-4 py-6 text-center text-sm text-gray-400">
          {t("poweredByOpenvpm")}
          <span className="mx-2" aria-hidden="true">
            ·
          </span>
          <a
            href="/legal/privacy"
            className="underline-offset-2 hover:text-gray-600 hover:underline"
          >
            {t("privacy")}
          </a>
        </div>
      </footer>
    </div>
  );
}
