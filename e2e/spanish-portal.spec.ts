import { randomBytes } from "node:crypto";
import { test, expect, type Browser, type Page } from "@playwright/test";
import {
  englishPhrases,
  esText,
  expectNoEnglish,
  flagOffReason,
  languageSelectionOn,
  languageSwitch,
  quietOverlays,
  seedUser,
  signIn,
  trpcMutation,
  trpcQuery,
} from "./helpers/spanish";
import {
  CONSENT_ELECTRONIC_SIGNATURE_INTENT,
  CONSENT_SIGNER_AUTHORITY_ATTESTATION,
} from "../apps/web/lib/consult/consent-template";

// T046: a Spanish-speaking client sees their links in Spanish (US3).
// Needs the standard seed: `pnpm db:seed`. The admin session creates the links.
test.skip(!languageSelectionOn, flagOffReason);
test.describe.configure({ mode: "serial" });

const CLINIC = "Neighborhood Veterinary";
const BOOKING_SLUG = "e2e-espanol";

type Patient = { id: string; name: string; clientId: string };

let admin: Page;
let patient: Patient;

async function englishBrowser(browser: Browser) {
  const context = await browser.newContext({ locale: "en-US" });
  const page = await context.newPage();
  await quietOverlays(page);
  return { context, page };
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000);
  admin = await (await browser.newContext({ locale: "en-US" })).newPage();
  await signIn(admin, seedUser("admin"));
  const patients = await trpcQuery<{ items: Patient[] }>(admin, "patients.list", { limit: 5 });
  patient = patients.items[0]!;
  await trpcMutation(admin, "clients.update", { id: patient.clientId, preferredLanguage: "es" });
});

test.afterAll(async () => {
  await trpcMutation(admin, "clients.update", { id: patient.clientId, preferredLanguage: null });
  await admin.context().close();
});

test("the portal link opens in the client's language on an English browser", async ({ browser }) => {
  const { accessToken } = await trpcMutation<{ accessToken: string }>(
    admin,
    "clients.rotatePortalAccessToken",
    { id: patient.clientId },
  );
  const { context, page } = await englishBrowser(browser);
  await page.goto(`/portal/access/${accessToken}`);
  await page.getByRole("button").first().click();
  await page.waitForURL((url) => url.pathname === "/portal");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByText(CLINIC).first()).toBeVisible();
  await expect(page.getByText(patient.name).first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expectNoEnglish(page, englishPhrases("portal", "common"));
  await context.close();
});

test("the consent signing link follows the client's language", async ({ browser }) => {
  const forms = await trpcQuery<Array<{ id: string; title: string }>>(admin, "records.listConsentForms");
  const { url } = await trpcMutation<{ url: string }>(admin, "records.createConsentRequest", {
    patientId: patient.id,
    formId: forms[0]!.id,
  });
  const { context, page } = await englishBrowser(browser);
  await page.goto(new URL(url).pathname);
  // The language arrives with the signing API response.
  await expect(page.locator("html")).toHaveAttribute("lang", "es", { timeout: 20_000 });
  // The clinic's own form title and pet name stay exactly as entered.
  await expect(page.getByText(forms[0]!.title).first()).toBeVisible();
  await expect(page.getByText(patient.name).first()).toBeVisible();
  // The signer statements are saved word for word as signing evidence and stay English (T088).
  await expectNoEnglish(page, englishPhrases("sign", "common"), [
    CONSENT_SIGNER_AUTHORITY_ATTESTATION,
    CONSENT_ELECTRONIC_SIGNATURE_INTENT,
  ]);
  await context.close();
});

test.describe("public pages on a Spanish browser", () => {
  test.use({ locale: "es-MX", extraHTTPHeaders: { "Accept-Language": "es-MX,es;q=0.9" } });

  // Creating a live plan needs the treatment-plan release flags and a priced
  // catalog; an expired link still proves the page speaks the visitor's language.
  test("an expired treatment plan link explains itself in Spanish", async ({ page }) => {
    await page.goto(`/treatment-plan/${randomBytes(32).toString("hex")}`);
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.getByText(esText("treatmentPlan.thisLinkIsNoLonger"))).toBeVisible();
  });

  test("email preferences open in Spanish", async ({ page }) => {
    await page.goto("/email-preferences?token=e2e");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(
      page.getByRole("heading", { name: esText("emailPreferences.emailPreferences") }),
    ).toBeVisible();
  });

  test("public booking is in Spanish with a language switch", async ({ page }) => {
    const types = await trpcQuery<Array<{ id: string }>>(admin, "appointments.listTypes");
    await trpcMutation(admin, "booking.savePage", {
      slug: BOOKING_SLUG,
      published: true,
      config: { bookableTypeIds: [types[0]!.id] },
    });
    await page.goto(`/book/${BOOKING_SLUG}`);
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.getByText(CLINIC).first()).toBeVisible();
    await expect(languageSwitch(page)).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expectNoEnglish(page, englishPhrases("booking", "common"));
  });
});
