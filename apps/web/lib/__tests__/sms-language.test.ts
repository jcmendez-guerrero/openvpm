import { beforeEach, describe, expect, it, vi } from "vitest";

const sendSms = vi.hoisted(() => vi.fn(async () => ({ success: true })));
vi.mock("@/lib/sms-dispatch", () => ({ sendSms }));

const { prepareCampaignSmsBody } = await vi.importActual<
  typeof import("@/lib/sms-dispatch")
>("@/lib/sms-dispatch");

import {
  sendAppointmentReminderSms,
  sendCareReminderSms,
  sendVaccinationReminderSms,
} from "../sms";

// GSM-7 basic set (plus its escaped extension). Any other character makes
// the whole text UCS-2: 70 characters per single text, 67 per part.
const GSM7 =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà^{}\\[~]|€";

function segments(text: string): { encoding: "GSM-7" | "UCS-2"; parts: number } {
  const gsm = [...text].every((c) => GSM7.includes(c));
  const [single, multi] = gsm ? [160, 153] : [70, 67];
  const length = [...text].length;
  return {
    encoding: gsm ? "GSM-7" : "UCS-2",
    parts: length <= single ? 1 : Math.ceil(length / multi),
  };
}

const base = {
  to: "+15550100",
  patientName: "Luna",
  practiceName: "Clínica Sol",
  practicePhone: "555-0100",
  practiceId: "p1",
};

async function body(send: () => Promise<unknown>): Promise<string> {
  sendSms.mockClear();
  await send();
  return (sendSms.mock.calls[0] as unknown as [{ body: string }])[0].body;
}

const templates = {
  appointment: (language?: "es") =>
    sendAppointmentReminderSms({
      ...base,
      appointmentDate: language ? "miércoles, 3 de marzo de 2025" : "Wednesday, March 3, 2025",
      appointmentTime: language ? "15:00" : "10:00 AM",
      language,
    }),
  vaccination: (language?: "es") =>
    sendVaccinationReminderSms({ ...base, vaccineName: "Rabia", language }),
  care: (language?: "es") =>
    sendCareReminderSms({
      ...base,
      reminderTitle: "Limpieza dental",
      dueDate: "2025-03-03",
      locationId: "l1",
      clientId: "c1",
      communicationId: "m1",
      sourceId: "s1",
      idempotencyKey: "k1",
      language,
    }),
};

describe("reminder texts follow the client's language", () => {
  beforeEach(() => sendSms.mockClear());

  it("keeps today's English texts when no language is given", async () => {
    expect(await body(() => templates.appointment())).toBe(
      "Reminder: Luna has an appointment on Wednesday, March 3, 2025 at 10:00 AM. Call 555-0100 to reschedule.",
    );
    expect(await body(() => templates.vaccination())).toBe(
      "Luna is due for their Rabia vaccination. Call 555-0100 to schedule.",
    );
    expect(await body(() => templates.care())).toBe(
      "Reminder for Luna: Limpieza dental. Reminder date: 2025-03-03. Call 555-0100 with questions.",
    );
  });

  it("sends Spanish texts for a Spanish client", async () => {
    expect(await body(() => templates.appointment("es"))).toBe(
      "Recordatorio: Luna tiene una cita el miércoles, 3 de marzo de 2025 a las 15:00. Llama al 555-0100 para reprogramar.",
    );
    expect(await body(() => templates.vaccination("es"))).toBe(
      "Luna debe recibir su vacuna Rabia. Llama al 555-0100 para agendar.",
    );
    expect(await body(() => templates.care("es"))).toBe(
      "Recordatorio para Luna: Limpieza dental. Fecha: 2025-03-03. Llama al 555-0100 si tienes preguntas.",
    );
  });

  it("keeps the Spanish template text itself in GSM-7 so only accented data costs extra", async () => {
    // Research R6: the fixed wording avoids á í ó ú, so a text stays GSM-7
    // unless its data has them (é is GSM-7; "sábado" is not). Per-template report.
    const report: Record<string, ReturnType<typeof segments>> = {};
    for (const [name, send] of Object.entries(templates)) {
      report[`${name}:en`] = segments(await body(() => send()));
      report[`${name}:es`] = segments(await body(() => send("es")));
    }
    report["appointment:es:sábado"] = segments(
      await body(() =>
        sendAppointmentReminderSms({
          ...base,
          appointmentDate: "sábado, 8 de marzo de 2025",
          appointmentTime: "15:00",
          language: "es",
        }),
      ),
    );
    expect(report).toEqual({
      "appointment:es:sábado": { encoding: "UCS-2", parts: 2 },
      "appointment:en": { encoding: "GSM-7", parts: 1 },
      "appointment:es": { encoding: "GSM-7", parts: 1 },
      "vaccination:en": { encoding: "GSM-7", parts: 1 },
      "vaccination:es": { encoding: "GSM-7", parts: 1 },
      "care:en": { encoding: "GSM-7", parts: 1 },
      "care:es": { encoding: "GSM-7", parts: 1 },
    });
  });
});

describe("SMS segments as sent", () => {
  it("counts the registered name prefix and the compliance footer", async () => {
    // An accented registered name makes every text UCS-2, in either language.
    expect(await fullBodyReport()).toEqual({
      "Sol Vet:appointment:en": { encoding: "GSM-7", parts: 1 },
      "Sol Vet:appointment:es": { encoding: "GSM-7", parts: 2 },
      "Sol Vet:vaccination:en": { encoding: "GSM-7", parts: 1 },
      "Sol Vet:vaccination:es": { encoding: "GSM-7", parts: 1 },
      "Sol Vet:care:en": { encoding: "GSM-7", parts: 1 },
      "Sol Vet:care:es": { encoding: "GSM-7", parts: 1 },
      "Clínica Sol:appointment:en": { encoding: "UCS-2", parts: 3 },
      "Clínica Sol:appointment:es": { encoding: "UCS-2", parts: 3 },
      "Clínica Sol:vaccination:en": { encoding: "UCS-2", parts: 2 },
      "Clínica Sol:vaccination:es": { encoding: "UCS-2", parts: 2 },
      "Clínica Sol:care:en": { encoding: "UCS-2", parts: 3 },
      "Clínica Sol:care:es": { encoding: "UCS-2", parts: 3 },
    });
  });
});

/** Segments of the text as sent: "<registered name>: <template> <compliance footer>". */
async function fullBodyReport() {
  const report: Record<string, ReturnType<typeof segments>> = {};
  for (const name of ["Sol Vet", "Clínica Sol"]) {
    for (const [template, send] of Object.entries(templates)) {
      for (const language of [undefined, "es"] as const) {
        const prepared = prepareCampaignSmsBody({
          registeredDisplayName: name,
          content: await body(() => send(language)),
        });
        if (!prepared.success) throw new Error(prepared.error);
        report[`${name}:${template}:${language ?? "en"}`] = segments(prepared.body);
      }
    }
  }
  return report;
}
