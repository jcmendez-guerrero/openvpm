import { afterEach, describe, expect, it, vi } from "vitest";
import es from "@/messages/es.json";
import { tokenPageLanguage } from "../token-page";

const request = (headers: Record<string, string> = {}) => new Request("https://example.test/api/sign/x", { headers });

describe("tokenPageLanguage", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns nothing while the release flag is off", () => {
    vi.stubEnv("LANGUAGE_SELECTION_ENABLED", "");
    expect(tokenPageLanguage(request(), { clientLanguage: "es", clinicDefault: "es" }, "sign")).toEqual({});
  });

  it("uses the client's language over the browser, and only the page's namespace", () => {
    vi.stubEnv("LANGUAGE_SELECTION_ENABLED", "true");
    const result = tokenPageLanguage(
      request({ "accept-language": "en-US" }),
      { clientLanguage: "es", clinicDefault: null },
      "sign",
    );
    expect(result.language).toBe("es");
    expect(result.messages).toEqual({ sign: es.sign, common: es.common });
  });

  it("lets the page switch cookie win over the client", () => {
    vi.stubEnv("LANGUAGE_SELECTION_ENABLED", "true");
    const result = tokenPageLanguage(
      request({ cookie: "NEXT_LOCALE=en" }),
      { clientLanguage: "es", clinicDefault: "es" },
      "treatmentPlan",
    );
    expect(result.language).toBe("en");
  });
});
