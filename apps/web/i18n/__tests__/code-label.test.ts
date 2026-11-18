import { describe, expect, it } from "vitest";
import { getTranslatorFor } from "../messages";
import { codeLabel } from "../code-label";

describe("codeLabel", () => {
  const es = getTranslatorFor("es") as never;
  const en = getTranslatorFor("en") as never;

  it("shows a known code in the reader's language", () => {
    expect(codeLabel(es, "encounters.page.codes.chargeDisposition", "no_charge")).toBe("sin cargo");
  });

  it("keeps the English display identical", () => {
    expect(codeLabel(en, "encounters.page.codes.chargeDisposition", "accounts_receivable")).toBe("accounts receivable");
  });

  it("falls back to the stored code for unknown values", () => {
    expect(codeLabel(es, "encounters.page.codes.chargeDisposition", "new_kind")).toBe("new kind");
    expect(codeLabel(es, "encounters.page.codes.chargeDisposition", null)).toBe("");
  });
});
