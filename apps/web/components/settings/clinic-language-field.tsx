"use client";

import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { useLanguageSelectionEnabled } from "@/components/common/intl-provider";
import { SUPPORTED_LANGUAGES, isSupportedLanguage } from "@/i18n/config";
import { trpc } from "@/lib/trpc";

/** Admin-only clinic default language; saves on change (like Branding). */
export function ClinicLanguageField() {
  const enabled = useLanguageSelectionEnabled();
  const t = useTranslations();
  const utils = trpc.useUtils();
  const practice = trpc.settings.getPractice.useQuery(undefined, { enabled });
  const save = trpc.settings.updatePractice.useMutation({
    onSuccess: () => {
      void utils.settings.getPractice.invalidate();
      void utils.settings.getMyLanguage.invalidate();
      toast.success(t("settings.practice.defaultLanguageSaved"));
    },
    onError: (err) => toast.error(err.message),
  });
  if (!enabled || !practice.data) return null;

  return (
    <label className="space-y-1.5">
      <span className="text-sm font-medium">{t("settings.practice.defaultLanguage")}</span>
      <select
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        value={practice.data.defaultLanguage}
        disabled={save.isPending}
        onChange={(e) => {
          if (isSupportedLanguage(e.target.value)) save.mutate({ defaultLanguage: e.target.value });
        }}
      >
        {SUPPORTED_LANGUAGES.map((language) => (
          <option key={language} value={language} lang={language}>
            {t(`language.names.${language}`)}
          </option>
        ))}
      </select>
      <span className="block text-xs text-muted-foreground">
        {t("settings.practice.defaultLanguageHelp")}
      </span>
    </label>
  );
}
