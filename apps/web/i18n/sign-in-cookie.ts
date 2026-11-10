import { knownDeviceCookieSecure } from "@/lib/known-device";
import {
  LANGUAGE_COOKIE,
  isLanguageSelectionEnabled,
  isSupportedLanguage,
} from "./config";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

interface CookieStore {
  set(name: string, value: string, options: Record<string, unknown>): unknown;
  delete(name: string): unknown;
}

/**
 * Sign-in replaces whatever the previous person on this browser chose: the
 * account's saved language, or no cookie so the clinic default applies.
 */
export function applySignInLanguageCookie(
  store: CookieStore,
  savedLanguage: string | null | undefined,
  env: Parameters<typeof knownDeviceCookieSecure>[0] = process.env,
): void {
  if (isSupportedLanguage(savedLanguage)) {
    store.set(LANGUAGE_COOKIE, savedLanguage, {
      path: "/",
      sameSite: "lax",
      secure: knownDeviceCookieSecure(env),
      maxAge: ONE_YEAR_SECONDS,
    });
  } else {
    store.delete(LANGUAGE_COOKIE);
  }
}

/** Called from the sign-in route handler; never blocks a sign-in. */
export async function syncLanguageCookieAtSignIn(
  savedLanguage: string | null | undefined,
): Promise<void> {
  if (!isLanguageSelectionEnabled()) return;
  try {
    const { cookies } = await import("next/headers");
    applySignInLanguageCookie(await cookies(), savedLanguage);
  } catch (err) {
    console.error("[auth] language cookie could not be set:", err);
  }
}
