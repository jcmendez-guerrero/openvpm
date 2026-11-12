import { isLanguageSelectionEnabled, languageCookieFromHeader, type Language } from "./config";
import { messagesFor, type Messages } from "./messages";
import { resolveLanguage } from "./resolve";

export type TokenPageLanguage = { language: Language; messages: Partial<Messages> };

/**
 * Language for a token page (consent signing, treatment plan), returned by its
 * rate-limited API instead of chosen at page render, so the page shell stays
 * the same for every token. Order: page switch cookie, client, browser, clinic.
 */
export function tokenPageLanguage(
  request: Request,
  values: { clientLanguage: string | null; clinicDefault: string | null },
  namespace: keyof Messages,
): { language?: Language; messages?: Partial<Messages> } {
  if (!isLanguageSelectionEnabled()) return {};
  const language = resolveLanguage({
    enabled: true,
    surface: "client",
    cookie: languageCookieFromHeader(request.headers.get("cookie")),
    clientLanguage: values.clientLanguage,
    acceptLanguage: request.headers.get("accept-language"),
    clinicDefault: values.clinicDefault,
  });
  const messages = messagesFor(language);
  // common carries the root layout's skip link, rendered before the language is known.
  return { language, messages: { [namespace]: messages[namespace], common: messages.common } };
}
