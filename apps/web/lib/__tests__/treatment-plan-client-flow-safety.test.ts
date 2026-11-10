import { readTranslatedSource } from "@/i18n/translated-source";
import { describe, expect, it } from "vitest";

const migration = readTranslatedSource("../../packages/db/drizzle/0102_curved_guardian.sql");
const finalizer = readTranslatedSource("lib/treatment-plan-presentations/finalize.ts");
const signer = readTranslatedSource("app/api/sign/[token]/route.ts");
const composer = readTranslatedSource("components/encounters/treatment-plan-composer.tsx");
const databaseContract = readTranslatedSource("../../packages/db/test-treatment-plan-evidence.sql");

describe("treatment-plan client flow safety", () => {
  it("persists only a presentation token digest and freezes concurrent revisions/closure", () => {
    expect(migration).toContain('"token_hash" varchar(64) NOT NULL');
    expect(migration).not.toContain('"token" varchar(64)');
    expect(migration).toContain(
      "compute_visit_treatment_plan_response_sha256_from_decisions",
    );
    expect(migration).toContain("reject_revision_while_treatment_plan_signing");
    expect(migration).toContain("reject_treatment_plan_close_while_signing");
    expect(databaseContract).toContain(
      "revision while awaiting signature unexpectedly succeeded",
    );
    expect(databaseContract).toContain(
      "close while awaiting signature unexpectedly succeeded",
    );
    expect(databaseContract).toContain(
      "cross-tenant presentation write unexpectedly succeeded",
    );
  });

  it("seals server-generated decisions only after hardened consent/file evidence exists", () => {
    expect(signer).toContain("finalizeManagedUploadManifest");
    expect(signer).toContain("finalizeTreatmentPlanResponseForConsent");
    expect(finalizer).toContain("visitTreatmentPlanResponseLines");
    expect(finalizer).toContain("visitTreatmentPlanResponses");
    expect(finalizer).toContain("signedDocumentSha256");
    expect(finalizer).toContain("signatureSha256");
    expect(finalizer).toContain("responseSha256: presentation.responseSha256");
    expect(finalizer).toContain("select ${consentRequests.signedAt}");
    expect(finalizer).not.toContain("decidedAt: input.signedAt");
    expect(finalizer).toContain("set constraints all immediate");
  });

  it("uses digest-only downstream signing credentials with form provenance", () => {
    expect(signer).toContain("eq(consentRequests.tokenHash");
    const treatmentRoute = readTranslatedSource("app/api/treatment-plan/[token]/route.ts");
    expect(treatmentRoute).toContain("deriveTreatmentPlanConsentToken(token)");
    expect(treatmentRoute).toContain("token: null");
    expect(treatmentRoute).toContain("tokenHash: consentTokenHash");
    expect(treatmentRoute).toContain("formId: form.id");
    expect(treatmentRoute).not.toContain("formId: null");
  });

  it("shows evidence in the encounter without billing, inventory, or work-item writes", () => {
    expect(composer).toContain("Client response signed");
    expect(composer).toContain("Signed document");
    for (const forbidden of [
      "invoices",
      "invoiceItems",
      "products.stockQuantity",
      "visitWorkItems",
    ]) {
      expect(finalizer).not.toContain(forbidden);
    }
  });
});
