import { readTranslatedSource } from "@/i18n/translated-source";
import { describe, expect, it } from "vitest";

describe("prescription lifecycle UI safety", () => {
  it("disables dispensing-label printing for effectively inactive prescriptions", () => {
    const source = readTranslatedSource("app/(dashboard)/records/page.tsx");
    expect(source).toContain(
      'disabled={rx.effectiveStatus !== "active"}',
    );
    expect(source).toContain(
      "Only active prescriptions can print a dispensing label",
    );
  });

  it("distinguishes external authorization, clinic stock, and billing scope", () => {
    const source = readTranslatedSource("components/records/prescription-lifecycle-control.tsx");
    expect(source).toContain("Authorize external-pharmacy refill");
    expect(source).toContain("does not dispense stock or contact the pharmacy");
    expect(source).toContain("creates an unbilled dispense in Billing");
    expect(source).toContain("billing work created");
    expect(source).toContain("Billing: {status}");
  });

  it("resets the idempotency key when lifecycle intent changes", () => {
    const source = readTranslatedSource("components/records/prescription-lifecycle-control.tsx");
    const reasonChange = source.match(
      /onChange=\{\(event\) => \{[\s\S]+?operationId\.current = null;[\s\S]+?\}\}/,
    );
    expect(reasonChange).not.toBeNull();
  });

  it("uses effective status in patient medical-summary exports", () => {
    const source = readTranslatedSource("app/(dashboard)/patients/[id]/page.tsx");
    expect(source).toContain('status: rx.effectiveStatus ?? "active"');
    expect(source).not.toContain('status: rx.status ?? "active"');
  });
});
