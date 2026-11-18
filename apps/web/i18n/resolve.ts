import { DEFAULT_LANGUAGE, isSupportedLanguage, type Language } from "./config";

/**
 * Where the language is needed. Order per surface is the contract in
 * specs/001-spanish-translation/contracts/language-resolution.md.
 */
export type LanguageSurface =
  | "staff"
  | "public"
  | "client"
  | "message"
  | "staffEmail"
  | "invite";

type Value = string | null | undefined;

export interface LanguageContext {
  /** LANGUAGE_SELECTION_ENABLED. While false everything is English. */
  enabled: boolean;
  surface: LanguageSurface;
  /** Explicit choice stored in the language cookie. */
  cookie?: Value;
  /** users.language — only used for staff account emails. */
  userLanguage?: Value;
  /** clients.preferred_language */
  clientLanguage?: Value;
  /** practices.default_language */
  clinicDefault?: Value;
  /** Raw Accept-Language header. */
  acceptLanguage?: Value;
}

export function resolveLanguage(ctx: LanguageContext): Language {
  if (!ctx.enabled) return DEFAULT_LANGUAGE;
  const browser = () => parseAcceptLanguage(ctx.acceptLanguage);
  const order: Record<LanguageSurface, () => Value[]> = {
    staff: () => [ctx.cookie, ctx.clinicDefault],
    public: () => [ctx.cookie, browser()],
    client: () => [ctx.cookie, ctx.clientLanguage, browser(), ctx.clinicDefault],
    message: () => [ctx.clientLanguage, ctx.clinicDefault],
    staffEmail: () => [ctx.userLanguage, ctx.clinicDefault],
    invite: () => [ctx.clinicDefault],
  };
  return order[ctx.surface]().find(isSupportedLanguage) ?? DEFAULT_LANGUAGE;
}

/** Highest-weighted supported language in an Accept-Language header. */
export function parseAcceptLanguage(header: Value): Language | undefined {
  if (!header) return undefined;
  return header
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const weight = q ? Number(q.slice(2)) : 1;
      return { language: tag.split("-")[0]?.toLowerCase(), weight, index };
    })
    .filter((entry) => Number.isFinite(entry.weight) && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
    .map((entry) => entry.language)
    .find(isSupportedLanguage);
}

/** /portal pages that run on a portal session; /portal/access/<token> is the sign-in step. */
export function isPortalSessionPath(path: string | null): boolean {
  if (!path) return false;
  return (path === "/portal" || path.startsWith("/portal/")) && !path.startsWith("/portal/access/");
}
