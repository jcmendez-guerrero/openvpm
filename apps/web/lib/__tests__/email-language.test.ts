import { afterAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const resendSend = vi.fn();
  return {
    resendSend,
    Resend: vi.fn(function () { return { emails: { send: resendSend } }; }),
  };
});

vi.mock("@/lib/billing/plans", () => ({
  billingEnforced: () => false,
  TRIAL_DAYS: 14,
}));
vi.mock("resend", () => ({ Resend: mocks.Resend }));

type Language = "en" | "es";

// Load once: reloading the module per call is slow under full-suite load.
vi.stubEnv("RESEND_API_KEY", "re_test");
const email = await import("../email");

async function sent(
  build: (email: typeof import("../email"), language?: Language) => Promise<unknown>,
  language?: Language,
) {
  mocks.resendSend.mockReset();
  mocks.resendSend.mockResolvedValue({ data: { id: "msg_1" }, error: null });
  await build(email, language);
  const [payload] = mocks.resendSend.mock.calls[0] as [{ subject: string; html: string }];
  return { subject: payload.subject, html: payload.html };
}

const practice = {
  practiceName: "Clínica Sol",
  practicePhone: "555-0100",
};

const builders: Record<
  string,
  (email: typeof import("../email"), language?: Language) => Promise<unknown>
> = {
  appointmentReminder: (e, language) =>
    e.sendAppointmentReminder({
      to: "ana@example.com",
      clientName: "Ana",
      patientName: "Luna",
      appointmentDate: "lunes, 3 de marzo de 2025",
      appointmentTime: "10:00",
      practiceAddress: "Calle 1",
      idempotencyKey: "k1",
      ...practice,
      ...(language ? { language } : {}),
    }),
  vaccinationReminder: (e, language) =>
    e.sendVaccinationReminder({
      to: "ana@example.com",
      clientName: "Ana",
      patientName: "Luna",
      vaccineName: "Rabia",
      dueDate: "2025-03-03",
      ...practice,
      ...(language ? { language } : {}),
    }),
  careReminder: (e, language) =>
    e.sendCareReminder({
      to: "ana@example.com",
      clientName: "Ana",
      patientName: "Luna",
      reminderTitle: "Dental",
      dueDate: "2025-03-03",
      idempotencyKey: "k2",
      ...practice,
      ...(language ? { language } : {}),
    }),
  invoice: (e, language) =>
    e.sendInvoiceEmail({
      to: "ana@example.com",
      clientName: "Ana",
      patientName: "Luna",
      invoiceTotal: "$120.00",
      dueDate: "2025-03-03",
      portalUrl: "https://example.com/portal",
      ...practice,
      ...(language ? { language } : {}),
    }),
  paymentReceipt: (e, language) =>
    e.sendClientPaymentReceiptEmail({
      to: "ana@example.com",
      clientName: "Ana",
      patientName: "Luna",
      amountPaid: "$50.00",
      balanceRemaining: "$70.00",
      fullyPaid: false,
      ...practice,
      ...(language ? { language } : {}),
    }),
};

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("client emails follow the client's language", () => {
  for (const [name, build] of Object.entries(builders)) {
    it(`${name}: no language sends today's English email`, async () => {
      expect(await sent(build)).toMatchSnapshot();
    });

    it(`${name}: English is the same as no language`, async () => {
      expect(await sent(build, "en")).toEqual(await sent(build));
    });

    it(`${name}: Spanish has a Spanish subject, body and footer`, async () => {
      const es = await sent(build, "es");
      const en = await sent(build);
      expect(es.subject).not.toBe(en.subject);
      expect(es.html).toContain('<html lang="es">');
      expect(es.html).toContain("Hola Ana,");
      expect(es.html).not.toMatch(/\b(Hi|Please|contact us)\b/);
      expect(es.html).toContain("Clínica Sol");
    });
  }

  it("the default footer is translated too", async () => {
    const es = await sent(
      (e, language) =>
        e.sendStaffInviteEmail({
          to: "vet@example.com",
          inviterName: "Ana",
          practiceName: "Clínica Sol",
          inviteUrl: "https://example.com/i",
          ...(language ? { language } : {}),
        }),
      "es",
    );
    expect(es.html).toContain("Este correo lo envió Clínica Sol");
  });
});
