import { describe, expect, it } from "vitest";
import { resolveLanguage, parseAcceptLanguage } from "../resolve";

const on = { enabled: true } as const;

describe("resolveLanguage — release flag", () => {
  it("returns English on every surface while the flag is off", () => {
    for (const surface of ["staff", "public", "client", "message", "staffEmail", "invite"] as const) {
      expect(
        resolveLanguage({
          enabled: false,
          surface,
          cookie: "es",
          userLanguage: "es",
          clientLanguage: "es",
          clinicDefault: "es",
          acceptLanguage: "es-MX",
        }),
      ).toBe("en");
    }
  });
});

describe("resolveLanguage — staff", () => {
  it("uses the cookie first", () => {
    expect(resolveLanguage({ ...on, surface: "staff", cookie: "es", clinicDefault: "en" })).toBe("es");
  });
  it("falls back to the clinic default without a cookie", () => {
    expect(resolveLanguage({ ...on, surface: "staff", clinicDefault: "es" })).toBe("es");
  });
  it("falls back to English", () => {
    expect(resolveLanguage({ ...on, surface: "staff" })).toBe("en");
  });
  it("ignores the browser", () => {
    expect(resolveLanguage({ ...on, surface: "staff", acceptLanguage: "es" })).toBe("en");
  });
});

describe("resolveLanguage — public", () => {
  it("uses the cookie before the browser", () => {
    expect(resolveLanguage({ ...on, surface: "public", cookie: "en", acceptLanguage: "es" })).toBe("en");
  });
  it("uses the browser without a cookie", () => {
    expect(resolveLanguage({ ...on, surface: "public", acceptLanguage: "es-MX,en;q=0.5" })).toBe("es");
  });
  it("ignores the clinic default", () => {
    expect(resolveLanguage({ ...on, surface: "public", clinicDefault: "es" })).toBe("en");
  });
});

describe("resolveLanguage — client pages", () => {
  it("puts the page switch (cookie) before the client's saved language", () => {
    expect(resolveLanguage({ ...on, surface: "client", cookie: "en", clientLanguage: "es" })).toBe("en");
  });
  it("then the client's language, browser, clinic default", () => {
    expect(resolveLanguage({ ...on, surface: "client", clientLanguage: "es", acceptLanguage: "en" })).toBe("es");
    expect(resolveLanguage({ ...on, surface: "client", acceptLanguage: "es", clinicDefault: "en" })).toBe("es");
    expect(resolveLanguage({ ...on, surface: "client", clinicDefault: "es" })).toBe("es");
    expect(resolveLanguage({ ...on, surface: "client" })).toBe("en");
  });
});

describe("resolveLanguage — messages and emails ignore cookie and browser", () => {
  it("message: client language, then clinic default", () => {
    expect(resolveLanguage({ ...on, surface: "message", cookie: "es", acceptLanguage: "es" })).toBe("en");
    expect(resolveLanguage({ ...on, surface: "message", clientLanguage: "es" })).toBe("es");
    expect(resolveLanguage({ ...on, surface: "message", clinicDefault: "es" })).toBe("es");
  });
  it("staffEmail: user language, then clinic default", () => {
    expect(resolveLanguage({ ...on, surface: "staffEmail", cookie: "es" })).toBe("en");
    expect(resolveLanguage({ ...on, surface: "staffEmail", userLanguage: "es", clinicDefault: "en" })).toBe("es");
    expect(resolveLanguage({ ...on, surface: "staffEmail", clinicDefault: "es" })).toBe("es");
  });
  it("invite: clinic default only", () => {
    expect(resolveLanguage({ ...on, surface: "invite", cookie: "es", userLanguage: "es" })).toBe("en");
    expect(resolveLanguage({ ...on, surface: "invite", clinicDefault: "es" })).toBe("es");
  });
});

describe("resolveLanguage — unsupported values are skipped", () => {
  it.each(["fr", "", "ES ", "xx-YY"])("skips %j", (value) => {
    expect(resolveLanguage({ ...on, surface: "staff", cookie: value, clinicDefault: "es" })).toBe("es");
  });
  it("skips null and undefined", () => {
    expect(resolveLanguage({ ...on, surface: "client", cookie: null, clientLanguage: undefined, clinicDefault: "es" })).toBe("es");
  });
});

describe("parseAcceptLanguage", () => {
  it("orders by quality weight and maps regional tags", () => {
    expect(parseAcceptLanguage("es-MX;q=0.9,en;q=0.8")).toBe("es");
    expect(parseAcceptLanguage("en;q=0.5,es-419;q=0.9")).toBe("es");
    expect(parseAcceptLanguage("fr-FR,fr;q=0.9,en;q=0.7")).toBe("en");
  });
  it("returns undefined when nothing is supported or the header is empty", () => {
    expect(parseAcceptLanguage("fr,de")).toBeUndefined();
    expect(parseAcceptLanguage("")).toBeUndefined();
    expect(parseAcceptLanguage(undefined)).toBeUndefined();
  });
  it("ignores q=0", () => {
    expect(parseAcceptLanguage("es;q=0,en")).toBe("en");
  });
});
