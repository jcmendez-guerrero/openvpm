import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { languageCookieFromHeader } from "../config";
import { resolveRequestLanguage, translateServerMessage } from "../server-errors";

const errorsEn = en.errors as Record<string, string>;
const errorsEs = es.errors as Record<string, string>;

describe("translateServerMessage", () => {
  it("leaves English untouched and swaps only exact catalog matches", () => {
    expect(translateServerMessage("Client not found", "en")).toBe("Client not found");
    expect(translateServerMessage("Client not found", "es")).toBe("No se encontró el cliente");
    expect(translateServerMessage("Client not found because of x", "es")).toBe(
      "Client not found because of x",
    );
  });
});

describe("languageCookieFromHeader", () => {
  it("accepts only supported languages", () => {
    expect(languageCookieFromHeader("a=1; NEXT_LOCALE=es")).toBe("es");
    expect(languageCookieFromHeader("NEXT_LOCALE=fr")).toBeUndefined();
    expect(languageCookieFromHeader("NEXT_LOCALE=es<script>")).toBeUndefined();
    expect(languageCookieFromHeader(undefined)).toBeUndefined();
  });
});

describe("resolveRequestLanguage", () => {
  afterEach(() => vi.unstubAllEnvs());
  const base = { acceptLanguage: "es-MX", practiceId: null, cookieHeader: null };

  it("is English while the release flag is off", async () => {
    vi.stubEnv("LANGUAGE_SELECTION_ENABLED", "");
    const loadClinicDefault = vi.fn();
    expect(
      await resolveRequestLanguage({ ...base, cookieHeader: "NEXT_LOCALE=es", loadClinicDefault }),
    ).toBe("en");
    expect(loadClinicDefault).not.toHaveBeenCalled();
  });

  it("uses the cookie, then the clinic default for staff, then the browser", async () => {
    vi.stubEnv("LANGUAGE_SELECTION_ENABLED", "true");
    const loadClinicDefault = vi.fn(async () => "es" as const);
    expect(
      await resolveRequestLanguage({ ...base, cookieHeader: "NEXT_LOCALE=en", practiceId: "p1", loadClinicDefault }),
    ).toBe("en");
    expect(await resolveRequestLanguage({ ...base, practiceId: "p1", loadClinicDefault })).toBe("es");
    expect(await resolveRequestLanguage({ ...base, loadClinicDefault })).toBe("es");
  });

  it("falls back to English when the clinic default cannot be read", async () => {
    vi.stubEnv("LANGUAGE_SELECTION_ENABLED", "true");
    const loadClinicDefault = vi.fn(async () => {
      throw new Error("db down");
    });
    expect(await resolveRequestLanguage({ ...base, practiceId: "p1", loadClinicDefault })).toBe("en");
  });
});

describe("errors catalog", () => {
  it("has Spanish for every English entry", () => {
    for (const key of Object.keys(errorsEn)) expect(errorsEs[key], key).toBeTruthy();
  });

  // Drift guard: a new literal TRPCError message in a router needs a catalog entry.
  it("covers every literal TRPCError message thrown by the routers", () => {
    const known = new Set(Object.values(errorsEn));
    const dir = join(process.cwd(), "server/routers");
    const missing: string[] = [];
    for (const file of readdirSync(dir).filter((name) => name.endsWith(".ts"))) {
      const source = readFileSync(join(dir, file), "utf8");
      for (const block of source.matchAll(/new TRPCError\(\s*\{([\s\S]*?)\}\s*\)/g)) {
        for (const literal of block[1]!.matchAll(/message:\s*"((?:[^"\\]|\\.)*)"/g)) {
          if (!known.has(literal[1]!)) missing.push(`${file}: ${literal[1]}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
