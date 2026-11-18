import { describe, expect, it } from "vitest";
import { getTranslatorFor } from "../messages";

describe("plural forms (FR-009)", () => {
  it.each([
    [0, "0 citas", "0 appointments"],
    [1, "1 cita", "1 appointment"],
    [5, "5 citas", "5 appointments"],
  ])("count %i", (count, es, en) => {
    expect(getTranslatorFor("es")("schedule.appointmentCount", { count })).toBe(es);
    expect(getTranslatorFor("en")("schedule.appointmentCount", { count })).toBe(en);
  });
});
