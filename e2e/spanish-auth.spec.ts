import { test, expect, type Page } from "@playwright/test";

// The sign-in screens follow the browser language only while the release flag is on.
test.skip(
  process.env.LANGUAGE_SELECTION_ENABLED?.trim() !== "true",
  "set LANGUAGE_SELECTION_ENABLED=true for the server and this run",
);

const languageSwitch = (page: Page) => page.getByLabel(/^(Language|Idioma)$/);

test.describe("Sign-in screens in Spanish", () => {
  test.describe("browser in Spanish", () => {
    test.use({ locale: "es-MX", extraHTTPHeaders: { "Accept-Language": "es-MX,es;q=0.9" } });

    test("opens /login in Spanish and switches both ways", async ({ page }) => {
      await page.goto("/login");
      await expect(page.locator("html")).toHaveAttribute("lang", "es");
      await expect(page.getByText("Inicia sesión en tu clínica")).toBeVisible();

      await languageSwitch(page).selectOption("en");
      await expect(page.getByText("Sign in to your practice")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", "en");

      await languageSwitch(page).selectOption("es");
      await expect(page.getByText("Inicia sesión en tu clínica")).toBeVisible();
    });

    test("a new account keeps Spanish in its workspace", async ({ page }) => {
      test.setTimeout(60_000);
      const email = `es-${Date.now()}@openpims.dev`;
      const password = "TestPassword123!";
      await page.addInitScript(() => {
        window.localStorage.setItem("openvpm.cookie-consent.v1", "essential");
      });
      await page.goto("/register");
      // Saves the choice as a cookie, which registration copies into the account.
      await languageSwitch(page).selectOption("es");
      await page.getByRole("button", { name: "Ver mis flujos de trabajo" }).click();
      await page.getByLabel("Nombre de la clínica").fill("Clínica de Prueba");
      await page.getByLabel("Correo de trabajo").fill(email);
      await page.getByRole("button", { name: "Ver mi primer día" }).click();
      await page.getByRole("button", { name: "Asegurar mi espacio de trabajo" }).click();
      await page.getByLabel("País de la clínica", { exact: true }).selectOption("US");
      await page.getByLabel("Contraseña", { exact: true }).fill(password);
      await page
        .getByRole("button", { name: /crear mi espacio de trabajo|empezar mi prueba gratis/i })
        .click();

      // Self-hosted lands in the app or on sign-in; hosted billing goes to checkout first.
      await page.waitForURL((url) => url.pathname === "/" || url.pathname.startsWith("/login"), {
        timeout: 45_000,
      });
      if (new URL(page.url()).pathname.startsWith("/login")) {
        // A fresh browser: only the saved account language can make this Spanish.
        await page.context().clearCookies();
        await page.goto("/login");
        await page.getByLabel(/correo|email/i).fill(email);
        await page.getByLabel(/^(contraseña|password)$/i).fill(password);
        await page.getByRole("button", { name: /iniciar sesión|sign in/i }).click();
        await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
      }
      await expect(page.locator("html")).toHaveAttribute("lang", "es");
    });
  });

  test.describe("browser in an unsupported language", () => {
    test.use({ locale: "fr-FR", extraHTTPHeaders: { "Accept-Language": "fr-FR,fr;q=0.9" } });

    test("falls back to English", async ({ page }) => {
      await page.goto("/login");
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page.getByText("Sign in to your practice")).toBeVisible();
    });
  });
});
