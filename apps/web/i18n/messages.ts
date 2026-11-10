import { createTranslator } from "use-intl/core";
import type { Language } from "./config";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

export type Messages = typeof en;

type Tree = { [key: string]: string | Tree };

/** Fill gaps in `target` with English so a missing translation shows English (FR-010). */
function withEnglishFallback(source: Tree, target: Tree): Tree {
  const out: Tree = {};
  for (const [key, value] of Object.entries(source)) {
    const translated = target[key];
    if (typeof value === "string") out[key] = typeof translated === "string" ? translated : value;
    else out[key] = withEnglishFallback(value, typeof translated === "object" ? translated : {});
  }
  return out;
}

const CATALOGS: Record<Language, Messages> = {
  en,
  es: withEnglishFallback(en, es) as Messages,
};

export function messagesFor(language: Language): Messages {
  return CATALOGS[language];
}

/** Translator for code outside React: emails, SMS, PDFs, server errors. */
export function getTranslatorFor(language: Language) {
  return createTranslator({ locale: language, messages: messagesFor(language) });
}
