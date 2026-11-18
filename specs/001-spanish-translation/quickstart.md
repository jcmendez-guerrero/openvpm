# Quickstart: Validating the Spanish Language Version

How to prove each user story works end to end. Design details live in
[data-model.md](data-model.md) and [contracts/](contracts/); this guide only
covers running and checking.

## Prerequisites

- Local setup from `CONTRIBUTING.md` (pnpm, PostgreSQL 16, `.env` from the
  example file).
- Migrations applied, including the new `*_language_preferences` migration:

```bash
pnpm db:migrate
```

```bash
pnpm db:rls && pnpm db:rls:test
```

- Turn on the release flag in `.env` (it defaults to off):

```text
LANGUAGE_SELECTION_ENABLED=true
```

- Seed data loaded and the app running:

```bash
pnpm dev
```

## Automated checks

```bash
pnpm i18n:check
```

Expected: `es: N/N keys, 100%` and exit code 0 (SC-002).

```bash
pnpm test
```

Expected: language resolver, catalog parity, formatting, tRPC language
procedures, `/api/v1/clients` contract, and Spanish email/SMS/PDF builder
tests all pass.

```bash
pnpm test:e2e
```

Expected: the Spanish journeys below pass, plus the layout screenshots at
1280 px and 768 px show no clipped text (SC-004).

## Manual scenarios

### 1. Sign-in screens (Story 2)

1. Set the browser language to Spanish and open `/login`. → Page is in Spanish; `<html lang="es">`.
2. Use the language switch to pick English, then Spanish again. → Page changes each time.
3. Set the browser to French and open `/login` in a private window. → English.

### 2. Staff workspace (Story 1)

1. Sign in as a seeded front-desk user; open personal settings; choose Español. → Workspace switches in under 2 s, no sign-out, a half-filled form keeps its input.
2. Book an appointment, open the patient, write a clinical note, create an invoice and take payment. → No English product text; dates are day-month with Spanish month names; amounts use the clinic's currency.
3. Sign out and sign in from a second browser. → Still Spanish.
4. In the same first browser, sign in as a different user with no language set. → English (clinic default), not the previous user's Spanish.
5. As Admin, set the clinic default to Español. → Within 60 seconds, users with no personal choice see Spanish on their next page load; users who chose English keep English.

### 3. Pet-owner pages (Story 3)

1. On a seeded client, set preferred language to Español.
2. Open that client's portal link, a treatment plan approval link, and the email preferences link. → All product text in Spanish; clinic name, services, and line items exactly as entered.
3. Open the public booking page in a Spanish browser with no client context. → Spanish, with a language switch.
4. On the Spanish client's portal, switch to English. → The page turns English; the client record still says Español.

### 4. Messages and documents (Story 4)

1. For the Spanish client, trigger an appointment reminder (email and SMS) using the local console email/SMS providers. → Subject, body, and footer in Spanish; the SMS test output reports its segment count.
2. Change the client back to English and retry the same reminder attempt. → The resend is identical to the first (still Spanish) and the provider accepts it.
3. Email an invoice and print a vaccination certificate for that client. → Headings, labels, and footer in Spanish; accents render correctly in the PDF; patient data and line items unchanged.
4. A client with no preference at an English-default clinic. → Messages in English.

### 5. Nothing changed for English users (SC-006)

0. Set `LANGUAGE_SELECTION_ENABLED=false` and restart. → Every page is English and no language switch appears, even with a Spanish browser and Spanish client records.

1. With every language setting left at its default, compare core screens and a sample invoice PDF against `main`. → Same wording and layout.
2. Call `GET /api/v1/clients` with an API key. → Response shape identical to before (no new field).
