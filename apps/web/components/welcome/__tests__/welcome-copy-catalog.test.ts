import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import { AI_VIGNETTE, WELCOME_CARD_COPY, WELCOME_COPY } from "../welcome-copy";

// The copy deck stays the voice-checked English source; the screens read the
// catalog, so the English catalog must say exactly the same thing.
describe("welcome copy catalog", () => {
  it("matches the English copy deck", () => {
    const w = en.welcome;
    expect(w.copy.headlineFallback).toBe(WELCOME_COPY.headlineFallback);
    expect(w.copy.headlineAdmin.replace("{practice}", "Acme")).toBe(WELCOME_COPY.headlineAdmin("Acme"));
    expect(w.copy.headlineStaff.replace("{name}", "Sam")).toBe(WELCOME_COPY.headlineStaff("Sam"));
    for (const key of ["subline", "skip", "reopenHint", "setupInstead"] as const) {
      expect(w.copy[key]).toBe(WELCOME_COPY[key]);
    }
    expect(w.copy.allDone).toEqual(WELCOME_COPY.allDone);
    expect(w.cards).toEqual(WELCOME_CARD_COPY);
    expect(w.ai.question).toBe(AI_VIGNETTE.question);
    expect(w.ai.answer).toBe(AI_VIGNETTE.answer);
  });
});
