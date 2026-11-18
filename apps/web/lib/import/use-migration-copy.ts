"use client";

import { useTranslations } from "use-intl";
import { MIGRATION_SOURCES, type MigrationImportMode } from "./sources";

/**
 * Translated migration labels. `sources.ts` stays the English source (tests
 * and docs read it); the UI reads the `migration` catalog through this hook.
 */
export function useMigrationCopy() {
  const t = useTranslations("migration");
  const known = (id: string) => MIGRATION_SOURCES.some((s) => s.id === id);
  return {
    stepLabel: (mode: MigrationImportMode) => t(`steps.${mode}.label`),
    stepShortLabel: (mode: MigrationImportMode) => t(`steps.${mode}.shortLabel`),
    stepColumnHint: (mode: MigrationImportMode) => t(`steps.${mode}.columnHint`),
    stepUnmatchedLabel: (mode: MigrationImportMode) =>
      mode === "clients" ? null : t(`steps.${mode}.unmatchedLabel`),
    sourceName: (id: string) =>
      known(id) ? t(`sources.${id}.name`) : t("previousSource", { id }),
    sourceExportHint: (id: string) =>
      known(id) ? t(`sources.${id}.exportHint`) : t("customSourceHint"),
  };
}
