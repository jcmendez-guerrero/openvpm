import { useTranslations } from "use-intl";
import {
  CalendarCheck2,
  Check,
  CreditCard,
  Globe2,
  PawPrint,
  ReceiptText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FirstGoal } from "@/lib/onboarding/clinic-profile";

type RecommendationTone = "primary" | "violet" | "coral";

const RECOMMENDATION_TONES: Record<
  RecommendationTone,
  { picture: string; tag: string }
> = {
  primary: {
    picture: "from-emerald-50 to-teal-50",
    tag: "bg-primary/10 text-primary",
  },
  violet: {
    picture: "from-violet-50 to-sky-50",
    tag: "bg-violet-100 text-violet-700",
  },
  coral: {
    picture: "from-orange-50 to-rose-50",
    tag: "bg-orange-100 text-orange-700",
  },
};

function firstGoalRecommendations(
  t: (key: string) => string,
): Record<
  FirstGoal,
  { title: string; body: string; pictureLabel: string; rowLabel: string }
> {
  return {
  run_visit: {
    title: t("runOneRealVisit"),
    body: t("addOneOwnerAndPet"),
    pictureLabel: t("yourClinicDay"),
    rowLabel: t("newPatient"),
  },
  import_records: {
    title: t("planASafeFirstImport"),
    body: t("inventoryAnExportAndReview"),
    pictureLabel: t("migrationPreview"),
    rowLabel: t("reviewOneChart"),
  },
  start_fresh: {
    title: t("buildYourFirstRealVisit"),
    body: t("setYourClinicBasicsAdd"),
    pictureLabel: t("yourClinicDay"),
    rowLabel: t("firstAppointment"),
  },
  explore_sample: {
    title: t("exploreAReadyMadeClinic"),
    body: t("openASampleScheduleAnd"),
    pictureLabel: t("sampleClinic"),
    rowLabel: t("guidedVisit"),
  },
  self_host: {
    title: t("reviewTheSelfHostedPath"),
    body: t("confirmDeploymentAndDataOwnership"),
    pictureLabel: t("selfHostedSetup"),
    rowLabel: t("deploymentPlan"),
  },
  };
}

function RecommendationCard({
  title,
  body,
  tag,
  tone,
  tilt,
  children,
}: {
  title: string;
  body: string;
  tag: string;
  tone: RecommendationTone;
  tilt: string;
  children: React.ReactNode;
}) {
  const palette = RECOMMENDATION_TONES[tone];
  return (
    <li
      className={cn(
        "group flex min-h-[292px] min-w-0 flex-col rounded-sm bg-white p-3 pb-5 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.55)] ring-1 ring-black/5",
        "transition duration-300 ease-out hover:z-10 hover:-translate-y-1.5 hover:rotate-0 hover:shadow-xl",
        "motion-reduce:transform-none motion-reduce:transition-none",
        tilt,
      )}
    >
      <div
        className={cn(
          "flex min-h-36 flex-col justify-between overflow-hidden rounded-[3px] bg-gradient-to-br p-4",
          palette.picture,
        )}
      >
        {children}
      </div>
      <h4 className="mt-3 font-heading text-base font-semibold leading-snug text-slate-950">
        {title}
      </h4>
      <p className="mt-1 text-xs leading-5 text-slate-600">{body}</p>
      <span
        className={cn(
          "mt-3 w-fit rounded-full px-2.5 py-1 text-[10px] font-semibold",
          palette.tag,
        )}
      >
        {tag}
      </span>
    </li>
  );
}

export function FirstDayRecommendations({
  hasImportedData = false,
  primaryGoal = "run_visit",
}: {
  hasImportedData?: boolean;
  primaryGoal?: FirstGoal;
}) {
  const t = useTranslations("onboarding.firstDay");
  const primaryRecommendation = hasImportedData
    ? {
        title: t("bookOneRealAppointment"),
        body: t("chooseAPatientFromYour"),
        pictureLabel: t("yourClinicDay"),
        rowLabel: t("firstVisit"),
      }
    : firstGoalRecommendations(t)[primaryGoal];

  return (
    <section aria-label={t("yourFirstDayRecommendations")}>
      <ul className="grid gap-6 sm:grid-cols-3 sm:gap-5">
        <RecommendationCard
          title={primaryRecommendation.title}
          body={primaryRecommendation.body}
          tag={t("bestNext")}
          tone="primary"
          tilt="sm:-rotate-1"
        >
          <span className="flex items-center gap-2 text-xs font-semibold text-primary">
            <CalendarCheck2 className="h-4 w-4" />
            {primaryRecommendation.pictureLabel}
          </span>
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-lg bg-white/90 px-3 py-2 text-xs text-slate-700 shadow-sm">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <PawPrint className="h-3.5 w-3.5" />
              </span>
              <span>{primaryRecommendation.rowLabel}</span>
              <Check className="ml-auto h-3.5 w-3.5 text-primary" />
            </div>
          </div>
        </RecommendationCard>

        <RecommendationCard
          title={t("makeGettingPaidEasy")}
          body={t("payBody")}
          tag={t("payTag")}
          tone="violet"
          tilt="sm:rotate-1"
        >
          <span className="flex items-center gap-2 text-xs font-semibold text-violet-700">
            <ReceiptText className="h-4 w-4" /> {t("clientBillingTag")}
          </span>
          <div className="rounded-lg bg-white/90 px-3 py-2.5 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{t("invoiceTotal")}</span>
              <span className="font-semibold text-slate-900">$68.00</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-violet-700">
              <CreditCard className="h-3.5 w-3.5" /> {t("paySecurelyOnline")}
            </div>
          </div>
        </RecommendationCard>

        <RecommendationCard
          title={t("giveClientsOneSimplePlace")}
          body={t("portalBody")}
          tag={t("portalTag")}
          tone="coral"
          tilt="sm:-rotate-1"
        >
          <span className="flex items-center gap-2 text-xs font-semibold text-orange-700">
            <Globe2 className="h-4 w-4" /> {t("clientPortalTag")}
          </span>
          <div className="flex items-center gap-2 rounded-lg bg-white/90 px-3 py-2.5 shadow-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-700">
              <PawPrint className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900">
                {t("everythingInOneLink")}
              </p>
              <p className="text-[10px] text-slate-500">
                {t("visitsVaccinesBills")}
              </p>
            </div>
          </div>
        </RecommendationCard>
      </ul>
    </section>
  );
}
