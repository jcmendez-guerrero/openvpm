import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import {
  BUILD_PRACTICE_PROFILES,
  BUILD_PRACTICE_TYPES,
  BUILD_SYSTEM_LABELS,
} from "@/lib/build/catalog";
import { DEMO_ROLE_OPTIONS } from "@/lib/demo-role-switcher";

// lib/build/catalog.ts and lib/demo-role-switcher.ts stay the English source;
// the build flow and demo screens read these labels from the catalog.
describe("build and demo label catalog", () => {
  it("matches the English practice-type, system and demo role labels", () => {
    const scenes = en.build.scenes as Record<string, any>;
    for (const type of BUILD_PRACTICE_TYPES) {
      expect(scenes.practiceTypes[type]).toBe(BUILD_PRACTICE_PROFILES[type].label);
    }
    expect(scenes.systems.paper).toBe(BUILD_SYSTEM_LABELS.paper);
    expect(scenes.systems.other).toBe(BUILD_SYSTEM_LABELS.other);
    for (const role of DEMO_ROLE_OPTIONS) {
      expect((en.demo.roles as Record<string, string>)[role.value]).toBe(role.label);
    }
  });
});
