import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import {
  CLINIC_MODEL_OPTIONS,
  CLINIC_MODELS,
  FIRST_GOAL_OPTIONS,
  FIRST_GOALS,
  SELF_HOST_GOAL,
  firstDayTaskSource,
  firstDayTasks,
} from "@/lib/onboarding/clinic-profile";
import { ONBOARDING_INTENT_OPTIONS } from "@/lib/onboarding/intent";
import { ONBOARDING_JOURNEY_STEPS } from "@/lib/onboarding/journey-plan";

// The lib modules stay the English source (the server uses them too); the UI
// renders onboarding.profile. This keeps the two from drifting apart.
const profile = en.onboarding.profile as Record<string, any>;

describe("onboarding profile catalog", () => {
  it("matches the English option copy in lib/onboarding", () => {
    for (const o of CLINIC_MODEL_OPTIONS) {
      expect(profile.models[o.value]).toEqual({ label: o.label, shortLabel: o.shortLabel });
    }
    for (const o of [...FIRST_GOAL_OPTIONS, SELF_HOST_GOAL]) {
      expect(profile.goals[o.value]).toBe(o.label);
    }
    for (const o of ONBOARDING_INTENT_OPTIONS) {
      expect(profile.intents[o.value]).toEqual({
        label: o.label,
        shortLabel: o.shortLabel,
        description: o.description,
        firstWin: o.firstWin,
        firstWinHint: o.firstWinHint,
      });
    }
    for (const s of ONBOARDING_JOURNEY_STEPS) {
      expect(profile.journey[s.id]).toBe(s.title);
    }
  });

  it("has a catalog entry for every first-day task list", () => {
    for (const model of CLINIC_MODELS) {
      for (const goal of FIRST_GOALS) {
        const source = firstDayTaskSource(model, goal);
        firstDayTasks(model, goal).forEach((task, i) => {
          expect(profile.tasks[source][String(i)]).toBe(task);
          expect((es.onboarding.profile.tasks as Record<string, any>)[source][String(i)]).toBeTruthy();
        });
      }
    }
  });
});
