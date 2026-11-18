import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate, localeForCountry } from "../format";

const jan15 = "2026-01-15T00:00:00.000Z";

describe("formatting without a language keeps today's output", () => {
  it.each([
    ["US", "usd"],
    ["GB", "gbp"],
    ["IT", "eur"],
  ])("%s", (country, currency) => {
    expect(formatCurrency(1234.5, currency, country, "en")).toBe(formatCurrency(1234.5, currency, country));
    expect(formatDate(jan15, country, "en")).toBe(formatDate(jan15, country));
  });

  it("matches the existing locale table for English", () => {
    expect(localeForCountry("US")).toBe("en-US");
    expect(localeForCountry("GB")).toBe("en-GB");
    expect(localeForCountry("IT")).toBe("it-IT");
  });
});

describe("Spanish formatting combines language and clinic country", () => {
  it("builds the format locale from language and country", () => {
    expect(localeForCountry("US", "es")).toBe("es-US");
    expect(localeForCountry("MX", "es")).toBe("es-MX");
    expect(localeForCountry(null, "es")).toBe("es-US");
  });

  it("puts the day before the month", () => {
    expect(formatDate(jan15, "US", "es")).toBe("15/01/2026");
  });

  it("keeps the clinic's currency", () => {
    expect(formatCurrency(1234.5, "usd", "US", "es")).toBe("$1,234.50");
    expect(formatCurrency(1234.5, "usd", "MX", "es")).toContain("USD");
  });
});
