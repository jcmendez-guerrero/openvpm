"use client";

import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { LanguageSwitch } from "@/components/common/language-switch";
import { useLanguageSelectionEnabled } from "@/components/common/intl-provider";
import { trpc } from "@/lib/trpc";

/** The signed-in user's own language, saved to their account (every role). */
export function MyLanguageSwitch({ className }: { className?: string }) {
  const enabled = useLanguageSelectionEnabled();
  const t = useTranslations("shell");
  const utils = trpc.useUtils();
  const saved = trpc.settings.getMyLanguage.useQuery(undefined, {
    enabled,
    staleTime: 60_000,
  });
  const save = trpc.settings.setMyLanguage.useMutation();
  if (!enabled) return null;

  return (
    <LanguageSwitch
      className={className}
      allowClinicDefault
      value={saved.data ? saved.data.language : undefined}
      onChange={async (language) => {
        try {
          await save.mutateAsync({ language });
          await utils.settings.getMyLanguage.invalidate();
        } catch {
          // Read-only roles and paused clinics can't save; this device still switched.
          toast.error(t("languageNotSaved"));
        }
      }}
    />
  );
}
