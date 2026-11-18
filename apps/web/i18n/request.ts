import { cookies, headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { nextAuthSecretRejected } from "@/lib/auth-secret";
import { db } from "@openpims/db/client";
import { withSystem } from "@/lib/tenant-db";
import {
  portalSessionTokenFromCookie,
  resolvePortalSession,
} from "@/lib/portal/session";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE,
  REQUEST_PATH_HEADER,
  isLanguageSelectionEnabled,
  isSupportedLanguage,
  type Language,
} from "./config";
import { getClinicDefaultLanguage } from "./clinic-default-cache";
import { isPortalSessionPath, resolveLanguage } from "./resolve";

/**
 * Language for the current page request. Returns English without reading
 * cookies or headers while the release flag is off, so pages that render
 * statically today stay static.
 *
 * Portal pages behind a portal session use the client's saved language.
 */
export async function getRequestLanguage(): Promise<Language> {
  if (!isLanguageSelectionEnabled()) return DEFAULT_LANGUAGE;

  const cookie = (await cookies()).get(LANGUAGE_COOKIE)?.value;
  // An explicit choice wins on every page surface; skip the rest.
  if (isSupportedLanguage(cookie)) return cookie;

  const requestHeaders = await headers();
  if (isPortalSessionPath(requestHeaders.get(REQUEST_PATH_HEADER))) {
    const portalClient = await portalSessionClient(requestHeaders.get("cookie"));
    if (portalClient) {
      return resolveLanguage({
        enabled: true,
        surface: "client",
        clientLanguage: portalClient.preferredLanguage,
        acceptLanguage: requestHeaders.get("accept-language"),
        clinicDefault: await getClinicDefaultLanguage(portalClient.practiceId),
      });
    }
  }

  // Secret-independent pages still render when the auth secret is unusable.
  const session = nextAuthSecretRejected() ? null : await getServerSession(authOptions);
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
    acceptLanguage: requestHeaders.get("accept-language"),
  });
}

/** Never blocks the page: an unreadable session just falls back to the browser language. */
async function portalSessionClient(cookieHeader: string | null) {
  const token = portalSessionTokenFromCookie(cookieHeader);
  if (!token) return null;
  try {
    return (await withSystem(db, (tx) => resolvePortalSession(tx, token)))?.client ?? null;
  } catch (err) {
    console.error("[i18n] portal session language could not be read:", err);
    return null;
  }
}
