import { readTranslatedSource } from "@/i18n/translated-source";
import { describe, expect, it } from "vitest";

describe("signup billing copy", () => {
  const registerSource = readTranslatedSource("app/(auth)/register/register-form.tsx");
  // The dormant WelcomePanel was replaced by the welcome surface; its copy
  // deck is now the customer-facing first-run voice to hold to account.
  const welcomeCopySource = readTranslatedSource("components/welcome/welcome-copy.ts");
  const activationChecklistSource = readTranslatedSource("components/dashboard/activation-checklist.tsx");
  const welcomeEmailSource = readTranslatedSource("../../packages/email/src/templates/WelcomeEmail.tsx");
  const readmeSource = readTranslatedSource("../../README.md");

  it("discloses card-required trial terms and distinguishes pending billing in email", () => {
    const pageSource = readTranslatedSource("app/(auth)/register/page.tsx");
    expect(pageSource).toContain("hostedBilling && !noCardTrialEnabled()");
    expect(registerSource).toContain("Continue to secure checkout");
    expect(registerSource).toContain("Card required. No charge today.");
    expect(registerSource).toContain("Billing starts automatically.");
    expect(registerSource).toContain("Cancel in Settings");
    expect(welcomeEmailSource).toContain("billingRequired");
    expect(welcomeEmailSource).toContain("Complete secure Stripe checkout");
    expect(welcomeEmailSource).not.toContain("no credit card");
    expect(readmeSource).toContain("starts after secure Stripe checkout");
    expect(activationChecklistSource).toContain("Confirm billing is connected");
  });

  it("keeps the safe card-checkout path for conversion", () => {
    // Both initial signup and conversion must guard off-site redirects.
    expect(registerSource).toContain(
      'import { isSafeCheckoutRedirectUrl } from "@/lib/checkout-redirect"'
    );
    expect(registerSource).toContain("data.checkoutUrl");
    expect(registerSource).toContain(
      "if (!isSafeCheckoutRedirectUrl(data.checkoutUrl))"
    );
    // New signups land on their validated destination via a FULL document navigation: the
    // logo link prefetches "/" while logged out, so the router cache holds a
    // redirect to /login and router.push would bounce fresh accounts there.
    expect(registerSource).toContain("window.location.assign(nextPath)");
    expect(registerSource).toContain("safeAuthNextPath");
    expect(registerSource).not.toContain('router.push("/");');
  });
});
