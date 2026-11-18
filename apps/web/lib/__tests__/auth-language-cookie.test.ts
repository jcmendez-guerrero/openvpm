import { afterEach, describe, expect, it, vi } from "vitest";
import { LANGUAGE_COOKIE } from "@/i18n/config";
import { resolveLanguage } from "@/i18n/resolve";

const store = vi.hoisted(() => {
  const jar = new Map<string, string>();
  return {
    jar,
    set: vi.fn((name: string, value: string) => void jar.set(name, value)),
    delete: vi.fn((name: string) => void jar.delete(name)),
  };
});

vi.mock("next/headers", () => ({ cookies: async () => store }));

const { applySignInLanguageCookie, syncLanguageCookieAtSignIn } = await import(
  "@/i18n/sign-in-cookie"
);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  store.jar.clear();
});

function staffLanguage(clinicDefault: string) {
  return resolveLanguage({
    enabled: true,
    surface: "staff",
    cookie: store.jar.get(LANGUAGE_COOKIE),
    clinicDefault,
  });
}

describe("sign-in language cookie", () => {
  it("writes the account's saved language", () => {
    applySignInLanguageCookie(store, "es", {});
    expect(store.set).toHaveBeenCalledWith(
      LANGUAGE_COOKIE,
      "es",
      expect.objectContaining({ path: "/", sameSite: "lax", secure: false }),
    );
  });

  it("marks the cookie Secure on HTTPS deployments", () => {
    applySignInLanguageCookie(store, "es", { NEXTAUTH_URL: "https://clinic.example" });
    expect(store.set).toHaveBeenCalledWith(
      LANGUAGE_COOKIE,
      "es",
      expect.objectContaining({ secure: true }),
    );
  });

  it("deletes the cookie when the account has no saved language", () => {
    applySignInLanguageCookie(store, null, {});
    expect(store.delete).toHaveBeenCalledWith(LANGUAGE_COOKIE);
  });

  it("shared computer: the next user never inherits the previous choice", () => {
    store.jar.set(LANGUAGE_COOKIE, "es"); // user A chose Spanish, then signed out
    applySignInLanguageCookie(store, null, {}); // user B has no saved choice
    expect(store.jar.has(LANGUAGE_COOKIE)).toBe(false);
    expect(staffLanguage("en")).toBe("en");
    // Clinic default later switches to Spanish → B follows it (no cookie pins B).
    expect(staffLanguage("es")).toBe("es");
  });

  it("does nothing while the release flag is off", async () => {
    vi.stubEnv("LANGUAGE_SELECTION_ENABLED", "false");
    await syncLanguageCookieAtSignIn("es");
    expect(store.set).not.toHaveBeenCalled();
    expect(store.delete).not.toHaveBeenCalled();
  });

  it("uses the request cookie store when the flag is on", async () => {
    vi.stubEnv("LANGUAGE_SELECTION_ENABLED", "true");
    await syncLanguageCookieAtSignIn("es");
    expect(store.jar.get(LANGUAGE_COOKIE)).toBe("es");
  });
});
