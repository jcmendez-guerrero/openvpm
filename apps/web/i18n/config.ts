import { z } from "zod";
import { envFlagEnabled } from "@/lib/env-bool";

/** Languages the product ships. English is the source and the fallback. */
export const SUPPORTED_LANGUAGES = ["en", "es"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = "en";

/** Holds only a language someone explicitly picked in this browser. */
export const LANGUAGE_COOKIE = "NEXT_LOCALE";

export const languageSchema = z.enum(SUPPORTED_LANGUAGES);

export function isSupportedLanguage(value: unknown): value is Language {
  return (SUPPORTED_LANGUAGES as readonly unknown[]).includes(value);
}

export const LANGUAGE_SELECTION_ENABLED_ENV = "LANGUAGE_SELECTION_ENABLED";

/**
 * Default-off release switch. Server-only: until it is true every surface
 * resolves to English and no language switch renders, so clinics never see a
 * half-translated product.
 */
export function isLanguageSelectionEnabled(): boolean {
  return envFlagEnabled(LANGUAGE_SELECTION_ENABLED_ENV);
}
