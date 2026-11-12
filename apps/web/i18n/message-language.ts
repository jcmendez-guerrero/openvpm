import { isLanguageSelectionEnabled, type Language } from "./config";
import { resolveLanguage, type LanguageContext } from "./resolve";

/**
 * Language for an email, text or document sent outside a request: the
 * client's (or staff user's) saved language, then the clinic default.
 * English while the release flag is off.
 */
export function messageLanguage(
  surface: "message" | "staffEmail" | "invite",
  values: Pick<LanguageContext, "clientLanguage" | "userLanguage" | "clinicDefault">,
): Language {
  return resolveLanguage({ enabled: isLanguageSelectionEnabled(), surface, ...values });
}
