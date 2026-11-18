/**
 * Named guide recipes: short walkthroughs the welcome surface (and the
 * sidebar Guides entry) can launch through the shared coachmark engine in
 * tour-provider. The classic value tour is the "tour" recipe; the others are
 * the "first win" guides, built at start time from a small context object so
 * routes and copy can use live data (the demo client, the demo patient) and
 * degrade gracefully once demo data is cleared.
 *
 * Voice: simple, fourth-grade, warm, no em dashes. Benefits first.
 */

import type { GuideId } from "@/lib/welcome/cards";
import { GUIDE_SIGNALS } from "./guide-signals";
import {
  buildTourSteps,
  englishTour,
  type TourStep,
  type TourTranslator,
} from "./tour-steps";

export interface GuideStep extends TourStep {
  /**
   * Guide signal that auto-advances past this step (see guide-signals.ts).
   * The Next button still works, so a step never blocks on the signal.
   */
  advanceOn?: string;
}

export interface GuideContext {
  /** Target client for the portal guide (demo client, else first real one). */
  portalClient?: { id: string; firstName: string } | null;
  /** First demo patient's name, e.g. "Biscuit", when demo data is present. */
  demoPatientName?: string | null;
  /** False when the AI agent has no platform key; the guide never blocks. */
  agentConfigured?: boolean;
}

export const AGENT_GUIDE_QUESTION = "Which pets are overdue for vaccines?";

export function buildGuideSteps(
  recipe: GuideId,
  ctx: GuideContext = {},
  t: TourTranslator = englishTour,
): GuideStep[] {
  switch (recipe) {
    case "tour":
      return buildTourSteps({}, t);

    case "ask-ai": {
      const ready = ctx.agentConfigured !== false;
      return [
        {
          id: "ask",
          route: `/agent?ask=${encodeURIComponent(t("agentQuestion"))}`,
          anchor: "agent-input",
          title: t("guides.askAi.title"),
          body: ready
            ? t("guides.askAi.bodyReady")
            : t("guides.askAi.body"),
          advanceOn: ready ? GUIDE_SIGNALS.agentRunSucceeded : undefined,
        },
        {
          id: "done",
          // Spotlight the real answer so the win lands. requiresAnchor lets
          // the guide end quietly if the user never pressed send.
          ...(ready ? { anchor: "agent-reply", requiresAnchor: true } : {}),
          title: t("guides.askAi.doneTitle"),
          body: t("guides.askAi.doneBody"),
        },
      ];
    }

    case "your-day": {
      const patient = ctx.demoPatientName;
      return [
        {
          id: "schedule",
          route: "/schedule",
          anchor: "schedule-calendar",
          title: t("guides.yourDay.title"),
          body: patient
            ? t("guides.yourDay.bodyWithPatient", { patient })
            : t("guides.yourDay.body"),
        },
        {
          id: "whiteboard",
          route: "/whiteboard",
          anchor: "whiteboard-board",
          title: t("guides.yourDay.whiteboardTitle"),
          body: t("guides.yourDay.whiteboardBody"),
        },
        {
          id: "done",
          title: t("guides.yourDay.doneTitle"),
          body: t("guides.yourDay.doneBody"),
        },
      ];
    }

    case "client-portal": {
      if (!ctx.portalClient) {
        return [
          {
            id: "empty",
            route: "/clients",
            title: t("guides.portal.emptyTitle"),
            body: t("guides.portal.emptyBody"),
          },
        ];
      }
      const first = ctx.portalClient.firstName;
      return [
        {
          id: "copy",
          route: `/clients/${ctx.portalClient.id}`,
          anchor: "client-portal-link",
          title: t("guides.portal.copyTitle"),
          body: t("guides.portal.copyBody", { first }),
          advanceOn: GUIDE_SIGNALS.portalLinkCopied,
        },
        {
          id: "done",
          title: t("guides.portal.doneTitle"),
          body: t("guides.portal.doneBody", { first }),
        },
      ];
    }

    case "calendar-feed":
      return [
        {
          id: "subscribe",
          route: "/schedule",
          anchor: "calendar-subscribe",
          title: t("guides.calendar.title"),
          body: t("guides.calendar.body"),
          advanceOn: GUIDE_SIGNALS.calendarUrlCopied,
        },
        {
          id: "done",
          title: t("guides.calendar.doneTitle"),
          body: t("guides.calendar.doneBody"),
        },
      ];
  }
}
