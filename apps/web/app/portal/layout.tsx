import type { Metadata } from "next";
import { getRequestLanguage } from "@/i18n/request";
import { getTranslatorFor } from "@/i18n/messages";
import { PortalShell } from "@/components/portal/portal-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = getTranslatorFor(await getRequestLanguage());
  return {
    title: t("meta.portal.title"),
    description: t("meta.portal.description"),
    referrer: "no-referrer",
    robots: { index: false, follow: false, nocache: true },
  };
}

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PortalShell>{children}</PortalShell>;
}
