import { test, expect, type Page } from "@playwright/test";
import {
  flagOffReason,
  languageSelectionOn,
  languageSwitch,
  quietOverlays,
  seedUser,
  signIn,
  spanishProductText,
  trpcMutation,
  trpcQuery,
} from "./helpers/spanish";

// T071 / SC-004: Spanish text is longer than English; no in-scope screen may
// clip it at desktop (1280 px) or tablet (768 px) width. Needs `pnpm db:seed`.
test.skip(!languageSelectionOn, flagOffReason);

const WIDTHS = [1280, 768] as const;
const STAFF_SCREENS = ["/", "/patients", "/clients", "/clients/new", "/schedule", "/records", "/billing", "/inbox"];
const PUBLIC_SCREENS = ["/login", "/register", "/forgot-password"];
const PORTAL_SCREENS = ["/portal", "/portal/appointments", "/portal/invoices", "/portal/messages"];

const PRODUCT_TEXT = spanishProductText();

/**
 * Text cut off by its own box. Hidden/clip overflow always counts; an ellipsis
 * counts only on product text, since previews of clinic data shorten by design.
 */
async function clippedText(page: Page): Promise<string[]> {
  return page.evaluate((productText) => {
    const product = new Set(productText);
    const found: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      const ownText = Array.from(el.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? "")
        .join("")
        .trim();
      if (!ownText || el.closest("[aria-hidden='true'], .sr-only, script, style")) continue;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || el.offsetParent === null) continue;
      const ellipsis = style.textOverflow === "ellipsis";
      const clips = ellipsis ? product.has(ownText) : ["hidden", "clip"].includes(style.overflowX);
      if (clips && el.scrollWidth > el.clientWidth) found.push(ownText.slice(0, 80));
    }
    if (document.documentElement.scrollWidth > window.innerWidth + 1) found.push("(page scrolls sideways)");
    return found;
  }, PRODUCT_TEXT);
}

async function checkScreens(page: Page, paths: string[], label: string) {
  const problems: string[] = [];
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of paths) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("html")).toHaveAttribute("lang", "es");
      await page.screenshot({
        path: test.info().outputPath(`${label}${path.replace(/\//g, "_") || "_home"}-${width}.png`),
        fullPage: true,
      });
      for (const text of await clippedText(page)) problems.push(`${width}px ${path}: ${text}`);
    }
  }
  expect(problems, "clipped Spanish text").toEqual([]);
}

test.describe("Spanish layout", () => {
  test.use({ locale: "es-MX", extraHTTPHeaders: { "Accept-Language": "es-MX,es;q=0.9" } });

  test("sign-in screens", async ({ page }) => {
    await quietOverlays(page);
    await checkScreens(page, PUBLIC_SCREENS, "auth");
  });

  test("staff workspace", async ({ page }) => {
    test.setTimeout(300_000);
    await signIn(page, seedUser("jamie.torres"));
    // Staff language comes from their own choice, not the browser.
    await languageSwitch(page).selectOption("es");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    try {
      await checkScreens(page, STAFF_SCREENS, "staff");
    } finally {
      await trpcMutation(page, "settings.setMyLanguage", { language: null });
    }
  });

  test("client portal", async ({ page, browser }) => {
    test.setTimeout(300_000);
    const admin = await (await browser.newContext()).newPage();
    await signIn(admin, seedUser("admin"));
    const { items } = await trpcQuery<{ items: Array<{ clientId: string }> }>(admin, "patients.list", { limit: 1 });
    const clientId = items[0]!.clientId;
    await trpcMutation(admin, "clients.update", { id: clientId, preferredLanguage: "es" });
    try {
      const { accessToken } = await trpcMutation<{ accessToken: string }>(
        admin,
        "clients.rotatePortalAccessToken",
        { id: clientId },
      );
      await quietOverlays(page);
      await page.goto(`/portal/access/${accessToken}`);
      await page.getByRole("button").first().click();
      await page.waitForURL((url) => url.pathname === "/portal");
      await checkScreens(page, PORTAL_SCREENS, "portal");
    } finally {
      await trpcMutation(admin, "clients.update", { id: clientId, preferredLanguage: null });
      await admin.context().close();
    }
  });
});
