"use client";

import { useTranslations } from "use-intl";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, FileText, FlaskConical, Receipt } from "lucide-react";
import { PawMark } from "@/components/brand/paw-mark";
import { FUNNEL_EVENTS } from "@/lib/funnel-analytics";
import { trackFunnelEvent } from "@/lib/track-funnel-event";

// Built with the translator so titles and steps follow the active language.
function demoWorkflows(t: (key: string) => string) {
  return [
  {
    id: "patients",
    icon: FileText,
    title: t("getToKnowAPatient"),
    description: t("seeTheChartVisitNotes"),
    href: "/patients",
    action: t("openPatientCharts"),
    steps: [
      t("chooseASamplePatientFrom"),
      t("openTheirChartAndExplore"),
      t("seeHowThePatientS"),
    ],
    note: t("thisIsASharedDemo"),
  },
  {
    id: "lab_results",
    icon: FlaskConical,
    title: t("followALabResult"),
    description: t("goFromResultsToReview"),
    href: "/lab-results",
    action: t("openTheLabInbox"),
    steps: [
      t("chooseAllToSeeThe"),
      t("openAResultSEvidence"),
      t("exploreTheFollowUpQueue"),
    ],
    note: t("theseAreManuallyRecordedResults"),
  },
  {
    id: "billing",
    icon: Receipt,
    title: t("exploreAClinicSBilling"),
    description: t("followChargesInvoicesAndRecorded"),
    href: "/billing",
    action: t("openBilling"),
    steps: [
      t("chooseASampleInvoiceFrom"),
      t("lookThroughItsLineItems"),
      t("seeHowTheInvoiceConnects"),
    ],
    note: t("useSampleInformationOnlyDo"),
  },
  ] as const;
}

type DemoWorkflow = ReturnType<typeof demoWorkflows>[number];

export function DemoWelcome() {
  const t = useTranslations("demo.welcome");
  const [selected, setSelected] = useState<DemoWorkflow | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const viewed = useRef(false);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    trackFunnelEvent(FUNNEL_EVENTS.demoWelcomeViewed, { path: "/demo-start" });
  }, []);

  useEffect(() => {
    heading.current?.focus();
  }, [selected]);

  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center bg-surface px-4 py-8 sm:py-16">
      <div className="w-full max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" aria-label={t("openvpmDemoDashboard")} className="flex items-center gap-2 font-heading text-lg font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <PawMark className="h-5 w-5" />
            </span>
            OpenVPM
          </Link>
          <span className="text-sm text-muted-foreground">{t("sharedDemoSampleData")}</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">
            {selected ? t("yourQuickWalkthrough") : t("welcomeToTheDemo")}
          </p>
          <h1 ref={heading} tabIndex={-1} className="font-heading text-2xl font-semibold tracking-tight outline-none sm:text-3xl">
            {selected ? selected.title : t("whatWouldYouLikeTo")}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            {selected ? t("hereAreAFewThings") : t("startWithOneEverydayTask")}
          </p>

          {selected ? (
            <>
              <ol className="my-7 space-y-5">
                {selected.steps.map((step, index) => (
                  <li key={step} className="flex items-start gap-3 text-sm leading-6">
                    <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary">{index + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <p className="rounded-lg bg-muted p-3 text-xs leading-5 text-muted-foreground">{selected.note}</p>
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button type="button" onClick={() => setSelected(null)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm text-muted-foreground hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Choose another workflow
                </button>
                <Link href={selected.href} onClick={() => trackFunnelEvent(FUNNEL_EVENTS.demoWorkflowStarted, { tool: selected.id, path: "/demo-start" })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  {selected.action} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </>
          ) : (
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {demoWorkflows(t).map((workflow) => (
                <button key={workflow.id} type="button" onClick={() => {
                  setSelected(workflow);
                  trackFunnelEvent(FUNNEL_EVENTS.demoWorkflowSelected, { tool: workflow.id, path: "/demo-start" });
                }} className="group flex flex-col rounded-xl border border-border p-5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                  <workflow.icon className="mb-4 h-6 w-6 text-primary" aria-hidden="true" />
                  <span className="block text-sm font-semibold">{workflow.title}</span>
                  <span className="mt-2 block flex-1 text-sm leading-6 text-muted-foreground">{workflow.description}</span>
                  <ArrowRight className="mt-4 h-4 w-4 text-primary" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 text-center">
          <Link href="/" onClick={() => trackFunnelEvent(FUNNEL_EVENTS.demoWelcomeSkipped, { path: "/demo-start" })} className="inline-flex min-h-11 items-center px-3 text-sm text-muted-foreground underline-offset-4 hover:underline">
            {t("iLlExploreOnMy")}
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">{t("youCanChooseAWorkflow")}</p>
        </div>
      </div>
    </main>
  );
}
