# Contract: Message Catalog

## Files

- `apps/web/messages/en.json` — canonical and complete. Every piece of product
  text exists here first.
- `apps/web/messages/es.json` — Spanish. Same keys as `en.json`.

## Format

- Nested JSON objects grouped by area, e.g.
  `schedule.newAppointment.title`, `billing.invoice.total`,
  `common.actions.save`, `email.appointmentReminder.subject`,
  `sms.appointmentReminder.body`, `pdf.vaccinationCertificate.heading`.
- Values use ICU message syntax:
  - Placeholders: `"Hola {clientName},"`
  - Plurals: `"{count, plural, one {# cita} other {# citas}}"`
  - Rich text tags for markup inside a sentence: `"Recordatorio para <b>{patientName}</b>"`
- Values hold user-facing text only. No HTML layout, styles, URLs that change
  per environment, or tax/legal/prescription rules (FR-014, docs/I18N.md).
- Units and abbreviations (mg, mL, kg) appear as placeholders or literal
  units, identical in both languages.

## Rules enforced by `apps/web/scripts/check-translations.mjs`

The script exits non-zero (failing CI) when:

1. A key in `en.json` is missing from `es.json`.
2. A key in `es.json` doesn't exist in `en.json`.
3. A value's placeholder names differ between languages (e.g. `{clientName}`
   vs `{nombre}`).
4. A value fails ICU syntax parsing.

It prints a summary (`es: 1234/1234 keys, 100%`), which is the number
behind SC-002.

## Runtime behavior

- A missing `es` key shows the `en` value (FR-010): catalogs are merged over
  English when loaded (`apps/web/i18n/messages.ts`), and `pnpm i18n:check`
  reports the gap in CI.
- A missing `en` key is a build-time error in tests (it can't happen if the
  check passes).

## Adding a language later (SC-007)

1. Add the code to `SUPPORTED_LANGUAGES` in `apps/web/i18n/config.ts`.
2. Add `apps/web/messages/<code>.json` and a glossary.
3. The check script picks up every file in `messages/` automatically.

No screen changes are needed.
