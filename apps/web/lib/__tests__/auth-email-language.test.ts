import { afterAll, describe, expect, it, vi } from "vitest";
import { messageLanguage } from "@/i18n/message-language";

const mocks = vi.hoisted(() => {
  const resendSend = vi.fn();
  return { resendSend, Resend: vi.fn(() => ({ emails: { send: resendSend } })) };
});
vi.mock("@/lib/billing/plans", () => ({ billingEnforced: () => false, TRIAL_DAYS: 14 }));
vi.mock("resend", () => ({ Resend: mocks.Resend }));

// Load once: reloading the module per call is slow under full-suite load.
vi.stubEnv("RESEND_API_KEY", "re_test");
const emailModule = await import("../email");

async function sent(build: (email: typeof import("../email")) => Promise<unknown>) {
  mocks.resendSend.mockReset();
  mocks.resendSend.mockResolvedValue({ data: { id: "msg_1" }, error: null });
  await build(emailModule);
  return (mocks.resendSend.mock.calls[0] as [{ subject: string; html: string }])[0];
}

afterAll(() => vi.unstubAllEnvs());

describe("staff account emails follow the staff language", () => {
  it("uses the user's language, then the clinic default (flag on)", () => {
    vi.stubEnv("LANGUAGE_SELECTION_ENABLED", "true");
    expect(messageLanguage("staffEmail", { userLanguage: "es", clinicDefault: "en" })).toBe("es");
    expect(messageLanguage("staffEmail", { userLanguage: null, clinicDefault: "es" })).toBe("es");
    // An invitee has no saved language yet: the clinic default decides.
    expect(messageLanguage("invite", { userLanguage: "en", clinicDefault: "es" })).toBe("es");
  });

  it("stays English while the release flag is off", () => {
    vi.stubEnv("LANGUAGE_SELECTION_ENABLED", "false");
    expect(messageLanguage("staffEmail", { userLanguage: "es", clinicDefault: "es" })).toBe("en");
  });

  it("sends verification, password reset and invite emails in Spanish", async () => {
    const verify = await sent((e) =>
      e.sendVerificationEmail({ to: "a@example.com", name: "Ana", verifyUrl: "https://x/v", language: "es" }),
    );
    expect(verify.subject).toBe("Verifica tu correo de OpenVPM");
    expect(verify.html).toContain("Confirmar correo");

    const reset = await sent((e) =>
      e.sendPasswordResetEmail({ to: "a@example.com", name: "Ana", resetUrl: "https://x/r", language: "es" }),
    );
    expect(reset.subject).toBe("Restablece tu contraseña de OpenVPM");
    expect(reset.html).toContain("Hola Ana,");

    const invite = await sent((e) =>
      e.sendStaffInviteEmail({
        to: "a@example.com",
        inviterName: "Luis",
        practiceName: "Clínica Sol",
        inviteUrl: "https://x/i",
        language: "es",
      }),
    );
    expect(invite.subject).toBe("Te invitaron a unirte a Clínica Sol en OpenVPM");
    expect(invite.html).toContain("<strong>Luis</strong> te invitó");
  });

  it("keeps the English emails unchanged without a language", async () => {
    const reset = await sent((e) =>
      e.sendPasswordResetEmail({ to: "a@example.com", name: "Ana", resetUrl: "https://x/r" }),
    );
    expect(reset.subject).toBe("Reset your OpenVPM password");
    expect(reset.html).toContain("Hi Ana,");
    expect(reset.html).toContain('<html lang="en">');
  });
});
