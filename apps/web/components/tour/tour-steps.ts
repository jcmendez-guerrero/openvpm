/**
 * Ordered steps for the value walk. Each step optionally navigates to a route
 * and anchors a coachmark to an element marked `data-tour="<anchor>"`. Anchoring
 * the sidebar nav links keeps anchors stable across route changes; steps without
 * an anchor render as a centered card.
 *
 * The tour is context-aware: when the workspace has sample data we walk into a
 * real chart and a real bill instead of pointing at empty tabs, and the finale
 * is the AI helper answering a real question. Voice: simple, fourth-grade,
 * warm, no em dashes. Lead with the value: you own your data and real AI tools
 * are built in.
 */
import { createTranslator } from "use-intl/core";
import en from "@/messages/en.json";
import { GUIDE_SIGNALS } from "./guide-signals";

/** Translator for the `tour` namespace; callers pass the active-language one. */
export type TourTranslator = (key: string, values?: Record<string, string>) => string;

const englishTour = createTranslator({
  locale: "en",
  messages: en,
  namespace: "tour",
}) as unknown as TourTranslator;
export { englishTour };

export interface TourStep {
  id: string;
  /** Route to navigate to before showing this step. */
  route?: string;
  /** `data-tour` value of the element to spotlight. Absent = centered card. */
  anchor?: string;
  /**
   * Only visit this step while its anchor is in the DOM; Next and Back pass
   * over it otherwise (e.g. the AI reply beat when nothing was ever sent).
   */
  requiresAnchor?: boolean;
  title: string;
  body: string;
  /** Guide signal that auto-advances past this step (never blocks Next). */
  advanceOn?: string;
}

export interface TourContext {
  /** First demo patient's name, e.g. "Biscuit", when demo data is present. */
  demoPatientName?: string | null;
  /** First demo patient's id, for walking into a real chart. */
  demoPatientId?: string | null;
  /** A live sample invoice id, for walking into a real bill. */
  demoInvoiceId?: string | null;
  /** False when the AI agent has no platform key; the tour never blocks. */
  agentConfigured?: boolean;
}

export function buildTourSteps(
  ctx: TourContext = {},
  t: TourTranslator = englishTour,
): TourStep[] {
  const patientName = ctx.demoPatientName ?? null;
  const agentReady = ctx.agentConfigured ?? false;

  const steps: TourStep[] = [
    {
      id: "welcome",
      route: "/",
      title: t("steps.welcome.title"),
      body: t("steps.welcome.body"),
    },
    {
      id: "schedule",
      route: "/schedule",
      anchor: "schedule-calendar",
      title: t("steps.schedule.title"),
      body: patientName
        ? t("steps.schedule.bodyWithPatient", { patientName })
        : t("steps.schedule.body"),
    },
  ];

  if (ctx.demoPatientId) {
    steps.push({
      id: "patient-chart",
      route: `/patients/${ctx.demoPatientId}`,
      title: t("steps.chart.title"),
      body: t("steps.chart.body", { patientName: patientName ?? t("steps.chart.samplePet") }),
    });
  } else {
    steps.push({
      id: "records",
      route: "/records",
      anchor: "nav-/records",
      title: t("steps.chart.title"),
      body: t("steps.records.body"),
    });
  }

  if (ctx.demoInvoiceId) {
    steps.push({
      id: "invoice",
      route: `/billing?expand=${ctx.demoInvoiceId}`,
      anchor: "invoice-detail",
      title: t("steps.invoice.title"),
      body: t("steps.invoice.body"),
    });
  } else {
    steps.push({
      id: "billing",
      route: "/billing",
      anchor: "nav-/billing",
      title: t("steps.invoice.title"),
      body: t("steps.billing.body"),
    });
  }

  steps.push({
    id: "inbox",
    route: "/inbox",
    anchor: "inbox-list",
    title: t("steps.inbox.title"),
    body: t("steps.inbox.body"),
  });

  steps.push({
    id: "agent",
    route: `/agent?ask=${encodeURIComponent(t("agentQuestion"))}`,
    anchor: "agent-input",
    title: t("steps.agent.title"),
    body: agentReady
      ? t("steps.agent.bodyReady")
      : t("steps.agent.body"),
    advanceOn: agentReady ? GUIDE_SIGNALS.agentRunSucceeded : undefined,
  });

  // The payoff beat: stay on the answer and spotlight it. Without this the
  // finish step navigated home the moment the reply landed, so nobody ever
  // read what the AI wrote.
  if (agentReady) {
    steps.push({
      id: "agent-reply",
      anchor: "agent-reply",
      requiresAnchor: true,
      title: t("steps.agentReply.title"),
      body: t("steps.agentReply.body"),
    });
  }

  steps.push({
    id: "finish",
    route: "/",
    title: t("steps.finish.title"),
    body: t("steps.finish.body"),
  });

  return steps;
}

/** Context-free steps, used for prefetch fallbacks and tests. */
export const TOUR_STEPS: TourStep[] = buildTourSteps();
