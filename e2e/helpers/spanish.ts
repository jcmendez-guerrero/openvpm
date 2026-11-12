import { expect, type APIResponse, type Page } from "@playwright/test";
import en from "../../apps/web/messages/en.json";
import es from "../../apps/web/messages/es.json";

// Shared helpers for the Spanish e2e specs. They run against a seeded
// database (`pnpm db:seed`) with LANGUAGE_SELECTION_ENABLED=true on the server.

export const languageSelectionOn =
  process.env.LANGUAGE_SELECTION_ENABLED?.trim() === "true";
export const flagOffReason =
  "set LANGUAGE_SELECTION_ENABLED=true for the server and this run";

export const SEED_PASSWORD = "password123";
export const seedUser = (name: string) => `${name}@neighborhoodvet.example.com`;

export const languageSwitch = (page: Page) =>
  page.getByLabel(/^(Language|Idioma)$/).first();

/** Skip the welcome overlay and cookie banner so they don't cover the page. */
export async function quietOverlays(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("openvpm.cookie-consent.v1", "essential");
    const realGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key: string) {
      if (typeof key === "string" && key.startsWith("ovpm.welcome.v1.")) {
        return JSON.stringify({ seenAt: "2026-01-01T00:00:00.000Z" });
      }
      return realGetItem.call(this, key);
    };
  });
}

export async function signIn(page: Page, email: string) {
  await quietOverlays(page);
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel(/correo|email/i).fill(email);
  await page.getByLabel(/^(contraseña|password)$/i).fill(SEED_PASSWORD);
  // Retry the submit if a click before hydration gets swallowed.
  await expect(async () => {
    if (!new URL(page.url()).pathname.startsWith("/login")) return;
    await page.getByRole("button", { name: /iniciar sesión|sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
  }).toPass({ timeout: 60_000 });
}

type TrpcEnvelope<T> = { result?: { data?: { json?: T } }; error?: { json?: { message?: string } } };

async function unwrap<T>(path: string, response: APIResponse): Promise<T> {
  const body = (await response.json()) as TrpcEnvelope<T>;
  if (!response.ok() || body.error) {
    throw new Error(`${path} failed: ${body.error?.json?.message ?? response.status()}`);
  }
  return body.result?.data?.json as T;
}

/** Call a staff tRPC query with the page's session cookie. */
export async function trpcQuery<T>(page: Page, path: string, input?: unknown): Promise<T> {
  const query =
    input === undefined ? "" : `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
  return unwrap<T>(path, await page.request.get(`/api/trpc/${path}${query}`));
}

export async function trpcMutation<T>(page: Page, path: string, input: unknown): Promise<T> {
  return unwrap<T>(path, await page.request.post(`/api/trpc/${path}`, { data: { json: input } }));
}

type Catalog = Record<string, unknown>;

function leaves(node: unknown, out: Array<[string, string]>, prefix: string): void {
  if (typeof node === "string") out.push([prefix, node]);
  else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node as Catalog)) {
      leaves(value, out, `${prefix}.${key}`);
    }
  }
}

function lookup(catalog: Catalog, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => (node as Catalog | undefined)?.[part], catalog);
}

/**
 * English product sentences from the given catalog namespaces that differ in
 * Spanish. Short strings and strings with placeholders are left out so clinic
 * data (pet names, service names) can't trigger a false match.
 */
export function englishPhrases(...namespaces: string[]): string[] {
  const found = new Set<string>();
  for (const namespace of namespaces) {
    const pairs: Array<[string, string]> = [];
    leaves(lookup(en as Catalog, namespace), pairs, namespace);
    for (const [key, text] of pairs) {
      if (text.length < 12 || !text.includes(" ") || /[{<]/.test(text)) continue;
      if (lookup(es as Catalog, key) === text) continue;
      found.add(text);
    }
  }
  return [...found];
}

/** Fail with the exact English sentences still on screen; `keep` is text that stays English on purpose. */
export async function expectNoEnglish(page: Page, phrases: string[], keep: string[] = []) {
  let text = await page.locator("body").innerText();
  for (const kept of keep) text = text.split(kept).join("");
  const leftover = phrases.filter((phrase) => text.includes(phrase));
  expect(leftover, `English text on ${new URL(page.url()).pathname}`).toEqual([]);
}

/** Every Spanish product string, for telling product text from clinic data. */
export function spanishProductText(): string[] {
  const pairs: Array<[string, string]> = [];
  leaves(es, pairs, "es");
  return pairs.map(([, text]) => text);
}

export function esText(key: string): string {
  const value = lookup(es as Catalog, key);
  if (typeof value !== "string") throw new Error(`missing es key ${key}`);
  return value;
}

export function enText(key: string): string {
  const value = lookup(en as Catalog, key);
  if (typeof value !== "string") throw new Error(`missing en key ${key}`);
  return value;
}
