"use client";

import { useTranslations } from "use-intl";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { motion } from "motion/react";
import {
  CalendarCheck,
  Check,
  Clock,
  CreditCard,
  FileText,
  LifeBuoy,
  Rocket,
  Users,
  Compass,
  Dog,
  FileSpreadsheet,
  HeartPulse,
  Home,
  ImagePlus,
  Leaf,
  Loader2,
  Moon,
  PawPrint,
  Plus,
  Sun,
  Sunrise,
  Truck,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BUILD_BRAND_COLORS,
  BUILD_PRACTICE_PROFILES,
  BUILD_PRACTICE_TYPES,
  BUILD_SERVICE_MAX,
  BUILD_SERVICE_PRICE_MAX,
  BUILD_SYSTEM_LABELS,
  BUILD_SYSTEMS,
  type BuildPracticeType,
  type BuildSystem,
} from "@/lib/build/catalog";
import { suggestBookingSlug } from "@/lib/booking/page-config";
import { processLogo } from "@/lib/build/logo";
import {
  AppWindow,
  BookingHeader,
  BrowserWindow,
  Caption,
  CaptionItem,
  CANVAS_WIDTH,
  ClinicMark,
  Phone,
  PhoneOverlay,
  PortalHeader,
  Stage,
  StatusPill,
  WinCards,
  type StoryWin,
} from "./mockups";

export interface BuildServiceChoice {
  name: string;
  price: number;
  on: boolean;
}

export interface BuildState {
  practiceType: BuildPracticeType;
  currentSystem: BuildSystem;
  clinicName: string;
  brandColor: string;
  services: BuildServiceChoice[];
  /** A small PNG data URL of their logo, kept in this browser only. */
  logo: string | null;
}

export interface SceneProps {
  draft: BuildState;
  update: (patch: Partial<BuildState>) => void;
  /** Changes on every visit or replay, restarting the scene's animation. */
  playId: number;
  /** Reduced motion: show each scene's end state without animating. */
  still: boolean;
}

export function servicesFor(type: BuildPracticeType): BuildServiceChoice[] {
  return BUILD_PRACTICE_PROFILES[type].services.map((service) => ({
    ...service,
    on: true,
  }));
}

/** Whether a service is one we recommend for this practice type. */
export function isRecommended(type: BuildPracticeType, name: string): boolean {
  const key = name.trim().toLowerCase();
  return BUILD_PRACTICE_PROFILES[type].services.some(
    (service) => service.name.toLowerCase() === key,
  );
}

/** The clinic's name inside a sentence: "Let's build your clinic…". */
export function displayName(draft: BuildState, fallback = "your clinic"): string {
  return draft.clinicName.trim() || fallback;
}

/** The clinic's name as it appears on its own screens. */
// The booking slug calls these without a fallback, so slugs stay English.
export function brandName(draft: BuildState, fallback = "Your clinic"): string {
  return draft.clinicName.trim() || fallback;
}

export function sampleFor(draft: BuildState) {
  const sample = BUILD_PRACTICE_PROFILES[draft.practiceType].sample;
  const selected = draft.services.filter((service) => service.on);
  const charges = sample.charges.flatMap((line) => {
    const service = selected.find(
      (candidate) => candidate.name.trim().toLowerCase() === line.label.toLowerCase(),
    );
    return service ? [{ label: service.name, price: service.price }] : [];
  });
  // A custom-only catalog still gets a useful preview, without inventing fees.
  return {
    ...sample,
    charges: charges.length ? charges : selected.slice(0, 3).map((service) => ({
      label: service.name,
      price: service.price,
    })),
  };
}

export function sampleTotal(draft: BuildState): number {
  return sampleFor(draft).charges.reduce((sum, line) => sum + line.price, 0);
}

export function money(value: number): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: value % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

function isFromPaper(draft: BuildState): boolean {
  return draft.currentSystem === "paper" || draft.currentSystem === "other";
}

/**
 * Steps through a scene's beats: `at[i]` is when beat i+1 begins (ms after
 * the scene starts). Returns how many beats have played.
 */
function useBeats(at: readonly number[], playId: number, still: boolean) {
  const [beat, setBeat] = useState(still ? at.length : 0);
  useEffect(() => {
    if (still) {
      setBeat(at.length);
      return;
    }
    setBeat(0);
    const timers = at.map((ms, i) => setTimeout(() => setBeat(i + 1), ms));
    return () => timers.forEach(clearTimeout);
    // The beat schedule is static per scene; replay keys off playId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playId, still]);
  return beat;
}

/** Types `text` out from `startMs`, a few characters at a time. */
function useTyped(
  text: string,
  startMs: number,
  playId: number,
  still: boolean,
  step = 3,
) {
  const chars = Array.from(text);
  const [count, setCount] = useState(still ? chars.length : 0);
  useEffect(() => {
    const total = Array.from(text).length;
    if (still) {
      setCount(total);
      return;
    }
    setCount(0);
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const start = setTimeout(function tick() {
      i = Math.min(total, i + step);
      setCount(i);
      if (i < total) timer = setTimeout(tick, 28);
    }, startMs);
    return () => {
      clearTimeout(start);
      clearTimeout(timer);
    };
  }, [text, startMs, playId, still, step]);
  return { shown: chars.slice(0, count).join(""), done: count >= chars.length, count };
}

// ---------------------------------------------------------------------------
// The sample clinic day every scene shares
// ---------------------------------------------------------------------------

const TYPE_COLORS = {
  recheck: "#65a30d",
  dental: "#0891b2",
  vaccination: "#2563eb",
} as const;

interface DayVisit {
  /** Hours after 8 AM. */
  start: number;
  length: number;
  time: string;
  pet: string;
  owner: string;
  type: string;
  color: string;
}

const DOCTOR = "Dr. Reyes";

/** The other patients on Tuesday's schedule, around the sample visit. */
function otherVisits(draft: BuildState): DayVisit[] {
  if (draft.practiceType === "equine") {
    return [
      { start: 0, length: 0.5, time: "8:00 AM", pet: "Duke", owner: "Chen", type: "Coggins Test", color: TYPE_COLORS.vaccination },
      { start: 2, length: 1, time: "10:00 AM", pet: "Bramble", owner: "Brooks", type: "Dental Float", color: TYPE_COLORS.dental },
      { start: 3.25, length: 0.5, time: "11:15 AM", pet: "Willow", owner: "Patel", type: "Recheck", color: TYPE_COLORS.recheck },
    ];
  }
  return [
    { start: 0, length: 0.5, time: "8:00 AM", pet: "Luna", owner: "Chen", type: "Recheck", color: TYPE_COLORS.recheck },
    { start: 2, length: 1, time: "10:00 AM", pet: "Mango", owner: "Brooks", type: "Dental", color: TYPE_COLORS.dental },
    { start: 3.25, length: 0.5, time: "11:15 AM", pet: "Olive", owner: "Patel", type: "Vaccination", color: TYPE_COLORS.vaccination },
  ];
}

function sampleVisit(draft: BuildState, type?: string): DayVisit {
  const sample = sampleFor(draft);
  return {
    start: 1,
    length: 0.75,
    time: "9:00 AM",
    pet: sample.pet,
    owner: "Lee",
    type: type ?? sample.visit,
    color: "var(--b)",
  };
}

function patientLine(type: BuildPracticeType): string {
  // Catalog key under build.scenes.patientLine.
  if (type === "equine") return "patientLine.equine";
  if (type === "shelter") return "patientLine.shelter";
  return "patientLine.default";
}

function Label({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 mt-6 text-sm font-medium text-slate-700 first:mt-0">
      {children}
    </p>
  );
}

const field =
  "h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition-colors focus:border-[var(--b)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--b)_20%,white)]";

function Chip({
  on,
  onClick,
  icon: Icon,
  children,
}: {
  on: boolean;
  onClick: () => void;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition-colors",
        on
          ? "border-[var(--b)] bg-[color-mix(in_srgb,var(--b)_8%,white)] font-medium text-slate-900"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900",
      )}
    >
      {Icon ? (
        <Icon
          className="h-4 w-4 shrink-0"
          style={on ? { color: "var(--b)" } : undefined}
          aria-hidden="true"
        />
      ) : null}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// 1. Practice
// ---------------------------------------------------------------------------

/** The same icons the app uses for each kind of practice. */
const PRACTICE_ICONS: Record<BuildPracticeType, LucideIcon> = {
  companion: Dog,
  mobile: Truck,
  equine: Leaf,
  specialty: HeartPulse,
  shelter: Home,
};

export function PracticeControls({ draft, update }: SceneProps) {
  const t = useTranslations("build.scenes");
  return (
    <div>
      <Label>{t("howDoYouPractice")}</Label>
      <div className="flex flex-wrap gap-2">
        {BUILD_PRACTICE_TYPES.map((type) => (
          <Chip
            key={type}
            on={draft.practiceType === type}
            icon={PRACTICE_ICONS[type]}
            onClick={() =>
              update({
                practiceType: type,
                services: [
                  ...servicesFor(type),
                  ...draft.services.filter(
                    (service) =>
                      !isRecommended(draft.practiceType, service.name) &&
                      !isRecommended(type, service.name),
                  ),
                ].slice(0, BUILD_SERVICE_MAX),
              })
            }
          >
            {t(`practiceTypes.${type}`)}
          </Chip>
        ))}
      </div>
      <Label>{t("whatDoYouUseToday")}</Label>
      <div className="flex flex-wrap gap-2">
        {BUILD_SYSTEMS.map((system) => (
          <Chip
            key={system}
            on={draft.currentSystem === system}
            icon={system === "other" ? Compass : undefined}
            onClick={() => update({ currentSystem: system })}
          >
            {system === "paper" || system === "other"
              ? t(`systems.${system}`)
              : BUILD_SYSTEM_LABELS[system]}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function AppointmentRow({ visit }: { visit: DayVisit }) {
  const t = useTranslations("build.scenes");
  return (
    <div className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2">
      <span className="flex w-[70px] shrink-0 items-center gap-1 text-[10.5px] text-slate-500">
        <Clock className="h-3 w-3" aria-hidden="true" />
        {visit.time}
      </span>
      <span className="min-w-0 text-[11px]">
        <span
          className="font-medium transition-colors duration-500"
          style={{ color: "var(--b)" }}
        >
          {visit.pet}
        </span>{" "}
        <span className="text-slate-500">({visit.owner})</span>
        <span className="block truncate text-[10.5px] text-slate-500">
          {t("visitWithDoctor", { type: visit.type, doctor: DOCTOR })}
        </span>
      </span>
    </div>
  );
}

export function PracticeStage({ draft }: SceneProps) {
  const t = useTranslations("build.scenes");
  const profile = BUILD_PRACTICE_PROFILES[draft.practiceType];
  const visits = [otherVisits(draft)[0]!, sampleVisit(draft)];
  const stats: Array<[string, string]> = [
    [t("stats.today"), "8"],
    [t("stats.checkedIn"), "1"],
    [t("stats.recall"), draft.practiceType === "equine" ? "24" : "38"],
  ];
  return (
    <Stage
      label={t("yourDashboard")}
      footer={
        <Caption>
          {profile.traits.map((trait) => (
            <CaptionItem key={trait}>{trait}</CaptionItem>
          ))}
        </Caption>
      }
    >
      <AppWindow
        clinicName={brandName(draft, t("yourClinic"))}
        logo={draft.logo}
        modules={profile.modules}
        active="Dashboard"
        title={t("goodMorning")}
        width={CANVAS_WIDTH}
      >
        <motion.div
          key={draft.practiceType}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex h-full flex-col"
        >
          <div className="grid grid-cols-3 gap-2.5">
            {stats.map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 px-3 py-2">
                <div className="text-[10px] text-slate-500">{label}</div>
                <div className="font-heading text-[17px] font-semibold">{value}</div>
              </div>
            ))}
          </div>
          <div className="mb-1.5 mt-3 text-[11.5px] font-semibold">
            {t("upcomingAppointments")}
          </div>
          <div className="space-y-1.5">
            {visits.map((visit, i) => (
              <motion.div
                key={`${draft.practiceType}-${visit.pet}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06 }}
              >
                <AppointmentRow visit={visit} />
              </motion.div>
            ))}
          </div>
          <motion.div
            key={draft.currentSystem}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-auto flex items-center gap-2 rounded-md border border-dashed border-slate-300 px-3 py-2 text-[10.5px] text-slate-600"
          >
            <Upload className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            {isFromPaper(draft)
              ? t("importASpreadsheetOfClients")
              : t("bringRecordsFrom", {
                  system: BUILD_SYSTEM_LABELS[draft.currentSystem],
                })}
          </motion.div>
        </motion.div>
      </AppWindow>
    </Stage>
  );
}

// ---------------------------------------------------------------------------
// 2. Brand
// ---------------------------------------------------------------------------

export function BrandControls({ draft, update }: SceneProps) {
  const t = useTranslations("build.scenes");
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setNote(null);
    try {
      const logo = await processLogo(file);
      update(
        logo.color
          ? { logo: logo.dataUrl, brandColor: logo.color }
          : { logo: logo.dataUrl },
      );
      setNote(logo.color ? t("weMatchedYourColorTo") : null);
    } catch (error) {
      setNote(error instanceof Error ? error.message : t("thatImageDidnTWork"));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <Label>{t("clinicName")}</Label>
      <input
        value={draft.clinicName}
        onChange={(event) => update({ clinicName: event.target.value })}
        maxLength={120}
        placeholder={t("neighborhoodVeterinary")}
        autoComplete="organization"
        className={cn(field, "w-full")}
      />
      <Label>{t("logo")}</Label>
      <div className="flex h-10 items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="sr-only"
          onChange={(event) => void onFile(event.target.files?.[0])}
          aria-label={t("uploadYourLogo")}
        />
        {draft.logo ? (
          <>
            <ClinicMark name={brandName(draft, t("yourClinic"))} logo={draft.logo} size={40} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline"
            >
              {t("change")}
            </button>
            <button
              type="button"
              onClick={() => update({ logo: null })}
              className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
            >
              <X className="h-3.5 w-3.5" />
              {t("remove")}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
            {t("uploadYourLogo")}
          </button>
        )}
      </div>
      {note ? <p className="mt-2 text-sm text-slate-500">{note}</p> : null}
      <Label>{t("brandColor")}</Label>
      <div className="flex flex-wrap items-center gap-2">
        {BUILD_BRAND_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={t("useColor", { color })}
            aria-pressed={draft.brandColor === color}
            onClick={() => update({ brandColor: color })}
            className={cn(
              "h-8 w-8 rounded-full border-2 border-white ring-1 ring-slate-200 transition-shadow",
              draft.brandColor === color && "ring-2 ring-slate-900",
            )}
            style={{ background: color }}
          />
        ))}
        <label className="ml-1 inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input
            type="color"
            value={draft.brandColor}
            onChange={(event) => update({ brandColor: event.target.value })}
            className="h-8 w-8 cursor-pointer rounded-full border border-slate-200 bg-white p-0.5"
          />
          {t("exactColor")}
        </label>
      </div>
    </div>
  );
}

export function BrandStage({ draft }: SceneProps) {
  const t = useTranslations("build.scenes");
  const name = brandName(draft, t("yourClinic"));
  const sample = sampleFor(draft);
  const dueLabel = sample.due
    .replace(/^an? /, "")
    .replace(/^./, (c) => c.toUpperCase());
  return (
    <Stage
      label={t("whatYourClientsSee")}
      footer={
        <Caption>
          <CaptionItem>{t("bookingPage")}</CaptionItem>
          <CaptionItem>{t("reminders")}</CaptionItem>
          <CaptionItem>{t("clientPortal")}</CaptionItem>
          <CaptionItem>{t("invoices")}</CaptionItem>
        </Caption>
      }
    >
      <BrowserWindow className="bg-slate-50">
        <div className="flex items-center gap-2.5 border-b border-slate-100 bg-white px-4 py-2.5">
          <ClinicMark name={name} logo={draft.logo} size={26} />
          <div className="min-w-0 text-[11px] leading-4">
            <div className="truncate font-semibold">{name}</div>
            <div className="truncate text-slate-500">
              {t("petVisitTomorrow", { pet: sample.pet })}
            </div>
          </div>
          <span className="ml-auto text-[10px] text-slate-400">8:00 AM</span>
        </div>
        <div className="mx-auto mt-4 w-[300px] overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div
            className="h-1.5 transition-colors duration-500"
            style={{ background: "var(--b)" }}
          />
          <div className="px-5 py-4 text-[11px] leading-[17px] text-slate-600">
            <div className="mb-3 flex items-center gap-2">
              <ClinicMark name={name} logo={draft.logo} size={24} />
              <b className="truncate text-[12px] text-slate-900">{name}</b>
            </div>
            <p className="font-semibold text-slate-900">
              {t("email.greeting", { owner: sample.owner })}
            </p>
            <p className="mt-1">
              {t("email.body", {
                pet: sample.pet,
                visit: sample.visit.toLowerCase(),
              })}
            </p>
            <span
              className="mt-3 inline-block rounded-md px-3 py-1.5 text-[10.5px] font-semibold text-white transition-colors duration-500"
              style={{ background: "var(--b)" }}
            >
              {t("viewAppointment")}
            </span>
          </div>
        </div>
      </BrowserWindow>
      <Phone time="8:00" dark>
        <PortalHeader clinicName={name} logo={draft.logo} />
        <div className="space-y-2 p-2.5">
          <div className="px-0.5 text-[12px] font-semibold">
            {t("welcomeBackOwner", { owner: sample.owner })}
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-2.5">
            <div className="text-[9.5px] font-medium text-slate-500">{t("upcoming")}</div>
            <div className="mt-0.5 font-medium">
              {sample.pet} · {sample.visit}
            </div>
            <div className="text-[10px] text-slate-500">{t("tue900Am")}</div>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2.5">
            <div className="min-w-0">
              <div className="text-[9.5px] font-medium text-slate-500">{t("dueSoon")}</div>
              <div className="truncate font-medium">{dueLabel}</div>
            </div>
            <span
              className="rounded-md px-2 py-1 text-[10px] font-semibold text-white transition-colors duration-500"
              style={{ background: "var(--b)" }}
            >
              {t("book")}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2.5">
            <div>
              <div className="text-[9.5px] font-medium text-slate-500">{t("balance")}</div>
              <div className="font-medium">$0.00</div>
            </div>
            <StatusPill label={t("paidUp")} tone="green" />
          </div>
        </div>
      </Phone>
    </Stage>
  );
}

// ---------------------------------------------------------------------------
// 3. Services
// ---------------------------------------------------------------------------

function PriceInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (price: number) => void;
  label: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
        $
      </span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        max={BUILD_SERVICE_PRICE_MAX}
        step="1"
        value={Number.isFinite(value) ? value : ""}
        onChange={(event) => {
          const price = Number(event.target.value);
          if (Number.isFinite(price) && price >= 0 && price <= BUILD_SERVICE_PRICE_MAX) {
            onChange(price);
          }
        }}
        aria-label={label}
        className={cn(field, "h-9 w-24 pl-6 pr-2 text-right tabular-nums")}
      />
    </div>
  );
}

export function ServicesControls({ draft, update }: SceneProps) {
  const t = useTranslations("build.scenes");
  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);
  const profile = BUILD_PRACTICE_PROFILES[draft.practiceType];
  const set = (index: number, patch: Partial<BuildServiceChoice>) =>
    update({
      services: draft.services.map((service, i) =>
        i === index ? { ...service, ...patch } : service,
      ),
    });
  const rows = draft.services.map((service, index) => ({ service, index }));
  const recommended = rows.filter(({ service }) =>
    isRecommended(draft.practiceType, service.name),
  );
  const own = rows.filter(
    ({ service }) => !isRecommended(draft.practiceType, service.name),
  );
  const trimmed = name.trim();
  const duplicate = draft.services.some(
    (service) => service.name.toLowerCase() === trimmed.toLowerCase(),
  );
  const full = draft.services.length >= BUILD_SERVICE_MAX;

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (!trimmed || duplicate || full) return;
    update({
      services: [...draft.services, { name: trimmed.slice(0, 80), price, on: true }],
    });
    setName("");
    setPrice(0);
  };

  const rowClass =
    "flex h-12 items-center gap-3 rounded-lg border bg-white pl-3 pr-1.5 transition-colors";

  return (
    <div>
      <Label>{t("recommendedFor", { group: profile.plural })}</Label>
      <div className="space-y-1.5">
        {recommended.map(({ service, index }) => (
          <label
            key={service.name}
            className={cn(
              rowClass,
              "cursor-pointer",
              service.on ? "border-slate-200" : "border-slate-200 bg-slate-50",
            )}
          >
            <input
              type="checkbox"
              checked={service.on}
              onChange={(event) => set(index, { on: event.target.checked })}
              aria-label={t("offerService", { name: service.name })}
              className="h-4 w-4 rounded accent-[var(--b)]"
            />
            <span
              className={cn(
                "flex-1 truncate text-sm",
                service.on ? "font-medium text-slate-900" : "text-slate-400",
              )}
            >
              {service.name}
            </span>
            <PriceInput
              value={service.price}
              onChange={(value) => set(index, { price: value })}
              label={`${service.name} price`}
            />
          </label>
        ))}
      </div>

      <Label>{t("yourServices")}</Label>
      <div className="space-y-1.5">
        {own.map(({ service, index }) => (
          <div key={service.name} className={cn(rowClass, "border-slate-200")}>
            <span className="flex-1 truncate text-sm font-medium text-slate-900">
              {service.name}
            </span>
            <PriceInput
              value={service.price}
              onChange={(value) => set(index, { price: value })}
              label={`${service.name} price`}
            />
            <button
              type="button"
              onClick={() =>
                update({ services: draft.services.filter((_, i) => i !== index) })
              }
              aria-label={t("removeService", { name: service.name })}
              className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        {full ? (
          <p className="text-sm text-slate-500">
            {t("serviceLimit", { max: BUILD_SERVICE_MAX })}
          </p>
        ) : (
          <form
            onSubmit={add}
            className={cn(rowClass, "border-dashed border-slate-300")}
          >
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              placeholder={t("addAServiceYouOffer")}
              aria-label={t("serviceName")}
              className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
            <PriceInput value={price} onChange={setPrice} label={t("newServicePrice")} />
            <button
              type="submit"
              disabled={!trimmed || duplicate}
              aria-label={t("addService")}
              className="flex h-9 w-9 items-center justify-center rounded-md text-white transition-opacity disabled:opacity-30"
              style={{ background: "var(--b)" }}
            >
              <Plus className="h-4 w-4" />
            </button>
          </form>
        )}
        {duplicate && trimmed ? (
          <p className="text-sm text-slate-500">{t("thatOneSAlreadyOn")}</p>
        ) : null}
      </div>
    </div>
  );
}

export function bookingSlug(draft: BuildState): string {
  return suggestBookingSlug(brandName(draft)) || "your-clinic";
}

export function ServicesStage({ draft }: SceneProps) {
  const t = useTranslations("build.scenes");
  const name = brandName(draft, t("yourClinic"));
  const offered = draft.services.filter((service) => service.on);
  return (
    <Stage
      label={t("yourBookingPage")}
      footer={
        <Caption>
          <CaptionItem>{t("shareItOnYourWebsite")}</CaptionItem>
          <CaptionItem>{t("requestsLandOnYourSchedule")}</CaptionItem>
        </Caption>
      }
    >
      <BrowserWindow
        url={`app.openvpm.com/book/${bookingSlug(draft)}`}
        width={CANVAS_WIDTH}
        className="bg-slate-50 p-4"
      >
        <div className="mx-auto flex h-full max-w-[460px] flex-col gap-3">
          <BookingHeader clinicName={name} logo={draft.logo} />
          <div className="min-h-0 flex-1 rounded-xl bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
            <div className="text-[11.5px] font-semibold">{t("whatDoesYourPetNeed")}</div>
            <div className="mt-2.5 grid grid-cols-2 gap-1.5">
              {offered.map((service, i) => (
                <motion.div
                  layout
                  key={service.name}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 rounded-md border border-slate-200 px-2.5 py-1.5 text-[10.5px]"
                >
                  <span
                    className={cn(
                      "h-2.5 w-2.5 shrink-0 rounded-full border",
                      i === 0 ? "border-[3px] border-[var(--b)]" : "border-slate-300",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{service.name}</span>
                  <span className="tabular-nums text-slate-500">{money(service.price)}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </BrowserWindow>
    </Stage>
  );
}

// ---------------------------------------------------------------------------
// Story scenes: a day at the clinic, with a win for the client and for you.
// ---------------------------------------------------------------------------

/** Translator for build.scenes, passed by the stage components. */
type ScenesT = (key: string, values?: Record<string, string>) => string;

export function bookWin(draft: BuildState, t: ScenesT): StoryWin {
  const { owner, pet } = sampleFor(draft);
  return {
    clientLabel: t("win.forName", { name: owner }),
    client: t("win.book.client"),
    you: t("win.book.you", { pet }),
  };
}

const HOUR_HEIGHT = 60;

function ScheduleBlock({ visit, fresh = false }: { visit: DayVisit; fresh?: boolean }) {
  const t = useTranslations("build.scenes");
  const height = visit.length * HOUR_HEIGHT - 3;
  return (
    <motion.div
      initial={fresh ? { opacity: 0, scale: 0.92 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 360, damping: 26 }}
      className="absolute left-1 right-1 overflow-hidden rounded-md px-2 py-1 text-[10.5px]"
      style={{
        top: visit.start * HOUR_HEIGHT + 1,
        height,
        background: `color-mix(in srgb, ${visit.color} 13%, white)`,
        borderLeft: `3px solid ${visit.color}`,
      }}
    >
      <div className="flex items-center gap-1.5 font-medium">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: fresh ? "#f59e0b" : "#22c55e" }}
        />
        <span className="truncate">{visit.pet}</span>
        {fresh ? (
          <span className="ml-auto shrink-0 text-[9.5px] font-medium text-slate-500">
            {t("bookedOnline")}
          </span>
        ) : null}
      </div>
      {height >= 36 ? (
        <div className="mt-0.5 truncate text-slate-500">
          {visit.type} · {visit.time.replace(" AM", "")}
        </div>
      ) : null}
    </motion.div>
  );
}

export function BookStage({ draft, playId, still }: SceneProps) {
  const t = useTranslations("build.scenes");
  const beat = useBeats([900, 1700, 2500, 2900, 3600], playId, still);
  const name = brandName(draft, t("yourClinic"));
  const offered = draft.services.filter((service) => service.on);
  const first = offered[0]?.name ?? sampleFor(draft).visit;
  const profile = BUILD_PRACTICE_PROFILES[draft.practiceType];
  const fresh = sampleVisit(draft, first);
  return (
    <Stage
      label={t("monday941Pm")}
      icon={Moon}
      footer={<WinCards win={bookWin(draft, t)} show={beat >= 5} />}
    >
      <AppWindow
        clinicName={name}
        logo={draft.logo}
        modules={profile.modules}
        active="Schedule"
        title={t("tuesday")}
        actions={
          <span className="flex rounded-md border border-slate-200 text-[10px] font-medium">
            <span className="rounded-l-md bg-slate-100 px-2 py-0.5">{t("day")}</span>
            <span className="px-2 py-0.5 text-slate-500">{t("week")}</span>
          </span>
        }
      >
        <div className="flex">
          <div className="w-10 shrink-0">
            {["8 AM", "9 AM", "10 AM", "11 AM"].map((hour) => (
              <div
                key={hour}
                className="text-[9.5px] text-slate-400"
                style={{ height: HOUR_HEIGHT }}
              >
                {hour}
              </div>
            ))}
          </div>
          <div className="relative flex-1 border-l border-slate-100" style={{ height: HOUR_HEIGHT * 4 }}>
            {[0, 1, 2, 3].map((hour) => (
              <div key={hour}>
                <div
                  className="absolute left-0 right-0 border-t border-slate-100"
                  style={{ top: hour * HOUR_HEIGHT }}
                />
                <div
                  className="absolute left-0 right-0 border-t border-dashed border-slate-100"
                  style={{ top: hour * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                />
              </div>
            ))}
            {otherVisits(draft).map((visit) => (
              <ScheduleBlock key={visit.pet} visit={visit} />
            ))}
            {beat >= 4 ? <ScheduleBlock visit={fresh} fresh /> : null}
          </div>
        </div>
      </AppWindow>
      <Phone
        time="9:41"
        dark
        overlay={
          <PhoneOverlay
            on={beat >= 4}
            title={t("requestSent")}
            detail={
              <>
                Tue, 9:00 AM · {first}
                <br />
                {t("willConfirmShortly", { name })}
              </>
            }
          />
        }
      >
        <div className="space-y-2 p-2.5">
          <BookingHeader clinicName={name} logo={draft.logo} />
          <div className="rounded-xl bg-white p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
            <div className="mb-1 text-[10px] font-medium text-slate-600">
              {t("appointmentType")}
            </div>
            <div
              className={cn(
                "truncate rounded-md border px-2 py-1.5 text-[10.5px] transition-colors",
                beat >= 1 ? "border-[var(--b)] text-slate-900" : "border-slate-200 text-slate-400",
              )}
            >
              {beat >= 1 ? first : t("chooseAService")}
            </div>
            <div className="mb-1 mt-2.5 text-[10px] font-medium text-slate-600">
              {t("tuesday")}
            </div>
            <div className="grid grid-cols-3 gap-1">
              {["8:30", "9:00", "9:30", "1:00", "2:30", "4:00"].map((slot) => {
                const picked = slot === "9:00" && beat >= 2;
                return (
                  <span
                    key={slot}
                    className={cn(
                      "rounded-md border py-1 text-center text-[10px] transition-colors",
                      picked ? "border-[var(--b)] text-white" : "border-slate-200",
                    )}
                    style={picked ? { background: "var(--b)" } : undefined}
                  >
                    {slot}
                  </span>
                );
              })}
            </div>
            <motion.div
              className="mt-2.5 rounded-lg py-1.5 text-center text-[10.5px] font-semibold text-white"
              style={{ background: "var(--b)" }}
              animate={{ scale: beat === 3 ? 0.96 : 1 }}
            >
              {t("requestAppointment")}
            </motion.div>
          </div>
        </div>
      </Phone>
    </Stage>
  );
}

export function remindWin(draft: BuildState, t: ScenesT): StoryWin {
  const { owner } = sampleFor(draft);
  return {
    clientLabel: t("win.forName", { name: owner }),
    client: t("win.remind.client"),
    you: t("win.remind.you"),
  };
}


export function RemindStage({ draft, playId, still }: SceneProps) {
  const t = useTranslations("build.scenes");
  const beat = useBeats([500, 3000, 3500, 4200], playId, still);
  const clientReply = t("clientReply");
  const reply = useTyped(clientReply, 1500, playId, still, 1);
  const name = brandName(draft, t("yourClinic"));
  const sample = sampleFor(draft);
  const profile = BUILD_PRACTICE_PROFILES[draft.practiceType];
  const reminder = t("smsReminder", {
    owner: sample.owner,
    clinic: name,
    pet: sample.pet,
    visit: sample.visit.toLowerCase(),
  });
  const replied = beat >= 2;
  const threads = [
    {
      who: `${sample.owner} Lee`,
      text: beat >= 3 ? clientReply : t("visitTomorrow", { pet: sample.pet }),
      time: beat >= 3 ? "8:01 AM" : "8:00 AM",
      unread: beat >= 3,
    },
    { who: "Maria Chen", text: t("thanksSeeYouThursday"), time: "7:52 AM", unread: false },
    { who: "Jordan Brooks", text: t("couldWeMoveTo11"), time: t("mon"), unread: false },
  ];
  return (
    <Stage
      label={t("tuesday800Am")}
      icon={Sunrise}
      footer={<WinCards win={remindWin(draft, t)} show={beat >= 4} />}
    >
      <AppWindow
        clinicName={name}
        logo={draft.logo}
        modules={profile.modules}
        active="Inbox"
        title={t("inbox")}
      >
        <div className="mb-2.5 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-slate-200 px-2.5 py-2">
            <div className="text-[10px] text-slate-500">{t("remindersSent")}</div>
            <div className="mt-0.5 flex items-center justify-between">
              <b className="font-heading text-[14px]">12</b>
              <StatusPill label={t("sent")} tone="green" />
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 px-2.5 py-2">
            <div className="truncate text-[10px] text-slate-500">{sample.recall.split(" · ")[0]}</div>
            <div className="mt-0.5 flex items-center justify-between">
              <b className="font-heading text-[14px]">{sample.recall.split(" · ")[1]?.split(" ")[0]}</b>
              <StatusPill label={t("sending")} tone="brand" />
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          {threads.map((thread) => (
            <motion.div
              layout
              key={thread.who}
              className="flex items-center gap-2.5 border-b border-slate-100 px-2.5 py-2 last:border-b-0"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9.5px] font-semibold text-slate-600">
                {thread.who.split(" ").map((part) => part[0]).join("")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between text-[10.5px]">
                  <span className={thread.unread ? "font-semibold" : "font-medium"}>
                    {thread.who}
                  </span>
                  <span className="text-[9.5px] text-slate-400">{thread.time}</span>
                </span>
                <span
                  className={cn(
                    "block truncate text-[10.5px]",
                    thread.unread ? "text-slate-900" : "text-slate-500",
                  )}
                >
                  {thread.text}
                </span>
              </span>
              {thread.unread ? (
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: "var(--b)" }}
                />
              ) : null}
            </motion.div>
          ))}
        </div>
      </AppWindow>
      <Phone time="8:00">
        <div className="flex flex-col items-center gap-0.5 border-b border-slate-100 pb-1.5">
          <ClinicMark name={name} logo={draft.logo} size={26} className="rounded-full" />
          <span className="max-w-[150px] truncate text-[9.5px] font-medium">{name}</span>
        </div>
        <div className="flex flex-col gap-1.5 px-2.5 pt-2.5">
          <motion.div
            initial={false}
            animate={beat >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
            className="max-w-[86%] self-start rounded-2xl rounded-bl-md bg-slate-100 px-2.5 py-1.5 text-[10.5px] leading-[15px]"
          >
            {reminder}
          </motion.div>
          <motion.div
            initial={false}
            animate={replied ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
            className="max-w-[92%] self-end whitespace-nowrap rounded-2xl rounded-br-md bg-[#0a84ff] px-2.5 py-1.5 text-[10.5px] leading-[15px] text-white"
          >
            {clientReply}
          </motion.div>
        </div>
        <div className="absolute inset-x-2 bottom-2 flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1.5 text-[10.5px]">
          <span className={cn("flex-1 truncate", !reply.count || replied ? "text-slate-400" : "text-slate-900")}>
            {replied || !reply.count ? t("textMessage") : reply.shown}
          </span>
          <span
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded-full text-white transition-colors",
              reply.count && !replied ? "bg-[#0a84ff]" : "bg-slate-200",
            )}
            aria-hidden="true"
          >
            <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" fill="currentColor">
              <path d="M5 1.5 8.5 5H6v3.5H4V5H1.5z" />
            </svg>
          </span>
        </div>
      </Phone>
    </Stage>
  );
}

export function visitWin(draft: BuildState, t: ScenesT): StoryWin {
  const { pet } = sampleFor(draft);
  return {
    clientLabel: t("win.forName", { name: pet }),
    client: t("win.visit.client"),
    you: t("win.visit.you"),
  };
}

export function VisitStage({ draft, playId, still }: SceneProps) {
  const t = useTranslations("build.scenes");
  const sample = sampleFor(draft);
  const sections = sample.soap.map((line) => {
    const at = line.indexOf(": ");
    return at > 0
      ? { letter: line.slice(0, at), text: line.slice(at + 2) }
      : { letter: "", text: line };
  });
  const joined = sections.map((section) => section.text).join("\u0000");
  const typed = useTyped(joined, 900, playId, still);
  const parts = typed.shown.split("\u0000");
  const beat = useBeats([600, 5000, 5400, 5800, 6300, 6900], playId, still);
  const profile = BUILD_PRACTICE_PROFILES[draft.practiceType];
  const status =
    beat >= 5
      ? { label: t("readyForCheckout"), tone: "green" as const }
      : beat >= 1
        ? { label: t("inExam"), tone: "brand" as const }
        : { label: t("checkedIn"), tone: "amber" as const };
  const charges = sample.charges.slice(0, Math.max(0, beat - 1));
  const total = charges.reduce((sum, line) => sum + line.price, 0);
  return (
    <Stage
      label={t("tuesday900Am")}
      icon={Sun}
      footer={<WinCards win={visitWin(draft, t)} show={beat >= 6} />}
    >
      <AppWindow
        clinicName={brandName(draft, t("yourClinic"))}
        logo={draft.logo}
        modules={profile.modules}
        active="Records"
        title={sample.visit}
        actions={<StatusPill label={status.label} tone={status.tone} />}
        width={CANVAS_WIDTH}
      >
        <div className="mb-3 flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ background: "color-mix(in srgb, var(--b) 12%, white)", color: "var(--b)" }}
          >
            <PawPrint className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="text-[10.5px] leading-4">
            <div className="text-[12.5px] font-semibold">{sample.pet}</div>
            <div className="text-slate-500">
              {t(patientLine(draft.practiceType))} · {sample.owner} Lee
            </div>
          </div>
        </div>
        <div className="grid grid-cols-[1fr_168px] gap-3">
          <div className="rounded-lg border border-slate-200 p-2.5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-semibold">{t("soapNote")}</span>
              <span className="text-[9.5px] text-slate-500">
                {typed.done ? t("draftedForYouReviewTo") : t("draftingFromTheExam")}
              </span>
            </div>
            <div className="space-y-1.5">
              {sections.map((section, i) => (
                <div key={section.letter || i} className="flex gap-2 text-[10.5px] leading-[15px]">
                  <span className="w-3 shrink-0 font-semibold text-slate-400">
                    {section.letter}
                  </span>
                  <span className="min-h-[15px] text-slate-700">
                    {parts[i] ?? ""}
                    {!typed.done && parts.length - 1 === i ? (
                      <span
                        className="ml-px inline-block h-3 w-px translate-y-0.5 animate-pulse"
                        style={{ background: "var(--b)" }}
                      />
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col rounded-lg border border-slate-200 p-2.5">
            <span className="mb-1.5 text-[11px] font-semibold">{t("charges")}</span>
            {charges.map((line) => (
              <motion.div
                key={line.label}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-between border-b border-slate-100 py-1 text-[10.5px]"
              >
                <span className="truncate pr-2">{line.label}</span>
                <span className="tabular-nums">{money(line.price)}</span>
              </motion.div>
            ))}
            <div className="mt-auto flex justify-between pt-1.5 text-[11px] font-semibold">
              <span>{t("total")}</span>
              <span className="tabular-nums">{money(total)}</span>
            </div>
            <div
              className={cn(
                "mt-2 rounded-md py-1.5 text-center text-[10.5px] font-semibold transition-colors duration-300",
                beat >= 5 ? "text-white" : "bg-slate-100 text-slate-400",
              )}
              style={beat >= 5 ? { background: "var(--b)" } : undefined}
            >
              {t("sendToCheckout")}
            </div>
          </div>
        </div>
      </AppWindow>
    </Stage>
  );
}

const COLLECTED_BEFORE = 1092;

export function paidWin(draft: BuildState, t: ScenesT): StoryWin {
  const { owner } = sampleFor(draft);
  return {
    clientLabel: t("win.forName", { name: owner }),
    client: t("win.paid.client"),
    you: t("win.paid.you", { amount: money(sampleTotal(draft)) }),
  };
}

export function PaidStage({ draft, playId, still }: SceneProps) {
  const t = useTranslations("build.scenes");
  const beat = useBeats([1200, 1500, 2600], playId, still);
  const sample = sampleFor(draft);
  const total = sampleTotal(draft);
  const after = COLLECTED_BEFORE + total;
  const [collected, setCollected] = useState(still ? after : COLLECTED_BEFORE);
  useEffect(() => {
    if (beat < 2) {
      setCollected(still ? after : COLLECTED_BEFORE);
      return;
    }
    let value = COLLECTED_BEFORE;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      value = Math.min(after, value + Math.max(1, Math.round(total / 18)));
      setCollected(value);
      if (value < after) timer = setTimeout(step, 16);
    };
    step();
    return () => clearTimeout(timer);
  }, [beat, still, after, total]);

  const name = brandName(draft, t("yourClinic"));
  const profile = BUILD_PRACTICE_PROFILES[draft.practiceType];
  const paid = beat >= 2;
  const invoices = [
    { id: "#1042", who: `${sample.owner} Lee`, amount: total, paid },
    { id: "#1041", who: "Maria Chen", amount: 86, paid: true },
    { id: "#1040", who: "Jordan Brooks", amount: 412, paid: true },
  ];
  return (
    <Stage
      label={t("tuesday942Am")}
      icon={Sun}
      footer={<WinCards win={paidWin(draft, t)} show={beat >= 3} />}
    >
      <AppWindow
        clinicName={name}
        logo={draft.logo}
        modules={profile.modules}
        active="Billing"
        title={t("billing")}
      >
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-slate-200 px-2.5 py-2">
            <div className="text-[10px] text-slate-500">{t("collectedToday")}</div>
            <div className="font-heading text-[17px] font-semibold tabular-nums">
              ${collected.toLocaleString("en-US")}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 px-2.5 py-2">
            <div className="text-[10px] text-slate-500">{t("openInvoices")}</div>
            <div className="font-heading text-[17px] font-semibold tabular-nums">
              {paid ? 0 : 1}
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <div className="grid grid-cols-[36px_1fr_44px_56px] gap-1.5 border-b border-slate-100 bg-slate-50 px-2.5 py-1.5 text-[9.5px] font-medium text-slate-500">
            <span>{t("invoice")}</span>
            <span>{t("client")}</span>
            <span className="text-right">{t("total")}</span>
            <span>{t("status")}</span>
          </div>
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="grid grid-cols-[44px_1fr_56px_76px] items-center gap-2 border-b border-slate-100 px-2.5 py-2 text-[10.5px] last:border-b-0"
            >
              <span className="text-slate-500">{invoice.id}</span>
              <span className="truncate">{invoice.who}</span>
              <span className="text-right tabular-nums">{money(invoice.amount)}</span>
              <StatusPill
                label={invoice.paid ? t("paid") : t("open")}
                tone={invoice.paid ? "green" : "amber"}
              />
            </div>
          ))}
        </div>
      </AppWindow>
      <Phone
        time="9:42"
        dark
        overlay={
          <PhoneOverlay
            on={paid}
            title={t("paidAmount", { amount: money(total) })}
            detail={t("receiptSent", { owner: sample.owner })}
          />
        }
      >
        <PortalHeader clinicName={name} logo={draft.logo} />
        <div className="p-2.5">
          <div className="rounded-lg border border-slate-200 bg-white p-2.5">
            <div className="flex items-baseline justify-between">
              <b className="text-[11.5px]">{t("invoice1042")}</b>
              <span className="text-[9.5px] text-slate-500">{t("today")}</span>
            </div>
            <div className="mb-1.5 text-[10px] text-slate-500">
              {sample.pet} · {sample.visit}
            </div>
            {sample.charges.map((line) => (
              <div
                key={line.label}
                className="flex justify-between border-b border-slate-100 py-1 text-[10.5px]"
              >
                <span className="truncate pr-2">{line.label}</span>
                <span className="tabular-nums">{money(line.price)}</span>
              </div>
            ))}
            <div className="mt-1.5 flex justify-between text-[11px] font-semibold">
              <span>{t("total")}</span>
              <span className="tabular-nums">{money(total)}</span>
            </div>
          </div>
          <motion.div
            className="mt-2.5 rounded-lg py-2 text-center text-[11px] font-semibold text-white"
            style={{ background: "var(--b)" }}
            animate={{ scale: beat === 1 ? 0.96 : 1 }}
          >
            {t("payAmount", { amount: money(total) })}
          </motion.div>
        </div>
      </Phone>
    </Stage>
  );
}

// ---------------------------------------------------------------------------
// 8. Records and fit
// ---------------------------------------------------------------------------

export interface ScenePoint {
  icon: LucideIcon;
  text: string;
}

/** A scene's benefits, one short line each, with an icon in the brand color. */
export function ScenePoints({ points }: { points: ScenePoint[] }) {
  return (
    <ul className="space-y-3">
      {points.map(({ icon: Icon, text }) => (
        <li key={text} className="flex items-center gap-3 text-[15px] text-slate-700">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-500"
            style={{
              background: "color-mix(in srgb, var(--b) 10%, white)",
              color: "var(--b)",
            }}
            aria-hidden="true"
          >
            <Icon className="h-4 w-4" />
          </span>
          {text}
        </li>
      ))}
    </ul>
  );
}

/** Under the records scene: we build fast, and we build what clinics ask for. */
export function RecordsPromise() {
  const t = useTranslations("build.scenes");
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
        <Rocket className="h-4 w-4" style={{ color: "var(--b)" }} aria-hidden="true" />
        {t("weShipNewFeaturesEvery")}
      </p>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        {t.rich("missingSomething", {
          email: (chunks) => (
            <a
              href="mailto:support@openvpm.com?subject=Something%20I%20need%20in%20OpenVPM"
              className="font-medium underline underline-offset-4"
              style={{ color: "var(--b)" }}
            >
              {chunks}
            </a>
          ),
        })}
      </p>
    </div>
  );
}

export function RecordsStage({ draft, playId, still }: SceneProps) {
  const t = useTranslations("build.scenes");
  const beat = useBeats([400, 900, 1400, 1900, 2400], playId, still);
  const profile = BUILD_PRACTICE_PROFILES[draft.practiceType];
  const fromPaper = isFromPaper(draft);
  const source = BUILD_SYSTEM_LABELS[draft.currentSystem];
  const file = fromPaper
    ? { name: "clients-and-pets.csv", size: "380 KB" }
    : { name: `${draft.currentSystem}-export.zip`, size: "48 MB" };
  const rows: Array<{ label: string; count: string; note: string }> = fromPaper
    ? [
        { label: t("clients"), count: "1,248", note: t("allMatched") },
        { label: t("patients"), count: "2,031", note: t("allMatched") },
        { label: t("vaccineHistory"), count: "3,904", note: "12 to review" },
      ]
    : [
        { label: t("clients"), count: "1,248", note: t("allMatched") },
        { label: t("patients"), count: "2,031", note: t("allMatched") },
        { label: t("vaccineHistory"), count: "9,412", note: "38 to review" },
        { label: t("visitNotes"), count: "6,880", note: t("attachedToCharts") },
      ];
  return (
    <Stage
      label={t("yourImportBeforeAnythingIs")}
      footer={
        <Caption>
          <CaptionItem>{t("nothingIsSavedUntilYou")}</CaptionItem>
          <CaptionItem>{t("yourCurrentSystemStaysIn")}</CaptionItem>
        </Caption>
      }
    >
      <AppWindow
        clinicName={brandName(draft, t("yourClinic"))}
        logo={draft.logo}
        modules={profile.modules}
        active="Clients"
        title={fromPaper ? t("importASpreadsheet") : t("importFrom", { source })}
        width={CANVAS_WIDTH}
        actions={
          <span
            className={cn(
              "rounded-md px-2.5 py-1 text-[10.5px] font-semibold transition-colors duration-300",
              beat >= rows.length + 1 ? "text-white" : "bg-slate-100 text-slate-400",
            )}
            style={beat >= rows.length + 1 ? { background: "var(--b)" } : undefined}
          >
            {t("reviewImport")}
          </span>
        }
      >
        <div className="mb-3 flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2">
          <FileSpreadsheet className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <span className="text-[11px] font-medium">{file.name}</span>
          <span className="text-[10px] text-slate-400">{file.size}</span>
          <span className="ml-auto">
            <StatusPill
              label={beat >= rows.length + 1 ? t("read") : t("reading")}
              tone={beat >= rows.length + 1 ? "green" : "amber"}
            />
          </span>
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <div className="grid grid-cols-[1fr_64px_120px_104px] gap-3 border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[9.5px] font-medium text-slate-500">
            <span>{t("records")}</span>
            <span className="text-right">{t("found")}</span>
            <span>{t("progress")}</span>
            <span>{t("status")}</span>
          </div>
          {rows.map((row, i) => {
            const done = beat > i;
            return (
              <div
                key={row.label}
                className="grid grid-cols-[1fr_64px_120px_104px] items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-[10.5px] last:border-b-0"
              >
                <span className="font-medium">{row.label}</span>
                <span className="text-right tabular-nums text-slate-600">
                  {done ? row.count : "—"}
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <motion.span
                    className="block h-full rounded-full"
                    style={{ background: "var(--b)" }}
                    initial={false}
                    animate={{ width: done ? "100%" : "0%" }}
                    transition={{ duration: still ? 0 : 0.45, ease: "easeOut" }}
                  />
                </span>
                <span className="truncate text-slate-500">{done ? row.note : t("waiting")}</span>
              </div>
            );
          })}
        </div>
      </AppWindow>
    </Stage>
  );
}

// ---------------------------------------------------------------------------
// 9. The gate: what's waiting inside
// ---------------------------------------------------------------------------

/** The gate's case for starting today: everything the plan includes. */
export function GateSummary({ draft }: SceneProps) {
  const t = useTranslations("build.scenes");
  const offered = draft.services.filter((service) => service.on).length;
  const included: ScenePoint[] = [
    { icon: Users, text: t("unlimitedStaffWithNoPer") },
    { icon: CalendarCheck, text: t("onlineBookingRemindersAndA") },
    { icon: FileText, text: t("aiDraftedSoapNotesYou") },
    { icon: CreditCard, text: t("cardPaymentsStraightToYour") },
    {
      icon: LifeBuoy,
      text: isFromPaper(draft)
        ? t("helpImportingYourClientsAnd")
        : t("helpMovingFrom", { system: BUILD_SYSTEM_LABELS[draft.currentSystem] }),
    },
    { icon: Rocket, text: t("newFeaturesEveryWeekAt") },
  ];
  return (
    <div>
      <p className="mb-3 text-sm font-medium text-slate-700">{t("everythingIncluded")}</p>
      <ScenePoints points={included} />
      <p className="mt-6 border-t border-slate-100 pt-4 text-sm leading-6 text-slate-500">
        {t("alreadySetUp", { logo: draft.logo ? "yes" : "no", count: offered, slug: bookingSlug(draft) })}
      </p>
    </div>
  );
}
