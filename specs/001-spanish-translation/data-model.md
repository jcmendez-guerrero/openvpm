# Data Model: Spanish Language Version

All changes are additive columns on existing tenant-scoped tables (already
under RLS). One migration: `packages/db/drizzle/<next>_language_preferences.sql`,
using the next free number when the PR is cut (`0117` today). No backfill, no contraction, no edits to past
migrations (Constitution IV).

## Language code

A **supported language** is a value from one list in code
(`apps/web/i18n/config.ts`): `["en", "es"]`. It's stored as a short text code
(`varchar(8)`, lowercase BCP 47 language subtag) rather than a database enum,
so adding a language needs no migration (SC-007). Every write validates the
value against the list with Zod; unknown values are rejected.

## Changes

### `practices.default_language` — clinic default language

| Field | Type | Null | Default | Notes |
|-------|------|------|---------|-------|
| `default_language` | `varchar(8)` | not null | `'en'` | Used when no user or client choice applies (FR-003). Existing clinics get `en`, so nothing changes for them. |

- Set by: users who can already edit clinic settings (existing Admin check on
  the settings router).
- Independent of `practices.country` and `practices.currency`, which keep
  driving regional format and currency (research R3).

### `users.language` — staff user language

| Field | Type | Null | Default | Notes |
|-------|------|------|---------|-------|
| `language` | `varchar(8)` | null | — | Null means "follow the clinic default". Set by the user for themselves (FR-002). |

- Written into the language cookie at sign-in when set; when null, sign-in
  deletes the cookie (contracts/language-resolution.md).
- New users created by invite or registration start as null; a language chosen
  on the sign-in or registration screen is saved here on account creation
  (Story 2, scenario 2).

### `clients.preferred_language` — pet owner language

| Field | Type | Null | Default | Notes |
|-------|------|------|---------|-------|
| `preferred_language` | `varchar(8)` | null | — | Null means "follow the clinic default". Set by staff with permission to edit client records (FR-015). |

- Not added to `toApiClient` — `/api/v1` responses are unchanged
  (Constitution II).
- Included in the CSV client import as an optional column
  (`preferred_language`). Blank or unknown values import as null, with a
  warning in the import review.

### `communications.language` — language a message was sent in

| Field | Type | Null | Default | Notes |
|-------|------|------|---------|-------|
| `language` | `varchar(8)` | null | — | Fixed when a send attempt is claimed; every resend of that attempt uses it (research R5). Null on existing rows means English. |

- Write-once per attempt: set on claim, never updated afterwards. A new
  attempt (explicit retry after a definite failure) resolves the language
  again.

## Resolution relationships

```text
staff pages:
  user.language ──(written at sign-in)──► language cookie ──┐
                                                            ├─► active staff language
  practice.default_language ──(60 s cache, if no cookie)────┘

client-facing messages:
  client.preferred_language ──┐
                              ├─► client language ─► communications.language (frozen per attempt)
  practice.default_language ──┘
```

## Validation rules

- Every language write: value ∈ supported list, or null where the column
  allows it.
- The language never changes clinical, financial, or patient data
  (FR-011, FR-014): no column above is read by tax, payment, dosing, or
  controlled-substance code.

## Migration sketch

```sql
ALTER TABLE practices      ADD COLUMN default_language     varchar(8) NOT NULL DEFAULT 'en';
ALTER TABLE users          ADD COLUMN language           varchar(8);
ALTER TABLE clients        ADD COLUMN preferred_language varchar(8);
ALTER TABLE communications ADD COLUMN language           varchar(8);
```

Run `pnpm db:rls` and `pnpm db:rls:test` after migrating (existing policies
already cover these tables; the test confirms nothing regressed).

## Non-database entities

- **Translation catalog**: `apps/web/messages/en.json` (canonical) and
  `apps/web/messages/es.json`. Format and rules:
  [contracts/message-catalog.md](contracts/message-catalog.md).
- **Terminology glossary**: `docs/i18n/glossary-es.md` — a table of English
  term, approved Spanish term, and usage notes.
