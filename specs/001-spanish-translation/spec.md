# Feature Specification: Spanish Language Version

**Feature Branch**: `claude/speckit-spanish-translation-c0a09f`

**Created**: 2026-11-10

**Status**: Draft

**Input**: User description: "lets start with the simple, we need to create a spanish version of this app, so, make the need full to have the translation"

## Overview

OpenVPM is English-only today. Spanish-speaking clinics, staff, and pet owners
cannot use it in their own language. This feature adds Spanish as the first
non-English language, following the principles in
[docs/I18N.md](../../docs/I18N.md): one shared product, English as the source
and fallback, and language kept separate from formatting, country, and
country-specific legal or tax features.

"Start simple" means: translate the fixed text the product itself shows
(labels, buttons, menus, messages), not the records clinics type in, and not
any country-specific regulatory behavior.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Staff use the clinic workspace in Spanish (Priority: P1)

A receptionist, technician, or veterinarian who prefers Spanish switches their
language to Spanish once. From then on, every screen of the staff workspace —
navigation, buttons, form labels, validation and error messages, empty states,
confirmation dialogs, and dates, times, numbers, and money amounts — appears in
Spanish. Colleagues at the same clinic who prefer English keep seeing English.

**Why this priority**: Staff spend all day in the workspace; it is the core of
the product and the main barrier for Spanish-speaking clinics today.

**Independent Test**: Sign in as a staff user, choose Spanish, and walk the
daily flows (schedule an appointment, open a patient record, write a clinical
note, create and take payment on an invoice). No English product text appears.

**Acceptance Scenarios**:

1. **Given** a signed-in staff user with English selected, **When** they choose Spanish in their personal settings, **Then** the workspace re-renders in Spanish without signing out or losing unsaved form input.
2. **Given** a staff user who chose Spanish, **When** they sign out and sign in again on another device, **Then** the workspace opens in Spanish.
3. **Given** two staff users at the same clinic with different language choices, **When** both open the same patient record, **Then** each sees product text in their own language and the same clinic-entered data (names, notes, medications) unchanged.
4. **Given** a Spanish-language user, **When** a form fails validation or an action errors, **Then** the message is shown in Spanish.
5. **Given** a Spanish-language user, **When** they view dates, times, quantities, and money amounts, **Then** these follow Spanish formatting conventions (day-month order, Spanish month and weekday names) while the currency stays the clinic's configured currency.

---

### User Story 2 - Sign-in and first-visit screens in Spanish (Priority: P1)

Someone arriving at the sign-in, registration, password reset, invite
acceptance, or email verification screens sees them in Spanish when their
browser prefers Spanish, and can switch language before signing in.

**Why this priority**: A Spanish-speaking user must be able to get into the
product before they can pick a language preference; without this, Story 1 is
unreachable for them.

**Independent Test**: Open the sign-in page in a browser set to Spanish; confirm
all text is Spanish; switch to English and back from the page itself.

**Acceptance Scenarios**:

1. **Given** a visitor whose browser prefers Spanish, **When** they open the sign-in page, **Then** it appears in Spanish.
2. **Given** a visitor on any sign-in or registration screen, **When** they use the visible language switch, **Then** the page changes language, and the choice is saved to the account when they register or accept an invite.
3. **Given** a visitor whose browser prefers a language OpenVPM does not support, **When** they open the sign-in page, **Then** it appears in English.
4. **Given** an existing account with a saved language, **When** the user signs in on a computer where someone else chose another language, **Then** the workspace uses the account's saved language, not the previous person's choice.
5. **Given** a staff user with Spanish saved (or a clinic default of Spanish for invites), **When** OpenVPM sends them an email verification, password reset, or staff invite email, **Then** that email is in Spanish.

---

### User Story 3 - Pet owners use the client portal in Spanish (Priority: P2)

A pet owner opening the client portal, online booking page, consent/signature
page, treatment plan approval page, or email preference page sees it in their
preferred language. Clinic staff can record each client's preferred language on
the client record.

**Why this priority**: Many clinics serve Spanish-speaking owners even when
staff work in English. High value, but it builds on the language groundwork
from Stories 1–2.

**Independent Test**: Set a client's preferred language to Spanish, open that
client's portal link and a treatment plan approval link, and confirm all
product text is Spanish.

**Acceptance Scenarios**:

1. **Given** a client record marked Spanish, **When** the owner opens their portal or a link sent to them, **Then** the page appears in Spanish.
2. **Given** an owner on a public page (e.g. online booking) with no client record yet, **When** their browser prefers Spanish, **Then** the page appears in Spanish and offers a language switch.
3. **Given** an owner viewing a Spanish page, **When** the page shows clinic-entered content (clinic name, service names, treatment plan line items), **Then** that content is shown as the clinic entered it.

---

### User Story 4 - Messages and documents sent to clients in Spanish (Priority: P3)

Emails, text messages, and printable documents that OpenVPM generates for pet
owners — appointment reminders, invoices and receipts, vaccination
certificates, treatment plans — use the client's preferred language for all
fixed product text.

**Why this priority**: Completes the owner experience, but needs Story 3's
client language preference and careful review of every template, so it ships
last.

**Independent Test**: For a Spanish-preference client, trigger an appointment
reminder, email an invoice, and print a vaccination certificate; confirm the
fixed text in each is Spanish.

**Acceptance Scenarios**:

1. **Given** a client marked Spanish, **When** OpenVPM sends them a reminder or receipt, **Then** the subject, body, and footer text are Spanish.
2. **Given** a client marked Spanish, **When** staff print or email an invoice or vaccination certificate, **Then** headings, labels, and footer text are Spanish, while clinic-entered line items and patient data are unchanged.
3. **Given** a client with no language preference, **When** a message is sent, **Then** it uses the clinic's default language.

---

### Edge Cases

- A Spanish translation is missing for some text: the English text is shown in its place (never a blank, a raw key, or a crash), and the gap is detectable before release.
- Spanish text is typically 20–30% longer than English: buttons, table headers, menus, and printed documents must not clip, overlap, or break layout.
- Plural agreement ("1 cita" vs "3 citas"): counts must read correctly in Spanish.
- Clinic-entered data (patient names, notes, drug names, invoice lines) is never machine-translated or altered.
- Staff working in Spanish send a message to an English-preference client: the client's preference wins for client-facing output.
- A clinic that never turns on Spanish (including self-hosted installs) keeps working exactly as today.
- Clinical safety text (dosing, warnings, controlled-substance labels) must keep the exact meaning; units and abbreviations (mg, mL, kg) are not translated.
- Screens outside OpenVPM's control (e.g. a payment provider's hosted checkout page) may stay in that provider's language.

## Requirements *(mandatory)*

### Functional Requirements

**Language support and selection**

- **FR-001**: The system MUST support English and Spanish for all fixed product text in the areas in scope, and MUST be structured so a further language can be added without changing existing screens.
- **FR-002**: Each staff user MUST be able to choose their own language; the choice MUST persist with their account across sessions and devices.
- **FR-003**: Each clinic MUST have a default language used when no individual preference applies (new staff users, clients with no preference, clinic-wide output). Existing clinics default to English.
- **FR-004**: Before sign-in, the system MUST pick the language from the visitor's browser preference when supported, fall back to English otherwise, and offer a visible language switch.
- **FR-005**: Changing language MUST take effect without signing out and without discarding unsaved user input.
- **FR-006**: Each page MUST declare its active language so screen readers and browsers pronounce and handle it correctly.

**Translation coverage**

- **FR-007**: In each in-scope area, all fixed product text MUST be translated: navigation, page titles, buttons, labels, placeholders, help text, tooltips, empty states, confirmation dialogs, notifications, validation messages, error messages, and accessibility labels.
- **FR-008**: Dates, times, numbers, and money amounts MUST be formatted according to the active language's conventions; the currency itself MUST remain the clinic's configured currency.
- **FR-009**: Text containing counts MUST use correct singular/plural forms in Spanish.
- **FR-010**: When a translation is missing, the system MUST show the English text and MUST NOT show blank text or internal identifiers.
- **FR-011**: The project MUST provide an automated check that reports any in-scope product text missing a Spanish translation, so gaps are caught before release.
- **FR-012**: Clinic-entered and patient data MUST never be translated or modified by the language setting.
- **FR-013**: Spanish wording MUST use consistent veterinary and clinic terminology across the product, kept in a shared glossary that contributors follow.
- **FR-014**: Translations MUST contain only user-facing text; tax, legal, prescription, or reporting rules MUST NOT depend on the selected language.

**Client-facing (pet owner)**

- **FR-015**: Staff MUST be able to set and change a client's preferred language on the client record.
- **FR-016**: Client portal, online booking, consent/signature, treatment plan approval, and email preference pages MUST render in the language the visitor picked on the page if they used the switch, otherwise the client's preferred language when known, otherwise the browser preference, otherwise the clinic default. Using the switch on these pages MUST NOT change the client record.
- **FR-017**: Emails, text messages, and printable documents generated for a client MUST use that client's preferred language for fixed text, falling back to the clinic default.
- **FR-021**: Account emails sent to staff (email verification, password reset) MUST use the user's saved language, falling back to the clinic default; staff invite emails MUST use the clinic default (the invitee has no saved language yet).

**Boundaries**

- **FR-018**: The public developer API and its webhook payloads MUST NOT change shape or field values because of language settings.
- **FR-019**: A self-hosted install MUST support Spanish with no additional paid service or external translation provider.
- **FR-020**: The first release MUST cover all four user stories: the staff workspace, sign-in screens, the pet-owner pages, and emails, text messages, and printed documents sent to clients. Delivery may still land in small pieces in priority order (P1 → P2 → P3), but the release is complete only when all four are in Spanish.

## Clarifications

### Session 2026-11-10

- Q: Which areas ship in the first release? → A: Everything — staff workspace, sign-in screens, pet-owner pages, and client emails, text messages, and printed documents (Stories 1–4).

### Key Entities

- **Supported language**: A language the product offers (English, Spanish), with its display name and formatting conventions.
- **User language preference**: The language a staff user chose; belongs to the user account.
- **Clinic default language**: The language a clinic uses when no individual preference applies; belongs to the clinic.
- **Client language preference**: The language a pet owner prefers for portal pages, messages, and documents; belongs to the client record.
- **Translation catalog**: All fixed product text, each item with English source text and its Spanish translation.
- **Terminology glossary**: Approved Spanish terms for recurring veterinary and clinic concepts (e.g. appointment, invoice, patient, estimate).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Spanish-speaking staff user can complete the four core daily flows (book an appointment, open a patient record, write a clinical note, create and collect an invoice) with zero English product text visible.
- **SC-002**: 100% of fixed product text in the in-scope areas has a Spanish translation at release, as reported by the missing-translation check.
- **SC-003**: Switching language takes effect in under 2 seconds and requires no sign-out.
- **SC-004**: No in-scope screen shows clipped, overlapping, or truncated text in Spanish at standard desktop and tablet widths.
- **SC-005**: A native Spanish speaker with veterinary clinic experience reviews the core flows and finds no blocking wording or terminology issues.
- **SC-006**: English-language users see no change in wording, layout, or behavior after this feature ships.
- **SC-007**: Adding a third language requires only new translations and a language entry, with no changes to individual screens.

## Assumptions

- Read-only users (the viewer role, or a clinic in read-only billing mode) can switch the language on their own device, but it can't be saved to their account, because those accounts can't make any changes.
- A language change made on one device applies to other devices at their next sign-in; a browser that is already signed in keeps its current language until then.
- Spanish means one neutral Latin American Spanish variant for the first release; regional variants (Spain, Mexico, etc.) are not separated.
- Formatting follows the language by default; a separate per-clinic regional format setting (as described in docs/I18N.md) can come later.
- Translations are written and reviewed by people (contributors, ideally a native speaker with clinic experience); machine translation may be used for drafts only and is never used at runtime.
- Clinic-entered content (patient records, notes, service and product names, clinic templates) stays as entered.
- Out of scope: the marketing website, the external guides site, API reference docs, the README, and country-specific legal, tax, or e-invoicing features for Spanish-speaking countries.
- Internal operator tooling used only by the hosting team may stay English.
- The pet-owner photo capture page (`/capture/<token>`) is translated and follows the visitor's language (cookie, then browser), because the link carries no client identity. The SMS program pages (`/sms/<practiceId>` opt-in, privacy, and terms) stay English: they are compliance disclosures reviewed by carriers, like consent disclosures, and change only with a reviewed Spanish version.
- Spanish texts keep the English compliance footer ("Reply STOP to opt out or HELP for help."). It is the wording registered with the carriers, and STOP and HELP are the keywords carriers act on. A Spanish footer needs the clinic's messaging campaign registered with that wording first.
- Staff roles and permissions are unchanged: any user can set their own language; roles that can edit client records can set a client's language; admins can set the clinic default.
- Adding user, clinic, and client language fields is an additive data change and follows the project's expand-contract migration rules.
- Work ships in small, reviewable pieces (one surface at a time) per docs/I18N.md; while work is in progress, untranslated areas show English through the fallback, but the release is not complete until all four stories are in Spanish (FR-020). Until then, language selection stays hidden behind a default-off release switch, so no clinic sees a half-translated product.
