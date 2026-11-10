# Research: Spanish Language Version

Decisions made while planning [spec.md](spec.md). Each one resolves a question
the spec left to planning. Builds on [docs/I18N.md](../../docs/I18N.md).

## R1. Translation library

- **Decision**: Use `use-intl`, the core of `next-intl`, in `apps/web`, with a
  small request helper (`apps/web/i18n/request.ts`) in place of next-intl's
  routing and middleware. *Updated during implementation*: `next-intl` 4.x
  pulls in native build tools (`@swc/core`, `@parcel/watcher`) for a message
  extractor this project doesn't use, which weighs on self-hosted Docker
  builds; `use-intl` has the same `useTranslations` / provider /
  `createTranslator` API in plain JavaScript.
- **Rationale**: It works in server components, client components, and plain
  server code (`createTranslator`), which covers pages, emails, SMS, and PDFs
  with one catalog and one API. It supports ICU plurals ("1 cita" / "3 citas",
  FR-009) and English fallback for missing keys (FR-010). Without-routing mode
  needs no URL changes, which docs/I18N.md asks for. It's MIT-licensed with no
  service behind it, so self-hosted installs need nothing extra.
- **Alternatives considered**:
  - *Hand-rolled lookup + `Intl.PluralRules`*: fewer moving parts, but we'd
    rebuild interpolation, rich text in JSX, plurals, fallback, and
    server/client hand-off — the core of the library — across ~190 files.
  - *`react-i18next`*: mature, but its App Router server-component story needs
    more glue, and it would add two packages (`i18next` + bindings).
  - *Locale-prefixed routes (`/es/...`)*: rejected. It changes every URL, breaks
    existing links in sent emails, and isn't needed for a signed-in product.

## R2. How the active language is chosen

- **Decision**: A pure resolver picks the first supported value from this
  order. Signed-in staff: language cookie (which holds the saved user
  language after sign-in) → clinic default → `en`. Signed-out pages: language cookie → browser
  `Accept-Language` → `en`. Pet-owner pages tied to a client: language cookie →
  client preferred language → browser → clinic default → `en` (cookie first so
  the switch on those pages works). Everything returns `en` while the
  `LANGUAGE_SELECTION_ENABLED` release flag is off. Full contract:
  [contracts/language-resolution.md](contracts/language-resolution.md).
- **Rationale**: The cookie gives an instant switch without re-reading the
  user row on every request (SC-003). It holds only an explicit choice: sign-in
  writes the saved user language or deletes the cookie, so a choice follows
  the user to another device (Story 1, scenario 2), a shared computer never
  carries one person's choice to the next, and a clinic default change reaches
  everyone without a personal choice. The clinic default comes from a
  per-practice cache with a 60-second lifetime.
- **Alternatives considered**: Storing the language in the next-auth JWT
  (rejected: it goes stale until the next sign-in and needs a session refresh
  path); reading the user row on every request (rejected: an extra query on
  every page).

## R3. Language vs. formatting locale

- **Decision**: Keep the clinic's `country` as the source of regional format
  and currency, and combine it with the active language:
  `formatLocale = <language>-<country>` (e.g. `es-US`, `es-MX`, `en-GB`).
  Existing helpers in `apps/web/lib/locale/format.ts` gain an optional
  `language` argument that defaults to `en`, so current English output is
  unchanged (SC-006).
- **Rationale**: Matches docs/I18N.md ("language, formatting locale, and
  country are separate") and reuses the existing helpers instead of adding new
  ones. `Intl` handles unknown pairs by falling back sensibly.
- **Follow-on**: The ~126 direct `toLocale*` calls are moved onto the helpers
  area by area, while translating that area — not in one sweeping PR.

## R4. Where the language is stored

- **Decision**: `users.language` (nullable; null = follow clinic default),
  `practices.default_language` (not null, default `en`),
  `clients.preferred_language` (nullable; null = follow clinic default), and
  `communications.language` (nullable; the language a send attempt was built
  in). Details: [data-model.md](data-model.md).
- **Rationale**: Each spec entity maps to the table that already owns it, and
  all four tables are already tenant-scoped under RLS. Nullable "follow the
  clinic" values mean a later change to the clinic default applies to everyone
  who hasn't made their own choice.
- **Alternatives considered**: Putting the user language in
  `practices.settings` JSON or a new preferences table (rejected: wrong owner,
  harder to validate and query).

## R5. Resent reminders must stay identical

- **Finding**: Reminder emails and SMS use provider idempotency keys scoped to
  the send attempt. A reclaimed attempt resends under the same key, and the
  provider rejects a same-key resend with a different body
  (`apps/web/lib/messaging/appointment-reminder.ts`).
- **Decision**: Resolve the client's language once when the attempt is claimed,
  store it on the `communications` row, and build every resend of that attempt
  from the stored value. Null on legacy rows means English.
- **Rationale**: Without this, changing a client's language between a send and
  its retry would block the retry.

## R6. Spanish text messages and segment cost

- **Finding**: The basic SMS character set includes `ñ Ñ é É ¿ ¡ ü Ü` but not
  `á í ó ú`. One of those letters switches the whole message to Unicode, which
  fits 70 characters per segment instead of 160. Spanish reminders are likely
  to cost more segments.
- **Decision**: Keep correct accents (dropping them reads as careless and can
  change meaning). Keep Spanish SMS templates short, and add a unit test that
  reports the segment count of each Spanish template at typical field lengths,
  so growth is visible in review. Document the cost difference for clinics in
  the SMS settings help text.
- **Alternatives considered**: Stripping accents (rejected: quality and
  meaning); per-clinic toggle (rejected for now: an option nobody has asked for).

## R7. PDFs and fonts

- **Finding**: `apps/web/lib/pdf.ts` uses jsPDF's built-in Helvetica, which
  covers the Latin-1 characters Spanish needs (á é í ó ú ñ ü ¿ ¡).
- **Decision**: No font change. Pass a translator into the PDF builders;
  re-check wrapping and column widths in Spanish, since labels are ~20–30%
  longer.

## R8. Catching missing translations

- **Decision**: `en.json` is the complete, canonical catalog.
  `apps/web/scripts/check-translations.mjs` (`pnpm i18n:check`) fails CI when `es.json` is missing a key,
  has a key `en.json` lacks, or uses different `{placeholders}` than English.
  A Vitest test runs the same check. To stop new English text being hard-coded
  outside the catalog, enable a "no raw text in JSX" lint rule for each
  directory once it has been translated.
- **Rationale**: Gives FR-011 / SC-002 a single, reproducible number.
  Turning the lint rule on per directory keeps PRs small and avoids a
  repo-wide flag day.

## R9. Which emails are in scope

- **Decision**: In scope are the emails a clinic sends to pet owners —
  appointment, vaccination, and care reminders, invoice, and client payment
  receipt (client's language) — and the staff account emails —
  verification, password reset, and staff invite (user's language, or the
  clinic default for invites). Out of scope: `packages/email` lifecycle
  messages (welcome, trial, win-back, newsletter, NPS, subscription billing),
  which the project sends to clinic owners and which aren't part of clinic
  workflows.
- **Rationale**: Covers every message tied to a user story; leaves operator
  marketing and billing copy to a separate decision.

## R10. Offline shell

- **Decision**: The offline chart shell (`apps/web/offline`) reads the
  language cookie at load time and uses a small, build-time copy of the keys
  it needs from the catalogs, so offline screens follow the same language.

## R11. Spanish variant and terminology

- **Decision**: One neutral Latin American Spanish catalog (`es`).
  `docs/i18n/glossary-es.md` fixes the terms used across the product (e.g.
  appointment → cita, invoice → factura, estimate → presupuesto, patient →
  paciente, client/owner → cliente/propietario, clinical note → nota clínica,
  controlled substance → sustancia controlada). Native-speaker review uses the
  glossary as its checklist (SC-005).
- **Alternatives considered**: Regional catalogs (`es-MX`, `es-ES`) — deferred;
  the catalog design allows adding them later as overlays on `es`.

## R12. Accessibility and layout

- **Decision**: `<html lang>` follows the active language (FR-006). Translated
  `aria-label`s come from the same catalog. A Playwright pass captures the core
  screens in Spanish at 1280 px and 768 px widths and checks for clipped or
  overflowing text (SC-004).
