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
 * Each call uses the namespace of the nearest `const t = useTranslations(…)`
 * above it, so one file can reuse `t` per component. Keys built at runtime
 * (t(`nav.${key}`)) are left as written.
 */
export function inlineEnglish(source: string): string {
  const declarations = [
    ...source.matchAll(/const (\w+) = useTranslations\((?:"([^"]*)")?\)/g),
  ].map((m) => ({ name: m[1]!, namespace: m[2] ?? "", index: m.index! }));
  if (declarations.length === 0) return source;

  const names = [...new Set(declarations.map((d) => d.name))].join("|");
  const call = `\\b(${names})\\("([^"]+)"(?:,[^()]*(?:\\([^()]*\\)[^()]*)*)?\\)`;
  // One pass, so every offset refers to the original source.
  const pattern = new RegExp(`(=\\{)?(\\{)?${call}(\\})?`, "g");

  return source.replace(
    pattern,
    (
      whole: string,
      eq: string | undefined,
      brace: string | undefined,
      fn: string,
      key: string,
      close: string | undefined,
      offset: number,
    ) => {
      const scope = declarations.filter((d) => d.name === fn && d.index < offset).at(-1);
      const text = scope && lookup(scope.namespace ? `${scope.namespace}.${key}` : key);
      if (text === undefined) return whole;
      if (eq && close) return `="${text}"`;
      if (brace && close) return text;
      return `${eq ?? ""}${brace ?? ""}${JSON.stringify(text)}${close ?? ""}`;
    },
  );
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
