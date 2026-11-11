import { readTranslatedSource } from "@/i18n/translated-source";
import { describe, expect, it } from "vitest";

const source = readTranslatedSource(
  new URL("../../app/(dashboard)/settings/page.tsx", import.meta.url),
);

describe("OpenVPM email settings UI", () => {
  it("separates optional platform email from required and clinic-sent mail", () => {
    expect(source).toContain("Emails from OpenVPM");
    expect(source).toContain("Product guidance and feedback");
    expect(source).toContain("Account, security, and billing email");
    expect(source).toContain(
      "not messages your clinic sends to pet owners",
    );
  });

  it("uses a labeled native control with loading, retry, and inline status", () => {
    expect(source).toContain("getMarketingEmailPreference.useQuery");
    expect(source).toContain("setMarketingEmailPreference.useMutation");
    expect(source).toContain(
      'aria-describedby="marketing-email-preference-description"',
    );
    expect(source).toContain('role="alert"');
    expect(source).toContain("marketingEmailMutation.isError");
    expect(source).toContain("marketingEmailMutation.isSuccess");
    expect(source).toContain("marketingEmailPreferenceRefreshing");
    expect(source).toContain(
      "utils.settings.getMarketingEmailPreference.invalidate()",
    );
    expect(source).toContain('role="status"');
    expect(source).toContain("refetchMarketingEmailPreference");
  });
});
