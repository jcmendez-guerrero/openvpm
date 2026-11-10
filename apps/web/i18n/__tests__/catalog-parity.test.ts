import { describe, expect, it } from "vitest";
import { checkCatalogs, loadCatalogs } from "../../scripts/check-translations.mjs";

type Result = { errors: string[]; summary: string[] };
const check = checkCatalogs as (catalogs: Record<string, unknown>) => Result;

const en = { a: { hello: "Hello {name}", count: "{n, plural, one {# item} other {# items}}" } };

describe("check-translations", () => {
  it("passes matching catalogs and reports 100%", () => {
    const es = { a: { hello: "Hola {name}", count: "{n, plural, one {# cosa} other {# cosas}}" } };
    const result = check({ en, es });
    expect(result.errors).toEqual([]);
    expect(result.summary).toEqual(["es: 2/2 keys, 100%"]);
  });

  it("fails on a key missing from Spanish", () => {
    const result = check({ en, es: { a: { hello: "Hola {name}" } } });
    expect(result.errors.join("\n")).toMatch(/es: missing key a\.count/);
    expect(result.summary).toEqual(["es: 1/2 keys, 50%"]);
  });

  it("fails on a key English doesn't have", () => {
    const es = { a: { hello: "Hola {name}", count: "{n, plural, one {#} other {#}}", extra: "Extra" } };
    expect(check({ en, es }).errors.join("\n")).toMatch(/es: extra key a\.extra/);
  });

  it("fails when placeholders differ", () => {
    const es = { a: { hello: "Hola {nombre}", count: "{n, plural, one {#} other {#}}" } };
    expect(check({ en, es }).errors.join("\n")).toMatch(/es: placeholders differ in a\.hello/);
  });

  it("fails on invalid ICU syntax", () => {
    const es = { a: { hello: "Hola {name", count: "{n, plural, one {#} other {#}}" } };
    expect(check({ en, es }).errors.join("\n")).toMatch(/es: invalid message a\.hello/);
  });

  it("the shipped catalogs pass", () => {
    expect(check(loadCatalogs()).errors).toEqual([]);
  });
});
