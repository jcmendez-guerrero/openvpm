import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import { PREVISIT_INTAKE_FIELD_DEFINITIONS } from "../previsit-intake";

describe("pre-visit intake field copy", () => {
  it("keeps the English catalog equal to the lib definitions", () => {
    const fromLib = Object.fromEntries(
      PREVISIT_INTAKE_FIELD_DEFINITIONS.map(({ key, label, placeholder }) => [key, { label, placeholder }]),
    );
    expect(en.booking.intake.fields).toEqual(fromLib);
  });
});
