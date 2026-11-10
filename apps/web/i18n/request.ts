import { cookies, headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE,
  isLanguageSelectionEnabled,
  isSupportedLanguage,
  type Language,
} from "./config";
import { getClinicDefaultLanguage } from "./clinic-default-cache";
import { resolveLanguage } from "./resolve";

/**
 * Language for the current page request. Returns English without reading
 * cookies or headers while the release flag is off, so pages that render
 * statically today stay static.
 *
 * shortcut: client pages (portal, sign, treatment plan) resolve like staff or
 * public pages until T050 adds the client's saved language.
 */
export async function getRequestLanguage(): Promise<Language> {
  if (!isLanguageSelectionEnabled()) return DEFAULT_LANGUAGE;

  const cookie = (await cookies()).get(LANGUAGE_COOKIE)?.value;
  // An explicit choice wins on every page surface; skip the rest.
  if (isSupportedLanguage(cookie)) return cookie;

  const session = await getServerSession(authOptions);
  const practiceId = session?.user?.practiceId;
  if (practiceId) {
    return resolveLanguage({
      enabled: true,
      surface: "staff",
      clinicDefault: await getClinicDefaultLanguage(practiceId),
    });
  }
  return resolveLanguage({
    enabled: true,
    surface: "public",
    acceptLanguage: (await headers()).get("accept-language"),
  });
}
