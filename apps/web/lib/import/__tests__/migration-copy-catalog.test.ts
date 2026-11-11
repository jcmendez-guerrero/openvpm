import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import { MIGRATION_SOURCES, MIGRATION_STEPS, migrationSourceExportHint, migrationSourceName } from "../sources";

// sources.ts stays the English source; the UI reads the `migration` catalog.
describe("migration copy catalog", () => {
  const m = en.migration as Record<string, any>;
  it("matches the English source and step copy", () => {
    for (const s of MIGRATION_SOURCES) {
      expect(m.sources[s.id]).toEqual({ name: s.name, exportHint: s.exportHint });
    }
    for (const s of MIGRATION_STEPS) {
      expect(m.steps[s.mode].label).toBe(s.label);
      expect(m.steps[s.mode].shortLabel).toBe(s.shortLabel);
      expect(m.steps[s.mode].columnHint).toBe(s.columnHint);
      expect(m.steps[s.mode].unmatchedLabel).toBe(s.unmatchedLabel);
    }
    expect(m.previousSource.replace("{id}", "x")).toBe(migrationSourceName("x"));
    expect(m.customSourceHint).toBe(migrationSourceExportHint("x"));
  });
});
