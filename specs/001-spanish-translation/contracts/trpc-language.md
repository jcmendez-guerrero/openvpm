# Contract: tRPC Language Procedures

Internal dashboard API only. The public `/api/v1` REST surface and webhook
payloads do **not** change (Constitution II).

All inputs are validated with Zod against the supported-language list
(`z.enum(SUPPORTED_LANGUAGES)`). Existing middleware enforces roles; no role
checks in UI code.

## `settings.getMyLanguage` — new

- **Procedure type**: `protectedProcedure` (any signed-in staff user)
- **Input**: none
- **Output**: `{ language: "en" | "es" | null, clinicDefault: "en" | "es" }`

## `settings.setMyLanguage` — new

- **Procedure type**: `protectedProcedure` — a user can change only their own
  language
- **Input**: `{ language: "en" | "es" | null }` (null = follow the clinic default)
- **Effect**: updates `users.language` for `ctx.session.user.id`, scoped by
  `practiceId`; the client then writes the language cookie (or deletes it for
  null) and refreshes.
- **Release flag**: while `LANGUAGE_SELECTION_ENABLED` is off, the settings UI
  hides the control and the procedure still validates and stores the value,
  but resolution returns `en` everywhere.
- **Output**: `{ language }`

## `settings.updatePractice` — extended

- **Procedure type**: unchanged (`adminProcedure`)
- **Input**: existing fields plus optional `defaultLanguage: "en" | "es"`
- **Effect**: updates `practices.default_language`; existing fields behave as
  before.

## `settings.getPractice` — extended

- **Output**: existing fields plus `defaultLanguage`.

## `clients.create` / `clients.update` — extended

- **Procedure type**: unchanged (`clientManagerProcedure`)
- **Input**: existing fields plus optional `preferredLanguage: "en" | "es" | null`
- **Effect**: writes `clients.preferred_language`; tenant scoping unchanged.

## `clients.getById` — extended

- **Output**: existing fields plus `preferredLanguage`.

## Pre-sign-in language switch

Not a tRPC call. The switch on public pages only writes the language cookie
and refreshes the page. At registration or invite acceptance, the current
cookie value is saved into `users.language`.

## Required tests

- `setMyLanguage` changes only the caller's row; a value outside the list is
  rejected.
- `updatePractice` with `defaultLanguage` needs Admin; other roles get the
  existing forbidden error.
- `clients.update` with `preferredLanguage` respects tenant isolation (a
  client from another practice can't be updated).
- Contract test: `/api/v1/clients` and `/api/v1/clients/{id}` responses don't
  include the new field (schema `.strict()` parse).
