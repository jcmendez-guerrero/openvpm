import { readFileSync } from "node:fs";
import en from "@/messages/en.json";

/**
 * Test helper: source text with each static `t("key")` call replaced by its
 * English catalog text, so source-reading UI tests keep asserting the English
 * copy after a component moves to translations.
 *
 *   aria-label={t("key")} → aria-label="English"
 *   {t("key")}            → English
 *   t("key", { … })       → "English"   (raw ICU message)
 *
 * Keys built at runtime (t(`nav.${key}`)) are left as written.
 */
export function inlineEnglish(source: string): string {
  const namespaces = new Map<string, string>();
  for (const m of source.matchAll(/const (\w+) = useTranslations\((?:"([^"]*)")?\)/g)) {
    namespaces.set(m[1]!, m[2] ?? "");
  }
  let out = source;
  for (const [fn, namespace] of namespaces) {
    const call = `${fn}\\("([^"]+)"(?:,[^()]*(?:\\([^()]*\\)[^()]*)*)?\\)`;
    const english = (key: string) => lookup(namespace ? `${namespace}.${key}` : key);
    out = out
      .replace(new RegExp(`=\\{${call}\\}`, "g"), (whole, key: string) => {
        const text = english(key);
        return text === undefined ? whole : `="${text}"`;
      })
      .replace(new RegExp(`\\{${call}\\}`, "g"), (whole, key: string) => english(key) ?? whole)
      .replace(new RegExp(`\\b${call}`, "g"), (whole, key: string) => {
        const text = english(key);
        return text === undefined ? whole : JSON.stringify(text);
      });
  }
  return out;
}

export function readTranslatedSource(path: string | URL): string {
  return inlineEnglish(readFileSync(path, "utf8"));
}

function lookup(path: string): string | undefined {
  let node: unknown = en;
  for (const part of path.split(".")) {
    if (!node || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}
