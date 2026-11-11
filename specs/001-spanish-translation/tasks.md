---
description: "Task list for the Spanish Language Version"
---

# Tasks: Spanish Language Version

**Input**: Design documents from `/specs/001-spanish-translation/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included. Constitution III requires unit tests for new logic and Playwright coverage for user-facing flows, and each contract lists its required tests. Write each test first and confirm it fails before implementing.

**Organization**: Grouped by user story (spec.md). Paths are relative to the repository root. All app code is in `apps/web`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: US1 = staff workspace (P1), US2 = sign-in screens (P1), US3 = pet-owner pages (P2), US4 = client messages and documents (P3)

## Rules for every translation task

- Move every user-visible string in the named files (text, placeholders, `aria-label`, `title`, toasts, Zod/tRPC error text shown to users) into `apps/web/messages/en.json` under the area's namespace, add the Spanish value to `apps/web/messages/es.json`, and read it through `useTranslations` from `use-intl` (client components) or `getTranslatorFor(await getRequestLanguage())` from `@/i18n/messages` and `@/i18n/request` (server components).
- Use ICU plurals for counts (`{count, plural, one {…} other {…}}`).
- Replace direct `toLocaleDateString` / `toLocaleTimeString` / `toLocaleString` / `Intl.*` calls in those files with the helpers in `apps/web/lib/locale/format.ts`, passing the active language.
- Never translate clinic-entered data, drug names, or units (mg, mL, kg).
- Use the terms in `docs/i18n/glossary-es.md`.
- English output must stay identical (SC-006).
- After the area is done, enable the no-raw-JSX-text lint rule for its folder (T010).
- Existing UI tests that read component source: switch `readFileSync(path, "utf8")` to `readTranslatedSource(path)` from `@/i18n/translated-source`, which puts the English catalog text back in place of static `t("…")` calls. Only keys built at runtime (lists keyed by `labelKey`) need their assertions edited.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the library and empty catalogs, with no visible change.

- [X] T001 Add `next-intl` to `apps/web/package.json` with `pnpm --filter @openpims/web add next-intl`, and wire the plugin into `apps/web/next.config.js` (without-routing mode, request config at `apps/web/i18n/request.ts`) — *Done note: used `use-intl` (the pure-JS core of next-intl, same API) instead of `next-intl`, whose 4.x release installs native build tools (`@swc/core`, `@parcel/watcher`) for a message extractor we don't use; no Next plugin needed*
- [X] T002 [P] Create `apps/web/i18n/config.ts` exporting `SUPPORTED_LANGUAGES = ["en", "es"] as const`, `type Language`, `DEFAULT_LANGUAGE = "en"`, `LANGUAGE_COOKIE = "NEXT_LOCALE"`, and a Zod schema `languageSchema = z.enum(SUPPORTED_LANGUAGES)`
- [ ] T003 Add the default-off release flag `LANGUAGE_SELECTION_ENABLED`: add `LANGUAGE_SELECTION_ENABLED=false` with a comment to `.env.example` (same style as `AMBULATORY_WORKSPACE_ENABLED`), read it server-only as `isLanguageSelectionEnabled()` in `apps/web/i18n/config.ts`, and open the Jira ticket that records the flag's owner (a role), activation criteria (all four stories pass, `es` catalog at 100%, native-speaker review done), and removal date, per `docs/repository-governance.md` — *Done note: flag added to `.env.example` and `isLanguageSelectionEnabled()`; the Jira ticket (owner role, activation criteria, removal date) is still to be opened*
- [X] T004 [P] Create `apps/web/messages/en.json` and `apps/web/messages/es.json` with a `common` namespace (actions: save, cancel, delete, edit, back, close, search, loading; states: empty, error, retry) following `specs/001-spanish-translation/contracts/message-catalog.md`
- [X] T005 [P] Create `docs/i18n/glossary-es.md` with the starting terms from research R11 (cita, factura, presupuesto, paciente, cliente/propietario, nota clínica, sustancia controlada, recordatorio, vacuna, receta) as a table of English term, Spanish term, and notes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Language resolution, storage, formatting, and the missing-translation check. Every story depends on this phase.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests first

- [X] T006 [P] Write `apps/web/i18n/__tests__/resolve.test.ts` covering every row of the surface table in `specs/001-spanish-translation/contracts/language-resolution.md`, unsupported values (`fr`, `""`, `"ES "`, `"xx-YY"`), Accept-Language quality weights (`es-MX;q=0.9,en;q=0.8` → `es`), message surfaces ignoring cookie and browser, the release-flag case (`enabled: false` → `en` everywhere), and cookie-before-client on client pages (sign-in cookie handling is tested in T019)
- [X] T007 [P] Add `apps/web/lib/locale/__tests__/format-language.test.ts`: `formatCurrency`/`formatDate` with no language equal today's output for US, GB, IT; with `language: "es"` and country `US` produce Spanish output; `es` + `MX` uses `es-MX`
- [X] T008 [P] Write `apps/web/i18n/__tests__/catalog-parity.test.ts` asserting the checker in `apps/web/scripts/check-translations.mjs` fails for a missing key, an extra key, mismatched `{placeholders}`, and invalid ICU syntax, and passes on matching catalogs — *Done note: test lives at `apps/web/i18n/__tests__/catalog-parity.test.ts`*
- [X] T009 [P] Write `apps/web/i18n/__tests__/plurals.test.ts`: render one plural key (e.g. `schedule.appointmentCount`) from both catalogs for counts 0, 1, and 5 and assert the Spanish forms (`0 citas`, `1 cita`, `5 citas`) and English forms (FR-009) — *Done note: imports `getTranslatorFor` from `apps/web/i18n/messages.ts`*

### Implementation

- [X] T010 Create `scripts/check-translations.mjs` implementing the four rules and the `es: N/N keys, X%` summary from `contracts/message-catalog.md`; add root script `"i18n:check": "node scripts/check-translations.mjs"` to `package.json`, a step running it in `.github/workflows/ci.yml` next to `pnpm type-check`, and an ESLint override in `apps/web` (create `apps/web/.eslintrc.json` extending `next/core-web-vitals` if no config exists) that enables `react/jsx-no-literals` only for an explicit list of translated folders (start empty) — *Done note: checker is `apps/web/scripts/check-translations.mjs` (the ICU parser is an apps/web dev dependency under pnpm's strict layout); root `pnpm i18n:check` and a CI step run it. The ESLint part moved to T070: the repo has no ESLint config and `next build` lints, so adding one now would switch lint on for the whole app*
- [X] T011 Implement the pure resolver `resolveLanguage(context)` in `apps/web/i18n/resolve.ts` per `contracts/language-resolution.md` (makes T006 pass), including the `enabled` flag short-circuit
- [X] T012 Add optional `language?: Language` to `localeForCountry`, `formatCurrency`, and `formatDate` in `apps/web/lib/locale/format.ts` (format locale = `${language}-${country}`, default `en` keeps current output), and add `formatTime` / `formatDateTime` helpers taking `(value, { language, country, timeZone })` (makes T007 pass) — *Done note: `formatTime`/`formatDateTime` deferred to the first US1 task that needs them, to avoid unused code*
- [ ] T013 Add the four columns from `data-model.md` to `packages/db/schema/practices.ts` (`defaultLanguage`), `packages/db/schema/users.ts` (`language`), `packages/db/schema/clients.ts` (`preferredLanguage`), and `packages/db/schema/communications.ts` (`language`); generate `packages/db/drizzle/<next>_language_preferences.sql` using the next free migration number when the PR is cut (`0117` today) with the four `ALTER TABLE … ADD COLUMN` statements; run `pnpm db:migrate`, `pnpm db:rls`, `pnpm db:rls:test`, `pnpm db:drift`, and `pnpm --filter @openpims/db db:migrations:conformance` — *Done note: schema columns added and `packages/db/drizzle/0117_language_preferences.sql` generated (exactly four ADD COLUMN statements); `db:migrations:check` passes. `db:migrate`, `db:rls`, `db:rls:test`, `db:drift`, and conformance not run yet: they need a configured database*
- [X] T014 Create `apps/web/i18n/request.ts` (`getRequestConfig`): read the release flag, the cookie (an explicit choice only; for staff it holds the saved user language), `Accept-Language`, and the surface (never the user row); read `practices.default_language` through a per-practice in-memory cache with a 60-second lifetime in `apps/web/i18n/clinic-default-cache.ts`, skipped when the cookie is set; call `resolveLanguage`; load `messages/<lang>.json` merged over `en.json` so missing keys fall back to English; log missing keys only outside production (FR-010) — *Done note: `getRequestLanguage()` in `apps/web/i18n/request.ts` plus `apps/web/i18n/clinic-default-cache.ts` (unit-tested); returns English without touching cookies or headers while the flag is off. Client pages resolve like staff/public pages until T050. Missing keys fall back to English at load time; the CI checker reports them*
- [X] T015 Create `apps/web/i18n/messages.ts` exporting `getTranslatorFor(language)` built on `createTranslator` from `use-intl/core`, for code outside React (emails, SMS, PDFs, tRPC error text) — *Done note: `getTranslatorFor` lives in `apps/web/i18n/messages.ts` next to the catalogs instead of a separate `server-translator.ts`*
- [X] T016 Update `apps/web/app/layout.tsx` to set `<html lang={language}>` from `getLocale()`, wrap children in `NextIntlClientProvider` (messages for the active language), and translate the "Skip to main content" link; confirm the existing English pages render unchanged — *Done note: provider is `apps/web/components/common/intl-provider.tsx` (`AppIntlProvider`), which also passes the release flag to the client*
- [X] T017 [P] Create `apps/web/components/common/language-switch.tsx`: a select listing languages by native name (English, Español) that writes the `NEXT_LOCALE` cookie and calls `router.refresh()` without a full reload, so unsaved form state survives (FR-005); optional `onChange` prop for callers that also persist the choice. Renders nothing while the release flag is off (the server passes the flag down). Choosing "Clinic default" deletes the cookie instead of writing one

**Checkpoint**: `pnpm test`, `pnpm i18n:check`, and `pnpm build` pass; English UI is unchanged; with the flag off nothing changes even with an `es` cookie; with the flag on, switching the cookie to `es` changes the `common` strings.

---

## Phase 3: User Story 1 - Staff use the clinic workspace in Spanish (Priority: P1) 🎯 MVP

**Goal**: A staff user picks Spanish once and the whole workspace — text, errors, dates, numbers, money — is Spanish, while colleagues keep their own language.

**Independent Test**: quickstart.md scenario 2 — sign in, choose Español, book an appointment, open a patient, write a clinical note, create and collect an invoice with no English product text; sign in on a second browser and it stays Spanish.

### Tests for User Story 1

- [X] T018 [P] [US1] Write `apps/web/server/__tests__/settings-language.test.ts`: `setMyLanguage` changes only the caller's row and rejects values outside the list; `updatePractice` with `defaultLanguage` requires Admin; `getMyLanguage` returns `{ language, clinicDefault }` (per `contracts/trpc-language.md`) — *Done note: 7 tests pass*
- [X] T019 [P] [US1] Write `apps/web/lib/__tests__/auth-language-cookie.test.ts`: sign-in writes the cookie when `users.language` is set and deletes it when null; shared computer: user A chose `es` and signed out, user B has no saved choice and clinic default `en` → after B signs in there is no cookie and B sees `en`; then the clinic default changes to `es` → B sees `es` within the 60-second cache window — *Done note: 6 tests pass; the sign-in helper is `apps/web/i18n/sign-in-cookie.ts`*
- [ ] T020 [P] [US1] Write `e2e/spanish-staff.spec.ts`: choose Español in settings with a half-filled form open (input kept), complete the four core flows asserting Spanish headings and no known English strings, sign in again in a fresh context (still Spanish), and a second user with no choice sees English; assert the switch finishes (Spanish heading visible) in under 2 seconds after selection (SC-003) — *Done note: not written yet: needs a running app and database, and the "no English text" checks can only pass once every US1 area is translated*

### Implementation for User Story 1

- [X] T021 [US1] Add `getMyLanguage` and `setMyLanguage` (`protectedProcedure`, Zod `languageSchema.nullable()`, scoped by `ctx.session.user.id` and `practiceId`), and extend `getPractice` / `updatePractice` with `defaultLanguage`, in `apps/web/server/routers/settings.ts` — *Done note: `getPractice` already returns every practice column, so only `updatePractice` input changed*
- [X] T022 [US1] In `apps/web/lib/auth.ts`, after a successful sign-in, write the `NEXT_LOCALE` cookie when `users.language` is set and delete it when null (both credential providers at the `authorize` paths around lines 111 and 195, or a shared `events.signIn` hook), per `contracts/language-resolution.md`. **Security review**: auth/session change — label the PR security-sensitive and use the security-owner review path in `docs/repository-governance.md`. — *Done note: both credential providers call `syncLanguageCookieAtSignIn`, which does nothing while the release flag is off and never blocks a sign-in*
- [X] T023 [US1] Add a "Language / Idioma" section with `LanguageSwitch` (persisting through `settings.setMyLanguage`, option "Clinic default") and an Admin-only clinic default language select to `apps/web/app/(dashboard)/settings/page.tsx`; choosing "Clinic default" saves null and deletes the cookie; the whole section is hidden while the release flag is off — *Done note: Settings is admin-only, so the personal language picker lives in the sidebar user area for every role (`components/layout/my-language-switch.tsx`); the clinic default is a save-on-change field in Settings › Practice › Region & Tax (`components/settings/clinic-language-field.tsx`). Viewers and read-only clinics can't save (mutations are blocked by design), so the choice applies to that browser and a message explains it wasn't saved*
- [X] T024 [US1] Translate the workspace shell: `apps/web/app/(dashboard)/layout.tsx`, `apps/web/components/layout/sidebar.tsx`, `top-bar.tsx`, `trial-badge.tsx`, `verify-email-banner.tsx`, `recovery-review-banner.tsx`, and shared `apps/web/components/ui` and `apps/web/components/common` text (namespaces `shell`, `ui`) — *Done note: sidebar, top bar, dashboard layout, command search, loading, recovery banner, trial badge, verify-email banner. Server-generated messages in the banner wait for T035. Source-reading UI tests now use `readTranslatedSource` (`apps/web/i18n/translated-source.ts`)*
- [X] T025 [P] [US1] Translate the dashboard home: `apps/web/app/(dashboard)/page.tsx`, `apps/web/components/dashboard/` (including chart labels in `dashboard-charts.tsx`), `apps/web/app/(dashboard)/post-login/` (namespace `dashboard`) — *Done note: dashboard page, KPI cards, follow-up queue, upcoming appointments, unfinished field visits, activation checklist and charts. `post-login` has no visible text. `dashboard.getCharts` now also returns `dateInput` and `species`, so charts relabel days and species in the chosen language (English labels unchanged). Onboarding pathway text (`lib/onboarding/intent`) is done under T030; the `Unassigned` doctor name from the server waits for T035*
- [X] T026 [P] [US1] Translate scheduling: `apps/web/app/(dashboard)/schedule/`, `apps/web/components/schedule/`, `apps/web/app/(dashboard)/whiteboard/` (namespace `schedule`); weekday and month names come from the formatting helpers — *Done note: schedule page, whiteboard, calendar link popover. Dates, times, hour labels and the week range follow the chosen language (English output unchanged). Species names on these screens wait for the shared species labels (T027). Server error text waits for T035*
- [X] T027 [P] [US1] Translate clients and patients: `apps/web/app/(dashboard)/clients/`, `apps/web/app/(dashboard)/patients/`, `apps/web/components/patients/` (namespaces `clients`, `patients`) — *Done note: clients list/new/edit/detail, patients list/new/edit/duplicates/chart, and the four `components/patients/` files. Shared hook `lib/patients/use-species-label.ts`; species, sex, patient status and allergy severity live under `patients.*`. `formatClinicalDate*`, `clinicalDateLabel`, the trend builders and `useCurrencyFormatter` take the language. Kept English on purpose: the SMS consent disclosure and rabies/vaccination certificate data (regulatory), and the downloadable medical-summary PDF content (US4). Server-provided text (merge blocker reasons and counts, certificate missing-field names, history item titles) waits for T035. The test helper now resolves each `t(...)` call against the nearest `useTranslations` above it*
- [X] T028 [P] [US1] Translate clinical records: `apps/web/app/(dashboard)/records/`, `encounters/`, `lab-reports/`, `lab-results/`, `apps/web/components/records/`, `apps/web/components/encounters/`, `apps/web/components/labs/`, `apps/web/components/SoapNoteEditor.tsx`, `apps/web/components/SoapNoteDisplay.tsx` (namespaces `records`, `encounters`, `labs`); SOAP section headings translate, note content does not — *Done note: shared components done (`components/labs/lab-navigation`, `SoapNoteEditor`, and in `components/records/`: recent items, reconciliation actions, correction control, document upload, weight correction, photo capture, consent signing, inventory picker, vaccination fields, field SOAP card, prescription lifecycle). SOAP section headings live in `records.soap`. Also done: `encounter-vitals-card`, `ambulatory-visit-records-card` and `components/encounters/treatment-plan-composer` (prescription safety warning text comes from the server, T035). Pages done: `records/replace-soap`, `lab-results` (lab event types, flags and statuses translated) `lab-reports` and `records/new-soap` (SOAP template names and prompts from `lib` stay as written; they are inserted into the clinical note). `records` is also done (prescription label PDF content stays English for US4). The encounter workspace (`encounters/[appointmentId]`) is done too; discharge-instruction PDF content stays English for US4. Rabies certificate checks now also recognise "rabia" and "antirrábica" (`lib/records/vaccination-policy.ts`), so they apply when staff type the vaccine name in Spanish. Consent template text from the server stays as written (legal content)*
- [X] T029 [P] [US1] Translate billing: `apps/web/app/(dashboard)/billing/`, `apps/web/components/billing/` (namespace `billing`); money only through `formatCurrency` with the clinic currency — *Done note: billing list, invoice detail, payments, credits, refunds, medication dispense queue, wellness billing, new invoice/estimate, service picker and Cloud billing cadence picker. Invoice statuses, tabs and payment methods translate from their stored values; money goes through `formatCurrency` with the chosen language. Invoice PDF content is US4*
- [X] T030 [P] [US1] Translate settings and onboarding: `apps/web/app/(dashboard)/settings/`, `apps/web/components/settings/` (all tabs and wizards), `apps/web/app/(dashboard)/onboarding/`, `apps/web/components/onboarding/`, `apps/web/components/welcome/`, `apps/web/components/tour/` (namespaces `settings`, `onboarding`) — *Done note: every settings tab in `settings/page.tsx` and every file in `components/settings/`, `components/onboarding/`, `components/welcome/` and `components/tour/` reads the catalog (namespaces `settings.*`, `onboarding.*`, `welcome.*`, `tour.*`, `migration.*`). Shared English sources stay in `lib/` where the server or tests also read them (`lib/onboarding/*`, `lib/import/sources.ts`, `welcome-copy.ts`); catalog tests keep the English catalog equal to them. Tour and guide steps take a translator from `tour-provider`. Country names use `Intl.DisplayNames` in the active language. Moved out: server-built text such as the messaging `statusDetail` and Stripe plan names and blurbs from `lib/billing/plans` (T035/T070), and the sign-up form's use of the onboarding labels (T040)*
- [X] T031 [P] [US1] Translate inventory and controlled substances: `apps/web/app/(dashboard)/inventory/`, `apps/web/components/inventory/`, `apps/web/app/(dashboard)/controlled-substances/` (namespaces `inventory`, `controlledSubstances`); log wording reviewed against the glossary; no change to log logic — *Done note: inventory page, markup input and controlled-substance log read the catalog. Category, alert, stock-status, DEA schedule, action and unit labels became catalog keys; stored values and log logic are unchanged, and logged units from entries are shown as recorded. Log terms follow the glossary (sustancia controlada) plus testigo, administrado, desechado, devuelto, recibido. Dates use the active language*
- [X] T032 [P] [US1] Translate communication pages: `apps/web/app/(dashboard)/inbox/`, `apps/web/app/(dashboard)/care-reminders/`, `apps/web/app/(dashboard)/recalls/` (namespaces `inbox`, `reminders`) — *Done note: inbox, care reminders and vaccination recalls read the catalog (`inbox`, `reminders.care`, `reminders.recalls`). Message status labels come from `lib/communications/status.ts`, which now takes an optional translator (`communications.status`) and keeps English output unchanged; the client detail log uses it too. Relative times and dates follow the active language. The outreach preview on care reminders stays English because it mirrors the server-built client message (T062)*
- [X] T033 [P] [US1] Translate reports and data pages: `apps/web/app/(dashboard)/reports/`, `apps/web/components/reports/`, `apps/web/app/(dashboard)/migration-archive/`, `apps/web/components/migration/`, `apps/web/components/templates/` (namespaces `reports`, `migration`, `templates`) — *Done note: reports page and charts, migration archive, migration review checklist and template catalog picker read the catalog (`reports.*`, `migration.archive`, `migration.reviewChecklist`, `templates.catalogPicker`). Staff PDF report titles and column headers follow the active language; CSV headers stay as machine-readable keys and row values stay as data. Dates and counts use the active language*
- [X] T034 [P] [US1] Translate agent and remaining pages: `apps/web/app/(dashboard)/agent/`, `apps/web/components/build/`, `apps/web/components/demo/`, `apps/web/components/brand/` (namespaces `agent`, `demo`); `apps/web/app/(dashboard)/admin/` operator tooling stays English (spec assumption) — *Done note: agent page, demo screens (login, welcome, role switcher, conversion bar), brand accent picker and the `/start` build flow (flow, scenes, mockups) read the catalog (`agent`, `demo.*`, `brand.*`, `build.*`). Build scene copy and the 'win' cards take the translator; role, practice-type and system labels stay English in `lib/` and `lib/build/__tests__/build-copy-catalog.test.ts` keeps the catalog equal. Kept as data: sample pet, owner and doctor names, sample service names and the clinic-hours times in the animated scenes. Kept English: the save-progress consent disclosure (`BUILD_SAVE_DISCLOSURE_TEXT`) and booking slugs. Admin tooling stays English*
- [X] T035 [US1] Translate user-facing tRPC error messages: where routers in `apps/web/server/routers/*.ts` throw `TRPCError` with text shown to staff, switch to message keys resolved through `getTranslatorFor(ctx.language)`; add `language` to the tRPC context in `apps/web/server/trpc.ts` from the request cookie. **Security review**: auth/session change — label the PR security-sensitive and use the security-owner review path in `docs/repository-governance.md`. — *Done note: routers keep throwing their English text; the tRPC `errorFormatter` swaps an exact match from the new `errors` catalog namespace (557 messages, including shared message constants) for `ctx.language`, via `apps/web/i18n/server-errors.ts`. Error codes, `zodError`, dynamic messages and error tracking are unchanged; `/api/v1` and `createCaller` do not go through the formatter. `ctx.language` comes from the `NEXT_LOCALE` cookie (allowlisted), then the clinic default for signed-in staff (tenant-scoped, cached, English on lookup failure), then Accept-Language for signed-out callers; English while the release flag is off. `i18n/__tests__/server-errors.test.ts` includes a drift guard that fails when a router throws a literal message missing from the catalog. The treatment-plan composer now reloads on the `CONFLICT` code instead of matching English text. Security review: language is read only by the error formatter and never by authorization or data access; the clinic-default read runs after session validation inside `withTenant`. The PR must be labeled security-sensitive and go through the security-owner review path*
- [X] T036 [US1] Translate the offline chart shell: generate `apps/web/offline/messages.generated.ts` from the `offline` namespace of both catalogs in `apps/web/scripts/build-offline.mjs`, and read the `NEXT_LOCALE` cookie in `apps/web/offline/index.tsx` (research R10); the generated config also carries the release flag, and the shell ignores the cookie and shows English while the flag is off — done: `scripts/offline-messages.mjs` writes the committed `offline/messages.generated.ts` (`offline` + `records.editor`, which the SOAP editor needs), a test keeps it equal to the catalogs, and esbuild fixes `LANGUAGE_SELECTION_ENABLED` at build time. The shell reads only the cookie; a clinic default without a picked language still shows English offline

**Checkpoint**: T018–T020 pass; quickstart scenario 2 passes; `pnpm i18n:check` reports 100% for the namespaces above.

---

## Phase 4: User Story 2 - Sign-in and first-visit screens in Spanish (Priority: P1)

**Goal**: Sign-in, registration, password reset, invite acceptance, and email verification follow the browser language, offer a switch, and carry the choice into the account.

**Independent Test**: quickstart.md scenario 1 — browser in Spanish opens `/login` in Spanish; switch works both ways; unsupported browser language gives English.

### Tests for User Story 2

- [ ] T037 [P] [US2] Write `e2e/spanish-auth.spec.ts`: `Accept-Language: es-MX` → Spanish `/login` with `<html lang="es">`; switch to English and back; `fr` → English; register with Spanish selected → new account lands in a Spanish workspace — *Done note: written, not run yet: it needs the app with a database and `LANGUAGE_SELECTION_ENABLED=true`; it skips itself while the flag is off. The /login switch both ways and the Spanish screens were checked by hand in the browser*
- [X] T038 [P] [US2] Write `apps/web/server/__tests__/register-language.test.ts`: registration and invite acceptance save the `NEXT_LOCALE` cookie value into `users.language` when supported, otherwise null — *Done note: the tests live in `apps/web/server/__tests__/auth-router.test.ts` ("saves the language picked before sign-in"), which already mocks everything registration needs. An invite with no choice leaves `users.language` unset (null for a new invitee)*

### Implementation for User Story 2

- [X] T039 [US2] Add `LanguageSwitch` to the auth pages under `apps/web/app/(auth)/` (shared layout if one exists, otherwise each page header) — *Done note: new `app/(auth)/layout.tsx`; the switch sits in a bar above the page, since a fixed corner switch covered the registration header on phones*
- [X] T040 [P] [US2] Translate `apps/web/app/(auth)/login/`, `register/`, `start/`, `demo-start/` (namespace `auth`), including user-facing validation messages from `apps/web/lib/auth-input-policy.ts` and `apps/web/lib/auth-password-policy.ts` — *Done note: the two policy files have no user-facing text; the login and registration messages that use their limits are in the catalog. `/start` and `/demo-start` reuse components translated in US1. Sign-in rate-limit text is rebuilt in the page from `loginRetryAfterSeconds`; `lib/login-error-message.ts` stays the English source*
- [X] T041 [P] [US2] Translate `apps/web/app/(auth)/forgot-password/`, `reset-password/`, `verify-email/`, `accept-invite/` (namespace `auth`)
- [X] T042 [US2] Save the cookie language into `users.language` on registration and invite acceptance in the server code behind `apps/web/app/(auth)/register/` and `accept-invite/` (e.g. `apps/web/server/routers/auth.ts`). **Security review**: auth/session change — label the PR security-sensitive and use the security-owner review path in `docs/repository-governance.md`. — *Done note: the tRPC context exposes `languageChoice` (the cookie, only while the flag is on); `register` saves it on the new owner and `acceptInvite` saves it when present. Security review still needed on the PR*
- [X] T043 [P] [US2] Translate the root error and not-found pages `apps/web/app/error.tsx`, `apps/web/app/global-error.tsx`, `apps/web/app/not-found.tsx` (namespace `errors`) — *Done note: namespace `errorPages`, not `errors`, which is the flat server-message map. `global-error` renders outside the root layout and its language provider, so it keeps English through `AppErrorBody`. `NotFoundView` became a client component so it can translate*

**Checkpoint**: T037–T038 pass; US1 and US2 together form the MVP.

---

## Phase 5: User Story 3 - Pet owners use the client portal in Spanish (Priority: P2)

**Goal**: Staff record a client's preferred language; portal, booking, signature, treatment plan, and email preference pages use it.

**Independent Test**: quickstart.md scenario 3 — client marked Español opens portal and treatment plan links in Spanish; clinic-entered content unchanged.

### Tests for User Story 3

- [ ] T044 [P] [US3] Write `apps/web/server/__tests__/clients-language.test.ts`: `clients.create`/`update` accept and store `preferredLanguage`, reject unsupported values, and can't update a client from another practice
- [ ] T045 [P] [US3] Write `apps/web/lib/compat/openvpm/__tests__/client-contract-unchanged.test.ts`: `toApiClient` output parses with a `.strict()` schema of today's fields, so `preferred_language` never leaks into `/api/v1` (Constitution II)
- [ ] T046 [P] [US3] Write `e2e/spanish-portal.spec.ts`: Spanish client opens portal token link, treatment plan link, sign link, and email preferences in Spanish; public booking with Spanish browser is Spanish with a switch; clinic names and line items match the seeded values

### Implementation for User Story 3

- [ ] T047 [US3] Extend `create`, `update`, and `getById` in `apps/web/server/routers/clients.ts` with `preferredLanguage` (`languageSchema.nullable().optional()`); leave `apps/web/lib/compat/openvpm/mappers.ts` unchanged
- [ ] T048 [US3] Add a "Preferred language" select (Clinic default / English / Español) to the client forms in `apps/web/app/(dashboard)/clients/new/page.tsx` and `apps/web/app/(dashboard)/clients/[id]/edit/page.tsx`, and show it on the client detail page; the select is hidden while the release flag is off (CSV import in T049 may still store the value)
- [ ] T049 [P] [US3] Accept an optional `preferred_language` column in the client CSV import (`apps/web/lib/csv/import.ts`, `apps/web/lib/csv/parse.ts`, `apps/web/lib/import/normalize.ts`): blank or unknown values import as null with a review warning
- [ ] T050 [US3] Make the `client` surface in `apps/web/i18n/request.ts` read the client's language: for portal sessions from the portal session's client, for token pages (`portal/[token]`, `portal/access/[token]`, `sign/[token]`, `treatment-plan/[token]`, `email-preferences`) from the client the token already resolves to, using the existing tenant-scoped lookups. Order is cookie → client language → browser → clinic default, so the page switch always wins; nothing on these pages writes `clients.preferred_language`
- [ ] T051 [P] [US3] Translate portal pages: `apps/web/app/portal/` (all routes, both session and `[token]` variants) and `apps/web/components/portal/` (namespace `portal`); add `LanguageSwitch` to the portal header; the switch writes only the cookie, never the client record
- [ ] T052 [P] [US3] Translate public booking: `apps/web/app/book/[slug]/page.tsx`, `apps/web/app/portal/book/`, `apps/web/app/portal/[token]/book/`, `apps/web/components/booking/` (namespace `booking`), with `LanguageSwitch`
- [ ] T053 [P] [US3] Translate `apps/web/app/sign/[token]/page.tsx` and `apps/web/app/sign/[token]/sign-client.tsx` (namespace `sign`); consent document text written by the clinic stays as entered
- [ ] T054 [P] [US3] Translate `apps/web/app/treatment-plan/[token]/page.tsx` and `apps/web/app/treatment-plan/[token]/treatment-plan-decision-client.tsx` (namespace `treatmentPlan`), replacing its `Intl` calls with the formatting helpers
- [ ] T055 [P] [US3] Translate `apps/web/app/email-preferences/page.tsx` (namespace `emailPreferences`)
- [ ] T056 [US3] Use the active language in date output from `apps/web/lib/portal/date.ts` and `apps/web/server/routers/portal.ts`

**Checkpoint**: T044–T046 pass; quickstart scenario 3 passes.

---

## Phase 6: User Story 4 - Messages and documents sent to clients in Spanish (Priority: P3)

**Goal**: Client emails, SMS, and printable documents use the client's language; staff account emails use the user's language; resends stay identical.

**Independent Test**: quickstart.md scenario 4 — reminder email and SMS, invoice email, and vaccination certificate are Spanish for a Spanish client; retrying the same attempt after switching the client to English still sends the identical Spanish message.

### Tests for User Story 4

- [ ] T057 [P] [US4] Write `apps/web/lib/__tests__/email-language.test.ts`: `sendAppointmentReminder`, `sendVaccinationReminder`, `sendCareReminder`, `sendInvoiceEmail`, `sendClientPaymentReceiptEmail` with `language: "es"` produce Spanish subject, body, and footer; omitted language produces today's English output exactly (snapshot)
- [ ] T058 [P] [US4] Write `apps/web/lib/__tests__/sms-language.test.ts`: Spanish bodies from `sendAppointmentReminderSms`, `sendVaccinationReminderSms`, `sendCareReminderSms`, and report each template's segment count (GSM-7 vs UCS-2) at typical field lengths (research R6)
- [ ] T059 [P] [US4] Write `apps/web/lib/messaging/__tests__/reminder-language-frozen.test.ts`: the language is resolved and stored on `communications.language` at claim; a reclaimed attempt rebuilds an identical body from the stored value after the client's language changes; a new attempt re-resolves; null on legacy rows means English
- [ ] T060 [P] [US4] Write `apps/web/lib/__tests__/pdf-language.test.ts`: invoice, vaccination certificate, vaccination history, medical summary, and discharge instructions in Spanish contain Spanish labels and render `á é í ó ú ñ ¿ ¡` (text extraction); English output unchanged
- [ ] T061 [P] [US4] Write `apps/web/lib/__tests__/auth-email-language.test.ts`: verification and password reset use `users.language ?? clinic default`; staff invite uses the clinic default (the staff-email part covers FR-021 / Story 2 scenario 5; it lives here because it shares `apps/web/lib/email.ts` with the client emails)

### Implementation for User Story 4

- [ ] T062 [US4] Add a `language?: Language` parameter (default `en`) to the five client email builders and three staff account emails (`sendVerificationEmail`, `sendPasswordResetEmail`, `sendStaffInviteEmail`) in `apps/web/lib/email.ts`; move their text to the `email.*` namespace and render through `getTranslatorFor(language)`; HTML layout stays in code (the staff-email part covers FR-021 / Story 2 scenario 5; it lives here because it shares `apps/web/lib/email.ts` with the client emails)
- [ ] T063 [US4] Pass a language to `appointmentReminderMessageFields` in `apps/web/lib/messaging/appointment-reminder.ts` (replace the hard-coded `"en-US"` with the formatting helpers) and to the SMS builders in `apps/web/lib/sms.ts`; move SMS text to the `sms.*` namespace
- [ ] T064 [US4] Store the resolved client language (`clients.preferred_language ?? practices.default_language`) on `communications.language` when a reminder attempt is claimed, and read it back when building every send of that attempt, in the reminder claim/send code (`apps/web/lib/messaging/reminders.ts`, `apps/web/lib/messaging/durable-sms-communication.ts`, `apps/web/app/api/cron/reminders/route.ts`)
- [ ] T065 [US4] Pass the client's language from every caller of the client email builders (invoice send and payment receipt paths in `apps/web/server/routers/billing.ts` and the reminder cron), and the user's language to the auth email callers in `apps/web/lib/auth-email-delivery.ts`
- [ ] T066 [US4] Add a `language` option to `generateInvoicePdf`, `generateMedicalSummaryPdf`, `generateVaccinationCertificatePdf`, `generateVaccinationHistoryCertificatePdf`, `generateReportPdf`, and `generateDischargeInstructions` in `apps/web/lib/pdf.ts`; move labels to the `pdf.*` namespace; widen or wrap columns where Spanish labels overflow
- [ ] T067 [US4] For `generatePrescriptionLabelPdf` and `generateRabiesVaccinationCertificatePdf` in `apps/web/lib/pdf.ts`, translate only the field labels; keep regulatory wording English unless a reviewer approves the Spanish text. Track this as a `risk:clinical` Jira ticket for human review
- [ ] T068 [US4] Pass the client's language (client documents) or active language (staff-only reports) from every PDF call site — find them with `grep -rnE "generate\w*Pdf|generateDischargeInstructions" apps/web --include=*.ts --include=*.tsx`
- [ ] T069 [US4] Add help text to the SMS settings in `apps/web/components/settings/messaging-tab.tsx` explaining that Spanish texts with accents use more segments (research R6)

**Checkpoint**: T057–T061 pass; quickstart scenario 4 passes.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T070 Sweep for remaining hard-coded strings and `toLocale*` calls in `apps/web` (`grep -rnE "toLocale(Date|Time)?String" apps/web --include=*.ts --include=*.tsx`); move what remains in in-scope surfaces onto the helpers and catalogs; enable `react/jsx-no-literals` for every translated folder in a new ESLint override (create `apps/web/.eslintrc.json` extending `next/core-web-vitals`, fixing any existing lint failures it surfaces)
- [ ] T071 [P] Write `e2e/spanish-layout.spec.ts`: screenshot the core staff, portal, and auth screens in Spanish at 1280 px and 768 px and assert no element's text overflows its box (SC-004); fix the overflows found
- [ ] T072 [P] Update `docs/I18N.md`: record the chosen library, catalog location and rules, language resolution order, and the "add a language" steps; link `docs/i18n/glossary-es.md`
- [ ] T073 [P] Add a "Translating OpenVPM" section to `CONTRIBUTING.md` pointing to `docs/I18N.md`, the glossary, and `pnpm i18n:check`
- [ ] T074 Native-speaker review of `apps/web/messages/es.json` against `docs/i18n/glossary-es.md`, prioritizing clinical, controlled-substance, and billing namespaces; record term changes in the glossary (SC-005)
- [ ] T075 Confirm `pnpm i18n:check` reports `es: 100%` (SC-002), then run `pnpm test`, `pnpm test:e2e`, and `pnpm build`
- [ ] T076 Run every scenario in `specs/001-spanish-translation/quickstart.md`, including scenario 5 (English unchanged, `/api/v1/clients` shape unchanged)
- [ ] T077 Switch the release on: when the activation criteria in the Jira ticket are met (T075 and T076 pass, T074 review done), enable `LANGUAGE_SELECTION_ENABLED` for hosted environments and change its `.env.example` default to `true` in a release PR that lists the flag change; then, by the removal date in the ticket, delete the flag, `isLanguageSelectionEnabled()`, and its branches in `apps/web/i18n/` and `apps/web/components/common/language-switch.tsx`

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: depends on Setup; blocks every story. Within it: T006–T009 before T010–T012; T013 before T014; T014 before T015–T017.
- **US1 (Phase 3)** and **US2 (Phase 4)**: both start after Phase 2 and don't depend on each other. US2's T042 uses the `users.language` column from T013, not US1 code.
- **US3 (Phase 5)**: starts after Phase 2. Uses `LanguageSwitch` (T017), not US1/US2 code.
- **US4 (Phase 6)**: starts after Phase 2. Needs `clients.preferred_language` (T013). Setting it through the UI needs T047–T048 (US3), but tests set the column directly.
- **Polish (Phase 7)**: after all four stories (FR-020).

### Within each story

- Tests first, and they must fail.
- Router changes (T021, T047) before UI that calls them (T023, T048).
- In US1, the shell (T024) first so later areas render inside a translated frame.
- In US4, T062–T063 before T064–T065; T066 before T068.

---

## Parallel Execution Examples

### Phase 2

```text
T006 resolve.test.ts   |  T007 format-language.test.ts  |  T008 catalog-parity.test.ts
then: T011 resolve.ts  |  T012 format.ts                |  T010 check-translations.mjs
```

### User Story 1 (after T021–T024)

```text
T025 dashboard | T026 schedule | T027 clients/patients | T028 records
T029 billing   | T030 settings | T031 inventory/CS     | T032 inbox
T033 reports   | T034 agent/remaining
```

Each area touches its own folder and its own catalog namespace. Keep catalog keys grouped by namespace to limit merge conflicts in `en.json` and `es.json`.

### User Story 3

```text
T051 portal | T052 booking | T053 sign | T054 treatment plan | T055 email preferences
```

### User Story 4

```text
T057 email tests | T058 SMS tests | T059 frozen-language test | T060 PDF tests | T061 auth email tests
```

---

## Implementation Strategy

### MVP first (US1 + US2)

1. Phase 1 → Phase 2 (no visible change; English identical; release flag off).
2. US1 + US2 → a Spanish-speaking staff member can sign in and work all day in Spanish.
3. **Stop and validate** with quickstart scenarios 1, 2, and 5 (flag on locally). The flag stays off in every shared environment until T077.

### Incremental delivery

- Each translation task is its own small PR (docs/I18N.md "Reviewable scope"). English stays identical in every PR, and untranslated areas fall back to English while work continues.
- Then US3 (pet-owner pages), then US4 (messages and documents).
- Per FR-020 the release is complete only when all four stories pass and the catalog is at 100%.

### Notes

- `[P]` = different files, no unfinished dependency.
- Never translate clinic-entered data; never let language affect tax, payments, dosing, or controlled-substance logic.
- T067 needs human sign-off before Spanish regulatory wording ships.
- T022, T035, and T042 touch auth or session code and take the security-owner review path.
- The release flag stays off until T077; untranslated areas are never shown to clinics.
