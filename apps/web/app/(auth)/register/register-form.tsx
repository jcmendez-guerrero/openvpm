"use client";

import { useTranslations } from "use-intl";

import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  Bot,
  Calendar,
  CheckCircle2,
  FileText,
  LayoutDashboard,
  Loader2,
  Package,
  PawPrint,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { PawMark } from "@/components/brand/paw-mark";
import { cn, initials, isValidEmail } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  AUTH_PASSWORD_MAX_LENGTH,
  AUTH_PASSWORD_MIN_LENGTH,
} from "@/lib/auth-password-policy";
import {
  AUTH_EMAIL_MAX_LENGTH,
  AUTH_PRACTICE_NAME_MAX_LENGTH,
  isAuthEmailLengthValid,
  isRequiredAuthTextValid,
} from "@/lib/auth-input-policy";
import { isSafeCheckoutRedirectUrl } from "@/lib/checkout-redirect";
import {
  acquisitionFromSearchParams,
  acquisitionWithFunnelVisitorId,
} from "@/lib/acquisition";
import { FUNNEL_EVENTS } from "@/lib/funnel-analytics";
import { trackFunnelEvent } from "@/lib/track-funnel-event";
import { getFunnelVisitorId } from "@/lib/funnel-visitor";
import { previewArmFor, type PreviewArm } from "@/lib/billing/preview";
import { usesClinicBuilder } from "@/lib/registration-entry";
import {
  CLINIC_REGION_OPTIONS,
  type ClinicRegionCode,
} from "@/lib/locale/clinic-regions";
import { safeAuthNextPath } from "@/lib/auth-redirect";
import { ClinicIntentBuilder } from "@/components/onboarding/clinic-intent-builder";
import { FirstDayRecommendations } from "@/components/onboarding/first-day-recommendations";
import {
  CLINIC_MODELS,
  DEFAULT_CLINIC_MODEL,
  DEFAULT_FIRST_GOAL,
  FIRST_GOALS,
  type ClinicModel,
  type FirstGoal,
} from "@/lib/onboarding/clinic-profile";

type RegistrationCountry = ClinicRegionCode | "OTHER" | "";
type RegistrationStage = "profile" | "workflow" | "preview" | "account";

const REGISTRATION_PROFILE_STORAGE_KEY = "openvpm:registration-profile:v1";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const onboardingStageMainClass =
  "min-h-screen bg-[radial-gradient(circle_at_top_left,#fff7ed_0%,transparent_34%),radial-gradient(circle_at_top_right,#ede9fe_0%,transparent_36%),linear-gradient(180deg,#ffffff_0%,#f5fbf8_100%)] px-4 py-4 sm:px-6 sm:py-6";
const onboardingStageFrameClass =
  "mx-auto flex max-w-6xl flex-col overflow-hidden rounded-[28px] border border-white/80 bg-white/95 shadow-[0_30px_90px_-54px_rgba(15,23,42,0.48)] backdrop-blur sm:min-h-[650px] lg:h-[calc(100dvh-5rem)] lg:min-h-[680px] lg:max-h-[730px]";
const onboardingStageHeaderClass =
  "flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-9";
const onboardingStageFooterClass =
  "relative flex shrink-0 flex-col-reverse gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-9";

export interface RegisterFormProps {
  hostedBilling: boolean;
  cardRequired: boolean;
  trialDays: number;
  monthlyPriceUsd: number;
  /** Share of card-required signups that explore a preview before the card. */
  previewPercent?: number;
  /** Share of card-required signups sent through "Build your clinic". */
  builderPercent?: number;
}

export default function RegisterForm(props: RegisterFormProps) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <RegistrationEntry {...props} />
    </Suspense>
  );
}

/** Resolve browser-only attribution before mounting any registration UI or events. */
function RegistrationEntry(props: RegisterFormProps) {
  const t = useTranslations("auth.register");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const funnelId =
      acquisitionFromSearchParams(searchParams)?.funnelId ?? getFunnelVisitorId();
    if (
      usesClinicBuilder({
        cardRequired: props.cardRequired,
        builderPercent: props.builderPercent ?? 0,
        funnelId,
      })
    ) {
      const params = new URLSearchParams(searchParams.toString());
      if (funnelId) params.set("funnel_id", funnelId);
      router.replace(`/start?${params.toString()}`);
    } else {
      setReady(true);
    }
  }, [props.cardRequired, props.builderPercent, router, searchParams]);
  if (!ready) {
    return (
      <div
        role="status"
        aria-label={t("openingClinicSetup")}
        className="flex min-h-screen items-center justify-center bg-white"
      >
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  return <RegisterPageInner {...props} />;
}

function RegisterPageInner({
  hostedBilling,
  cardRequired,
  trialDays,
  monthlyPriceUsd,
  previewPercent = 0,
}: RegisterFormProps) {
  const t = useTranslations("auth.register");
  const pt = useTranslations("onboarding.profile");
  const router = useRouter();
  const searchParams = useSearchParams();
  const cloudIntent = searchParams.get("intent") === "cloud";
  const nextPath = safeAuthNextPath(searchParams.get("next"), "/");
  const acquisition = acquisitionFromSearchParams(searchParams);
  const [stage, setStage] = useState<RegistrationStage>("profile");
  const [profileRestored, setProfileRestored] = useState(false);
  const [clinicModel, setClinicModel] =
    useState<ClinicModel>(DEFAULT_CLINIC_MODEL);
  const [firstGoal, setFirstGoal] = useState<FirstGoal>(DEFAULT_FIRST_GOAL);
  const [practiceName, setPracticeName] = useState("");
  const [country, setCountry] = useState<RegistrationCountry>("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Mirrors the server's assignment from the same funnel id, so the copy
  // matches what registration will do.
  const [previewArm, setPreviewArm] = useState<PreviewArm>("control");
  useEffect(() => {
    if (!cardRequired || previewPercent <= 0) return;
    setPreviewArm(
      previewArmFor(
        acquisition?.funnelId ?? getFunnelVisitorId(),
        previewPercent,
      ),
    );
    // Assigned once per mount from the attribution snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable arm
  }, []);
  const previewFirst = cardRequired && previewArm === "preview";
  const cardFirst = cardRequired && !previewFirst;

  useEffect(() => {
    trackFunnelEvent(FUNNEL_EVENTS.signupLand, {
      intent: cloudIntent ? "cloud" : "default",
      source: acquisition?.source ?? "none",
      campaign: acquisition?.campaign ?? "none",
    });
    // Fire once on land; acquisition is derived from the URL for this mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- signup attribution snapshot
  }, []);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(
        REGISTRATION_PROFILE_STORAGE_KEY,
      );
      if (!raw) {
        return;
      }
      const saved = JSON.parse(raw) as {
        stage?: unknown;
        clinicModel?: unknown;
        firstGoal?: unknown;
      };
      if (
        typeof saved.clinicModel === "string" &&
        CLINIC_MODELS.includes(saved.clinicModel as ClinicModel)
      ) {
        setClinicModel(saved.clinicModel as ClinicModel);
      }
      if (
        typeof saved.firstGoal === "string" &&
        FIRST_GOALS.includes(saved.firstGoal as FirstGoal)
      ) {
        setFirstGoal(saved.firstGoal as FirstGoal);
      }
      if (
        saved.stage === "workflow" ||
        saved.stage === "preview" ||
        saved.stage === "account"
      ) {
        // Practice name and email intentionally stay out of sessionStorage.
        // A refresh from the security step returns to the identity step so the
        // user can re-enter them instead of landing on a hidden invalid state.
        setStage("workflow");
      }
    } catch {
      window.sessionStorage.removeItem(REGISTRATION_PROFILE_STORAGE_KEY);
    } finally {
      setProfileRestored(true);
    }
  }, []);

  useEffect(() => {
    if (!profileRestored) return;
    try {
      window.sessionStorage.setItem(
        REGISTRATION_PROFILE_STORAGE_KEY,
        JSON.stringify({ stage, clinicModel, firstGoal }),
      );
    } catch {
      // Session continuity is helpful but must never block registration.
    }
  }, [profileRestored, stage, clinicModel, firstGoal]);

  useEffect(() => {
    if (!profileRestored) return;
    if (stage === "workflow" || stage === "preview") return;
    trackFunnelEvent(
      stage === "profile"
        ? FUNNEL_EVENTS.signupProfileViewed
        : FUNNEL_EVENTS.signupAccountViewed,
      {
        source: acquisition?.source ?? "none",
        step: stage,
      },
    );
  }, [acquisition?.source, profileRestored, stage]);

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async (data) => {
      trackFunnelEvent(FUNNEL_EVENTS.signupSucceeded, {
        model: clinicModel,
        goal: firstGoal,
        step: "account",
      });
      try {
        window.sessionStorage.removeItem(REGISTRATION_PROFILE_STORAGE_KEY);
      } catch {
        // The account is created even when storage is unavailable.
      }
      if (data.checkoutUrl) {
        if (!isSafeCheckoutRedirectUrl(data.checkoutUrl)) {
          toast.error(t("hostedCheckoutIsUnavailablePlease"));
          setLoading(false);
          return;
        }
        window.location.href = data.checkoutUrl;
        return;
      }

      // No checkout wall: card-free hosted trials and self-host both sign in and
      // land in the app immediately. (A legacy card-up-front flow would have
      // returned a checkoutUrl above and never reached here.)
      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });
      if (result?.ok) {
        // Full document navigation, NOT router.push: the logo link prefetched
        // "/" while logged out, so the router cache holds a redirect to
        // /login for up to 30s and push would replay it, bouncing brand-new
        // accounts to the login page right after signup.
        window.location.assign(nextPath);
      } else {
        toast.success(t("accountCreatedPleaseSignIn"));
        router.push(`/login?next=${encodeURIComponent(nextPath)}`);
      }
    },
    onError: (err) => {
      toast.error(err.message);
      setError(err.message);
      setLoading(false);
    },
  });

  function validate(): string | null {
    if (practiceName.trim().length < 2)
      return t("addYourPracticeNameTo");
    if (practiceName.trim().length > AUTH_PRACTICE_NAME_MAX_LENGTH)
      return t("errors.practiceNameLong", { max: AUTH_PRACTICE_NAME_MAX_LENGTH });
    if (!isAuthEmailLengthValid(email))
      return t("errors.emailLong", { max: AUTH_EMAIL_MAX_LENGTH });
    if (!isValidEmail(email)) return t("addAValidWorkEmail");
    if (!country) return t("errors.country");
    if (country === "OTHER")
      return t("errors.countryUnavailable");
    if (password.length < AUTH_PASSWORD_MIN_LENGTH)
      return t("errors.passwordShort", { min: AUTH_PASSWORD_MIN_LENGTH });
    if (password.length > AUTH_PASSWORD_MAX_LENGTH)
      return t("errors.passwordLong", { max: AUTH_PASSWORD_MAX_LENGTH });
    return null;
  }

  const canSubmit =
    isRequiredAuthTextValid(practiceName, AUTH_PRACTICE_NAME_MAX_LENGTH, 2) &&
    isAuthEmailLengthValid(email) &&
    isValidEmail(email) &&
    country !== "" &&
    country !== "OTHER" &&
    password.length >= AUTH_PASSWORD_MIN_LENGTH &&
    password.length <= AUTH_PASSWORD_MAX_LENGTH;

  const canContinueFromWorkflow =
    isRequiredAuthTextValid(practiceName, AUTH_PRACTICE_NAME_MAX_LENGTH, 2) &&
    isAuthEmailLengthValid(email) &&
    isValidEmail(email);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setLoading(true);
    trackFunnelEvent(FUNNEL_EVENTS.signupSubmitted, {
      model: clinicModel,
      goal: firstGoal,
      step: "account",
    });
    const registrationAcquisition = acquisitionWithFunnelVisitorId(
      acquisition,
      getFunnelVisitorId(),
    );
    registerMutation.mutate({
      email: email.trim().toLowerCase(),
      password,
      practiceName: practiceName.trim(),
      country: country as ClinicRegionCode,
      onboardingDraft: { clinicModel, firstGoal },
      acquisition: registrationAcquisition,
    });
  }

  function selectClinicModel(model: ClinicModel) {
    const nextGoal =
      model === "exploring" || firstGoal !== "self_host"
        ? firstGoal
        : "explore_sample";
    setClinicModel(model);
    setFirstGoal(nextGoal);
    trackFunnelEvent(FUNNEL_EVENTS.onboardingModelSelected, {
      model,
      step: "profile",
    });
  }

  function selectFirstGoal(goal: FirstGoal) {
    setFirstGoal(goal);
    trackFunnelEvent(FUNNEL_EVENTS.onboardingGoalSelected, {
      model: clinicModel,
      goal,
      step: "workflow",
    });
  }

  function showStage(nextStage: RegistrationStage) {
    window.scrollTo({ top: 0, behavior: "auto" });
    setStage(nextStage);
  }

  function continueToWorkflow() {
    setError("");
    showStage("workflow");
  }

  function continueToPreview() {
    if (!canContinueFromWorkflow) {
      setError(
        practiceName.trim().length < 2
          ? t("addYourPracticeNameTo")
          : t("addAValidWorkEmail"),
      );
      return;
    }
    setError("");
    trackFunnelEvent(FUNNEL_EVENTS.signupProfileCompleted, {
      model: clinicModel,
      goal: firstGoal,
      step: "workflow",
    });
    trackFunnelEvent(FUNNEL_EVENTS.onboardingPlanBuilt, {
      model: clinicModel,
      goal: firstGoal,
      step: "workflow",
    });
    showStage("preview");
  }

  function continueToAccount() {
    setError("");
    showStage("account");
  }

  if (stage === "profile") {
    return (
      <main className={onboardingStageMainClass}>
        <div className={onboardingStageFrameClass}>
          <header className={onboardingStageHeaderClass}>
            <Link
              href="/"
              className="inline-flex items-center gap-3 font-heading text-lg font-semibold tracking-tight text-slate-950 sm:text-xl"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <PawMark className="h-5 w-5" />
              </span>
              OpenVPM
            </Link>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 sm:gap-3 sm:text-sm">
              <span className="whitespace-nowrap">{t("step1Of4")}</span>
              <span className="flex gap-1" aria-hidden="true">
                <span className="h-1.5 w-6 rounded-full bg-primary sm:w-10" />
                <span className="h-1.5 w-6 rounded-full bg-slate-200 sm:w-10" />
                <span className="h-1.5 w-6 rounded-full bg-slate-200 sm:w-10" />
                <span className="h-1.5 w-6 rounded-full bg-slate-200 sm:w-10" />
              </span>
            </div>
          </header>

          <section className="flex-1 px-5 py-7 sm:px-9 sm:py-10 lg:px-12">
            <div className="mb-8 max-w-3xl">
              <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                {t("aPlatformTrulyBuiltFor")}
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
                {t("tellUsWhatYourTeam")}
              </p>
            </div>

            <ClinicIntentBuilder
              clinicModel={clinicModel}
              firstGoal={firstGoal}
              onClinicModelChange={selectClinicModel}
              onFirstGoalChange={selectFirstGoal}
              intro={null}
              showFirstGoal={false}
            />
          </section>

          <footer className={cn(onboardingStageFooterClass, "sm:justify-end")}>
            <Button
              type="button"
              onClick={continueToWorkflow}
              className="h-11 rounded-xl px-6 text-sm font-semibold shadow-[0_12px_28px_-16px_rgba(5,150,105,0.8)]"
            >
              {t("showMyWorkflows")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </footer>
        </div>
      </main>
    );
  }

  if (stage === "workflow") {
    return (
      <main className={onboardingStageMainClass}>
        <div className={onboardingStageFrameClass}>
          <header className={onboardingStageHeaderClass}>
            <Link
              href="/"
              className="inline-flex items-center gap-3 font-heading text-lg font-semibold tracking-tight text-slate-950 sm:text-xl"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <PawMark className="h-5 w-5" />
              </span>
              OpenVPM
            </Link>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 sm:gap-3 sm:text-sm">
              <span className="whitespace-nowrap">{t("step2Of4")}</span>
              <span className="flex gap-1" aria-hidden="true">
                <span className="h-1.5 w-6 rounded-full bg-primary sm:w-10" />
                <span className="h-1.5 w-6 rounded-full bg-primary sm:w-10" />
                <span className="h-1.5 w-6 rounded-full bg-slate-200 sm:w-10" />
                <span className="h-1.5 w-6 rounded-full bg-slate-200 sm:w-10" />
              </span>
            </div>
          </header>

          <section className="flex-1 px-5 py-6 sm:px-9 sm:py-7 lg:px-10">
            <ClinicIntentBuilder
              clinicModel={clinicModel}
              firstGoal={firstGoal}
              onClinicModelChange={selectClinicModel}
              onFirstGoalChange={selectFirstGoal}
              intro={null}
              showClinicModel={false}
              goalLegend={t("goalLegend")}
              beforeChoices={
                <div className="max-w-3xl">
                  <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                    {t("whatWouldYouLikeTo")}
                  </h1>
                  <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
                    {t("pickOneUsefulWorkflowAnd")}
                  </p>
                </div>
              }
              afterChoices={
                <div className="mt-5 border-t border-slate-100 pt-5">
                  <p className="text-sm font-semibold text-slate-950 sm:text-base">
                    {t("startYourWorkspace")}
                  </p>

                  {error ? (
                    <div className="mt-4 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                      {error}
                    </div>
                  ) : null}

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <FormField label={t("practiceName")} htmlFor="practiceName">
                      <Input
                        id="practiceName"
                        name="practiceName"
                        value={practiceName}
                        onChange={(event) => {
                          setPracticeName(event.target.value);
                          setError("");
                        }}
                        placeholder={t("neighborhoodVeterinary")}
                        autoComplete="organization"
                        autoFocus
                        maxLength={AUTH_PRACTICE_NAME_MAX_LENGTH}
                        required
                      />
                    </FormField>
                    <FormField label={t("workEmail")} htmlFor="email">
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={email}
                        onChange={(event) => {
                          setEmail(event.target.value);
                          setError("");
                        }}
                        placeholder="you@clinic.com"
                        autoComplete="email"
                        maxLength={AUTH_EMAIL_MAX_LENGTH}
                        required
                      />
                    </FormField>
                  </div>
                </div>
              }
            />
          </section>

          <footer className={onboardingStageFooterClass}>
            <button
              type="button"
              onClick={() => {
                setError("");
                showStage("profile");
              }}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("back")}
            </button>
            <Button
              type="button"
              onClick={continueToPreview}
              className="h-11 rounded-xl px-6 text-sm font-semibold shadow-[0_12px_28px_-16px_rgba(5,150,105,0.8)]"
            >
              {t("seeMyFirstDay")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </footer>
        </div>
      </main>
    );
  }

  if (stage === "preview") {
    return (
      <main className={onboardingStageMainClass}>
        <div className={onboardingStageFrameClass}>
          <header className={onboardingStageHeaderClass}>
            <Link
              href="/"
              className="inline-flex items-center gap-3 font-heading text-lg font-semibold tracking-tight text-slate-950 sm:text-xl"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <PawMark className="h-5 w-5" />
              </span>
              OpenVPM
            </Link>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 sm:gap-3 sm:text-sm">
              <span className="whitespace-nowrap">{t("step3Of4")}</span>
              <span className="flex gap-1" aria-hidden="true">
                <span className="h-1.5 w-6 rounded-full bg-primary sm:w-10" />
                <span className="h-1.5 w-6 rounded-full bg-primary sm:w-10" />
                <span className="h-1.5 w-6 rounded-full bg-primary sm:w-10" />
                <span className="h-1.5 w-6 rounded-full bg-slate-200 sm:w-10" />
              </span>
            </div>
          </header>

          <section className="flex-1 px-5 py-6 sm:px-9 sm:py-7 lg:px-10">
            <div className="mb-6 max-w-3xl">
              <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                {t("yourFirstDayIsReady")}
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
                {t("readyIntro", { practice: practiceName.trim() })}
              </p>
            </div>

            <FirstDayRecommendations primaryGoal={firstGoal} />
          </section>

          <footer className={onboardingStageFooterClass}>
            <button
              type="button"
              onClick={() => showStage("workflow")}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("back")}
            </button>
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-4">
              <p className="text-center text-xs text-slate-500">
                {previewFirst ? t("noCardNeededToLook") : cardFirst ? t("cardRequiredNoChargeToday") : hostedBilling ? t("noCardRequired") : t("freeToSelfHost")}
              </p>
              <Button
                type="button"
                onClick={continueToAccount}
                className="h-11 rounded-xl px-6 text-sm font-semibold shadow-[0_12px_28px_-16px_rgba(5,150,105,0.8)]"
              >
                {t("secureMyWorkspace")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </footer>
        </div>
      </main>
    );
  }

  return (
    <div className="grid min-h-screen min-w-0 overflow-x-hidden lg:grid-cols-2">
      {/* Left pane: the form, on clean white */}
      <div className="flex min-w-0 items-start justify-center bg-white px-6 py-10 sm:px-10">
        <div className="min-w-0 w-full max-w-md">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-primary"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <PawMark className="h-4 w-4" />
              </span>
              OpenVPM {cloudIntent ? "Cloud" : ""}
            </Link>
            <span className="text-xs font-medium text-slate-500">
              {t("step4Of4")}
            </span>
          </div>

          <h1 className="mt-8 font-heading text-3xl font-bold tracking-tight text-slate-950">
            {t("secureYourWorkspace")}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {t("chooseYourClinicCountryAnd")}
            {previewFirst
              ? " Next, explore your workspace with sample data. Add a card when you're ready to start your free trial."
              : cardFirst
              ? " Next, add your card securely through Stripe to start your free trial."
              : hostedBilling
                ? " Your free trial starts immediately."
                : " Your self-hosted workspace is free."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 grid min-w-0 gap-4">
            {error ? (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                {t("yourWorkspace")}
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-950">
                {practiceName.trim()}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-600">
                {email.trim().toLowerCase()}
              </p>
            </div>

            <input
              type="email"
              name="email"
              value={email.trim().toLowerCase()}
              autoComplete="username"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              readOnly
            />

            <FormField
              label={t("clinicCountry")}
              htmlFor="country"
              className="min-w-0"
              description={t("thisSetsYourCurrencyTax")}
            >
              <select
                id="country"
                name="country"
                className={selectClass}
                value={country}
                autoComplete="country"
                onChange={(event) => {
                  setCountry(event.target.value as RegistrationCountry);
                  setError("");
                }}
                required
              >
                <option value="">{t("chooseYourClinicCountry")}</option>
                {CLINIC_REGION_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
                <option value="OTHER">{t("anotherCountry")}</option>
              </select>
            </FormField>

            {country && country !== "US" && country !== "OTHER" ? (
              <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  {t("regionNotice")}
                </p>
              </div>
            ) : null}

            {country === "OTHER" ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                {t.rich("countryUnavailable", {
                  demo: (chunks) => (
                    <a href="https://demo.openvpm.com" className="font-medium text-primary underline underline-offset-2">
                      {chunks}
                    </a>
                  ),
                  repo: (chunks) => (
                    <a href="https://github.com/evangauer/openvpm" className="font-medium text-primary underline underline-offset-2">
                      {chunks}
                    </a>
                  ),
                })}
              </div>
            ) : null}

            <FormField
              label={t("password")}
              htmlFor="password"
              className="min-w-0"
              description={t("passwordHint", { min: AUTH_PASSWORD_MIN_LENGTH })}
            >
              <Input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("createAPassword")}
                autoComplete="new-password"
                minLength={AUTH_PASSWORD_MIN_LENGTH}
                maxLength={AUTH_PASSWORD_MAX_LENGTH}
                required
              />
            </FormField>

            <Button
              type="submit"
              disabled={!canSubmit || loading || registerMutation.isPending}
              className="mt-1 w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("creatingYourWorkspace")}
                </>
              ) : (
                <>
                  {previewFirst ? t("buildMyWorkspace") : cardFirst ? t("continueToSecureCheckout") : hostedBilling ? t("startMyFreeTrial") : t("createMyWorkspace")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>

            <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              {hostedBilling ? t("freeForDays", { days: trialDays }) : t("freeOpenSourceSoftware")}
              {previewFirst ? ` ${t("noCardNeededToLook")}` : cardFirst ? ` ${t("cardRequiredNoChargeToday")}` : hostedBilling ? ` ${t("noCreditCard")}` : ""}
            </p>

            {cardFirst && (
              <p className="text-center text-xs leading-5 text-slate-500">
                {t("trialTerms", { days: trialDays, price: monthlyPriceUsd })}
              </p>
            )}

            <button
              type="button"
              onClick={() => showStage("preview")}
              className="mx-auto inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-primary"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("backToMyFirstDay")}
            </button>

            <p className="text-center text-xs text-slate-400">
              {t.rich("agreement", {
                terms: (chunks) => (
                  <Link href="/legal/terms" className="underline underline-offset-2 hover:text-slate-600">
                    {chunks}
                  </Link>
                ),
                privacy: (chunks) => (
                  <Link href="/legal/privacy" className="underline underline-offset-2 hover:text-slate-600">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500">
            {t("haveAccount")}{" "}
            <Link
              href={`/login?next=${encodeURIComponent(nextPath)}`}
              className="font-medium text-primary hover:underline"
            >
              {t("signIn")}
            </Link>
          </p>
        </div>
      </div>

      {/* Right pane: gradient, with the platform flush to the bottom-right edge */}
      <div className="relative hidden overflow-hidden bg-[linear-gradient(135deg,#fff7ed_0%,#fdf2f8_45%,#ecfdf5_100%)] lg:block">
        <div className="relative z-10 px-12 pt-16">
          <h2 className="max-w-md font-heading text-3xl font-bold tracking-tight text-slate-950">
            {t("yourFirstDayAlreadyTaking")}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
            {t("builtAround", {
              care: pt(`models.${clinicModel}.shortLabel`).toLowerCase(),
            })}
          </p>
        </div>

        <div className="absolute bottom-0 right-0 left-16 top-52">
          <PlatformPreview practiceName={practiceName} />
        </div>
      </div>
    </div>
  );
}

// Labels are auth.register catalog keys.
const NAV = [
  { label: "dashboard", icon: LayoutDashboard },
  { label: "patients", icon: PawPrint },
  { label: "schedule", icon: Calendar },
  { label: "records", icon: FileText },
  { label: "billing", icon: Receipt },
  { label: "inventory", icon: Package },
] as const;

const KPIS = [
  { label: "todaySVisits", value: "8", icon: Calendar },
  { label: "newPatients", value: "3", icon: PawPrint },
  { label: "revenue", value: "$1,240", icon: Receipt },
] as const;

// Appointment colors mirror the real schedule.
const APPTS = [
  { time: "9:00", title: "wellnessExam", pet: "Biscuit", color: "#0d9488" },
  { time: "10:30", title: "vaccination", pet: "Luna", color: "#2563eb" },
  { time: "1:15", title: "dentalCleaning", pet: "Mango", color: "#0891b2" },
  { time: "3:00", title: "sickVisit", pet: "Olive", color: "#dc2626" },
] as const;

/**
 * A clean, value-first snapshot of the real app: the icon side nav, the
 * dashboard value cards, the day's schedule with appointment colors, and an
 * Ask AI card. Rendered flush to the bottom-right edge of the pane.
 */
function PlatformPreview({ practiceName }: { practiceName: string }) {
  const t = useTranslations("auth.register");
  const clinic = practiceName.trim() || t("neighborhoodVeterinary");
  return (
    <div className="h-full w-full overflow-hidden rounded-tl-2xl border-l border-t border-white/80 bg-white shadow-2xl shadow-rose-200/40">
      <div className="flex h-full">
        {/* Side nav */}
        <aside className="flex w-[150px] shrink-0 flex-col border-r border-slate-100 bg-slate-50/70 p-3">
          <div className="flex items-center gap-2 px-1 pb-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-[10px] font-semibold text-primary-foreground">
              {initials(clinic)}
            </span>
            <span className="truncate font-heading text-sm font-semibold text-slate-900">
              {clinic}
            </span>
          </div>
          <nav className="space-y-1">
            {NAV.map(({ label, icon: Icon }, i) => (
              <div
                key={label}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-xs font-medium",
                  i === 0 ? "bg-primary/10 text-primary" : "text-slate-500",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {t(label)}
              </div>
            ))}
          </nav>
          <div className="mt-auto flex items-center gap-2 px-1 pt-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
              DV
            </span>
            <span className="truncate text-[11px] text-slate-500">Dr. Vet</span>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="font-heading text-sm font-semibold text-slate-900">
              {t("dashboard")}
            </p>
            <span className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground">
              {t("new")}
            </span>
          </div>

          <div className="flex-1 space-y-3 p-4">
            {/* Value cards */}
            <div className="grid grid-cols-3 gap-3">
              {KPIS.map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-lg border border-slate-100 bg-white p-3"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    {t(label)}
                  </p>
                  <p className="text-base font-semibold text-slate-950">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {/* Today's schedule with appointment colors */}
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-xs font-semibold text-slate-900">
                {t("todaySSchedule")}
              </p>
              <div className="mt-2 space-y-1.5">
                {APPTS.map((a) => (
                  <div
                    key={a.time}
                    className="flex items-center gap-3 rounded-md px-2.5 py-1.5"
                    style={{ backgroundColor: `${a.color}14` }}
                  >
                    <span className="w-10 text-[11px] font-medium text-slate-500">
                      {a.time}
                    </span>
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: a.color }}
                    />
                    <span className="text-xs font-medium text-slate-900">
                      {t(a.title)}
                    </span>
                    <span className="ml-auto text-[11px] text-slate-500">
                      {a.pet}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ask AI */}
            <div className="rounded-lg border border-slate-100 bg-primary/5 p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Bot className="h-3.5 w-3.5" />
                </span>
                <p className="text-xs font-semibold text-slate-900">{t("askAi")}</p>
              </div>
              <div className="mt-2 flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
                <span className="truncate text-[11px] text-slate-500">
                  {t("whichPetsAreDueFor")}
                </span>
                <span className="ml-auto rounded bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                  {t("ask")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
