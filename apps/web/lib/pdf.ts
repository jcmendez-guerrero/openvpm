import jsPDF from "jspdf";
import { soapSectionText } from "@/lib/records/soap-content";
import type { Language } from "@/i18n/config";
import { getTranslatorFor } from "@/i18n/messages";

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const COLOR_TEAL = "#0d9488";
const COLOR_DARK = "#333333";
const COLOR_GRAY = "#666666";
const COLOR_LIGHT_GRAY = "#eeeeee";
const FONT = "helvetica";
const PAGE_MARGIN = 20; // mm
const PAGE_WIDTH = 210; // A4 / letter approximate usable width
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function setColor(doc: jsPDF, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.setTextColor(r, g, b);
}

function drawLine(doc: jsPDF, y: number) {
  const [r, g, b] = hexToRgb(COLOR_LIGHT_GRAY);
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(0.5);
  doc.line(PAGE_MARGIN, y, PAGE_WIDTH - PAGE_MARGIN, y);
}

/**
 * Check remaining space on page; add a new page if needed.
 * Returns the (potentially reset) y position.
 */
function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - 20) {
    doc.addPage();
    return PAGE_MARGIN;
  }
  return y;
}

function formatGeneratedDateUtc(language?: Language): string {
  return new Date().toLocaleDateString(language === "es" ? "es" : "en-US", {
    timeZone: "UTC",
  });
}

type PdfText = ReturnType<typeof getTranslatorFor>;

/** Value x-offset after a label: the fixed gap, widened for longer labels. */
function labelGap(doc: jsPDF, label: string, min: number): number {
  return Math.max(min, doc.getTextWidth(label) + 3);
}

/** Printed labels in the document's language (English when omitted). */
export function pdfText(language?: Language): PdfText {
  return getTranslatorFor(language ?? "en");
}

/**
 * Brand mark: a white paw print on a teal rounded square, drawn with
 * primitives so PDFs need no image asset. Matches the in-app brand color.
 */
function drawPawMark(doc: jsPDF, x: number, y: number, size: number) {
  const [r, g, b] = hexToRgb(COLOR_TEAL);
  doc.setFillColor(r, g, b);
  doc.roundedRect(x, y, size, size, size * 0.22, size * 0.22, "F");

  doc.setFillColor(255, 255, 255);
  const cx = x + size / 2;
  const s = size / 12;
  // Main pad
  doc.ellipse(cx, y + 7.7 * s, 2.7 * s, 2.2 * s, "F");
  // Four toes
  doc.circle(cx - 3.3 * s, y + 4.7 * s, 1.15 * s, "F");
  doc.circle(cx - 1.15 * s, y + 3.5 * s, 1.15 * s, "F");
  doc.circle(cx + 1.15 * s, y + 3.5 * s, 1.15 * s, "F");
  doc.circle(cx + 3.3 * s, y + 4.7 * s, 1.15 * s, "F");
}

// ---------------------------------------------------------------------------
// 1. Invoice PDF
// ---------------------------------------------------------------------------

export interface InvoiceData {
  /** Language of the printed labels; English when omitted. */
  language?: Language;
  practiceName: string;
  practiceAddress?: string;
  practicePhone?: string;
  practiceEmail?: string;
  clientName: string;
  clientEmail?: string;
  clientAddress?: string;
  patientName?: string;
  invoiceDate: string;
  dueDate?: string;
  status: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: string;
    total: string;
  }>;
  subtotal: string;
  tax: string;
  total: string;
  paidAmount: string;
  /** Region-formatted sum of credits and write-offs from the invoice ledger. */
  adjustedAmount: string;
  /** Region-formatted authoritative balance from the invoice ledger. */
  balanceDue: string;
}

export function generateInvoicePdf(data: InvoiceData): jsPDF {
  const t = pdfText(data.language);
  const doc = new jsPDF();
  let y = PAGE_MARGIN;

  // --- Header: Practice info -------------------------------------------------
  doc.setFont(FONT, "bold");
  doc.setFontSize(20);
  setColor(doc, COLOR_TEAL);
  doc.text(data.practiceName, PAGE_MARGIN, y);
  y += 7;

  doc.setFont(FONT, "normal");
  doc.setFontSize(9);
  setColor(doc, COLOR_GRAY);
  if (data.practiceAddress) {
    doc.text(data.practiceAddress, PAGE_MARGIN, y);
    y += 4;
  }
  if (data.practicePhone) {
    doc.text(data.practicePhone, PAGE_MARGIN, y);
    y += 4;
  }
  if (data.practiceEmail) {
    doc.text(data.practiceEmail, PAGE_MARGIN, y);
    y += 4;
  }

  // --- INVOICE title (right-aligned) -----------------------------------------
  doc.setFont(FONT, "bold");
  doc.setFontSize(28);
  setColor(doc, COLOR_DARK);
  doc.text(t("pdf.invoice.title"), PAGE_WIDTH - PAGE_MARGIN, PAGE_MARGIN, {
    align: "right",
  });

  // Status badge
  doc.setFontSize(10);
  const statusKey = `billing.status.${data.status}`;
  const statusLabel = (
    t.has(statusKey as never) ? t(statusKey as never) : data.status
  ).toUpperCase();
  const statusWidth = doc.getTextWidth(statusLabel) + 8;
  const statusX = PAGE_WIDTH - PAGE_MARGIN - statusWidth;
  const statusY = PAGE_MARGIN + 6;
  const [tr, tg, tb] = hexToRgb(COLOR_TEAL);
  doc.setFillColor(tr, tg, tb);
  doc.roundedRect(statusX, statusY, statusWidth, 7, 1, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(statusLabel, statusX + statusWidth / 2, statusY + 5, {
    align: "center",
  });

  // Date info right side
  setColor(doc, COLOR_GRAY);
  doc.setFont(FONT, "normal");
  doc.setFontSize(9);
  let dateY = statusY + 12;
  doc.text(t("pdf.invoice.date", { date: data.invoiceDate }), PAGE_WIDTH - PAGE_MARGIN, dateY, {
    align: "right",
  });
  if (data.dueDate) {
    dateY += 4;
    doc.text(t("pdf.invoice.due", { date: data.dueDate }), PAGE_WIDTH - PAGE_MARGIN, dateY, {
      align: "right",
    });
  }

  y = Math.max(y, dateY) + 8;
  drawLine(doc, y);
  y += 8;

  // --- Bill To ---------------------------------------------------------------
  doc.setFont(FONT, "bold");
  doc.setFontSize(10);
  setColor(doc, COLOR_DARK);
  doc.text(t("pdf.invoice.billTo"), PAGE_MARGIN, y);
  y += 5;

  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  setColor(doc, COLOR_GRAY);
  doc.text(data.clientName, PAGE_MARGIN, y);
  y += 5;
  if (data.clientAddress) {
    doc.text(data.clientAddress, PAGE_MARGIN, y);
    y += 5;
  }
  if (data.clientEmail) {
    doc.text(data.clientEmail, PAGE_MARGIN, y);
    y += 5;
  }
  if (data.patientName) {
    y += 2;
    doc.setFont(FONT, "italic");
    setColor(doc, COLOR_DARK);
    doc.text(t("pdf.invoice.patient", { name: data.patientName }), PAGE_MARGIN, y);
    y += 5;
  }

  y += 6;

  // --- Line Items Table ------------------------------------------------------
  const colX = {
    desc: PAGE_MARGIN,
    qty: PAGE_MARGIN + CONTENT_WIDTH * 0.55,
    unit: PAGE_MARGIN + CONTENT_WIDTH * 0.7,
    total: PAGE_WIDTH - PAGE_MARGIN,
  };

  // Table header
  const [lr, lg, lb] = hexToRgb(COLOR_LIGHT_GRAY);
  doc.setFillColor(lr, lg, lb);
  doc.rect(PAGE_MARGIN, y - 4, CONTENT_WIDTH, 8, "F");
  doc.setFont(FONT, "bold");
  doc.setFontSize(9);
  setColor(doc, COLOR_DARK);
  doc.text(t("pdf.invoice.description"), colX.desc + 2, y);
  doc.text(t("pdf.invoice.qty"), colX.qty, y, { align: "center" });
  doc.text(t("pdf.invoice.unitPrice"), colX.unit, y, { align: "center" });
  doc.text(t("pdf.invoice.total"), colX.total - 2, y, { align: "right" });
  y += 8;

  // Table rows
  doc.setFont(FONT, "normal");
  doc.setFontSize(9);
  setColor(doc, COLOR_DARK);
  for (const item of data.items) {
    y = ensureSpace(doc, y, 8);
    doc.text(item.description, colX.desc + 2, y);
    doc.text(String(item.quantity), colX.qty, y, { align: "center" });
    doc.text(item.unitPrice, colX.unit, y, { align: "center" });
    doc.text(item.total, colX.total - 2, y, { align: "right" });
    y += 6;
  }

  // Keep the entire totals block together and clear of the footer.
  y = ensureSpace(doc, y, 66);
  y += 4;
  drawLine(doc, y);
  y += 8;

  // --- Totals ----------------------------------------------------------------
  const totalsX = PAGE_WIDTH - PAGE_MARGIN - 80;
  const totalsValX = PAGE_WIDTH - PAGE_MARGIN;

  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  setColor(doc, COLOR_GRAY);

  doc.text(t("pdf.invoice.subtotalLabel"), totalsX, y);
  doc.text(data.subtotal, totalsValX, y, { align: "right" });
  y += 6;

  doc.text(t("pdf.invoice.taxLabel"), totalsX, y);
  doc.text(data.tax, totalsValX, y, { align: "right" });
  y += 6;

  drawLine(doc, y);
  y += 6;

  doc.setFont(FONT, "bold");
  doc.setFontSize(12);
  setColor(doc, COLOR_DARK);
  doc.text(t("pdf.invoice.totalLabel"), totalsX, y);
  doc.text(data.total, totalsValX, y, { align: "right" });
  y += 7;

  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  setColor(doc, COLOR_GRAY);
  doc.text(t("pdf.invoice.paidLabel"), totalsX, y);
  doc.text(data.paidAmount, totalsValX, y, { align: "right" });
  y += 6;

  doc.text(t("pdf.invoice.adjustedLabel"), totalsX, y);
  doc.text(data.adjustedAmount, totalsValX, y, { align: "right" });
  y += 6;

  // Use the server's ledger balance; never parse localized currency strings.
  doc.setFont(FONT, "bold");
  setColor(doc, COLOR_TEAL);
  doc.text(t("pdf.invoice.balanceLabel"), totalsX, y);
  doc.text(data.balanceDue, totalsValX, y, { align: "right" });

  // --- Footer ----------------------------------------------------------------
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont(FONT, "italic");
  doc.setFontSize(9);
  setColor(doc, COLOR_GRAY);
  doc.text(
    t("pdf.invoice.thanks"),
    PAGE_WIDTH / 2,
    pageHeight - 15,
    { align: "center" },
  );

  return doc;
}

// ---------------------------------------------------------------------------
// 2. Prescription Label PDF
// ---------------------------------------------------------------------------

export interface PrescriptionLabelData {
  /** Language of the printed labels; English when omitted. */
  language?: Language;
  practiceName: string;
  practicePhone?: string;
  patientName: string;
  clientName: string;
  species: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  instructions?: string;
  prescribedBy: string;
  startDate: string;
  quantity?: string;
  refillsRemaining?: number;
}

export function generatePrescriptionLabelPdf(
  data: PrescriptionLabelData,
): jsPDF {
  const t = pdfText(data.language);
  // 4" x 2" landscape at 72 DPI  ➜  288 x 144 points
  const doc = new jsPDF({ format: [144, 288], orientation: "landscape" });

  // Convert points to mm for internal use (1 pt = 0.3528 mm)
  const W = 288 * 0.3528; // ~101.6 mm
  const H = 144 * 0.3528; // ~50.8 mm
  const M = 4; // margin in mm
  let y = M + 3;

  // Practice info
  doc.setFont(FONT, "bold");
  doc.setFontSize(9);
  setColor(doc, COLOR_TEAL);
  doc.text(data.practiceName, W / 2, y, { align: "center" });
  y += 3.5;

  if (data.practicePhone) {
    doc.setFont(FONT, "normal");
    doc.setFontSize(7);
    setColor(doc, COLOR_GRAY);
    doc.text(data.practicePhone, W / 2, y, { align: "center" });
    y += 3;
  }

  // Divider
  const [lr, lg, lb] = hexToRgb(COLOR_LIGHT_GRAY);
  doc.setDrawColor(lr, lg, lb);
  doc.setLineWidth(0.3);
  doc.line(M, y, W - M, y);
  y += 3;

  // Patient / Client
  doc.setFont(FONT, "normal");
  doc.setFontSize(7);
  setColor(doc, COLOR_DARK);
  doc.text(t("pdf.prescription.patient", {
      name: data.patientName,
      species: data.species,
    }), M, y);
  doc.text(t("pdf.prescription.owner", { name: data.clientName }), W - M, y, { align: "right" });
  y += 4;

  // Medication (bold, larger)
  doc.setFont(FONT, "bold");
  doc.setFontSize(10);
  setColor(doc, COLOR_DARK);
  doc.text(data.medicationName, M, y);
  y += 4;

  // Dosage & frequency
  doc.setFontSize(8);
  doc.text(`${data.dosage}  —  ${data.frequency}`, M, y);
  y += 4;

  // Instructions
  if (data.instructions) {
    doc.setFont(FONT, "normal");
    doc.setFontSize(7);
    setColor(doc, COLOR_DARK);
    const lines = doc.splitTextToSize(data.instructions, W - M * 2);
    doc.text(lines, M, y);
    y += lines.length * 3;
  }

  y += 1;

  // Prescriber & date
  doc.setFont(FONT, "normal");
  doc.setFontSize(6.5);
  setColor(doc, COLOR_GRAY);
  doc.text(t("pdf.prescription.prescribedBy", { name: data.prescribedBy }), M, y);
  doc.text(t("pdf.prescription.date", { date: data.startDate }), W - M, y, { align: "right" });
  y += 3;

  // Quantity & refills
  const extras: string[] = [];
  if (data.quantity) extras.push(t("pdf.prescription.qty", { qty: data.quantity }));
  if (data.refillsRemaining !== undefined)
    extras.push(t("pdf.prescription.refills", { count: data.refillsRemaining }));
  if (extras.length > 0) {
    doc.text(extras.join("   |   "), M, y);
  }

  return doc;
}

// ---------------------------------------------------------------------------
// 3. Medical Record Summary PDF
// ---------------------------------------------------------------------------

export interface MedicalSummaryData {
  /** Language of the printed labels; English when omitted. */
  language?: Language;
  practiceName: string;
  practiceAddress?: string;
  practicePhone?: string;
  patientName: string;
  species: string;
  breed?: string;
  sex?: string;
  dob?: string;
  color?: string;
  microchip?: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  allergies: Array<{
    allergen: string;
    severity: string;
    reaction?: string;
  }>;
  problems: Array<{ description: string; status: string; onsetDate?: string }>;
  vaccinations: Array<{ name: string; date: string; nextDue?: string }>;
  recentNotes: Array<{
    date: string;
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
    imported?: boolean;
    authorName?: string;
    finalizerName?: string;
    finalizedAt?: string;
    replacementForLabel?: string;
    addenda?: Array<{ content: string; authorName: string; createdAt: string }>;
  }>;
  chartNotes?: {
    items: Array<{
      date: string;
      type: string;
      authorName: string;
      content: string;
    }>;
    hasMore: boolean;
  } | null;
  recordCorrections?: Array<{
    recordLabel: string;
    reason: string;
    correctedByName: string;
    correctedAt: string;
    replacementLabel?: string;
  }>;
  prescriptions: Array<{
    medication: string;
    dosage: string;
    frequency: string;
    status: string;
  }>;
  generatedDate?: string;
}

export function generateMedicalSummaryPdf(data: MedicalSummaryData): jsPDF {
  const t = pdfText(data.language);
  const doc = new jsPDF();
  let y = PAGE_MARGIN;

  function writeWrappedText(
    value: string,
    x: number,
    width: number,
    lineHeight = 4,
  ) {
    const lines = doc.splitTextToSize(value, width) as string[];
    for (const line of lines) {
      y = ensureSpace(doc, y, lineHeight + 1);
      doc.text(line, x, y);
      y += lineHeight;
    }
  }

  // ---- Helper: section heading ---------------------------------------------
  function sectionHeading(title: string) {
    y = ensureSpace(doc, y, 16);
    y += 4;
    doc.setFont(FONT, "bold");
    doc.setFontSize(12);
    setColor(doc, COLOR_TEAL);
    doc.text(title, PAGE_MARGIN, y);
    y += 2;
    const [r, g, b] = hexToRgb(COLOR_TEAL);
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(0.5);
    doc.line(PAGE_MARGIN, y, PAGE_WIDTH - PAGE_MARGIN, y);
    y += 6;
  }

  // ---- Header ---------------------------------------------------------------
  // Stacked top to bottom (logo, clinic name, document title) so any
  // clinic-name length fits without colliding with the title.
  const logoSize = 12;
  drawPawMark(doc, PAGE_MARGIN, y, logoSize);
  y += logoSize + 8;

  doc.setFont(FONT, "bold");
  doc.setFontSize(20);
  setColor(doc, COLOR_TEAL);
  const nameLines = doc.splitTextToSize(data.practiceName, CONTENT_WIDTH);
  doc.text(nameLines, PAGE_MARGIN, y);
  y += nameLines.length * 8;

  doc.setFont(FONT, "normal");
  doc.setFontSize(9);
  setColor(doc, COLOR_GRAY);
  if (data.practiceAddress) {
    doc.text(data.practiceAddress, PAGE_MARGIN, y);
    y += 4;
  }
  if (data.practicePhone) {
    doc.text(data.practicePhone, PAGE_MARGIN, y);
    y += 4;
  }
  y += 4;

  doc.setFont(FONT, "bold");
  doc.setFontSize(16);
  setColor(doc, COLOR_DARK);
  doc.text(t("pdf.summary.title"), PAGE_MARGIN, y);

  y += 3;
  drawLine(doc, y);
  y += 8;

  // ---- Patient Info ---------------------------------------------------------
  sectionHeading(t("pdf.summary.patientInformation"));

  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  setColor(doc, COLOR_DARK);

  const patientFields: [string, string | undefined][] = [
    [t("pdf.summary.name"), data.patientName],
    [t("pdf.summary.species"), data.species],
    [t("pdf.summary.breed"), data.breed],
    [t("pdf.summary.sex"), data.sex],
    [t("pdf.summary.dob"), data.dob],
    [t("pdf.summary.color"), data.color],
    [t("pdf.summary.microchip"), data.microchip],
  ];

  const colMid = PAGE_MARGIN + CONTENT_WIDTH / 2;
  let col = 0;
  for (const [label, value] of patientFields) {
    if (value === undefined) continue;
    const xPos = col === 0 ? PAGE_MARGIN : colMid;
    doc.setFont(FONT, "bold");
    doc.text(`${label}: `, xPos, y);
    const labelW = doc.getTextWidth(`${label}: `);
    doc.setFont(FONT, "normal");
    doc.text(value, xPos + labelW, y);
    col++;
    if (col === 2) {
      col = 0;
      y += 6;
    }
  }
  if (col !== 0) y += 6;

  // ---- Owner Info -----------------------------------------------------------
  sectionHeading(t("pdf.summary.ownerInformation"));

  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  setColor(doc, COLOR_DARK);

  doc.setFont(FONT, "bold");
  doc.text(t("pdf.summary.nameLabel"), PAGE_MARGIN, y);
  doc.setFont(FONT, "normal");
  doc.text(data.clientName, PAGE_MARGIN + doc.getTextWidth(t("pdf.summary.nameLabel")), y);
  y += 6;

  if (data.clientPhone) {
    doc.setFont(FONT, "bold");
    doc.text(t("pdf.summary.phoneLabel"), PAGE_MARGIN, y);
    doc.setFont(FONT, "normal");
    doc.text(data.clientPhone, PAGE_MARGIN + doc.getTextWidth(t("pdf.summary.phoneLabel")), y);
    y += 6;
  }
  if (data.clientEmail) {
    doc.setFont(FONT, "bold");
    doc.text(t("pdf.summary.emailLabel"), PAGE_MARGIN, y);
    doc.setFont(FONT, "normal");
    doc.text(data.clientEmail, PAGE_MARGIN + doc.getTextWidth(t("pdf.summary.emailLabel")), y);
    y += 6;
  }

  // ---- Allergies ------------------------------------------------------------
  if (data.allergies.length > 0) {
    sectionHeading(t("pdf.summary.allergies"));

    doc.setFontSize(10);
    for (const allergy of data.allergies) {
      y = ensureSpace(doc, y, 8);
      // Highlight background for allergies
      const [ar, ag, ab] = hexToRgb("#fef2f2"); // light red
      doc.setFillColor(ar, ag, ab);
      doc.rect(PAGE_MARGIN, y - 4, CONTENT_WIDTH, 7, "F");

      doc.setFont(FONT, "bold");
      setColor(doc, "#dc2626");
      doc.text(allergy.allergen, PAGE_MARGIN + 2, y);
      doc.setFont(FONT, "normal");
      setColor(doc, COLOR_GRAY);
      doc.text(
        `(${allergy.severity})`,
        PAGE_MARGIN + 2 + doc.getTextWidth(allergy.allergen + " "),
        y,
      );
      y += 5;
      if (allergy.reaction) {
        doc.setFontSize(8);
        writeWrappedText(
          t("pdf.summary.reaction", { reaction: allergy.reaction }),
          PAGE_MARGIN + 2,
          CONTENT_WIDTH - 4,
          3.5,
        );
        doc.setFontSize(10);
      }
      y += 3;
    }
  }

  // ---- Active Problems ------------------------------------------------------
  if (data.problems.length > 0) {
    sectionHeading(t("pdf.summary.activeProblems"));

    doc.setFontSize(10);
    for (const problem of data.problems) {
      y = ensureSpace(doc, y, 8);
      doc.setFont(FONT, "normal");
      setColor(doc, COLOR_DARK);
      let text = `• ${problem.description}`;
      if (problem.onsetDate) text += t("pdf.summary.onset", { date: problem.onsetDate });
      doc.text(text, PAGE_MARGIN + 2, y);
      doc.setFont(FONT, "italic");
      setColor(doc, COLOR_GRAY);
      doc.text(`[${problem.status}]`, PAGE_WIDTH - PAGE_MARGIN, y, {
        align: "right",
      });
      y += 6;
    }
  }

  // ---- Vaccination History --------------------------------------------------
  if (data.vaccinations.length > 0) {
    sectionHeading(t("pdf.summary.vaccinationHistory"));

    // Table header
    const vColName = PAGE_MARGIN;
    const vColDate = PAGE_MARGIN + CONTENT_WIDTH * 0.5;
    const vColNext = PAGE_WIDTH - PAGE_MARGIN;

    const [lr, lg, lb] = hexToRgb(COLOR_LIGHT_GRAY);
    doc.setFillColor(lr, lg, lb);
    doc.rect(PAGE_MARGIN, y - 4, CONTENT_WIDTH, 8, "F");
    doc.setFont(FONT, "bold");
    doc.setFontSize(9);
    setColor(doc, COLOR_DARK);
    doc.text(t("pdf.common.vaccine"), vColName + 2, y);
    doc.text(t("pdf.summary.dateGiven"), vColDate, y);
    doc.text(t("pdf.summary.nextDue"), vColNext - 2, y, { align: "right" });
    y += 8;

    doc.setFont(FONT, "normal");
    for (const vax of data.vaccinations) {
      y = ensureSpace(doc, y, 7);
      setColor(doc, COLOR_DARK);
      doc.text(vax.name, vColName + 2, y);
      doc.text(vax.date, vColDate, y);
      setColor(doc, COLOR_GRAY);
      doc.text(vax.nextDue ?? "—", vColNext - 2, y, { align: "right" });
      y += 6;
    }
  }

  // ---- Recent SOAP Notes ----------------------------------------------------
  if (data.recentNotes.length > 0) {
    sectionHeading(t("pdf.summary.recentSoapNotes"));

    const notesToShow = data.recentNotes.slice(0, 5);
    for (const note of notesToShow) {
      y = ensureSpace(doc, y, 30);

      doc.setFont(FONT, "bold");
      doc.setFontSize(10);
      setColor(doc, COLOR_DARK);
      doc.text(
        note.imported
          ? t("pdf.summary.finalizedImported", { date: note.date })
          : t("pdf.summary.finalized", { date: note.date }),
        PAGE_MARGIN,
        y,
      );
      y += 6;

      doc.setFont(FONT, "normal");
      doc.setFontSize(8);
      setColor(doc, COLOR_GRAY);
      const attribution = note.imported
        ? t("pdf.summary.importedBy", {
            name: note.authorName ?? t("pdf.summary.unknownClinician"),
          })
        : note.finalizedAt
          ? t("pdf.summary.authoredFinalizedOn", {
              author: note.authorName ?? t("pdf.summary.unknownClinician"),
              finalizer: note.finalizerName ?? t("pdf.summary.unknownClinician"),
              date: note.finalizedAt,
            })
          : t("pdf.summary.authoredFinalized", {
              author: note.authorName ?? t("pdf.summary.unknownClinician"),
              finalizer: note.finalizerName ?? t("pdf.summary.unknownClinician"),
            });
      writeWrappedText(attribution, PAGE_MARGIN, CONTENT_WIDTH);
      y += 2;
      if (note.replacementForLabel) {
        doc.setFont(FONT, "bold");
        setColor(doc, COLOR_TEAL);
        writeWrappedText(
          t("pdf.summary.signedReplacementFor", {
            label: note.replacementForLabel,
          }),
          PAGE_MARGIN,
          CONTENT_WIDTH,
        );
        y += 2;
      }

      doc.setFontSize(9);
      const soapSections: [string, string | undefined][] = [
        ["S: ", soapSectionText(note.subjective)],
        ["O: ", soapSectionText(note.objective)],
        ["A: ", soapSectionText(note.assessment)],
        ["P: ", soapSectionText(note.plan)],
      ];

      for (const [prefix, content] of soapSections) {
        if (!content) continue;
        y = ensureSpace(doc, y, 10);
        doc.setFont(FONT, "bold");
        setColor(doc, COLOR_TEAL);
        doc.text(prefix, PAGE_MARGIN + 4, y);
        doc.setFont(FONT, "normal");
        setColor(doc, COLOR_DARK);
        writeWrappedText(content, PAGE_MARGIN + 14, CONTENT_WIDTH - 14);
        y += 2;
      }

      for (const addendum of note.addenda ?? []) {
        y = ensureSpace(doc, y, 14);
        doc.setFont(FONT, "bold");
        setColor(doc, COLOR_TEAL);
        writeWrappedText(
          t("pdf.summary.addendum", {
            author: addendum.authorName,
            date: addendum.createdAt,
          }),
          PAGE_MARGIN + 4,
          CONTENT_WIDTH - 8,
          5,
        );
        doc.setFont(FONT, "normal");
        setColor(doc, COLOR_DARK);
        writeWrappedText(
          soapSectionText(addendum.content),
          PAGE_MARGIN + 4,
          CONTENT_WIDTH - 8,
        );
        y += 2;
      }

      y += 4;
      drawLine(doc, y);
      y += 4;
    }
  }

  if (data.chartNotes !== undefined) {
    sectionHeading(t("pdf.summary.recentChartNotes"));
    doc.setFont(FONT, "normal");
    doc.setFontSize(9);
    setColor(doc, COLOR_GRAY);
    if (data.chartNotes === null) {
      writeWrappedText(
        t("pdf.summary.chartNotesHidden"),
        PAGE_MARGIN,
        CONTENT_WIDTH,
      );
    } else {
      if (data.chartNotes.hasMore) {
        writeWrappedText(
          t("pdf.summary.chartNotesLimited"),
          PAGE_MARGIN,
          CONTENT_WIDTH,
        );
        y += 3;
      } else if (data.chartNotes.items.length === 0) {
        writeWrappedText(
          t("pdf.summary.noChartNotes"),
          PAGE_MARGIN,
          CONTENT_WIDTH,
        );
      }
      for (const note of data.chartNotes.items) {
        y = ensureSpace(doc, y, 20);
        doc.setFont(FONT, "bold");
        setColor(doc, COLOR_DARK);
        writeWrappedText(
          `${note.type} - ${note.date}`,
          PAGE_MARGIN,
          CONTENT_WIDTH,
          5,
        );
        doc.setFont(FONT, "normal");
        setColor(doc, COLOR_GRAY);
        writeWrappedText(
          t("pdf.summary.authoredBy", { name: note.authorName }),
          PAGE_MARGIN,
          CONTENT_WIDTH,
        );
        y += 2;
        setColor(doc, COLOR_DARK);
        // Chart notes are plain text: literal angle brackets are not HTML.
        writeWrappedText(note.content, PAGE_MARGIN + 4, CONTENT_WIDTH - 8);
        y += 6;
      }
    }
  }

  // Invalidated clinical content stays excluded, while its durable correction
  // evidence remains visible to a downstream clinician reviewing the summary.
  if ((data.recordCorrections?.length ?? 0) > 0) {
    sectionHeading(t("pdf.summary.recordCorrections"));
    for (const correction of data.recordCorrections ?? []) {
      y = ensureSpace(doc, y, 18);
      doc.setFont(FONT, "bold");
      doc.setFontSize(9);
      setColor(doc, COLOR_DARK);
      writeWrappedText(
        correction.recordLabel,
        PAGE_MARGIN + 4,
        CONTENT_WIDTH - 8,
      );
      doc.setFont(FONT, "normal");
      setColor(doc, COLOR_GRAY);
      writeWrappedText(
        t("pdf.summary.enteredInError", {
          name: correction.correctedByName,
          date: correction.correctedAt,
        }),
        PAGE_MARGIN + 4,
        CONTENT_WIDTH - 8,
      );
      setColor(doc, COLOR_DARK);
      writeWrappedText(
        t("pdf.summary.reason", {
          reason: soapSectionText(correction.reason),
        }),
        PAGE_MARGIN + 4,
        CONTENT_WIDTH - 8,
      );
      if (correction.replacementLabel) {
        doc.setFont(FONT, "bold");
        setColor(doc, COLOR_TEAL);
        writeWrappedText(
          t("pdf.summary.signedReplacement", {
            label: correction.replacementLabel,
          }),
          PAGE_MARGIN + 4,
          CONTENT_WIDTH - 8,
        );
      }
      y += 3;
    }
  }

  // ---- Current Prescriptions ------------------------------------------------
  if (data.prescriptions.length > 0) {
    sectionHeading(t("pdf.summary.currentPrescriptions"));

    // Table header
    const pColMed = PAGE_MARGIN;
    const pColDose = PAGE_MARGIN + CONTENT_WIDTH * 0.35;
    const pColFreq = PAGE_MARGIN + CONTENT_WIDTH * 0.6;
    const pColStat = PAGE_WIDTH - PAGE_MARGIN;

    const [lr2, lg2, lb2] = hexToRgb(COLOR_LIGHT_GRAY);
    doc.setFillColor(lr2, lg2, lb2);
    doc.rect(PAGE_MARGIN, y - 4, CONTENT_WIDTH, 8, "F");
    doc.setFont(FONT, "bold");
    doc.setFontSize(9);
    setColor(doc, COLOR_DARK);
    doc.text(t("pdf.summary.medication"), pColMed + 2, y);
    doc.text(t("pdf.summary.dosage"), pColDose, y);
    doc.text(t("pdf.summary.frequency"), pColFreq, y);
    doc.text(t("pdf.summary.status"), pColStat - 2, y, { align: "right" });
    y += 8;

    doc.setFont(FONT, "normal");
    for (const rx of data.prescriptions) {
      y = ensureSpace(doc, y, 7);
      setColor(doc, COLOR_DARK);
      doc.text(rx.medication, pColMed + 2, y);
      doc.text(rx.dosage, pColDose, y);
      doc.text(rx.frequency, pColFreq, y);
      setColor(doc, COLOR_GRAY);
      doc.text(rx.status, pColStat - 2, y, { align: "right" });
      y += 6;
    }
  }

  // ---- Footer ---------------------------------------------------------------
  const pageCount = doc.getNumberOfPages();
  const generatedDate =
    data.generatedDate ?? formatGeneratedDateUtc(data.language);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont(FONT, "italic");
    doc.setFontSize(8);
    setColor(doc, COLOR_GRAY);
    doc.text(
      t("pdf.summary.footer", { date: generatedDate }),
      PAGE_WIDTH / 2,
      pageHeight - 10,
      { align: "center" },
    );
    doc.text(
      t("pdf.common.page", { page: i, count: pageCount }),
      PAGE_WIDTH - PAGE_MARGIN,
      pageHeight - 10,
      {
        align: "right",
      },
    );
  }

  return doc;
}

// ---------------------------------------------------------------------------
// 4. Vaccination Certificate
// ---------------------------------------------------------------------------

export interface VaccinationCertificateData {
  /** Language of the printed labels; English when omitted. */
  language?: Language;
  practiceName: string;
  practiceAddress?: string;
  practicePhone?: string;
  practiceEmail?: string;
  patientName: string;
  species: string;
  breed?: string;
  sex?: string;
  dob?: string;
  color?: string;
  clientName: string;
  vaccineName: string;
  administeredAt: string;
  nextDueDate?: string;
  manufacturer?: string;
  lotNumber?: string;
  generatedDate?: string;
}

export function generateVaccinationCertificatePdf(
  data: VaccinationCertificateData,
): jsPDF {
  const t = pdfText(data.language);
  const doc = new jsPDF();
  let y = PAGE_MARGIN;

  doc.setFont(FONT, "bold");
  doc.setFontSize(20);
  setColor(doc, COLOR_TEAL);
  doc.text(data.practiceName || t("pdf.common.veterinaryPractice"), PAGE_MARGIN, y);
  y += 7;

  doc.setFont(FONT, "normal");
  doc.setFontSize(9);
  setColor(doc, COLOR_GRAY);
  if (data.practiceAddress) {
    doc.text(data.practiceAddress, PAGE_MARGIN, y);
    y += 4;
  }
  if (data.practicePhone) {
    doc.text(data.practicePhone, PAGE_MARGIN, y);
    y += 4;
  }
  if (data.practiceEmail) {
    doc.text(data.practiceEmail, PAGE_MARGIN, y);
    y += 4;
  }

  doc.setFont(FONT, "bold");
  doc.setFontSize(16);
  setColor(doc, COLOR_DARK);
  doc.text(t("pdf.certificate.title"), PAGE_WIDTH - PAGE_MARGIN, PAGE_MARGIN, {
    align: "right",
  });

  y = Math.max(y, PAGE_MARGIN + 14) + 4;
  drawLine(doc, y);
  y += 10;

  doc.setFont(FONT, "bold");
  doc.setFontSize(12);
  setColor(doc, COLOR_TEAL);
  doc.text(t("pdf.common.patient"), PAGE_MARGIN, y);
  doc.text(t("pdf.common.owner"), PAGE_MARGIN + CONTENT_WIDTH / 2, y);
  y += 6;

  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  setColor(doc, COLOR_DARK);
  const patientLines = [
    data.patientName,
    [data.breed, data.species].filter(Boolean).join(" / "),
    data.sex,
    data.dob ? t("pdf.common.dobValue", { value: data.dob }) : undefined,
    data.color ? t("pdf.certificate.colorValue", { value: data.color }) : undefined,
  ].filter(Boolean) as string[];
  doc.text(patientLines, PAGE_MARGIN, y);
  doc.text(data.clientName, PAGE_MARGIN + CONTENT_WIDTH / 2, y);
  y += Math.max(patientLines.length, 1) * 5 + 10;

  doc.setFont(FONT, "bold");
  doc.setFontSize(12);
  setColor(doc, COLOR_TEAL);
  doc.text(t("pdf.certificate.vaccinationRecord"), PAGE_MARGIN, y);
  y += 6;

  const rows: [string, string | undefined][] = [
    [t("pdf.common.vaccine"), data.vaccineName],
    [t("pdf.certificate.administered"), data.administeredAt],
    [t("pdf.common.nextDueLower"), data.nextDueDate],
    [t("pdf.common.manufacturer"), data.manufacturer],
    [t("pdf.common.lotNumber"), data.lotNumber],
  ];

  doc.setFontSize(10);
  for (const [label, value] of rows) {
    if (!value) continue;
    y = ensureSpace(doc, y, 8);
    doc.setFont(FONT, "bold");
    setColor(doc, COLOR_DARK);
    doc.text(`${label}:`, PAGE_MARGIN, y);
    doc.setFont(FONT, "normal");
    doc.text(value, PAGE_MARGIN + 36, y);
    y += 7;
  }

  y += 8;
  drawLine(doc, y);
  y += 8;

  doc.setFont(FONT, "normal");
  doc.setFontSize(9);
  setColor(doc, COLOR_GRAY);
  const note =
    t("pdf.certificate.portalNote");
  doc.text(doc.splitTextToSize(note, CONTENT_WIDTH), PAGE_MARGIN, y);

  const generatedDate =
    data.generatedDate ?? formatGeneratedDateUtc(data.language);
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont(FONT, "italic");
  doc.setFontSize(8);
  setColor(doc, COLOR_GRAY);
  doc.text(t("pdf.common.generatedOn", { date: generatedDate }), PAGE_WIDTH / 2, pageHeight - 10, {
    align: "center",
  });

  return doc;
}

export interface StaffVaccinationCertificateData {
  /** Language of the printed labels; English when omitted. */
  language?: Language;
  certificateId: string;
  generatedDate: string;
  practice: {
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  owner: {
    name: string;
    address?: string | null;
    phone?: string | null;
  };
  patient: {
    name: string;
    species: string;
    breed?: string | null;
    sex?: string | null;
    dob?: string | null;
    color?: string | null;
    microchipNumber?: string | null;
    weightKg?: string | null;
  };
  vaccinations: Array<{
    vaccineName: string;
    productName?: string | null;
    administeredAt: string;
    nextDueDate?: string | null;
    manufacturer?: string | null;
    lotNumber?: string | null;
    administeredByName?: string | null;
  }>;
}

export interface RabiesVaccinationCertificateData extends Omit<
  StaffVaccinationCertificateData,
  "vaccinations"
> {
  vaccination: {
    vaccineName: string;
    productName: string;
    manufacturer: string;
    lotNumber: string;
    productExpirationDate: string;
    doseType: "initial" | "booster";
    licensedDurationMonths: number;
    rabiesTagNumber?: string | null;
    administeredAt: string;
    nextDueDate: string;
    administeredByName?: string | null;
    veterinarianName: string;
    veterinarianLicenseNumber: string;
  };
}

function drawCertificateHeader(
  doc: jsPDF,
  data: Pick<StaffVaccinationCertificateData, "practice" | "certificateId">,
  title: string,
  t: PdfText = pdfText(),
): number {
  let y = PAGE_MARGIN;
  drawPawMark(doc, PAGE_MARGIN, y - 5, 13);
  doc.setFont(FONT, "bold");
  doc.setFontSize(18);
  setColor(doc, COLOR_TEAL);
  const practiceNameLines = doc.splitTextToSize(
    data.practice.name || t("pdf.common.veterinaryPractice"),
    CONTENT_WIDTH - 18,
  );
  doc.text(practiceNameLines, PAGE_MARGIN + 18, y);
  y += Math.max(practiceNameLines.length, 1) * 6;
  doc.setFont(FONT, "normal");
  doc.setFontSize(8);
  setColor(doc, COLOR_GRAY);
  const practiceLines = [
    data.practice.address,
    [data.practice.phone, data.practice.email].filter(Boolean).join(" • "),
  ].filter(Boolean) as string[];
  if (practiceLines.length > 0) {
    doc.text(practiceLines, PAGE_MARGIN + 18, y);
  }
  y += Math.max(practiceLines.length, 1) * 4 + 5;

  doc.setFont(FONT, "bold");
  doc.setFontSize(15);
  setColor(doc, COLOR_DARK);
  doc.text(title, PAGE_MARGIN, y);
  doc.setFont(FONT, "normal");
  doc.setFontSize(8);
  setColor(doc, COLOR_GRAY);
  doc.text(
    t("pdf.common.certificateId", { id: data.certificateId }),
    PAGE_WIDTH - PAGE_MARGIN,
    y,
    { align: "right" },
  );
  y += 6;
  drawLine(doc, y);
  return y + 8;
}

function drawCertificateIdentity(
  doc: jsPDF,
  data: Pick<StaffVaccinationCertificateData, "owner" | "patient">,
  y: number,
  t: PdfText = pdfText(),
): number {
  const rightX = PAGE_MARGIN + CONTENT_WIDTH / 2 + 4;
  doc.setFont(FONT, "bold");
  doc.setFontSize(11);
  setColor(doc, COLOR_TEAL);
  doc.text(t("pdf.common.patient"), PAGE_MARGIN, y);
  doc.text(t("pdf.common.owner"), rightX, y);
  y += 5;

  const patientLines = [
    data.patient.name,
    [data.patient.species, data.patient.breed].filter(Boolean).join(" / "),
    data.patient.sex ? t("pdf.certificate.sexValue", { value: data.patient.sex }) : undefined,
    data.patient.dob ? t("pdf.common.dobValue", { value: data.patient.dob }) : undefined,
    data.patient.color ? t("pdf.certificate.colorMarkings", { value: data.patient.color }) : undefined,
    data.patient.microchipNumber
      ? t("pdf.certificate.microchipValue", {
          value: data.patient.microchipNumber,
        })
      : undefined,
    data.patient.weightKg ? t("pdf.certificate.weightValue", { value: data.patient.weightKg }) : undefined,
  ].filter(Boolean) as string[];
  const ownerLines = [
    data.owner.name,
    ...(data.owner.address?.split("\n") ?? []),
    data.owner.phone ? t("pdf.certificate.phoneValue", { value: data.owner.phone }) : undefined,
  ].filter(Boolean) as string[];
  doc.setFont(FONT, "normal");
  doc.setFontSize(9);
  setColor(doc, COLOR_DARK);
  doc.text(patientLines, PAGE_MARGIN, y);
  doc.text(ownerLines, rightX, y);
  return y + Math.max(patientLines.length, ownerLines.length, 1) * 4.5 + 8;
}

function drawCertificateFooter(
  doc: jsPDF,
  certificateId: string,
  generatedDate: string,
  t: PdfText = pdfText(),
): void {
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont(FONT, "italic");
    doc.setFontSize(7.5);
    setColor(doc, COLOR_GRAY);
    doc.text(
      t("pdf.certificate.footer", { date: generatedDate, id: certificateId }),
      PAGE_MARGIN,
      pageHeight - 9,
    );
    doc.text(
      t("pdf.common.page", { page, count: pageCount }),
      PAGE_WIDTH - PAGE_MARGIN,
      pageHeight - 9,
      {
        align: "right",
      },
    );
  }
}

export function generateVaccinationHistoryCertificatePdf(
  data: StaffVaccinationCertificateData,
): jsPDF {
  const t = pdfText(data.language);
  const doc = new jsPDF();
  let y = drawCertificateHeader(
    doc,
    data,
    t("pdf.certificate.title"),
    t,
  );
  y = drawCertificateIdentity(doc, data, y, t);

  doc.setFont(FONT, "bold");
  doc.setFontSize(11);
  setColor(doc, COLOR_TEAL);
  doc.text(t("pdf.history.section"), PAGE_MARGIN, y);
  y += 6;

  const columns = [PAGE_MARGIN, 64, 94, 121, 148];
  const widths = [42, 28, 25, 25, 42];
  const drawTableHeader = (headerY: number) => {
    const headings = [
      t("pdf.history.vaccineProduct"),
      t("pdf.history.given"),
      t("pdf.common.nextDueLower"),
      t("pdf.history.lot"),
      t("pdf.common.administeredBy"),
    ];
    doc.setFillColor(...hexToRgb(COLOR_LIGHT_GRAY));
    doc.rect(PAGE_MARGIN, headerY - 4, CONTENT_WIDTH, 7, "F");
    doc.setFont(FONT, "bold");
    doc.setFontSize(7.5);
    setColor(doc, COLOR_DARK);
    headings.forEach((heading, index) =>
      doc.text(heading, columns[index]!, headerY),
    );
    return headerY + 6;
  };
  y = drawTableHeader(y);

  doc.setFontSize(8);
  for (const vaccination of data.vaccinations) {
    const rowCells = [
      [vaccination.vaccineName, vaccination.productName]
        .filter(Boolean)
        .join(" / "),
      vaccination.administeredAt,
      vaccination.nextDueDate || "—",
      vaccination.lotNumber || "—",
      vaccination.administeredByName || "—",
    ];
    const wrapped = rowCells.map((value, index) =>
      doc.splitTextToSize(value, widths[index]!),
    );
    const rowHeight =
      Math.max(...wrapped.map((lines) => lines.length), 1) * 3.8 + 3;
    if (y + rowHeight + 3 > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = PAGE_MARGIN;
      doc.setFont(FONT, "bold");
      doc.setFontSize(11);
      setColor(doc, COLOR_TEAL);
      doc.text(t("pdf.history.sectionContinued"), PAGE_MARGIN, y);
      doc.setFont(FONT, "normal");
      doc.setFontSize(8);
      setColor(doc, COLOR_GRAY);
      doc.text(
        t("pdf.common.certificateId", { id: data.certificateId }),
        PAGE_WIDTH - PAGE_MARGIN,
        y,
        { align: "right" },
      );
      y += 6;
      drawLine(doc, y);
      y = drawTableHeader(y + 8);
    }
    doc.setFont(FONT, "normal");
    setColor(doc, COLOR_DARK);
    wrapped.forEach((lines, index) => doc.text(lines, columns[index]!, y));
    y += rowHeight;
    drawLine(doc, y - 2);
  }

  y = ensureSpace(doc, y + 5, 14);
  doc.setFont(FONT, "normal");
  doc.setFontSize(8);
  setColor(doc, COLOR_GRAY);
  doc.text(
    doc.splitTextToSize(
      t("pdf.history.note"),
      CONTENT_WIDTH,
    ),
    PAGE_MARGIN,
    y,
  );
  drawCertificateFooter(doc, data.certificateId, data.generatedDate, t);
  return doc;
}

export function generateRabiesVaccinationCertificatePdf(
  data: RabiesVaccinationCertificateData,
): jsPDF {
  const t = pdfText(data.language);
  const doc = new jsPDF();
  let y = drawCertificateHeader(
    doc,
    data,
    "RABIES VACCINATION CERTIFICATE",
    t,
  );
  y = drawCertificateIdentity(doc, data, y, t);

  doc.setFont(FONT, "bold");
  doc.setFontSize(11);
  setColor(doc, COLOR_TEAL);
  doc.text(t("pdf.rabies.section"), PAGE_MARGIN, y);
  y += 6;

  const durationLabel =
    data.vaccination.licensedDurationMonths % 12 === 0
      ? t("pdf.rabies.years", {
          count: data.vaccination.licensedDurationMonths / 12,
        })
      : t("pdf.rabies.months", {
          count: data.vaccination.licensedDurationMonths,
        });
  const details: Array<[string, string]> = [
    [t("pdf.common.vaccine"), data.vaccination.vaccineName],
    [t("pdf.rabies.product"), data.vaccination.productName],
    [t("pdf.common.manufacturer"), data.vaccination.manufacturer],
    [t("pdf.common.lotNumber"), data.vaccination.lotNumber],
    [t("pdf.rabies.productExpiration"), data.vaccination.productExpirationDate],
    [
      t("pdf.rabies.dose"),
      data.vaccination.doseType === "initial"
        ? t("pdf.rabies.initial")
        : t("pdf.rabies.booster"),
    ],
    [t("pdf.rabies.licensedDuration"), durationLabel],
    [t("pdf.rabies.dateAdministered"), data.vaccination.administeredAt],
    [t("pdf.common.nextDueLower"), data.vaccination.nextDueDate],
    [
      t("pdf.rabies.tag"),
      data.vaccination.rabiesTagNumber || t("pdf.rabies.tagNotAssigned"),
    ],
    [
      t("pdf.common.administeredBy"),
      data.vaccination.administeredByName || t("pdf.rabies.notRecorded"),
    ],
  ];
  const half = Math.ceil(details.length / 2);
  const rightX = PAGE_MARGIN + CONTENT_WIDTH / 2 + 4;
  const drawDetailsColumn = (
    rows: Array<[string, string]>,
    x: number,
    startY: number,
  ) => {
    let columnY = startY;
    rows.forEach(([label, value]) => {
      doc.setFont(FONT, "bold");
      doc.setFontSize(7.5);
      setColor(doc, COLOR_GRAY);
      doc.text(label.toUpperCase(), x, columnY);
      columnY += 3.8;
      doc.setFont(FONT, "normal");
      doc.setFontSize(9);
      setColor(doc, COLOR_DARK);
      const lines = doc.splitTextToSize(value, CONTENT_WIDTH / 2 - 8);
      doc.text(lines, x, columnY);
      columnY += Math.max(lines.length, 1) * 4 + 3;
    });
    return columnY;
  };
  y = Math.max(
    drawDetailsColumn(details.slice(0, half), PAGE_MARGIN, y),
    drawDetailsColumn(details.slice(half), rightX, y),
  );

  y = ensureSpace(doc, y + 6, 40);
  drawLine(doc, y);
  y += 8;
  doc.setFont(FONT, "bold");
  doc.setFontSize(10);
  setColor(doc, COLOR_DARK);
  doc.text(data.vaccination.veterinarianName, PAGE_MARGIN, y);
  doc.setFont(FONT, "normal");
  doc.setFontSize(8.5);
  doc.text(
    `Veterinarian • License ${data.vaccination.veterinarianLicenseNumber}`,
    PAGE_MARGIN,
    y + 5,
  );
  doc.line(PAGE_MARGIN + 94, y + 4, PAGE_WIDTH - PAGE_MARGIN, y + 4);
  doc.setFontSize(7.5);
  setColor(doc, COLOR_GRAY);
  doc.text("Veterinarian signature", PAGE_MARGIN + 94, y + 8);

  y += 18;
  doc.setFont(FONT, "bold");
  doc.setFontSize(8);
  setColor(doc, COLOR_DARK);
  doc.text(
    "Routine vaccination record — not a travel health certificate",
    PAGE_MARGIN,
    y,
  );
  doc.setFont(FONT, "normal");
  doc.setFontSize(7.5);
  setColor(doc, COLOR_GRAY);
  doc.text(
    doc.splitTextToSize(
      "A handwritten veterinarian signature may be required by the receiving authority. Travel and import documents can require separate accreditation, endorsement, and submission workflows.",
      CONTENT_WIDTH,
    ),
    PAGE_MARGIN,
    y + 4,
  );
  drawCertificateFooter(doc, data.certificateId, data.generatedDate, t);
  return doc;
}

// ---------------------------------------------------------------------------
// 5. Generic Report PDF
// ---------------------------------------------------------------------------

export type ReportPdfCell = string | number | null | undefined;

export interface ReportPdfData {
  /** Language of the printed labels; English when omitted. */
  language?: Language;
  title: string;
  subtitle?: string;
  columns: string[];
  rows: ReportPdfCell[][];
  emptyMessage?: string;
  generatedDate?: string;
}

export function generateReportPdf(data: ReportPdfData): jsPDF {
  const t = pdfText(data.language);
  const doc = new jsPDF({
    orientation: data.columns.length > 4 ? "landscape" : "portrait",
  });
  const margin = 16;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  const colWidth = contentWidth / Math.max(data.columns.length, 1);
  let y = margin;

  function addPageIfNeeded(needed: number) {
    if (y + needed <= pageHeight - 18) return;
    doc.addPage();
    y = margin;
    drawTableHeader();
  }

  function drawTableHeader() {
    const [r, g, b] = hexToRgb(COLOR_LIGHT_GRAY);
    doc.setFillColor(r, g, b);
    doc.rect(margin, y - 4, contentWidth, 8, "F");
    doc.setFont(FONT, "bold");
    doc.setFontSize(8);
    setColor(doc, COLOR_DARK);
    data.columns.forEach((column, index) => {
      doc.text(column, margin + index * colWidth + 2, y);
    });
    y += 8;
  }

  doc.setFont(FONT, "bold");
  doc.setFontSize(18);
  setColor(doc, COLOR_TEAL);
  doc.text(data.title, margin, y);
  y += 7;

  if (data.subtitle) {
    doc.setFont(FONT, "normal");
    doc.setFontSize(9);
    setColor(doc, COLOR_GRAY);
    doc.text(data.subtitle, margin, y);
    y += 5;
  }

  const [reportLineR, reportLineG, reportLineB] = hexToRgb(COLOR_LIGHT_GRAY);
  doc.setDrawColor(reportLineR, reportLineG, reportLineB);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  if (data.rows.length === 0) {
    doc.setFont(FONT, "italic");
    doc.setFontSize(10);
    setColor(doc, COLOR_GRAY);
    doc.text(data.emptyMessage ?? t("pdf.report.noData"), margin, y);
  } else {
    drawTableHeader();
    doc.setFont(FONT, "normal");
    doc.setFontSize(8);

    for (const row of data.rows) {
      const cellLines = data.columns.map((_, index) =>
        doc.splitTextToSize(String(row[index] ?? ""), colWidth - 4),
      );
      const rowHeight =
        Math.max(...cellLines.map((lines) => lines.length), 1) * 4 + 4;
      addPageIfNeeded(rowHeight);
      setColor(doc, COLOR_DARK);
      cellLines.forEach((lines, index) => {
        doc.text(lines, margin + index * colWidth + 2, y);
      });
      y += rowHeight;
    }
  }

  const generatedDate =
    data.generatedDate ?? formatGeneratedDateUtc(data.language);
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont(FONT, "italic");
    doc.setFontSize(8);
    setColor(doc, COLOR_GRAY);
    doc.text(t("pdf.common.generatedOn", { date: generatedDate }), pageWidth / 2, pageHeight - 8, {
      align: "center",
    });
    doc.text(t("pdf.common.page", { page: i, count: pageCount }), pageWidth - margin, pageHeight - 8, {
      align: "right",
    });
  }

  return doc;
}

// ---------------------------------------------------------------------------
// 6. Discharge Instructions
// ---------------------------------------------------------------------------

export interface DischargeInstructionsData {
  /** Language of the printed labels; English when omitted. */
  language?: Language;
  practiceName: string;
  practicePhone?: string;
  patientName: string;
  species: string;
  clientName: string;
  visitDate: string;
  doctorName?: string;
  diagnosis?: string;
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    instructions?: string;
  }>;
  instructions: string[];
  followUpDate?: string;
  followUpNotes?: string;
  restrictions?: string[];
  emergencyNotes?: string;
}

export function generateDischargeInstructions(
  data: DischargeInstructionsData,
): jsPDF {
  const t = pdfText(data.language);
  const doc = new jsPDF();
  let y = PAGE_MARGIN;

  // Header
  doc.setFont(FONT, "bold");
  doc.setFontSize(16);
  setColor(doc, COLOR_TEAL);
  doc.text(data.practiceName || t("pdf.common.veterinaryPractice"), PAGE_MARGIN, y);
  y += 6;

  if (data.practicePhone) {
    doc.setFont(FONT, "normal");
    doc.setFontSize(9);
    setColor(doc, COLOR_GRAY);
    doc.text(data.practicePhone, PAGE_MARGIN, y);
    y += 4;
  }
  y += 4;

  // Title
  doc.setFont(FONT, "bold");
  doc.setFontSize(18);
  setColor(doc, COLOR_DARK);
  doc.text(t("pdf.discharge.title"), PAGE_MARGIN, y);
  y += 10;
  drawLine(doc, y);
  y += 8;

  // Patient & Visit Info
  doc.setFontSize(10);
  doc.setFont(FONT, "bold");
  setColor(doc, COLOR_DARK);
  doc.text(t("pdf.discharge.patient"), PAGE_MARGIN, y);
  const patientGap = labelGap(doc, t("pdf.discharge.patient"), 22);
  doc.setFont(FONT, "normal");
  doc.text(`${data.patientName} (${data.species})`, PAGE_MARGIN + patientGap, y);

  doc.setFont(FONT, "bold");
  doc.text(t("pdf.discharge.owner"), PAGE_WIDTH / 2, y);
  const ownerGap = labelGap(doc, t("pdf.discharge.owner"), 20);
  doc.setFont(FONT, "normal");
  doc.text(data.clientName, PAGE_WIDTH / 2 + ownerGap, y);
  y += 6;

  doc.setFont(FONT, "bold");
  doc.text(t("pdf.discharge.visitDate"), PAGE_MARGIN, y);
  const visitGap = labelGap(doc, t("pdf.discharge.visitDate"), 28);
  doc.setFont(FONT, "normal");
  doc.text(data.visitDate, PAGE_MARGIN + visitGap, y);

  if (data.doctorName) {
    doc.setFont(FONT, "bold");
    doc.text(t("pdf.discharge.doctor"), PAGE_WIDTH / 2, y);
    const doctorGap = labelGap(doc, t("pdf.discharge.doctor"), 20);
    doc.setFont(FONT, "normal");
    doc.text(data.doctorName, PAGE_WIDTH / 2 + doctorGap, y);
  }
  y += 10;

  // Diagnosis
  if (data.diagnosis) {
    drawLine(doc, y);
    y += 6;
    doc.setFont(FONT, "bold");
    doc.setFontSize(12);
    setColor(doc, COLOR_DARK);
    doc.text(t("pdf.discharge.diagnosis"), PAGE_MARGIN, y);
    y += 6;
    doc.setFont(FONT, "normal");
    doc.setFontSize(10);
    const diagLines = doc.splitTextToSize(data.diagnosis, CONTENT_WIDTH);
    doc.text(diagLines, PAGE_MARGIN, y);
    y += diagLines.length * 5 + 6;
  }

  // Medications
  if (data.medications.length > 0) {
    y = ensureSpace(doc, y, 30);
    drawLine(doc, y);
    y += 6;
    doc.setFont(FONT, "bold");
    doc.setFontSize(12);
    setColor(doc, COLOR_DARK);
    doc.text(t("pdf.discharge.medications"), PAGE_MARGIN, y);
    y += 8;

    for (const med of data.medications) {
      y = ensureSpace(doc, y, 20);
      doc.setFont(FONT, "bold");
      doc.setFontSize(10);
      doc.text(`${med.name} — ${med.dosage}`, PAGE_MARGIN + 4, y);
      y += 5;
      doc.setFont(FONT, "normal");
      setColor(doc, COLOR_GRAY);
      doc.text(t("pdf.discharge.frequency", { value: med.frequency }), PAGE_MARGIN + 4, y);
      y += 5;
      if (med.instructions) {
        const instrLines = doc.splitTextToSize(
          med.instructions,
          CONTENT_WIDTH - 8,
        );
        setColor(doc, COLOR_DARK);
        doc.text(instrLines, PAGE_MARGIN + 4, y);
        y += instrLines.length * 5;
      }
      y += 4;
    }
  }

  // Care Instructions
  if (data.instructions.length > 0) {
    y = ensureSpace(doc, y, 20);
    drawLine(doc, y);
    y += 6;
    doc.setFont(FONT, "bold");
    doc.setFontSize(12);
    setColor(doc, COLOR_DARK);
    doc.text(t("pdf.discharge.careInstructions"), PAGE_MARGIN, y);
    y += 8;

    doc.setFont(FONT, "normal");
    doc.setFontSize(10);
    for (const instruction of data.instructions) {
      y = ensureSpace(doc, y, 10);
      const lines = doc.splitTextToSize(`• ${instruction}`, CONTENT_WIDTH - 4);
      doc.text(lines, PAGE_MARGIN + 4, y);
      y += lines.length * 5 + 2;
    }
    y += 4;
  }

  // Restrictions
  if (data.restrictions && data.restrictions.length > 0) {
    y = ensureSpace(doc, y, 20);
    drawLine(doc, y);
    y += 6;
    doc.setFont(FONT, "bold");
    doc.setFontSize(12);
    setColor(doc, COLOR_DARK);
    doc.text(t("pdf.discharge.restrictions"), PAGE_MARGIN, y);
    y += 8;

    doc.setFont(FONT, "normal");
    doc.setFontSize(10);
    for (const restriction of data.restrictions) {
      y = ensureSpace(doc, y, 10);
      const lines = doc.splitTextToSize(`• ${restriction}`, CONTENT_WIDTH - 4);
      doc.text(lines, PAGE_MARGIN + 4, y);
      y += lines.length * 5 + 2;
    }
    y += 4;
  }

  // Follow-up
  if (data.followUpDate || data.followUpNotes) {
    y = ensureSpace(doc, y, 20);
    drawLine(doc, y);
    y += 6;
    doc.setFont(FONT, "bold");
    doc.setFontSize(12);
    setColor(doc, COLOR_DARK);
    doc.text(t("pdf.discharge.followUp"), PAGE_MARGIN, y);
    y += 7;

    doc.setFontSize(10);
    if (data.followUpDate) {
      doc.setFont(FONT, "bold");
      doc.text(t("pdf.discharge.scheduled"), PAGE_MARGIN + 4, y);
      const scheduledGap = labelGap(doc, t("pdf.discharge.scheduled"), 26);
      doc.setFont(FONT, "normal");
      doc.text(data.followUpDate, PAGE_MARGIN + 4 + scheduledGap, y);
      y += 6;
    }
    if (data.followUpNotes) {
      doc.setFont(FONT, "normal");
      const lines = doc.splitTextToSize(data.followUpNotes, CONTENT_WIDTH - 8);
      doc.text(lines, PAGE_MARGIN + 4, y);
      y += lines.length * 5;
    }
    y += 6;
  }

  // Emergency notes
  if (data.emergencyNotes) {
    y = ensureSpace(doc, y, 25);
    drawLine(doc, y);
    y += 6;
    const [r, g, b] = hexToRgb("#dc2626");
    doc.setTextColor(r, g, b);
    doc.setFont(FONT, "bold");
    doc.setFontSize(11);
    doc.text(t("pdf.discharge.emergency"), PAGE_MARGIN, y);
    y += 7;
    doc.setFont(FONT, "normal");
    doc.setFontSize(10);
    setColor(doc, COLOR_DARK);
    const emergLines = doc.splitTextToSize(data.emergencyNotes, CONTENT_WIDTH);
    doc.text(emergLines, PAGE_MARGIN, y);
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont(FONT, "italic");
  doc.setFontSize(8);
  setColor(doc, COLOR_GRAY);
  doc.text(
    t("pdf.discharge.questions"),
    PAGE_WIDTH / 2,
    pageHeight - 15,
    { align: "center" },
  );
  if (data.practicePhone) {
    doc.text(data.practicePhone, PAGE_WIDTH / 2, pageHeight - 10, {
      align: "center",
    });
  }

  return doc;
}
