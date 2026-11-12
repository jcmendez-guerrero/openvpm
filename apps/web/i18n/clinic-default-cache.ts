import { practices } from "@openpims/db";
import { db } from "@openpims/db/client";
import { activePracticeWhere } from "@/lib/compat/shared/active-practice";
import { withTenant } from "@/lib/tenant-db";
import {
  DEFAULT_LANGUAGE,
  isLanguageSelectionEnabled,
  isSupportedLanguage,
  type Language,
} from "./config";

export const CLINIC_DEFAULT_TTL_MS = 60_000;

/**
 * Per-practice memo so most page loads skip the query. A clinic default
 * change reaches users without a personal choice within the TTL.
 * The map holds one small entry per practice seen by this server instance.
 */
export function createClinicDefaultCache(
  load: (practiceId: string) => Promise<string | null | undefined>,
  ttlMs = CLINIC_DEFAULT_TTL_MS,
  now: () => number = Date.now,
) {
  const entries = new Map<string, { value: Language; expiresAt: number }>();
  return async function get(practiceId: string): Promise<Language> {
    const hit = entries.get(practiceId);
    if (hit && hit.expiresAt > now()) return hit.value;
    const stored = await load(practiceId);
    const value = isSupportedLanguage(stored) ? stored : DEFAULT_LANGUAGE;
    entries.set(practiceId, { value, expiresAt: now() + ttlMs });
    return value;
  };
}

export const getClinicDefaultLanguage = createClinicDefaultCache(async (practiceId) => {
  const [row] = await withTenant(db, practiceId, (tx) =>
    tx
      .select({ defaultLanguage: practices.defaultLanguage })
      .from(practices)
      .where(activePracticeWhere(practiceId))
      .limit(1),
  );
  return row?.defaultLanguage;
});

/**
 * Language for a staff account email: the user's saved language, else the
 * clinic default. Skips the lookup while the release flag is off, and falls
 * back to English if it fails, so a lookup error never blocks the email.
 */
export async function staffEmailLanguage(
  practiceId: string,
  userLanguage?: string | null,
): Promise<Language> {
  if (!isLanguageSelectionEnabled()) return DEFAULT_LANGUAGE;
  if (isSupportedLanguage(userLanguage)) return userLanguage;
  try {
    return await getClinicDefaultLanguage(practiceId);
  } catch {
    return DEFAULT_LANGUAGE;
  }
}
