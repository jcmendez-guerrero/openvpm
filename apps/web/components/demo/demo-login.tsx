"use client";

import { useTranslations } from "use-intl";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  HeartPulse,
  LockKeyhole,
  Phone,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { PawMark } from "@/components/brand/paw-mark";
import { DEMO_ROLE_OPTIONS } from "@/lib/demo-role-switcher";
import { AUTH_EMAIL_MAX_LENGTH } from "@/lib/auth-input-policy";
import { safeAuthNextPath } from "@/lib/auth-redirect";
import { signInToDemo } from "@/lib/demo-sign-in";
import { CURRENT_DEMO_DISCLOSURE_TEXT } from "@/lib/growth/demo-disclosure";
import {
  buildCloudSignupUrl,
  cloudSignupAppOrigin,
  FUNNEL_EVENTS,
} from "@/lib/funnel-analytics";
import { trackFunnelEvent } from "@/lib/track-funnel-event";
import { getFunnelVisitorId, useFunnelVisitorId } from "@/lib/funnel-visitor";
import styles from "./demo-login.module.css";

// Role, description, alt and tab text live in the catalog under demo.
const roleDetails = {
  admin: {
    icon: ShieldCheck,
  },
  veterinarian: {
    icon: Stethoscope,
  },
  technician: {
    icon: HeartPulse,
  },
  front_desk: {
    icon: Phone,
  },
};
const demoRoles = DEMO_ROLE_OPTIONS.map(({ value, label }) => ({
  id: value,
  label,
  ...roleDetails[value],
}));
const shots = {
  whiteboard: {
    src: "/demo/whiteboard.jpg",
    width: 1280,
    height: 800,
    fit: styles.productImageFill,
  },
  "visit-clinical-work": {
    src: "/demo/patient-record.jpg",
    width: 1040,
    height: 448,
    fit: styles.productImageTop,
  },
};
const previewTabs = [
  { id: "whiteboard" },
  { id: "visit-clinical-work" },
] as const;
function ProductImage({
  id,
  priority = false,
}: {
  id: keyof typeof shots;
  priority?: boolean;
}) {
  const demoT = useTranslations("demo");
  const shot = shots[id];
  return (
    <Image
      src={shot.src}
      alt={demoT(`login.shots.${id}`)}
      width={shot.width}
      height={shot.height}
      sizes="(max-width: 760px) 100vw, 65vw"
      priority={priority}
      className={`${styles.productImage} ${shot.fit}`}
    />
  );
}

export function DemoLogin() {
  const demoT = useTranslations("demo");
  const t = useTranslations("demo.login");
  const router = useRouter();
  const searchParams = useSearchParams();
  const visitorId = useFunnelVisitorId();
  const nextPath = safeAuthNextPath(searchParams.get("next"), "/demo-start");
  const [role, setRole] = useState<(typeof demoRoles)[number] | null>(null);
  const [step, setStep] = useState<"role" | "email">("role");
  const [email, setEmail] = useState("");
  const [previewTab, setPreviewTab] =
    useState<(typeof previewTabs)[number]["id"]>("whiteboard");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    trackFunnelEvent(FUNNEL_EVENTS.demoLand);
    trackFunnelEvent(FUNNEL_EVENTS.demoGateViewed);
  }, []);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [step]);

  function chooseRole(selected: (typeof demoRoles)[number]) {
    setRole(selected);
    setError("");
    setStep("email");
  }

  async function enterDemo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!role || submitting.current) return;
    submitting.current = true;
    setLoading(true);
    setError("");
    try {
      await signInToDemo(
        {
          email,
          role: role.id,
          anonymousId: visitorId ?? getFunnelVisitorId() ?? undefined,
        },
        { fetch, signIn },
      );
      setEmail("");
      router.push(nextPath);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("theDemoIsTemporarilyUnavailable"),
      );
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }
  const RoleIcon = role?.icon ?? ShieldCheck;

  return (
    <main id="main-content" className={styles.page}>
      <header className={styles.header}>
        <a
          href="https://openvpm.com"
          aria-label={t("openvpmHome")}
          className={styles.brand}
        >
          <span>
            <PawMark className={styles.brandMark} />
          </span>
          OpenVPM
        </a>
        <a href="https://openvpm.com" className={styles.backLink}>
          <ArrowLeft size={15} aria-hidden="true" /> {t("backToWebsite")}
        </a>
      </header>
      <div className={styles.split}>
        <section className={styles.formPanel} aria-label={t("demoSetup")}>
          <div className={styles.formInner}>
            <ol className={styles.progress} aria-label={t("yourDemoSetup")}>
              <li aria-current={step === "role" ? "step" : undefined}>
                <span>
                  {step === "email" ? (
                    <Check size={13} aria-hidden="true" />
                  ) : (
                    "1"
                  )}
                </span>
                {t("chooseARole")}
              </li>
              <li className={styles.progressLine} aria-hidden="true" />
              <li aria-current={step === "email" ? "step" : undefined}>
                <span>2</span>{t("stepYourEmail")}
              </li>
            </ol>

            {step === "role" ? (
              <>
                <h1 ref={heading} tabIndex={-1}>
                  {t("aDayInYourShoes")}
                </h1>
                <p className={styles.intro}>
                  {t("walkThroughOpenvpmWithA")}
                </p>
                <div className={styles.roles}>
                  {demoRoles.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        className={styles.role}
                        onClick={() => chooseRole(item)}
                      >
                        <span className={styles.roleIcon}>
                          <Icon
                            size={22}
                            strokeWidth={1.7}
                            aria-hidden="true"
                          />
                        </span>
                        <span>
                          <strong>{demoT(`roles.${item.id}`)}</strong>
                          <span className={styles.roleDescription}>
                            {demoT(`login.roleDescriptions.${item.id}`)}
                          </span>
                        </span>
                        <ArrowRight
                          size={18}
                          className={styles.roleArrow}
                          aria-hidden="true"
                        />
                      </button>
                    );
                  })}
                </div>
                <p className={styles.reassurance}>
                  <Check size={15} aria-hidden="true" />
                  {t("noSetupNoCreditCard")}
                </p>
              </>
            ) : (
              <>
                <button
                  className={styles.changeRole}
                  disabled={loading}
                  onClick={() => {
                    setError("");
                    setStep("role");
                  }}
                >
                  <ArrowLeft size={15} aria-hidden="true" />
                  {t("chooseADifferentRole")}
                </button>
                <h1 ref={heading} tabIndex={-1}>
                  {t("oneLastThing")}
                  <br />
                  {t("dropYourEmail")}
                </h1>
                <p className={styles.intro}>
                  {t("yourSampleClinicIsReady")}
                </p>
                <div className={styles.selectedRole}>
                  <span className={styles.roleIcon}>
                    <RoleIcon size={22} aria-hidden="true" />
                  </span>
                  <div>
                    <small>{t("youReExploringAs")}</small>
                    <strong>{role ? demoT(`roles.${role.id}`) : null}</strong>
                  </div>
                  <CheckCircle2 size={19} aria-hidden="true" />
                </div>
                <form
                  onSubmit={enterDemo}
                  className={styles.emailForm}
                  aria-busy={loading}
                >
                  {error && (
                    <p role="alert" className={styles.error}>
                      {error}
                    </p>
                  )}
                  <label htmlFor="demo-email">{t("emailAddress")}</label>
                  <input
                    id="demo-email"
                    type="email"
                    name="email"
                    required
                    maxLength={AUTH_EMAIL_MAX_LENGTH}
                    disabled={loading}
                    autoComplete="email"
                    inputMode="email"
                    placeholder="you@yourclinic.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    aria-describedby="email-purpose"
                  />
                  <p id="email-purpose" className={styles.disclosure}>
                    {CURRENT_DEMO_DISCLOSURE_TEXT}
                  </p>
                  <button
                    className={styles.primary}
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? t("openingDemo") : t("enterTheDemo")}
                    <ArrowRight size={18} aria-hidden="true" />
                  </button>
                </form>
                <p className={styles.reassurance}>
                  <LockKeyhole size={14} aria-hidden="true" />
                  {t("noPasswordOrCreditCard")}
                </p>
              </>
            )}
            <p className={styles.startClinic}>
              {t("readyForOwnWorkspace")}{" "}
              <a
                href={buildCloudSignupUrl({
                  appOrigin: cloudSignupAppOrigin(),
                  source: "demo",
                  medium: "product",
                  campaign: "demo_login",
                  visitorId,
                })}
                onClick={() =>
                  trackFunnelEvent(FUNNEL_EVENTS.demoCtaStartClinic, {
                    tool: "login",
                    path: "/login",
                  })
                }
              >
                {t("startMyClinic")}
              </a>
            </p>
          </div>
        </section>

        <aside className={styles.showcase} aria-label={t("aLookInsideOpenvpm")}>
          <div className={styles.showcaseCopy}>
            <span className={styles.liveDot} aria-hidden="true" />
            {t("aLittleLookInside")}
            <h2>
              {t("aWholeClinic")}
              <br />
              {t("readyToExplore")}
            </h2>
            <p>
              {t("patientsToMeetVisitsTo")}
              <br />
              {t("seeHowTheDayComes")}
            </p>
          </div>
          <div className={styles.previewWindow}>
            <div className={styles.browserBar}>
              <span className={styles.browserDots} aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <div
                className={styles.previewTabs}
                role="group"
                aria-label={t("productPreview")}
              >
                {previewTabs.map((tab) => (
                  <button
                    key={tab.id}
                    aria-pressed={previewTab === tab.id}
                    onClick={() => setPreviewTab(tab.id)}
                  >
                    {demoT(`login.tabs.${tab.id}`)}
                  </button>
                ))}
              </div>
            </div>
            <ProductImage id={previewTab} priority />
          </div>
        </aside>
      </div>
    </main>
  );
}
