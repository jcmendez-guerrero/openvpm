import { test, expect, type Page } from "@playwright/test";
import {
  englishPhrases,
  enText,
  esText,
  expectNoEnglish,
  flagOffReason,
  languageSelectionOn,
  languageSwitch,
  seedUser,
  signIn,
  trpcMutation,
  trpcQuery,
} from "./helpers/spanish";

// T020: staff choose Spanish once and the daily flows follow (US1, SC-003).
// Needs the standard seed: `pnpm db:seed`.
test.skip(!languageSelectionOn, flagOffReason);
test.describe.configure({ mode: "serial" });

const spanishUser = seedUser("jamie.torres");
const englishUser = seedUser("alex.kim");
const staffEnglish = englishPhrases(
  "shell",
  "common",
  "schedule",
  "patients",
  "encounters",
  "billing",
  "clients",
);

const isoDate = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

async function resetLanguage(page: Page, email: string) {
  await signIn(page, email);
  await trpcMutation(page, "settings.setMyLanguage", { language: null });
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000);
  for (const email of [spanishUser, englishUser]) {
    const context = await browser.newContext({ locale: "en-US" });
    await resetLanguage(await context.newPage(), email);
    await context.close();
  }
});

test("choosing Español keeps a half-filled form and switches in under 2 seconds", async ({ page }) => {
  await signIn(page, spanishUser);
  await page.goto("/clients/new");
  const firstName = page.locator("#firstName");
  await expect(page.getByText(enText("clients.form.firstName"), { exact: true })).toBeVisible();
  await firstName.fill("Rosa");

  const started = Date.now();
  await languageSwitch(page).selectOption("es");
  await expect(page.getByText(esText("clients.form.firstName"), { exact: true })).toBeVisible();
  expect(Date.now() - started).toBeLessThan(2_000);

  await expect(firstName).toHaveValue("Rosa");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
});

test("the four daily flows show Spanish product text", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page, spanishUser);

  // Schedule an appointment.
  await page.goto("/schedule");
  await expect(page.getByRole("link", { name: esText("shell.nav.schedule") }).first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expectNoEnglish(page, staffEnglish);

  // Open a patient record and write a clinical note.
  const appointments = await trpcQuery<Array<{ id: string; patientId: string | null }>>(
    page,
    "appointments.list",
    { startDate: isoDate(-14), endDate: isoDate(14) },
  );
  const visit = appointments.find((appointment) => appointment.patientId);
  expect(visit, "seeded appointment with a patient").toBeTruthy();

  await page.goto(`/patients/${visit!.patientId}`);
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await page.waitForLoadState("networkidle");
  await expectNoEnglish(page, staffEnglish);

  await page.goto(`/encounters/${visit!.id}`);
  await page.waitForLoadState("networkidle");
  await expectNoEnglish(page, staffEnglish);

  // Create and take payment on an invoice.
  await page.goto("/billing");
  await expect(page.getByRole("link", { name: esText("shell.nav.billing") }).first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expectNoEnglish(page, staffEnglish);
});

test("the saved choice follows the user to a fresh browser", async ({ browser }) => {
  const context = await browser.newContext({ locale: "en-US" });
  const page = await context.newPage();
  await signIn(page, spanishUser);
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("link", { name: esText("shell.nav.patients") }).first()).toBeVisible();
  await context.close();
});

test("a colleague with no choice keeps English", async ({ browser }) => {
  const context = await browser.newContext({ locale: "en-US" });
  const page = await context.newPage();
  await signIn(page, englishUser);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("link", { name: enText("shell.nav.patients") }).first()).toBeVisible();
  await context.close();
});
