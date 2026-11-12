"use client";

import { useTranslations } from "use-intl";
import { portalAge } from "@/lib/portal/date";

/** Translated pet age ("3 years old" / "3 años"). */
export function usePortalAge() {
  const t = useTranslations("portal.age");
  return (dob: string | Date | null | undefined) => {
    const age = portalAge(dob);
    return age ? t(age.unit, { count: age.count }) : t("unknown");
  };
}
