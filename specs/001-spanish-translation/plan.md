# Implementation Plan: Spanish Language Version

**Branch**: `claude/speckit-spanish-translation-c0a09f` | **Date**: 2026-11-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-spanish-translation/spec.md`

## Summary

Add Spanish as the first non-English language across the staff workspace,
sign-in screens, pet-owner pages, and client emails, texts, and printed
documents (all four stories, per FR-020). The approach follows
[docs/I18N.md](../../docs/I18N.md): English stays the source and fallback;
language is a separate setting from the clinic's country (which already drives
currency and date formatting); no tax, legal, or prescription logic moves into
translations.

Technically: one message catalog per language (`en` complete, `es` translated)
read through a single translation library that works in server components,
client components, and plain server code (emails, SMS, PDFs). The active
language is resolved per request from a language cookie (kept in sync with the
user's saved choice), the browser, and the clinic default — no URL changes.
Four language columns are added (user, clinic, client, and each message send record). Formatting helpers
gain a language argument so `es` + the clinic's country produces a regional
format (e.g. `es-US`, `es-MX`). A CI check fails when a Spanish key is missing.

## Technical Context

**Language/Version**: TypeScript (strict), Node 20+, React 19, Next.js 15 App Router

**Primary Dependencies**: `use-intl` (new runtime dependency; see research R1), `@formatjs/icu-messageformat-parser` (new dev dependency for the catalog check), existing `next-auth` 4, tRPC 11, Zod 4, Drizzle, jsPDF 4, `@react-email/render`

**Storage**: PostgreSQL 16 via Drizzle; four additive columns (see [data-model.md](data-model.md)); message catalogs are JSON files in the repo

**Testing**: Vitest (catalog parity, resolver, formatting, email/SMS/PDF builders), Playwright (Spanish journeys for each story)

**Target Platform**: Web (desktop and tablet browsers), self-hosted Docker and hosted

**Project Type**: Web application (pnpm + Turborepo monorepo)

**Performance Goals**: Language switch visible in < 2 s (SC-003); no user-row read per page (the language cookie carries an explicit choice); the clinic default comes from a per-practice cache with a 60-second lifetime

**Constraints**: No URL/route restructuring; public `/api/v1` and webhook payloads unchanged; works in the offline shell and on self-hosted installs with no external translation service; a resent reminder must be identical to its first attempt

**Scale/Scope**: ~190 `.tsx` files under `apps/web/app` and `apps/web/components`, ~126 direct `toLocale*` calls, 5 client-facing email builders + 3 staff auth emails in `apps/web/lib/email.ts`, SMS reminder builders in `apps/web/lib/messaging`, ~1,800-line PDF builder in `apps/web/lib/pdf.ts`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|------------|--------|
| I. Tenant isolation | New columns live on existing tenant-scoped tables (`users`, `practices`, `clients`), already under RLS. Setting a client's language goes through the existing tenant-scoped `clients.update` path. Public token pages read the client's language through the token lookup they already do — no new cross-tenant query. | Pass |
| II. Public API frozen | `toApiClient` maps fields explicitly, so `clients.preferred_language` does not appear in `/api/v1`. Webhook payloads untouched. A contract test asserts the client response shape is unchanged. | Pass |
| III. Test-first | Unit tests for language resolution, catalog parity, locale-aware formatting, and each email/SMS/PDF builder in Spanish; Playwright journeys per story. | Pass |
| IV. Expand-contract | One additive migration (nullable or defaulted columns); no contraction; no edits to past migrations. | Pass |
| V. Self-hostable | Catalogs ship in the repo; no external translation API at runtime; Spanish works on any install. | Pass |
| VI. Clinical/financial care | Translations hold text only. Units (mg, mL, kg), drug names, dosing math, and controlled-substance logic are untouched. Spanish clinical labels go through native-speaker review (SC-005). Payment state, tax, and invoice math never read the language. | Pass |
| Stack constraints | Stays on Next.js + tRPC + Drizzle. Adds one library inside that stack, justified in research R1 per the docs/I18N.md checklist. Language changes go through tRPC with Zod validation and existing role middleware. | Pass |
| Workflow: unfinished work behind a flag | Language selection ships behind a server-only, default-off `LANGUAGE_SELECTION_ENABLED` flag (pattern of the existing `*_ENABLED` flags in `.env.example`). While off, every surface resolves to English and no switch renders. Owner (a role, recorded in the Jira ticket), activation criteria (all four stories pass, `es` catalog at 100%, native-speaker review done), and removal date are recorded in the Jira ticket, per `docs/repository-governance.md`. | Pass |
| Security review path (auth, sessions) | Sign-in cookie handling (T022), saving the language at registration and invite acceptance (T042), and adding `language` to the tRPC context (T035) touch auth and session code. These PRs are labeled security-sensitive, take the security-owner review path in `docs/repository-governance.md`, and call the change out in the PR description. Language changes need no audit logging: they aren't clinical, financial, or access-control writes. | Pass (with review) |
| Workflow & public voice | Delivered as small per-surface PRs (docs/I18N.md "Reviewable scope"); no names or internal context in artifacts. | Pass |

No violations; Complexity Tracking not needed.

**Post-design re-check (after Phase 1)**: Still passing. The design added
`communications.language` (research R5) — an additive, nullable column on an
existing tenant-scoped table, written once per send attempt (IV, VI). The
tRPC contract keeps `/api/v1` unchanged and adds a `.strict()` response test
(II). Sign-in always rewrites the language cookie, so one person's choice
never carries over to the next user on a shared computer.

**Re-check after analysis (2026-11-10)**: Added the default-off release flag
and the security review path for auth-touching tasks (both were missing).
Client pages now put the visitor's switch before the client's saved language,
and the cookie stores only explicit choices, so a clinic default change
reaches everyone without a personal choice.

## Project Structure

### Documentation (this feature)

```text
specs/001-spanish-translation/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1 entities and migration
├── quickstart.md        # Phase 1 validation guide
├── contracts/
│   ├── language-resolution.md   # How the active language is chosen
│   ├── trpc-language.md         # New/changed tRPC procedures
│   └── message-catalog.md       # Catalog format, keys, parity check
└── tasks.md             # Created by /speckit-tasks
```

### Source Code (repository root)

```text
apps/web/
├── messages/
│   ├── en.json                     # NEW: canonical English catalog
│   └── es.json                     # NEW: Spanish catalog
├── i18n/
│   ├── config.ts                   # NEW: supported languages, default
│   ├── resolve.ts                  # NEW: pure language resolver (+ test)
│   ├── request.ts                  # NEW: language for the current request
│   ├── messages.ts                 # NEW: catalogs with English fallback + translator for emails/SMS/PDF
│   └── clinic-default-cache.ts     # NEW: 60-second clinic default lookup
├── app/layout.tsx                  # html lang from active language
├── app/(auth)/…                    # sign-in screens + language switch
├── app/(dashboard)/…               # staff workspace strings
├── app/portal, book, sign, treatment-plan, email-preferences/…  # owner pages
├── components/…                    # shared UI strings; LanguageSwitch component
├── lib/locale/format.ts            # gains a language argument
├── lib/email.ts                    # client + staff-auth emails take a language
├── lib/messaging/…                 # SMS reminder bodies take a language
├── lib/pdf.ts                      # document labels take a language
├── offline/                        # offline shell strings
├── server/routers/settings.ts      # user language + clinic default
└── server/routers/clients.ts       # client preferred language

packages/db/
├── schema/users.ts, practices.ts, clients.ts, communications.ts  # new columns
└── drizzle/<next>_language_preferences.sql     # additive migration (0117 today)

apps/web/scripts/check-translations.mjs  # NEW: fails CI on missing es keys (`pnpm i18n:check`)
docs/I18N.md                        # updated: chosen library, catalog rules
docs/i18n/glossary-es.md            # NEW: Spanish terminology glossary
```

**Structure Decision**: All UI translation lives in `apps/web` because every
in-scope surface — including client emails, SMS, and PDFs — is built there.
The `packages/email` lifecycle templates (welcome, trial, newsletter, NPS,
billing notices to clinic owners) are product-operator emails, not clinic
workflows, and stay English in this feature (see research R9).

## Delivery slices

Each slice is one or more small PRs that keep English behavior identical.

1. **Foundation** — release flag (off), library, catalogs, resolver, `html lang`, formatting helpers take a language, parity check in CI, glossary. No visible change for English users.
2. **Language preferences** — migration, user setting, clinic default, sign-in language switch and cookie (Story 2, plus switching in Story 1).
3. **Staff workspace** — translate by area (navigation shell → schedule → patients/records → billing → settings → remaining pages), replacing `toLocale*` calls in each area as it is touched (Story 1).
4. **Pet-owner pages** — client preferred language field; portal, booking, sign, treatment plan, email preferences (Story 3).
5. **Messages and documents** — client emails, staff auth emails, SMS reminders, PDFs, with the language fixed per send attempt (Story 4).
6. **Review and release** — native-speaker review against the glossary, layout pass at desktop and tablet widths, catalog at 100%, then switch the release flag on.

## Complexity Tracking

Not applicable — no constitution violations.
