import { describe, expect, it } from "vitest";
import {
  generateDischargeInstructions,
  generateInvoicePdf,
  generateMedicalSummaryPdf,
  generateVaccinationCertificatePdf,
  generateVaccinationHistoryCertificatePdf,
} from "../pdf";

type Language = "en" | "es";

// jsPDF writes each text run as `(text) Tj` in WinAnsi, so Latin-1 letters
// such as á ñ ¿ ¡ appear as the same characters in the raw output string.
const shown = (output: string, text: string) => output.includes(`(${text}) Tj`);

const documents: Record<string, (language?: Language) => string> = {
  invoice: (language) =>
    generateInvoicePdf({
      language,
      practiceName: "Clínica Sol",
      clientName: "Ana Peña",
      invoiceDate: "3 de marzo de 2026",
      status: "paid",
      items: [{ description: "Consulta", quantity: 1, unitPrice: "$100.00", total: "$100.00" }],
      subtotal: "$100.00", tax: "$0.00", total: "$100.00",
      paidAmount: "$100.00", adjustedAmount: "$0.00", balanceDue: "$0.00",
    }).output(),
  vaccinationCertificate: (language) =>
    generateVaccinationCertificatePdf({
      language,
      practiceName: "Clínica Sol",
      patientName: "Luna",
      species: "Canino",
      clientName: "Ana Peña",
      vaccineName: "Rabia",
      administeredAt: "3 de marzo de 2026",
      nextDueDate: "3 de marzo de 2027",
      lotNumber: "L-1",
      generatedDate: "3 de marzo de 2026",
    }).output(),
  vaccinationHistory: (language) =>
    generateVaccinationHistoryCertificatePdf({
      language,
      certificateId: "cert-1",
      generatedDate: "3 de marzo de 2026",
      practice: { name: "Clínica Sol" },
      owner: { name: "Ana Peña" },
      patient: { name: "Luna", species: "Canino" },
      vaccinations: [{ vaccineName: "Rabia", administeredAt: "3 de marzo de 2026" }],
    } as never).output(),
  medicalSummary: (language) =>
    generateMedicalSummaryPdf({
      language,
      practiceName: "Clínica Sol",
      patientName: "Luna",
      species: "Canino",
      clientName: "Ana Peña",
      allergies: [],
      problems: [],
      vaccinations: [{ name: "Rabia", date: "2026-03-03" }],
      recentNotes: [],
      prescriptions: [],
      generatedDate: "3 de marzo de 2026",
    } as never).output(),
  discharge: (language) =>
    generateDischargeInstructions({
      language,
      practiceName: "Clínica Sol",
      patientName: "Luna",
      species: "Canino",
      clientName: "Ana Peña",
      visitDate: "3 de marzo de 2026",
      diagnosis: "¿Otitis? ¡Revisar en 7 días! áéíóú ñ",
      medications: [],
      instructions: ["Limpiar el oído"],
    }).output(),
};

const expected: Record<string, { en: string[]; es: string[] }> = {
  invoice: { en: ["INVOICE", "BILL TO", "Description", "PAID"], es: ["FACTURA", "FACTURAR A", "Descripción", "PAGADA"] },
  vaccinationCertificate: {
    en: ["VACCINATION CERTIFICATE", "Vaccination Record", "Next due:"],
    es: ["CERTIFICADO DE VACUNACIÓN", "Registro de vacunación", "Próxima dosis:"],
  },
  vaccinationHistory: {
    en: ["Vaccination history", "Administered by"],
    es: ["Historial de vacunas", "Aplicada por"],
  },
  medicalSummary: {
    en: ["MEDICAL RECORD SUMMARY", "Patient Information"],
    es: ["RESUMEN DEL HISTORIAL MÉDICO", "Datos del paciente"],
  },
  discharge: {
    en: ["DISCHARGE INSTRUCTIONS", "Diagnosis", "Visit Date:"],
    es: ["INSTRUCCIONES DE ALTA", "Diagnóstico", "Fecha de la visita:"],
  },
};

describe("client documents follow the client's language", () => {
  for (const [name, render] of Object.entries(documents)) {
    it(`${name}: Spanish labels in a Spanish document`, () => {
      const es = render("es");
      for (const label of expected[name]!.es) expect(shown(es, label), label).toBe(true);
      for (const label of expected[name]!.en) expect(shown(es, label), label).toBe(false);
    });

    it(`${name}: English labels without a language`, () => {
      const en = render();
      for (const label of expected[name]!.en) expect(shown(en, label), label).toBe(true);
    });
  }

  it("prints Spanish accents and punctuation", () => {
    const output = documents.discharge!("es");
    expect(shown(output, "¿Otitis? ¡Revisar en 7 días! áéíóú ñ")).toBe(true);
  });
});
