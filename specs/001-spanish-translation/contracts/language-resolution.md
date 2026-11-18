# Contract: Language Resolution

One pure function decides the active language. It lives in
`apps/web/i18n/resolve.ts`, has no I/O, and is unit-tested on its own.

## Signature (shape, not code)

```text
resolveLanguage(context) -> "en" | "es"

context:
  enabled:          boolean  # LANGUAGE_SELECTION_ENABLED (server-only flag)
  surface:          "staff" | "public" | "client" | "message" | "staffEmail" | "invite"
  cookie?:          string   # value of the language cookie
  userLanguage?:    string   # users.language (staff account emails only)
  clientLanguage?:  string   # clients.preferred_language (client surfaces, messages)
  clinicDefault?:   string   # practices.default_language
  acceptLanguage?:  string   # raw Accept-Language header
```

Unsupported or empty values are skipped. The result is always a supported
language; the final fallback is `en`.

## Release flag

While `enabled` is false, the function returns `en` for every surface, and no
language switch is rendered. This keeps a half-translated product away from
users until the release criteria in `tasks.md` (T077) are met. Tests and local
development set the flag to true.

## Order by surface

| Surface | Used for | Order (first supported value wins) |
|---------|----------|-------------------------------------|
| `staff` | `(dashboard)`, signed-in settings | cookie → clinicDefault → `en` |
| `public` | `(auth)` screens, booking with no client yet, photo capture, `/email-preferences` | cookie → acceptLanguage → `en` |
| `client` | portal (pages and error messages), sign, treatment-plan, booking with a known client | cookie → clientLanguage → acceptLanguage → clinicDefault → `en` |
| `message` | emails, SMS, PDFs for a client | clientLanguage → clinicDefault → `en` (no cookie or browser) |
| `staffEmail` | verification, password reset | userLanguage → clinicDefault → `en` |
| `invite` | staff invite email | clinicDefault → `en` |

For signed-in staff the cookie already holds the saved user language (sign-in
writes it), so page requests never read the user row (research R2).

`/email-preferences` manages OpenVPM account emails, not pet-owner email, so
it uses the `public` order through `apps/web/i18n/public-request.ts`.

### Consent signing and treatment-plan pages

The page and its layout render before anything checks the token, so they
cannot read the client record without becoming a token-validity oracle. The
first render uses the `public` order. After the page loads, its rate-limited
API (`/api/sign/<token>`, `/api/treatment-plan/<token>`) returns `language`,
resolved with the `client` order, and `apps/web/i18n/token-page.ts` switches
the page to it. An explicit cookie still wins.

On client pages the cookie comes first, so the language switch shown there
always works. Switching on a public page changes only that browser; it never
changes the client record (only staff can, FR-015).

## Language cookie

The cookie holds only an **explicit choice** someone made in this browser. It
never stores a fallback, so a change to the clinic default reaches everyone
without a personal choice on their next page load.

- Name: `NEXT_LOCALE` (the library's default name), path `/`, `SameSite=Lax`,
  `Secure` in production, 1-year max age. Not `HttpOnly`, so the offline shell
  can read it. Holds only a language code, never anything identifying.
- Switch to a language (any surface): write the cookie.
- Choose "Clinic default" in personal settings: delete the cookie.
- Sign-in: if `users.language` is set, write it; otherwise delete the cookie.
  Both cases replace whatever the previous person on a shared computer chose.
- Registration and invite acceptance: save the current cookie value (if
  supported) into `users.language`. For an existing account with no saved
  choice, a language picked on the sign-in page applies only until sign-in;
  after that the user picks it in settings.

## Clinic default lookup

Staff without a saved choice, and every client surface, need
`practices.default_language`. Read it through a small per-practice in-memory
cache (60-second lifetime) so most page loads skip the query. Users with a
cookie never need it. A clinic default change shows up within 60 seconds.

## Accept-Language parsing

Take the language subtags in order of quality weight; `es-MX`, `es-419`,
and `es` all map to `es`. Anything unsupported is skipped.

## Required tests

- Each row of the table above, including the fallbacks.
- `enabled: false` returns `en` for every surface, even with a Spanish cookie,
  user, client, and browser.
- Unsupported values (`fr`, `""`, `"ES "`, `"xx-YY"`) are skipped.
- Accept-Language with quality weights picks the highest-weighted supported
  language.
- `message`, `staffEmail`, and `invite` never consult the cookie or browser.
- A client page with cookie `en` and client language `es` gives `en`.
- Sign-in cookie handling is not part of this function. It is tested with
  the sign-in code (`tasks.md` T019): user A chose `es` and signs out; user B
  has no saved choice and the clinic default is `en` → after B signs in the
  cookie is gone and B sees `en`.
