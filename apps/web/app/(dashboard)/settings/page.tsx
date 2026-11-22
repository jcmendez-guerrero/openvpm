"use client";

import { useTranslations, useLocale } from "use-intl";

import { ImportRowIssues } from "@/components/settings/import-row-issues";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import {
  Settings,
  Users,
  Calendar,
  DoorOpen,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Database,
  Download,
  Upload,
  FileSpreadsheet,
  Check,
  AlertTriangle,
  Layers,
  CreditCard,
  ImageIcon,
  Mail,
  Copy,
  MessageSquare,
  Globe,
  MapPin,
  Star,
  HeartPulse,
  Compass,
  ReceiptText,
  LockOpen,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/common/empty-state";
import { AccentColorPicker } from "@/components/brand/accent-color-picker";
import { MessagingTab } from "@/components/settings/messaging-tab";
import { BookingTab } from "@/components/settings/booking-tab";
import { ClinicLanguageField } from "@/components/settings/clinic-language-field";
import { ProviderHours } from "@/components/settings/provider-hours";
import { useMigrationCopy } from "@/lib/import/use-migration-copy";
import { MigrationHelpRequest } from "@/components/onboarding/migration-help-request";
import { ServicesTab } from "@/components/settings/services-tab";
import { AmbulatoryWorkspaceSettingsCard } from "@/components/settings/ambulatory-workspace-settings";
import {
  TemplateCatalogPicker,
  type TemplateCatalogItem,
} from "@/components/templates/catalog-picker";
import { useWelcome } from "@/components/welcome/welcome-provider";
import { cn, isValidEmail } from "@/lib/utils";
import { toast } from "sonner";
import { regionDefaults } from "@/lib/locale/format";
import {
  supportsInvoiceCardCurrency,
  UNSUPPORTED_INVOICE_CARD_CURRENCY_MESSAGE,
} from "@/lib/billing/invoice-card-currency";
import {
  CLINIC_REGION_OPTIONS,
  CLINIC_TIMEZONES,
  isClinicRegionCode,
  type ClinicRegionCode,
} from "@/lib/locale/clinic-regions";
import { useCurrencyFormatter } from "@/lib/locale/useCurrency";
import { formatDateInputForTimeZone } from "@/lib/date-input";
import { isSafeCheckoutRedirectUrl } from "@/lib/checkout-redirect";
import { TRIAL_DAYS } from "@/lib/billing/plans";
import { trialCalendarDaysLeft } from "@/lib/billing/trial-days";
import { CloudBillingCadencePicker } from "@/components/billing/cloud-billing-cadence-picker";
import {
  billingCadenceFromQuery,
  type BillingCadence,
} from "@/lib/billing/catalog";
import {
  PRACTICE_BACKUP_JSON_MAX_BYTES,
  isPracticeBackupJsonSizeValid,
} from "@/lib/backup/policy";
import {
  isWellnessPlanPriceInputValid,
  WELLNESS_PLAN_DESCRIPTION_MAX_LENGTH,
  WELLNESS_PLAN_NAME_MAX_LENGTH,
  WELLNESS_PLAN_PRICE_MAX,
  WELLNESS_PLAN_PRICE_MIN,
  WELLNESS_PLAN_PRICE_SCALE,
} from "@/lib/wellness/policy";
import {
  isTreatmentTemplateItemTotalValid,
  isTreatmentTemplateQuantityValid,
  isTreatmentTemplateUnitPriceInputValid,
  TREATMENT_TEMPLATE_DESCRIPTION_MAX_LENGTH,
  TREATMENT_TEMPLATE_ITEM_DESCRIPTION_MAX_LENGTH,
  TREATMENT_TEMPLATE_ITEM_QUANTITY_MAX,
  TREATMENT_TEMPLATE_ITEM_QUANTITY_MIN,
  TREATMENT_TEMPLATE_MAX_ITEMS,
  TREATMENT_TEMPLATE_NAME_MAX_LENGTH,
  TREATMENT_TEMPLATE_UNIT_PRICE_MAX,
} from "@/lib/templates/policy";
import {
  CLIENT_UPLOAD_TIMEOUT_MS,
  fetchWithClientTimeout,
} from "@/lib/client-fetch";
import {
  IMAGE_UPLOAD_POLICY_MESSAGE,
  isImageUploadFileValid,
} from "@/lib/upload-policy";
import {
  selectManagedUploadFile,
  settleManagedUploadAttempt,
  type ManagedUploadAttempt,
} from "@/lib/managed-upload-attempt";
import {
  IMPORT_CSV_MAX_BYTES,
  isImportCsvSizeValid,
} from "@/lib/import/policy";
import {
  MIGRATION_SOURCES,
  MIGRATION_STEPS,
  type MigrationImportMode,
} from "@/lib/import/sources";
import {
  AUTH_PASSWORD_MAX_LENGTH,
  AUTH_PASSWORD_MIN_LENGTH,
} from "@/lib/auth-password-policy";
import {
  ACCOUNT_DELETION_REASON_MAX_LENGTH,
  APPOINTMENT_TYPE_DURATION_MAX_MINUTES,
  APPOINTMENT_TYPE_DURATION_MIN_MINUTES,
  APPOINTMENT_TYPE_NAME_MAX_LENGTH,
  LOCATION_NAME_MAX_LENGTH,
  PRACTICE_NAME_MAX_LENGTH,
  ROOM_NAME_MAX_LENGTH,
  SETTINGS_ADDRESS_MAX_LENGTH,
  SETTINGS_EMAIL_MAX_LENGTH,
  SETTINGS_PHONE_MAX_LENGTH,
  SETTINGS_VAT_NUMBER_MAX_LENGTH,
  SETTINGS_WEBSITE_MAX_LENGTH,
  STAFF_LICENSE_NUMBER_MAX_LENGTH,
  STAFF_NAME_MAX_LENGTH,
  isValidSettingsTaxRate,
  isSupportedPracticeTimezone,
} from "@/lib/settings-policy";
import { downloadCsv, recordsToCsv } from "@/lib/csv/serialize";

// ── Types ───────────────────────────────────────────────────
type Tab =
  | "practice"
  | "locations"
  | "staff"
  | "appointmentTypes"
  | "rooms"
  | "services"
  | "data"
  | "templates"
  | "wellness"
  | "messaging"
  | "booking"
  | "billing";

// Labels are catalog keys: settings.page.tabs.<id>.
const tabs: { id: Tab; icon: React.ElementType }[] = [
  { id: "practice", icon: Settings },
  { id: "locations", icon: MapPin },
  { id: "staff", icon: Users },
  { id: "appointmentTypes", icon: Calendar },
  { id: "rooms", icon: DoorOpen },
  { id: "services", icon: ReceiptText },
  { id: "data", icon: Database },
  { id: "templates", icon: Layers },
  { id: "wellness", icon: HeartPulse },
  { id: "messaging", icon: MessageSquare },
  { id: "booking", icon: Globe },
  { id: "billing", icon: CreditCard },
];

const CURRENCIES = ["usd", "gbp", "eur", "cad", "aud", "jpy", "mxn"];

const PRESET_COLORS = [
  "#0d9488",
  "#dc2626",
  "#2563eb",
  "#7c3aed",
  "#ea580c",
  "#16a34a",
  "#f59e0b",
  "#6b7280",
];

// Accent swatches now live in the shared <AccentColorPicker /> (presets +
// custom hex), reused by Settings and the onboarding journey.

const ROLE_BADGE: Record<string, string> = {
  admin:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  veterinarian:
    "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
  technician:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  front_desk:
    "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  viewer:
    "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400",
};

const ROOM_TYPES = ["exam", "surgery", "treatment", "boarding"] as const;

/** Translated room type, falling back to the stored value for unknown types. */
function useRoomTypeLabel() {
  const t = useTranslations("settings.page");
  return (value: string) =>
    (ROOM_TYPES as readonly string[]).includes(value)
      ? t(`roomTypes.${value}`)
      : value;
}

type PracticeInfoForm = {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  timezone: string;
  country: ClinicRegionCode | "";
  currency: string;
  taxRatePercent: string;
  vatNumber: string;
};

function formatSettingsDateTime(
  value: Date | string | null | undefined,
  timeZone?: string | null,
  locale = "en-US",
): string {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  };
  const resolvedTimeZone = timeZone?.trim() || "UTC";

  try {
    return new Intl.DateTimeFormat(locale, {
      ...options,
      timeZone: resolvedTimeZone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(locale, {
      ...options,
      timeZone: "UTC",
    }).format(date);
  }
}

function formatSettingsDateInput(
  value: Date = new Date(),
  timeZone?: string | null,
): string {
  return formatDateInputForTimeZone(value, timeZone?.trim() || "UTC");
}

function requireSettingsExportData<T>(
  result: { data?: T; error?: { message?: string } | null },
  fallbackMessage: string,
): T {
  if (result.error) {
    throw new Error(result.error.message || fallbackMessage);
  }

  if (result.data === undefined) {
    throw new Error(fallbackMessage);
  }

  return result.data;
}

function SettingsLoadError({
  message,
  title,
  onRetry,
}: {
  message: string;
  title?: string;
  onRetry?: () => void;
}) {
  const t = useTranslations("settings.page");
  return (
    <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">{title ?? t("couldNotLoadSettings")}</p>
          <p className="mt-1">{message}</p>
          {onRetry ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="mt-3"
            >
              {t("retry")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TrustedProxyNotice() {
  const t = useTranslations("settings.page");
  const notices = trpc.settings.deploymentNotices.useQuery(undefined, {
    staleTime: Infinity,
  });
  const data = notices.data;
  if (!data?.trustedProxyHopsMissing && !data?.proxyNotForwarding) return null;
  return (
    <div className="mt-4 flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        {data.proxyNotForwarding ? (
          <>
            <p className="font-medium">
              {t("proxy.notForwardingTitle")}
            </p>
            <p className="mt-1">
              {t.rich("proxy.notForwardingBody", {
                source: data.proxyNotForwarding.address
                  ? t("proxy.internalAddress", {
                      address: data.proxyNotForwarding.address,
                    })
                  : t("proxy.noClientAddress"),
                code: (chunks) => <code>{chunks}</code>,
              })}
            </p>
          </>
        ) : (
          <>
            <p className="font-medium">{t("reverseProxyNotConfigured")}</p>
            <p className="mt-1">
              {t.rich("proxy.notConfiguredBody", {
                code: (chunks) => <code>{chunks}</code>,
              })}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────
export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const t = useTranslations("settings.page");
  const { data: session, status } = useSession();
  const { openWelcome } = useWelcome();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "practice";
  const [activeTab, setActiveTab] = useState<Tab>(
    tabs.some((t) => t.id === initialTab) ? initialTab : "practice",
  );

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("checkingSettingsAccess")}
      </div>
    );
  }

  if (session?.user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="font-heading text-xl font-semibold">{t("accessDenied")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("onlyAdministratorsCanAccessPractice")}
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full max-w-full overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-xl font-semibold">{t("settings")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("practiceConfigurationAndStaffManagement")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          data-tour="settings-guides"
          onClick={openWelcome}
        >
          <Compass className="mr-2 h-4 w-4" />
          {t("guides")}
        </Button>
      </div>

      <TrustedProxyNotice />

      <div className="mt-6 flex min-w-0 w-full max-w-full flex-col gap-6 lg:flex-row lg:gap-8">
        {/* Section nav: horizontal scroll on small screens, vertical on lg+ */}
        <nav
          className="min-w-0 max-w-full overflow-hidden lg:w-56 lg:shrink-0"
          aria-label={t("settingsSections")}
        >
          <div className="flex w-full max-w-full gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    activeTab === tab.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {t(`tabs.${tab.id}`)}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Tab content */}
        <div className="min-w-0 w-full max-w-full flex-1">
          {activeTab === "practice" && <PracticeInfoTab />}
          {activeTab === "locations" && <LocationsTab />}
          {activeTab === "staff" && <StaffTab />}
          {activeTab === "appointmentTypes" && <AppointmentTypesTab />}
          {activeTab === "rooms" && <RoomsTab />}
          {activeTab === "services" && <ServicesTab />}
          {activeTab === "data" && <DataTab />}
          {activeTab === "templates" && <TemplatesTab />}
          {activeTab === "wellness" && <WellnessPlansTab />}
          {activeTab === "messaging" && <MessagingTab />}
          {activeTab === "booking" && <BookingTab />}
          {activeTab === "billing" && <BillingTab />}
        </div>
      </div>
    </div>
  );
}

// ── Practice Info ───────────────────────────────────────────
function PracticeInfoTab() {
  const t = useTranslations("settings.page");
  const locale = useLocale();
  const regionNames = new Intl.DisplayNames([locale], { type: "region" });
  const utils = trpc.useUtils();
  const {
    data: practice,
    isLoading,
    error: practiceError,
  } = trpc.settings.getPractice.useQuery();
  const {
    data: marketingEmailPreference,
    isLoading: marketingEmailPreferenceLoading,
    isFetching: marketingEmailPreferenceRefreshing,
    error: marketingEmailPreferenceError,
    refetch: refetchMarketingEmailPreference,
  } = trpc.settings.getMarketingEmailPreference.useQuery();
  const updateMutation = trpc.settings.updatePractice.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.settings.getPractice.invalidate(),
        utils.settings.getMarketingEmailPreference.invalidate(),
      ]);
      toast.success(t("practiceInfoUpdated"));
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Branding mutation invalidates getBranding too so the sidebar logo/accent
  // refresh without a reload.
  const brandingMutation = trpc.settings.updatePractice.useMutation({
    onSuccess: () => {
      utils.settings.getPractice.invalidate();
      utils.settings.getBranding.invalidate();
      toast.success(t("brandingUpdated"));
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const marketingEmailMutation =
    trpc.settings.setMarketingEmailPreference.useMutation({
      onSuccess: (preference) => {
        utils.settings.getMarketingEmailPreference.invalidate();
        toast.success(
          preference.enabled
            ? t("optionalOpenvpmEmailsTurnedOn")
            : t("optionalOpenvpmEmailsTurnedOff"),
        );
      },
      onError: (err) => toast.error(err.message),
    });

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoUploadAttemptRef = useRef<ManagedUploadAttempt | null>(null);

  const handleLogoUpload = async (selectedFile?: File) => {
    if (selectedFile && !isImageUploadFileValid(selectedFile)) {
      logoUploadAttemptRef.current = null;
      setLogoUploadError(null);
      toast.error(IMAGE_UPLOAD_POLICY_MESSAGE);
      return;
    }

    if (selectedFile) {
      logoUploadAttemptRef.current = selectManagedUploadFile(
        logoUploadAttemptRef.current,
        selectedFile,
      );
    }
    const attempt = logoUploadAttemptRef.current;
    if (!attempt) return;

    setUploadingLogo(true);
    setLogoUploadError(null);
    try {
      const body = new FormData();
      body.append("file", attempt.file);
      body.append("category", "branding");
      const res = await fetchWithClientTimeout(
        "/api/upload",
        {
          method: "POST",
          body,
          headers: { "Idempotency-Key": attempt.idempotencyKey },
        },
        CLIENT_UPLOAD_TIMEOUT_MS,
      );
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        logoUploadAttemptRef.current = settleManagedUploadAttempt(attempt, {
          kind: "response",
          status: res.status,
        });
        throw new Error(json.error ?? t("uploadFailed"));
      }
      logoUploadAttemptRef.current = settleManagedUploadAttempt(attempt, {
        kind: "success",
      });
      await Promise.all([
        utils.settings.getPractice.invalidate(),
        utils.settings.getBranding.invalidate(),
      ]);
      toast.success(t("logoSaved"));
    } catch (err) {
      if (logoUploadAttemptRef.current === attempt) {
        logoUploadAttemptRef.current = settleManagedUploadAttempt(attempt, {
          kind: "ambiguous",
        });
      }
      const message = err instanceof Error ? err.message : t("uploadFailed");
      setLogoUploadError(message);
      toast.error(message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const [form, setForm] = useState<PracticeInfoForm | null>(null);
  const isOptionalSettingsEmailValid = (email: string) =>
    email.trim().length === 0 ||
    (email.trim().length <= SETTINGS_EMAIL_MAX_LENGTH &&
      isValidEmail(email.trim()));
  const isPracticeInfoFormValid = (practiceForm: PracticeInfoForm) =>
    practiceForm.name.trim().length > 0 &&
    practiceForm.name.trim().length <= PRACTICE_NAME_MAX_LENGTH &&
    practiceForm.address.trim().length <= SETTINGS_ADDRESS_MAX_LENGTH &&
    practiceForm.phone.trim().length <= SETTINGS_PHONE_MAX_LENGTH &&
    isOptionalSettingsEmailValid(practiceForm.email) &&
    practiceForm.website.trim().length <= SETTINGS_WEBSITE_MAX_LENGTH &&
    isSupportedPracticeTimezone(practiceForm.timezone) &&
    isClinicRegionCode(practiceForm.country) &&
    isValidSettingsTaxRate(practiceForm.taxRatePercent) &&
    practiceForm.vatNumber.trim().length <= SETTINGS_VAT_NUMBER_MAX_LENGTH;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (practiceError) {
    return <SettingsLoadError message={practiceError.message} />;
  }
  if (!practice) {
    return (
      <EmptyState
        icon={Settings}
        title={t("practiceSettingsUnavailable")}
        description={t("thePracticeProfileCouldNot")}
      />
    );
  }

  const currentBrandColor =
    (practice.settings as { brandColor?: string } | null)?.brandColor ?? null;

  // Initialize form from the verified practice profile. Nullable profile fields
  // still get editable display defaults, but a missing profile never builds a
  // blank form.
  const current: PracticeInfoForm = form ?? {
    name: practice.name ?? "",
    address: practice.address ?? "",
    phone: practice.phone ?? "",
    email: practice.email ?? "",
    website: practice.website ?? "",
    timezone: practice.timezone ?? "America/New_York",
    country:
      practice.jurisdictionConfirmed &&
      practice.country &&
      isClinicRegionCode(practice.country)
        ? practice.country
        : "",
    currency: practice.currency ?? "usd",
    taxRatePercent: practice.taxRatePercent ?? "8.00",
    vatNumber: practice.vatNumber ?? "",
  };

  const handleChange = (field: string, value: string) => {
    setForm({ ...current, [field]: value });
  };

  // Changing country prefills sensible currency/tax/timezone defaults for that
  // region; the admin can still override any of them before saving.
  const handleCountryChange = (country: string) => {
    if (!isClinicRegionCode(country)) return;
    const d = regionDefaults(country);
    setForm({
      ...current,
      country,
      currency: d.currency,
      taxRatePercent: d.taxRatePercent,
      timezone: d.timezone,
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        {/* ── Practice details ── */}
        <div className="space-y-6 rounded-lg border border-border bg-card p-6">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">{t("practiceDetails")}</h3>
            <p className="text-xs text-muted-foreground">
              {t("yourPracticeNameContactInfo")}
            </p>
          </div>
          <div className="grid gap-4">
            <label className="space-y-1.5">
              <span className="text-sm font-medium">{t("practiceName")}</span>
              <Input
                maxLength={PRACTICE_NAME_MAX_LENGTH}
                value={current.name}
                onChange={(e) => handleChange("name", e.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">{t("address")}</span>
              <Input
                maxLength={SETTINGS_ADDRESS_MAX_LENGTH}
                value={current.address}
                onChange={(e) => handleChange("address", e.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="space-y-1.5">
                <span className="text-sm font-medium">{t("phone")}</span>
                <Input
                  maxLength={SETTINGS_PHONE_MAX_LENGTH}
                  value={current.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">{t("email")}</span>
                <Input
                  type="email"
                  maxLength={SETTINGS_EMAIL_MAX_LENGTH}
                  value={current.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                />
              </label>
            </div>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">{t("website")}</span>
              <Input
                maxLength={SETTINGS_WEBSITE_MAX_LENGTH}
                value={current.website}
                onChange={(e) => handleChange("website", e.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">{t("timezone")}</span>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={current.timezone}
                onChange={(e) => handleChange("timezone", e.target.value)}
              >
                {CLINIC_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* ── Region & Tax ── */}
        <div className="space-y-6 rounded-lg border border-border bg-card p-6">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">{t("regionTax")}</h3>
            <p className="text-xs text-muted-foreground">
              {t("controlsInvoiceCurrencyTaxRate")}
            </p>
            {!supportsInvoiceCardCurrency(current.currency) ? (
              <p className="text-xs text-muted-foreground" role="status">
                {UNSUPPORTED_INVOICE_CARD_CURRENCY_MESSAGE}
              </p>
            ) : null}
          </div>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <label className="space-y-1.5">
                <span className="text-sm font-medium">{t("country")}</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={current.country}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  required
                >
                  <option value="">{t("chooseYourClinicCountry")}</option>
                  {CLINIC_REGION_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {regionNames.of(c.code) ?? c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">{t("currency")}</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={current.currency}
                  onChange={(e) => handleChange("currency", e.target.value)}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="space-y-1.5">
                <span className="text-sm font-medium">{t("taxVatRate")}</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={current.taxRatePercent}
                  onChange={(e) =>
                    handleChange("taxRatePercent", e.target.value)
                  }
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">
                  {t("vatNumberOptional")}
                </span>
                <Input
                  maxLength={SETTINGS_VAT_NUMBER_MAX_LENGTH}
                  value={current.vatNumber}
                  onChange={(e) => handleChange("vatNumber", e.target.value)}
                />
              </label>
            </div>
            <ClinicLanguageField />
          </div>
        </div>

        {/* ── Branding ── */}
        <div className="space-y-6 rounded-lg border border-border bg-card p-6">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">{t("branding")}</h3>
            <p className="text-xs text-muted-foreground">
              {t("yourLogoAndAccentColor")}
            </p>
          </div>
          <div className="grid gap-5">
            {/* Logo */}
            <div className="space-y-2">
              <span className="text-sm font-medium">{t("logo")}</span>
              <div className="flex items-center gap-4">
                {practice.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={practice.logoUrl}
                    alt={t("practiceLogo")}
                    className="h-14 w-14 rounded-lg border border-border object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                )}
                <div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoUpload(file);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploadingLogo || brandingMutation.isPending}
                    onClick={() => logoInputRef.current?.click()}
                  >
                    {uploadingLogo ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    {practice.logoUrl ? t("replaceLogo") : t("uploadLogo")}
                  </Button>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {t("pngJpgOrWebpSquare")}
                  </p>
                  {logoUploadError ? (
                    <div className="mt-2 flex items-center gap-2 text-xs text-destructive">
                      <span>{logoUploadError}</span>
                      {logoUploadAttemptRef.current ? (
                        <button
                          type="button"
                          disabled={uploadingLogo}
                          onClick={() => void handleLogoUpload()}
                          className="font-medium underline underline-offset-2 disabled:opacity-50"
                        >
                          {t("tryAgain")}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Accent color */}
            <div className="space-y-2">
              <span className="text-sm font-medium">{t("accentColor")}</span>
              <AccentColorPicker
                value={currentBrandColor}
                onChange={(c) => brandingMutation.mutate({ brandColor: c })}
                disabled={brandingMutation.isPending}
              />
            </div>
          </div>
        </div>

        {/* ── OpenVPM email preferences ── */}
        <div className="space-y-5 rounded-lg border border-border bg-card p-6">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">{t("emailsFromOpenvpm")}</h3>
            <p className="text-xs text-muted-foreground">
              {t("controlsOptionalEmailOpenvpmSends")}
            </p>
          </div>

          {marketingEmailPreferenceError ? (
            <div className="space-y-3" role="alert">
              <p className="text-sm text-destructive">
                {t("emailPreferenceLoadError")}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void refetchMarketingEmailPreference()}
              >
                {t("tryAgain")}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3">
                <Checkbox
                  checked={marketingEmailPreference?.enabled ?? true}
                  disabled={
                    marketingEmailPreferenceLoading ||
                    marketingEmailPreferenceRefreshing ||
                    updateMutation.isPending ||
                    marketingEmailMutation.isPending ||
                    marketingEmailPreference?.configurable === false
                  }
                  aria-describedby="marketing-email-preference-description"
                  onChange={(event) =>
                    marketingEmailMutation.mutate({
                      enabled: event.currentTarget.checked,
                    })
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {t("productGuidanceAndFeedback")}
                  </span>
                  <span
                    id="marketing-email-preference-description"
                    className="mt-1 block text-xs leading-5 text-muted-foreground"
                  >
                    {t("occasionalSetupTipsProductUpdates")}
                    {marketingEmailPreference?.recipientEmail
                      ? ` to ${marketingEmailPreference.recipientEmail}`
                      : ""}
                    .
                  </span>
                </span>
                {marketingEmailPreferenceLoading ||
                marketingEmailPreferenceRefreshing ||
                marketingEmailMutation.isPending ? (
                  <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-muted-foreground" />
                ) : null}
              </label>

              {marketingEmailMutation.isError ? (
                <p className="text-xs text-destructive" role="alert">
                  {marketingEmailMutation.error.message}
                </p>
              ) : marketingEmailMutation.isSuccess &&
                marketingEmailMutation.data.recipientEmail ===
                  marketingEmailPreference?.recipientEmail &&
                marketingEmailMutation.data.enabled ===
                  marketingEmailPreference?.enabled ? (
                <p className="text-xs text-emerald-700" role="status">
                  {marketingEmailMutation.data.enabled
                    ? t("optionalOpenvpmEmailsAreOn")
                    : t("optionalOpenvpmEmailsAreOff")}
                </p>
              ) : null}

              <div className="rounded-md bg-muted/50 p-3">
                <p className="text-sm font-medium">
                  {t("accountSecurityAndBillingEmail")}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {t("requiredForSignInReceipts")}
                </p>
              </div>

              {marketingEmailPreference?.configurable === false ? (
                <p className="text-xs text-amber-700" role="status">
                  {t("addAPracticeEmailAbove")}
                </p>
              ) : null}
            </div>
          )}
        </div>

        <AmbulatoryWorkspaceSettingsCard
          settings={practice.settings}
          rolloutEnabled={practice.ambulatoryWorkspaceRolloutEnabled === true}
        />
      </div>

      <Button
        onClick={() => {
          if (!isClinicRegionCode(current.country)) return;
          updateMutation.mutate({
            ...current,
            country: current.country,
            email: current.email.trim() || undefined,
          });
        }}
        disabled={!isPracticeInfoFormValid(current) || updateMutation.isPending}
      >
        {updateMutation.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        {t("saveChanges")}
      </Button>
    </div>
  );
}

// ── Locations ───────────────────────────────────────────────
type LocationForm = {
  name: string;
  address: string;
  phone: string;
  isPrimary: boolean;
};

function LocationsTab() {
  const t = useTranslations("settings.page");
  const utils = trpc.useUtils();
  const {
    data: locationList,
    isLoading,
    error: locationsError,
    refetch: refetchLocations,
  } = trpc.settings.listLocations.useQuery();

  const invalidateLocationState = () => {
    utils.settings.listLocations.invalidate();
    utils.messaging.getStatus.invalidate();
    utils.messaging.getInboxStatus.invalidate();
    utils.subscription.get.invalidate();
  };

  const createMutation = trpc.settings.createLocation.useMutation({
    onSuccess: () => {
      invalidateLocationState();
      setShowAdd(false);
      setAddForm({ name: "", address: "", phone: "", isPrimary: false });
      toast.success(t("locationCreated"));
    },
    onError: (err) => toast.error(err.message),
  });
  const updateMutation = trpc.settings.updateLocation.useMutation({
    onSuccess: () => {
      invalidateLocationState();
      setEditingId(null);
      toast.success(t("locationUpdated"));
    },
    onError: (err) => toast.error(err.message),
  });
  const setPrimaryMutation = trpc.settings.setPrimaryLocation.useMutation({
    onSuccess: () => {
      invalidateLocationState();
      toast.success(t("primaryLocationUpdated"));
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.settings.deleteLocation.useMutation({
    onSuccess: () => {
      invalidateLocationState();
      setConfirmDelete(null);
      toast.success(t("locationRetired"));
    },
    onError: (err) => toast.error(err.message),
  });

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<LocationForm>({
    name: "",
    address: "",
    phone: "",
    isPrimary: false,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<LocationForm>({
    name: "",
    address: "",
    phone: "",
    isPrimary: false,
  });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const locationsMissing = !isLoading && !locationsError && !locationList;
  const activeLocationCount = locationList?.length ?? 0;
  const isLocationFormValid = (form: {
    name: string;
    address: string;
    phone: string;
  }) =>
    form.name.trim().length > 0 &&
    form.name.trim().length <= LOCATION_NAME_MAX_LENGTH &&
    form.phone.trim().length <= SETTINGS_PHONE_MAX_LENGTH &&
    form.address.trim().length <= SETTINGS_ADDRESS_MAX_LENGTH;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (locationsError) {
    return <SettingsLoadError message={locationsError.message} />;
  }
  if (locationsMissing) {
    return (
      <SettingsLoadError
        title={t("couldNotLoadLocations")}
        message={t("locationsEmpty")}
        onRetry={() => void refetchLocations()}
      />
    );
  }

  const startEditing = (location: {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    isPrimary: boolean;
  }) => {
    setEditingId(location.id);
    setEditForm({
      name: location.name,
      address: location.address ?? "",
      phone: location.phone ?? "",
      isPrimary: location.isPrimary,
    });
    setConfirmDelete(null);
  };

  const saveLocation = (id: string) => {
    updateMutation.mutate({
      id,
      name: editForm.name,
      address: editForm.address,
      phone: editForm.phone,
    });
  };

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold">{t("practiceLocations")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("locationsPowerTextingSetupRoom")}
          </p>
        </div>
        <Button
          onClick={() => {
            setShowAdd(!showAdd);
            setEditingId(null);
            setConfirmDelete(null);
          }}
          size="sm"
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          {t("addLocation")}
        </Button>
      </div>

      {showAdd ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">{t("newLocation")}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Input
              placeholder={t("locationName")}
              maxLength={LOCATION_NAME_MAX_LENGTH}
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
            />
            <Input
              placeholder={t("phone")}
              maxLength={SETTINGS_PHONE_MAX_LENGTH}
              value={addForm.phone}
              onChange={(e) =>
                setAddForm({ ...addForm, phone: e.target.value })
              }
            />
            <Input
              placeholder={t("address")}
              maxLength={SETTINGS_ADDRESS_MAX_LENGTH}
              value={addForm.address}
              onChange={(e) =>
                setAddForm({ ...addForm, address: e.target.value })
              }
              className="sm:col-span-2"
            />
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={addForm.isPrimary}
              onChange={(e) =>
                setAddForm({ ...addForm, isPrimary: e.target.checked })
              }
            />
            {t("makeThisThePrimaryLocation")}
          </label>
          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              disabled={
                !isLocationFormValid(addForm) || createMutation.isPending
              }
              onClick={() => createMutation.mutate(addForm)}
            >
              {createMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {t("create")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">{t("location2")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("contact")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {locationList?.map((location) => {
              const isEditing = editingId === location.id;
              const isConfirmingDelete = confirmDelete === location.id;

              return (
                <tr
                  key={location.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3 align-top">
                    {isEditing ? (
                      <div className="space-y-2">
                        <Input
                          maxLength={LOCATION_NAME_MAX_LENGTH}
                          value={editForm.name}
                          onChange={(e) =>
                            setEditForm({ ...editForm, name: e.target.value })
                          }
                        />
                        <Input
                          value={editForm.address}
                          placeholder={t("address")}
                          maxLength={SETTINGS_ADDRESS_MAX_LENGTH}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              address: e.target.value,
                            })
                          }
                        />
                      </div>
                    ) : (
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{location.name}</span>
                          {location.isPrimary ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              <Star className="h-3 w-3" />
                              {t("primary")}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-muted-foreground">
                          {location.address || t("noAddressOnFile")}
                        </p>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-muted-foreground">
                    {isEditing ? (
                      <Input
                        value={editForm.phone}
                        placeholder={t("phone")}
                        maxLength={SETTINGS_PHONE_MAX_LENGTH}
                        onChange={(e) =>
                          setEditForm({ ...editForm, phone: e.target.value })
                        }
                      />
                    ) : (
                      location.phone || t("noPhone")
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex justify-end gap-1">
                      {isEditing ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={
                              !isLocationFormValid(editForm) ||
                              updateMutation.isPending
                            }
                            onClick={() => saveLocation(location.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          {!location.isPrimary ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={setPrimaryMutation.isPending}
                              onClick={() =>
                                setPrimaryMutation.mutate({ id: location.id })
                              }
                            >
                              <Star className="h-4 w-4" />
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEditing(location)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {isConfirmingDelete ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={
                                deleteMutation.isPending ||
                                activeLocationCount <= 1
                              }
                              onClick={() =>
                                deleteMutation.mutate({ id: location.id })
                              }
                            >
                              <Check className="h-4 w-4 text-destructive" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={activeLocationCount <= 1}
                              onClick={() => setConfirmDelete(location.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {locationList?.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-0">
                  <EmptyState
                    className="border-0 bg-transparent p-8"
                    icon={MapPin}
                    title={t("noActiveLocationsConfigured")}
                    description={t("addALocationToPower")}
                  />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {activeLocationCount <= 1 ? (
        <p className="text-xs text-muted-foreground">
          {t("aPracticeMustKeepAt")}
        </p>
      ) : null}
    </div>
  );
}

// ── Plan & Billing ──────────────────────────────────────────
// Feature labels are catalog keys: settings.page.features.<feature>.
const FEATURE_KEYS = new Set([
  "agent",
  "sms",
  "advancedReporting",
  "apiAccess",
  "multiLocation",
  "integrations",
]);

function redirectToHostedBillingUrl(url: unknown, unavailableMessage: string) {
  if (!isSafeCheckoutRedirectUrl(url)) {
    toast.error(unavailableMessage);
    return;
  }

  window.location.href = url;
}

function redirectToClientPaymentUrl(url: unknown, unavailableMessage: string) {
  if (!isSafeCheckoutRedirectUrl(url)) {
    toast.error(unavailableMessage);
    return;
  }

  window.location.href = url;
}

function BillingTab() {
  const t = useTranslations("settings.page");
  const locale = useLocale();
  const utils = trpc.useUtils();
  const searchParams = useSearchParams();
  const [selectedCadence, setSelectedCadence] = useState<BillingCadence>(() =>
    billingCadenceFromQuery(searchParams.get("plan")),
  );
  const {
    data,
    isLoading,
    error: billingError,
    refetch: refetchBilling,
  } = trpc.subscription.get.useQuery();
  const paymentAccount = trpc.billing.paymentAccountStatus.useQuery(undefined, {
    staleTime: 60_000,
  });
  const checkout = trpc.subscription.createCheckout.useMutation({
    onSuccess: (r) => {
      redirectToHostedBillingUrl(r.url, t("checkoutUnavailable"));
    },
    onError: (e) => toast.error(e.message),
  });
  const setupPaymentAccount =
    trpc.billing.createPaymentAccountOnboarding.useMutation({
      onSuccess: (r) => {
        redirectToClientPaymentUrl(r.url, t("clientPaymentUnavailable"));
      },
      onError: (e) => toast.error(e.message),
    });
  const refreshPaymentAccount = trpc.billing.refreshPaymentAccount.useMutation({
    onSuccess: () => {
      utils.billing.paymentAccountStatus.invalidate();
      toast.success(t("clientPaymentStatusRefreshed"));
    },
    onError: (e) => toast.error(e.message),
  });
  const openPaymentAccountDashboard =
    trpc.billing.openPaymentAccountDashboard.useMutation({
      onSuccess: (r) => {
        redirectToClientPaymentUrl(r.url, t("clientPaymentUnavailable"));
      },
      onError: (e) => toast.error(e.message),
    });
  const portal = trpc.subscription.openBillingPortal.useMutation({
    onSuccess: (r) => {
      redirectToHostedBillingUrl(r.url, t("checkoutUnavailable"));
    },
    onError: (e) => toast.error(e.message),
  });

  if (billingError) {
    return (
      <SettingsLoadError
        title={t("couldNotLoadBillingDetails")}
        message={billingError.message}
        onRetry={() => void refetchBilling()}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <SettingsLoadError
        title={t("couldNotLoadBillingDetails")}
        message={t("billingEmpty")}
        onRetry={() => void refetchBilling()}
      />
    );
  }

  // Self-host: nothing to buy — everything is unlocked.
  if (!data.billingEnforced) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <Check className="h-5 w-5 text-green-600" />
              <h3 className="font-heading text-lg font-semibold">
                {t("selfHostedAllFeaturesUnlocked")}
              </h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("selfHostedBody")}
            </p>
          </div>
          <ClientPaymentProcessingSection
            data={paymentAccount.data}
            isLoading={paymentAccount.isLoading}
            error={paymentAccount.error?.message}
            setupPending={setupPaymentAccount.isPending}
            refreshPending={refreshPaymentAccount.isPending}
            dashboardPending={openPaymentAccountDashboard.isPending}
            onSetup={() => setupPaymentAccount.mutate()}
            onRefresh={() => refreshPaymentAccount.mutate()}
            onDashboard={() => openPaymentAccountDashboard.mutate()}
          />
        </div>
        <PlanGrid
          plans={data.plans}
          currentTier={data.tier}
          enforced={false}
          onChoose={() => {}}
          busyTier={null}
        />
      </div>
    );
  }

  const daysLeft = trialCalendarDaysLeft(data.trialEndsAt, data.timezone) ?? 0;
  const currentPlan = data.plans.find((p) => p.tier === data.tier);
  const showReadOnlyNotice = !data.hasFullAccess;
  const availableCadences = data.billingOptions
    .filter((option) => option.purchasable)
    .map((option) => option.cadence);
  const firstActivation = !data.hasSubscription;
  const pendingTrial = firstActivation && !data.trialEndsAt && data.billingStatus === "none";
  const previewEnded = pendingTrial && !!data.previewEndsAt && !data.previewActive;
  const checkoutStatus = searchParams.get("checkout");
  // Only surface the sync note when something actually needs attention.
  const showSyncNote =
    data.billingSyncStatus &&
    (data.billingSyncStatus.status === "error" ||
      data.billingSyncStatus.status === "legacy");

  return (
    <div className="min-w-0 w-full max-w-full space-y-6">
      {checkoutStatus === "cancelled" ? (
        <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm">
          <p className="font-medium">{t("checkoutWasCanceled")}</p>
          <p className="mt-1 text-muted-foreground">
            {t("nothingChangedChooseASchedule")}
          </p>
        </div>
      ) : null}
      {checkoutStatus === "success" ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-medium">{t("yourBillingDetailsWereReceived")}</p>
          <p className="mt-1">{t("openvpmIsConfirmingTheSubscription")}</p>
        </div>
      ) : null}

      <div className="min-w-0 w-full max-w-full overflow-hidden rounded-xl border border-primary/25 bg-card shadow-sm">
        <div className="border-b border-primary/10 bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8">
          <div className="flex flex-col items-start gap-4 sm:flex-row">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-primary">
                  {t("openvpmCloud")}
                </p>
                <Badge
                  variant={data.billingStatus === "active" ? "success" : "info"}
                >
                  {pendingTrial
                    ? t("trialNotStarted")
                    : data.billingStatus === "trialing"
                    ? t("trialDaysLeft", { count: daysLeft })
                    : t.has(`billingStatus.${data.billingStatus}`)
                      ? t(`billingStatus.${data.billingStatus}`)
                      : data.billingStatus.replace("_", " ")}
                </Badge>
              </div>
              <h3 className="mt-2 font-heading text-2xl font-semibold tracking-tight">
                {pendingTrial
                  ? t("startYourFreeTrial")
                  : firstActivation
                  ? t("activateYourAccount")
                  : t("yourCloudSubscription")}
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                {pendingTrial && data.previewActive
                  ? t("trialPreviewSaved", { days: TRIAL_DAYS })
                  : previewEnded
                  ? t("trialPreviewEnded", { days: TRIAL_DAYS })
                  : pendingTrial
                  ? t("trialAddCard", { days: TRIAL_DAYS })
                  : firstActivation
                  ? t("chooseABillingScheduleThen")
                  : t("planKeepsActive", { plan: currentPlan?.name ?? t("cloud") })}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {showReadOnlyNotice && !data.previewActive ? (
            <div className="mb-5 flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {t("cloudIsInReadOnly")}
              </p>
            </div>
          ) : null}

          {data.billingStatus === "past_due" ? (
            <div className="mb-5 flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {t("pastDue")}
              </p>
            </div>
          ) : null}

          {firstActivation ? (
            <>
              <CloudBillingCadencePicker
                value={selectedCadence}
                onValueChange={setSelectedCadence}
                locationCount={data.locationCount}
                availableCadences={availableCadences}
                disabled={checkout.isPending}
              />

              <div className="mt-6 flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {selectedCadence === "year"
                      ? t("billedYearly", { amount: `$${data.estimatedAnnualBase}` })
                      : t("billedMonthly", { amount: `$${data.estimatedMonthlyBase}` })}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {pendingTrial
                      ? t("trialTerms", { days: TRIAL_DAYS })
                      : data.billingStatus === "trialing"
                      ? t("noChargeTrialRemaining", { count: daysLeft })
                      : t("stripeSecurelyCollectsAndStores")}
                  </p>
                </div>
                <Button
                  className="w-full gap-2 sm:w-auto"
                  disabled={
                    checkout.isPending ||
                    !availableCadences.includes(selectedCadence)
                  }
                  onClick={() =>
                    checkout.mutate({
                      tier: "cloud",
                      billingCadence: selectedCadence,
                    })
                  }
                >
                  {checkout.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CreditCard className="size-4" />
                  )}
                  {t("continueCheckout")}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">
                  {data.currentBillingCadence === "year"
                    ? t("perYear", { amount: `$${data.estimatedAnnualBase}` })
                    : t("perMonth", { amount: `$${data.estimatedMonthlyBase}` })}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("updatePaymentDetailsInvoicesOr")}
                </p>
              </div>
              <Button
                variant="outline"
                disabled={portal.isPending}
                onClick={() => portal.mutate()}
              >
                {portal.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="mr-2 h-4 w-4" />
                )}
                {t("manageBilling")}
              </Button>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            {[
              t("poweredByStripe"),
              t("cancelAnytime"),
              t("unlimitedStaffIncluded"),
            ].map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-primary" aria-hidden="true" />
                {item}
              </span>
            ))}
          </div>

          {(currentPlan?.includedSmsPerMonth != null ||
            currentPlan?.includedAiRunsPerMonth != null) && (
            <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
              {t("usageThisMonth", {
                sms: data.usage.sms,
                smsIncluded:
                  currentPlan?.includedSmsPerMonth?.toLocaleString(locale) ?? "",
                ai: data.usage.aiRuns,
                aiIncluded:
                  currentPlan?.includedAiRunsPerMonth?.toLocaleString(locale) ??
                  "",
              })}
            </p>
          )}

          {showSyncNote ? (
            <div
              className={cn(
                "mt-4 rounded-md border p-3 text-xs",
                data.billingSyncStatus!.status === "error"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-amber-200 bg-amber-50 text-amber-800",
              )}
            >
              <span className="font-medium">{t("billingSyncLabel")} </span>
              {data.billingSyncStatus!.message}
            </div>
          ) : null}
        </div>
      </div>

      <ClientPaymentProcessingSection
        data={paymentAccount.data}
        isLoading={paymentAccount.isLoading}
        error={paymentAccount.error?.message}
        setupPending={setupPaymentAccount.isPending}
        refreshPending={refreshPaymentAccount.isPending}
        dashboardPending={openPaymentAccountDashboard.isPending}
        onSetup={() => setupPaymentAccount.mutate()}
        onRefresh={() => refreshPaymentAccount.mutate()}
        onDashboard={() => openPaymentAccountDashboard.mutate()}
      />
    </div>
  );
}

function ClientPaymentProcessingSection({
  data,
  isLoading,
  error,
  setupPending,
  refreshPending,
  dashboardPending,
  onSetup,
  onRefresh,
  onDashboard,
}: {
  data:
    | {
        stripeConfigured: boolean;
        connectRequired: boolean;
        status:
          | "not_started"
          | "pending"
          | "active"
          | "action_required"
          | "disabled"
          | "not_configured"
          | "not_required";
        enabled: boolean;
        chargesEnabled?: boolean;
        payoutsEnabled?: boolean;
        detailsSubmitted?: boolean;
        requirementsCurrentlyDue?: string[];
        requirementsDisabledReason?: string | null;
        lastSyncedAt?: Date | string | null;
      }
    | undefined;
  isLoading: boolean;
  error?: string;
  setupPending: boolean;
  refreshPending: boolean;
  dashboardPending: boolean;
  onSetup: () => void;
  onRefresh: () => void;
  onDashboard: () => void;
}) {
  const t = useTranslations("settings.page");
  const status = data?.enabled
    ? t("paymentStatus.ready")
    : data?.status === "action_required" || data?.status === "disabled"
      ? t("paymentStatus.actionRequired")
      : data?.connectRequired
        ? t("paymentStatus.setupNeeded")
        : data?.stripeConfigured
          ? t("paymentStatus.configured")
          : t("paymentStatus.notConfigured");
  const statusClass = data?.enabled
    ? "bg-green-100 text-green-700"
    : data?.status === "action_required" || data?.status === "disabled"
      ? "bg-amber-100 text-amber-800"
      : data?.stripeConfigured
        ? "bg-blue-100 text-blue-700"
        : "bg-gray-100 text-gray-600";
  const canOpenDashboard = Boolean(
    data?.connectRequired && data.status !== "not_started",
  );
  const canShowSetup =
    Boolean(data?.connectRequired && data.stripeConfigured) &&
    data?.status !== "active";

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-lg font-semibold">
              {t("clientPaymentProcessing")}
            </h3>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium capitalize",
                statusClass,
              )}
            >
              {status}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {data?.connectRequired
              ? t("stripeConnectLetsTheClinic")
              : t("thisInstallationCanUseIts")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canShowSetup && (
            <Button size="sm" disabled={setupPending} onClick={onSetup}>
              {setupPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              {data?.status === "not_started" ? t("setUp") : t("resumeSetup")}
            </Button>
          )}
          {data?.connectRequired && (
            <Button
              size="sm"
              variant="outline"
              disabled={refreshPending || !data.stripeConfigured}
              onClick={onRefresh}
            >
              {refreshPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              {t("refresh")}
            </Button>
          )}
          {canOpenDashboard && (
            <Button
              size="sm"
              variant="outline"
              disabled={dashboardPending}
              onClick={onDashboard}
            >
              {dashboardPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              {t("openStripe")}
            </Button>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("loadingClientPaymentStatus")}
        </div>
      )}
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {!isLoading && !error && data && (
        <div className="mt-4 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground">{t("stripeApi")}</p>
            <p className="font-medium">
              {data.stripeConfigured ? t("configured") : t("missing")}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("cardPayments")}</p>
            <p className="font-medium">
              {data.enabled || data.status === "not_required"
                ? t("enabled")
                : t("disabled")}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("payouts")}</p>
            <p className="font-medium">
              {data.payoutsEnabled
                ? t("enabled")
                : data.connectRequired
                  ? t("pending")
                  : t("nA")}
            </p>
          </div>
          {data.requirementsCurrentlyDue?.length ? (
            <div className="sm:col-span-3">
              <p className="text-muted-foreground">{t("stripeRequirements")}</p>
              <p className="font-medium">
                {t("itemsDue", { count: data.requirementsCurrentlyDue.length })}
              </p>
            </div>
          ) : null}
          {data.requirementsDisabledReason ? (
            <div className="sm:col-span-3">
              <p className="text-muted-foreground">{t("disabledReason")}</p>
              <p className="font-medium">{data.requirementsDisabledReason}</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function PlanGrid({
  plans,
  currentTier,
  enforced,
  onChoose,
  busyTier,
}: {
  plans: Array<{
    tier: string;
    name: string;
    locationUnitPriceMonthlyUsd: number | null;
    seatUnitPriceMonthlyUsd: number | null;
    blurb: string;
    features: string[];
    seatLimit: number | null;
    locationLimit: number | null;
    includedSmsPerMonth: number | null;
    includedAiRunsPerMonth: number | null;
    aiOveragePriceUsd: number | null;
    smsOveragePriceUsd: number | null;
    selfServe: boolean;
    purchasable: boolean;
  }>;
  currentTier: string;
  enforced: boolean;
  onChoose: (tier: "cloud") => void;
  busyTier: string | null;
}) {
  const t = useTranslations("settings.page");
  const locale = useLocale();
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {plans.map((p) => {
        const isCurrent = p.tier === currentTier;
        const canBuy =
          enforced && p.purchasable && p.tier === "cloud" && !isCurrent;
        return (
          <div
            key={p.tier}
            className={cn(
              "flex flex-col rounded-lg border bg-card p-5",
              isCurrent
                ? "border-primary ring-1 ring-primary"
                : "border-border",
            )}
          >
            <h4 className="font-heading text-base font-semibold">{p.name}</h4>
            <p className="mt-1 text-2xl font-bold">
              {p.locationUnitPriceMonthlyUsd === null ? (
                t("custom")
              ) : p.locationUnitPriceMonthlyUsd === 0 ? (
                t("free")
              ) : (
                <>
                  ${p.locationUnitPriceMonthlyUsd}
                  <span className="text-sm font-normal text-muted-foreground">
                    {t("location")}
                  </span>
                  <span className="block text-sm font-normal text-muted-foreground">
                    {p.seatUnitPriceMonthlyUsd && p.seatUnitPriceMonthlyUsd > 0
                      ? t("perStaff", { price: p.seatUnitPriceMonthlyUsd })
                      : t("unlimitedStaff")}
                  </span>
                </>
              )}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{p.blurb}</p>
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              <li>
                {t("staffRolesIncluded", {
                  count: p.seatLimit === null ? t("all") : p.seatLimit,
                })}
              </li>
              <li>
                {t("locationCount", {
                  count:
                    p.locationLimit === null ? t("unlimited") : p.locationLimit,
                  plural: p.locationLimit === 1 ? "one" : "other",
                })}
              </li>
              {p.includedSmsPerMonth ? (
                <li>
                  {t("smsIncluded", {
                    count: p.includedSmsPerMonth.toLocaleString(locale),
                  })}
                  {p.smsOveragePriceUsd
                    ? t("smsOverage", { price: p.smsOveragePriceUsd })
                    : ""}
                </li>
              ) : null}
              {p.includedAiRunsPerMonth ? (
                <li>
                  {t("aiIncluded", {
                    count: p.includedAiRunsPerMonth.toLocaleString(locale),
                  })}
                  {p.aiOveragePriceUsd
                    ? t("aiOverage", { price: p.aiOveragePriceUsd })
                    : ""}
                </li>
              ) : null}
              {p.features.length > 0 ? (
                p.features.map((f) => (
                  <li key={f} className="flex items-center gap-1">
                    <Check className="h-3 w-3 text-green-600" />
                    {FEATURE_KEYS.has(f) ? t(`features.${f}`) : f}
                  </li>
                ))
              ) : (
                <li>{t("fullCorePims")}</li>
              )}
            </ul>
            <div className="mt-4 pt-2">
              {isCurrent ? (
                <span className="text-xs font-medium text-primary">
                  {t("currentPlan")}
                </span>
              ) : canBuy ? (
                <Button
                  size="sm"
                  className="w-full"
                  disabled={busyTier === p.tier}
                  onClick={() => onChoose(p.tier as "cloud")}
                >
                  {busyTier === p.tier ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {t("choosePlan", { name: p.name })}
                </Button>
              ) : !p.selfServe ? (
                <a
                  href="mailto:support@openvpm.com?subject=OpenVPM%20Enterprise"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {t("contactSales")}
                </a>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Staff ───────────────────────────────────────────────────
function StaffTab() {
  const t = useTranslations("settings.page");
  const roleT = useTranslations("shell.roles");
  const utils = trpc.useUtils();
  const {
    data: staffList,
    isLoading,
    error: staffError,
    refetch: refetchStaff,
  } = trpc.settings.listUsers.useQuery();
  const createMutation = trpc.settings.createUser.useMutation({
    onSuccess: () => {
      utils.settings.listUsers.invalidate();
      setShowAdd(false);
      resetAddForm();
      toast.success(t("staffMemberAdded"));
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const updateMutation = trpc.settings.updateUser.useMutation({
    onSuccess: () => {
      utils.settings.listUsers.invalidate();
      setEditingId(null);
      toast.success(t("staffMemberUpdated"));
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const deactivateMutation = trpc.settings.deactivateUser.useMutation({
    onSuccess: () => {
      utils.settings.listUsers.invalidate();
      toast.success(t("staffMemberDeactivated"));
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const signInLocks = trpc.settings.staffSignInLocks.useQuery();
  const lockedStaff = new Set(
    (signInLocks.data ?? []).map((lock) => lock.userId),
  );
  const clearSignInLockMutation =
    trpc.settings.clearStaffSignInLock.useMutation({
      onSuccess: () => {
        utils.settings.staffSignInLocks.invalidate();
        toast.success(t("signInLockCleared"));
      },
      onError: (err) => {
        toast.error(err.message);
      },
    });
  const inviteMutation = trpc.settings.inviteStaff.useMutation({
    onSuccess: (res) => {
      utils.settings.listUsers.invalidate();
      setInviteForm({ email: "", name: "", role: "front_desk" });
      setInviteUrl(res.inviteUrl ?? null);
      toast.success(t("inviteSent"));
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    name: "",
    role: "front_desk" as
      | "admin"
      | "veterinarian"
      | "technician"
      | "front_desk"
      | "viewer",
  });
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "front_desk" as
      | "admin"
      | "veterinarian"
      | "technician"
      | "front_desk"
      | "viewer",
    isVeterinarian: false,
    phone: "",
    licenseNumber: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    role: "front_desk" as
      | "admin"
      | "veterinarian"
      | "technician"
      | "front_desk"
      | "viewer",
    isVeterinarian: false,
    phone: "",
    licenseNumber: "",
  });
  const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(
    null,
  );

  const resetAddForm = () =>
    setAddForm({
      name: "",
      email: "",
      password: "",
      role: "front_desk",
      isVeterinarian: false,
      phone: "",
      licenseNumber: "",
    });
  const isStaffNameValid = (name: string) =>
    name.trim().length > 0 && name.trim().length <= STAFF_NAME_MAX_LENGTH;
  const isOptionalStaffNameValid = (name: string) =>
    name.trim().length <= STAFF_NAME_MAX_LENGTH;
  const isSettingsEmailInputValid = (email: string) =>
    email.trim().length <= SETTINGS_EMAIL_MAX_LENGTH &&
    isValidEmail(email.trim());
  const isStaffContactFieldsValid = (form: {
    phone: string;
    licenseNumber: string;
  }) =>
    form.phone.trim().length <= SETTINGS_PHONE_MAX_LENGTH &&
    form.licenseNumber.trim().length <= STAFF_LICENSE_NUMBER_MAX_LENGTH;
  const isStaffPasswordValid = (password: string) =>
    password.length >= AUTH_PASSWORD_MIN_LENGTH &&
    password.length <= AUTH_PASSWORD_MAX_LENGTH;
  const isStaffCreateFormValid = (form: typeof addForm) =>
    isStaffNameValid(form.name) &&
    isSettingsEmailInputValid(form.email) &&
    isStaffPasswordValid(form.password) &&
    isStaffContactFieldsValid(form);
  const isStaffInviteFormValid = (form: typeof inviteForm) =>
    isSettingsEmailInputValid(form.email) &&
    isOptionalStaffNameValid(form.name);
  const isStaffEditFormValid = (form: typeof editForm) =>
    isStaffNameValid(form.name) && isStaffContactFieldsValid(form);
  const staffMissing = !isLoading && !staffError && !staffList;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (staffError) {
    return <SettingsLoadError message={staffError.message} />;
  }
  if (staffMissing) {
    return (
      <SettingsLoadError
        title={t("couldNotLoadStaff")}
        message={t("staffEmpty")}
        onRetry={() => void refetchStaff()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button
          onClick={() => {
            setShowInvite(!showInvite);
            setShowAdd(false);
            setInviteUrl(null);
          }}
          size="sm"
          variant="outline"
        >
          <Mail className="mr-2 h-4 w-4" />
          {t("inviteByEmail")}
        </Button>
        <Button
          onClick={() => {
            setShowAdd(!showAdd);
            setShowInvite(false);
            resetAddForm();
          }}
          size="sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("addStaff")}
        </Button>
      </div>

      {showInvite && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">{t("inviteATeammate")}</h3>
          <p className="text-xs text-muted-foreground">
            {t("inviteIntro")}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder={t("email")}
              type="email"
              maxLength={SETTINGS_EMAIL_MAX_LENGTH}
              value={inviteForm.email}
              onChange={(e) =>
                setInviteForm({ ...inviteForm, email: e.target.value })
              }
            />
            <Input
              placeholder={t("nameOptional")}
              maxLength={STAFF_NAME_MAX_LENGTH}
              value={inviteForm.name}
              onChange={(e) =>
                setInviteForm({ ...inviteForm, name: e.target.value })
              }
            />
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={inviteForm.role}
              onChange={(e) =>
                setInviteForm({
                  ...inviteForm,
                  role: e.target.value as typeof inviteForm.role,
                })
              }
            >
              <option value="front_desk">{t("frontDesk")}</option>
              <option value="viewer">{t("viewerReadOnly")}</option>
              <option value="technician">{t("technician")}</option>
              <option value="veterinarian">{t("veterinarian")}</option>
              <option value="admin">{t("admin")}</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={
                !isStaffInviteFormValid(inviteForm) || inviteMutation.isPending
              }
              onClick={() =>
                inviteMutation.mutate({
                  email: inviteForm.email,
                  name: inviteForm.name || undefined,
                  role: inviteForm.role,
                })
              }
            >
              {inviteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("sendInvite")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowInvite(false)}
            >
              {t("cancel")}
            </Button>
          </div>
          {inviteUrl && (
            <div className="space-y-1.5 rounded-md border border-border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                {t("inviteLinkDev")}
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-background px-2 py-1 text-xs">
                  {inviteUrl}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(inviteUrl);
                    toast.success(t("copied"));
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          {inviteMutation.error && (
            <p className="text-sm text-destructive">
              {inviteMutation.error.message}
            </p>
          )}
        </div>
      )}

      {showAdd && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">{t("newStaffMember")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder={t("fullName")}
              maxLength={STAFF_NAME_MAX_LENGTH}
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
            />
            <Input
              placeholder={t("email")}
              type="email"
              maxLength={SETTINGS_EMAIL_MAX_LENGTH}
              value={addForm.email}
              onChange={(e) =>
                setAddForm({ ...addForm, email: e.target.value })
              }
            />
            <Input
              placeholder={t("passwordMin", { min: AUTH_PASSWORD_MIN_LENGTH })}
              type="password"
              maxLength={AUTH_PASSWORD_MAX_LENGTH}
              value={addForm.password}
              onChange={(e) =>
                setAddForm({ ...addForm, password: e.target.value })
              }
            />
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={addForm.role}
              onChange={(e) =>
                setAddForm({
                  ...addForm,
                  role: e.target.value as typeof addForm.role,
                  isVeterinarian:
                    e.target.value === "veterinarian" || addForm.isVeterinarian,
                })
              }
            >
              <option value="front_desk">{t("frontDesk")}</option>
              <option value="viewer">{t("viewerReadOnly")}</option>
              <option value="technician">{t("technician")}</option>
              <option value="veterinarian">{t("veterinarian")}</option>
              <option value="admin">{t("admin")}</option>
            </select>
            <Input
              placeholder={t("phoneOptional")}
              maxLength={SETTINGS_PHONE_MAX_LENGTH}
              value={addForm.phone}
              onChange={(e) =>
                setAddForm({ ...addForm, phone: e.target.value })
              }
            />
            <Input
              placeholder={t("licenseOptional")}
              maxLength={STAFF_LICENSE_NUMBER_MAX_LENGTH}
              value={addForm.licenseNumber}
              onChange={(e) =>
                setAddForm({ ...addForm, licenseNumber: e.target.value })
              }
            />
            <label className="col-span-2 flex items-start gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                checked={addForm.isVeterinarian}
                disabled={addForm.role === "veterinarian"}
                onChange={(event) =>
                  setAddForm({
                    ...addForm,
                    isVeterinarian: event.target.checked,
                  })
                }
              />
              <span>
                {t("veterinarianProviderAppearsInDoctor")}
              </span>
            </label>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={
                !isStaffCreateFormValid(addForm) || createMutation.isPending
              }
              onClick={() =>
                createMutation.mutate({
                  ...addForm,
                  phone: addForm.phone || undefined,
                  licenseNumber: addForm.licenseNumber || undefined,
                })
              }
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("create")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              {t("cancel")}
            </Button>
          </div>
          {createMutation.error && (
            <p className="text-sm text-destructive">
              {createMutation.error.message}
            </p>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">{t("name")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("email")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("role")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("provider")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("phone")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("license")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {staffList?.map((user) => (
              <tr
                key={user.id}
                className="border-b border-border last:border-0"
              >
                {editingId === user.id ? (
                  <>
                    <td className="px-4 py-2">
                      <Input
                        className="h-8"
                        maxLength={STAFF_NAME_MAX_LENGTH}
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm({ ...editForm, name: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {user.email}
                    </td>
                    <td className="px-4 py-2">
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                        value={editForm.role}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            role: e.target.value as typeof editForm.role,
                            isVeterinarian:
                              e.target.value === "veterinarian" ||
                              editForm.isVeterinarian,
                          })
                        }
                      >
                        <option value="front_desk">{t("frontDesk")}</option>
                        <option value="viewer">{t("viewerReadOnly")}</option>
                        <option value="technician">{t("technician")}</option>
                        <option value="veterinarian">{t("veterinarian")}</option>
                        <option value="admin">{t("admin")}</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={editForm.isVeterinarian}
                          disabled={editForm.role === "veterinarian"}
                          onChange={(event) =>
                            setEditForm({
                              ...editForm,
                              isVeterinarian: event.target.checked,
                            })
                          }
                        />
                        {t("veterinarian")}
                      </label>
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        className="h-8"
                        maxLength={SETTINGS_PHONE_MAX_LENGTH}
                        value={editForm.phone}
                        onChange={(e) =>
                          setEditForm({ ...editForm, phone: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        className="h-8"
                        maxLength={STAFF_LICENSE_NUMBER_MAX_LENGTH}
                        value={editForm.licenseNumber}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            licenseNumber: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={
                            !isStaffEditFormValid(editForm) ||
                            updateMutation.isPending
                          }
                          onClick={() =>
                            updateMutation.mutate({
                              id: user.id,
                              name: editForm.name,
                              role: editForm.role,
                              isVeterinarian: editForm.isVeterinarian,
                              phone: editForm.phone || undefined,
                              licenseNumber:
                                editForm.licenseNumber || undefined,
                            })
                          }
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-medium">
                      {user.name}
                      {lockedStaff.has(user.id) && (
                        <span className="ml-2 text-xs font-normal text-amber-700">
                          {t("signInLocked")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.email}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                          ROLE_BADGE[user.role] ?? ROLE_BADGE.front_desk,
                        )}
                      >
                        {roleT.has(user.role) ? roleT(user.role) : user.role.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.isVeterinarian ? t("veterinarian") : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.phone ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.licenseNumber ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {confirmDeactivate === user.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="mr-2 text-xs text-destructive">
                            {t("deactivate")}
                          </span>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={deactivateMutation.isPending}
                            onClick={() => {
                              deactivateMutation.mutate({ id: user.id });
                              setConfirmDeactivate(null);
                            }}
                          >
                            {t("yes")}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmDeactivate(null)}
                          >
                            {t("no")}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          {lockedStaff.has(user.id) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              title={t("clearSignInLock")}
                              aria-label={t("clearLockFor", { name: user.name })}
                              disabled={clearSignInLockMutation.isPending}
                              onClick={() =>
                                clearSignInLockMutation.mutate({ id: user.id })
                              }
                            >
                              <LockOpen className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(user.id);
                              setEditForm({
                                name: user.name,
                                role: user.role,
                                isVeterinarian: user.isVeterinarian,
                                phone: user.phone ?? "",
                                licenseNumber: user.licenseNumber ?? "",
                              });
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmDeactivate(user.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
            {staffList?.length === 0 && (
              <tr>
                <td colSpan={7} className="p-0">
                  <EmptyState
                    className="border-0 bg-transparent p-8"
                    icon={Users}
                    title={t("noStaffMembersFound")}
                    description={t("inviteTeammatesOrCreateA")}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <ProviderHours />
    </div>
  );
}

// ── Appointment Types ───────────────────────────────────────
function AppointmentTypesTab() {
  const t = useTranslations("settings.page");
  const roomTypeLabel = useRoomTypeLabel();
  const utils = trpc.useUtils();
  const {
    data: types,
    isLoading,
    error: appointmentTypesError,
    refetch: refetchAppointmentTypes,
  } = trpc.settings.listAppointmentTypes.useQuery();
  const createMutation = trpc.settings.createAppointmentType.useMutation({
    onSuccess: () => {
      utils.settings.listAppointmentTypes.invalidate();
      setShowAdd(false);
      resetAddForm();
      toast.success(t("appointmentTypeCreated"));
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const updateMutation = trpc.settings.updateAppointmentType.useMutation({
    onSuccess: () => {
      utils.settings.listAppointmentTypes.invalidate();
      setEditingId(null);
      toast.success(t("appointmentTypeUpdated"));
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const deleteMutation = trpc.settings.deleteAppointmentType.useMutation({
    onSuccess: () => {
      utils.settings.listAppointmentTypes.invalidate();
      toast.success(t("appointmentTypeDeleted"));
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    durationMinutes: 30,
    color: "#0d9488",
    requiresDoctor: 1,
    defaultRoomType: "exam" as "exam" | "surgery" | "treatment" | "boarding",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ ...addForm });
  const isDurationValid = (duration: number) =>
    Number.isInteger(duration) &&
    duration >= APPOINTMENT_TYPE_DURATION_MIN_MINUTES &&
    duration <= APPOINTMENT_TYPE_DURATION_MAX_MINUTES;
  const isAppointmentTypeNameValid = (name: string) =>
    name.trim().length > 0 &&
    name.trim().length <= APPOINTMENT_TYPE_NAME_MAX_LENGTH;

  const resetAddForm = () =>
    setAddForm({
      name: "",
      durationMinutes: 30,
      color: "#0d9488",
      requiresDoctor: 1,
      defaultRoomType: "exam",
    });
  const appointmentTypesMissing =
    !isLoading && !appointmentTypesError && !types;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (appointmentTypesError) {
    return <SettingsLoadError message={appointmentTypesError.message} />;
  }
  if (appointmentTypesMissing) {
    return (
      <SettingsLoadError
        title={t("couldNotLoadAppointmentTypes")}
        message={t("appointmentTypesEmpty")}
        onRetry={() => void refetchAppointmentTypes()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setShowAdd(!showAdd);
            resetAddForm();
          }}
          size="sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("addType")}
        </Button>
      </div>

      {showAdd && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">{t("newAppointmentType")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder={t("typeName")}
              maxLength={APPOINTMENT_TYPE_NAME_MAX_LENGTH}
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
            />
            <Input
              type="number"
              placeholder={t("durationMinutes")}
              min={APPOINTMENT_TYPE_DURATION_MIN_MINUTES}
              max={APPOINTMENT_TYPE_DURATION_MAX_MINUTES}
              value={addForm.durationMinutes}
              onChange={(e) =>
                setAddForm({
                  ...addForm,
                  durationMinutes: parseInt(e.target.value) || 30,
                })
              }
            />
            <div className="space-y-1.5">
              <span className="text-sm font-medium">{t("color")}</span>
              <div className="flex gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition-transform",
                      addForm.color === c
                        ? "border-foreground scale-110"
                        : "border-transparent",
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setAddForm({ ...addForm, color: c })}
                  />
                ))}
              </div>
            </div>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={addForm.defaultRoomType}
              onChange={(e) =>
                setAddForm({
                  ...addForm,
                  defaultRoomType: e.target
                    .value as typeof addForm.defaultRoomType,
                })
              }
            >
              {ROOM_TYPES.map((roomType) => (
                <option key={roomType} value={roomType}>
                  {t(`roomTypes.${roomType}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={
                !isAppointmentTypeNameValid(addForm.name) ||
                !isDurationValid(addForm.durationMinutes) ||
                createMutation.isPending
              }
              onClick={() => createMutation.mutate(addForm)}
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("create")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">{t("name")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("duration")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("color")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("roomType")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {types?.map((type) => (
              <tr
                key={type.id}
                className="border-b border-border last:border-0"
              >
                {editingId === type.id ? (
                  <>
                    <td className="px-4 py-2">
                      <Input
                        className="h-8"
                        maxLength={APPOINTMENT_TYPE_NAME_MAX_LENGTH}
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm({ ...editForm, name: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        className="h-8 w-20"
                        type="number"
                        min={APPOINTMENT_TYPE_DURATION_MIN_MINUTES}
                        max={APPOINTMENT_TYPE_DURATION_MAX_MINUTES}
                        value={editForm.durationMinutes}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            durationMinutes: parseInt(e.target.value) || 30,
                          })
                        }
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c}
                            className={cn(
                              "h-6 w-6 rounded-full border-2",
                              editForm.color === c
                                ? "border-foreground"
                                : "border-transparent",
                            )}
                            style={{ backgroundColor: c }}
                            onClick={() =>
                              setEditForm({ ...editForm, color: c })
                            }
                          />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                        value={editForm.defaultRoomType}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            defaultRoomType: e.target
                              .value as typeof editForm.defaultRoomType,
                          })
                        }
                      >
                        {ROOM_TYPES.map((roomType) => (
                          <option key={roomType} value={roomType}>
                            {t(`roomTypes.${roomType}`)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={
                            !isAppointmentTypeNameValid(editForm.name) ||
                            !isDurationValid(editForm.durationMinutes) ||
                            updateMutation.isPending
                          }
                          onClick={() =>
                            updateMutation.mutate({
                              id: type.id,
                              ...editForm,
                            })
                          }
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-medium">{type.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {t("minutesShort", { count: type.durationMinutes })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block h-4 w-4 rounded-full"
                        style={{ backgroundColor: type.color ?? "#6b7280" }}
                      />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">
                      {type.defaultRoomType
                        ? roomTypeLabel(type.defaultRoomType)
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(type.id);
                            setEditForm({
                              name: type.name,
                              durationMinutes: type.durationMinutes,
                              color: type.color ?? "#0d9488",
                              requiresDoctor: type.requiresDoctor,
                              defaultRoomType: type.defaultRoomType ?? "exam",
                            });
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate({ id: type.id })}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {types?.length === 0 && (
              <tr>
                <td colSpan={5} className="p-0">
                  <EmptyState
                    className="border-0 bg-transparent p-8"
                    icon={Calendar}
                    title={t("noAppointmentTypesConfigured")}
                    description={t("addAppointmentTypesSoScheduling")}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── CSV Helpers ──────────────────────────────────────────────
function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return;
  downloadCsv(filename, recordsToCsv(data));
}

function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type ImportPreview = {
  requestKey: string;
  previewToken: string;
  total: number;
  willInsert: number;
  willReconcile?: number;
  duplicates?: number;
  unmatchedClient?: number;
  unmatchedPatient?: number;
  errors: string[];
};
type ImportMode = MigrationImportMode;
function importPreviewRequestKey(
  mode: ImportMode,
  source: string,
  csv: string,
): string {
  let hash = 2_166_136_261;
  const input = `${mode}\u0000${source}\u0000${csv}`;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `${mode}:${source}:${csv.length}:${(hash >>> 0).toString(16)}`;
}
// ── Data Tab ─────────────────────────────────────────────────
function DataTab() {
  const t = useTranslations("settings.page");
  const migrationCopy = useMigrationCopy();
  const locale = useLocale();
  const [exportingType, setExportingType] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<ImportMode | null>(null);
  const [migrationSource, setMigrationSource] = useState<
    (typeof MIGRATION_SOURCES)[number]["id"] | null
  >(null);
  const importSource = migrationSource ?? "other";
  const [csvText, setCsvText] = useState("");
  const [csvFileName, setCsvFileName] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(
    null,
  );
  const [importResult, setImportResult] = useState<{
    imported: number;
    reconciled?: number;
    errors?: string[];
  } | null>(null);
  const [importRecoveryMessage, setImportRecoveryMessage] = useState("");
  const [backupFileName, setBackupFileName] = useState("");
  const [backupPayload, setBackupPayload] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [backupSummary, setBackupSummary] = useState<{
    counts: Record<string, number>;
    missingSections: string[];
    restoreErrors: string[];
    totalRows: number;
  } | null>(null);
  const [restoreResult, setRestoreResult] = useState<{
    restored: Record<string, number>;
    totalRows: number;
  } | null>(null);
  const [confirmFreshPractice, setConfirmFreshPractice] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [deletionContactEmail, setDeletionContactEmail] = useState("");
  const [deletionReason, setDeletionReason] = useState("");
  const [confirmExportDownloaded, setConfirmExportDownloaded] = useState(false);
  const [confirmManualReview, setConfirmManualReview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importRequestKeyRef = useRef<string | null>(null);
  const importFileReadVersionRef = useRef(0);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const exportClients = trpc.data.exportClients.useQuery(undefined, {
    enabled: false,
  });
  const exportPatients = trpc.data.exportPatients.useQuery(undefined, {
    enabled: false,
  });
  const exportAppointments = trpc.data.exportAppointments.useQuery(undefined, {
    enabled: false,
  });
  const exportInvoices = trpc.data.exportInvoices.useQuery(undefined, {
    enabled: false,
  });
  const exportFullBackup = trpc.data.exportFullBackup.useQuery(undefined, {
    enabled: false,
  });
  const restoreBackup = trpc.data.restoreBackup.useMutation({
    onSuccess: (data) => {
      if (data.dryRun) {
        setBackupSummary({
          counts: data.counts,
          missingSections: data.missingSections,
          restoreErrors: data.restoreErrors,
          totalRows: data.totalRows,
        });
        setRestoreResult(null);
        if (data.missingSections.length > 0) {
          toast.error(t("backupIsMissingRequiredSections"));
        } else if (data.restoreErrors.length > 0) {
          toast.error(t("backupHasInvalidRestoreData"));
        } else {
          toast.success(t("backupVerified"));
        }
        return;
      }

      setRestoreResult({
        restored: data.restored,
        totalRows: data.totalRows,
      });
      setConfirmFreshPractice(false);
      toast.success(t("restoredRows", { count: data.totalRows.toLocaleString(locale) }));
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const accountDeletionRequest =
    trpc.settings.getAccountDeletionRequest.useQuery();
  const {
    data: practiceSettings,
    isLoading: practiceSettingsLoading,
    error: practiceSettingsError,
  } = trpc.settings.getPractice.useQuery();
  const practiceSettingsMissing =
    !practiceSettingsLoading && !practiceSettingsError && !practiceSettings;
  const verifiedPracticeSettings =
    practiceSettingsError || practiceSettingsMissing || !practiceSettings
      ? null
      : practiceSettings;
  const settingsTimeZone = verifiedPracticeSettings
    ? verifiedPracticeSettings.timezone
    : null;

  function handleCsvImportError(err: {
    data?: { code?: string | null } | null;
    message: string;
  }) {
    if (err.data?.code === "CONFLICT") {
      importRequestKeyRef.current = null;
      setImportPreview(null);
      setImportRecoveryMessage(
        t("thisPreviewExpiredOrThe"),
      );
      toast.error(t("checkTheCsvAgainBefore"));
      return;
    }
    toast.error(err.message);
  }

  const importClientsCsv = trpc.data.importClientsCsv.useMutation({
    onSuccess: (data, variables) => {
      if ("dryRun" in data && data.dryRun) {
        const requestKey = importPreviewRequestKey(
          "clients",
          variables.source ?? "other",
          variables.csv,
        );
        if (importRequestKeyRef.current !== requestKey) return;
        setImportPreview({
          requestKey,
          previewToken: data.previewToken,
          total: data.total,
          willInsert: data.willInsert,
          willReconcile: data.willReconcile,
          duplicates: data.duplicates,
          errors: data.errors,
        });
        setImportRecoveryMessage("");
        setImportResult(null);
        toast.success(t("clientCsvChecked"));
        return;
      }

      setImportResult({
        imported: data.imported ?? 0,
        reconciled: data.reconciled,
        errors: data.errors,
      });
      setImportPreview(null);
      setCsvText("");
      setCsvFileName("");
      setImportRecoveryMessage("");
      toast.success(t("clientsImported"));
    },
    onError: handleCsvImportError,
  });
  const importPatientsCsv = trpc.data.importPatientsCsv.useMutation({
    onSuccess: (data, variables) => {
      if ("dryRun" in data && data.dryRun) {
        const requestKey = importPreviewRequestKey(
          "patients",
          variables.source ?? "other",
          variables.csv,
        );
        if (importRequestKeyRef.current !== requestKey) return;
        setImportPreview({
          requestKey,
          previewToken: data.previewToken,
          total: data.total,
          willInsert: data.willInsert,
          willReconcile: data.willReconcile,
          duplicates: data.duplicates,
          unmatchedClient: data.unmatchedClient,
          errors: data.errors,
        });
        setImportRecoveryMessage("");
        setImportResult(null);
        toast.success(t("patientCsvChecked"));
        return;
      }

      setImportResult({
        imported: data.imported ?? 0,
        reconciled: data.reconciled,
        errors: data.errors,
      });
      setImportPreview(null);
      setCsvText("");
      setCsvFileName("");
      setImportRecoveryMessage("");
      toast.success(t("patientsImported"));
    },
    onError: handleCsvImportError,
  });
  const importVaccinationsCsv = trpc.data.importVaccinationsCsv.useMutation({
    onSuccess: (data, variables) => {
      if ("dryRun" in data && data.dryRun) {
        const requestKey = importPreviewRequestKey(
          "vaccinations",
          variables.source ?? "other",
          variables.csv,
        );
        if (importRequestKeyRef.current !== requestKey) return;
        setImportPreview({
          requestKey,
          previewToken: data.previewToken,
          total: data.total,
          willInsert: data.willInsert,
          duplicates: data.duplicates,
          unmatchedPatient: data.unmatchedPatient,
          errors: data.errors,
        });
        setImportRecoveryMessage("");
        setImportResult(null);
        toast.success(t("vaccinationCsvChecked"));
        return;
      }

      setImportResult({ imported: data.imported ?? 0, errors: data.errors });
      setImportPreview(null);
      setCsvText("");
      setCsvFileName("");
      setImportRecoveryMessage("");
      toast.success(t("vaccineHistoryImported"));
    },
    onError: handleCsvImportError,
  });
  const importSoapNotesCsv = trpc.data.importSoapNotesCsv.useMutation({
    onSuccess: (data, variables) => {
      if ("dryRun" in data && data.dryRun) {
        const requestKey = importPreviewRequestKey(
          "soapNotes",
          variables.source ?? "other",
          variables.csv,
        );
        if (importRequestKeyRef.current !== requestKey) return;
        setImportPreview({
          requestKey,
          previewToken: data.previewToken,
          total: data.total,
          willInsert: data.willInsert,
          duplicates: data.duplicates,
          unmatchedPatient: data.unmatchedPatient,
          errors: data.errors,
        });
        setImportRecoveryMessage("");
        setImportResult(null);
        toast.success(t("medicalHistoryCsvChecked"));
        return;
      }

      setImportResult({ imported: data.imported ?? 0, errors: data.errors });
      setImportPreview(null);
      setCsvText("");
      setCsvFileName("");
      setImportRecoveryMessage("");
      toast.success(t("medicalHistoryImported"));
    },
    onError: handleCsvImportError,
  });

  const requestAccountDeletion =
    trpc.settings.requestAccountDeletion.useMutation({
      onSuccess: () => {
        utils.settings.getAccountDeletionRequest.invalidate();
        setConfirmExportDownloaded(false);
        setConfirmManualReview(false);
        toast.success(t("accountDeletionRequestSent"));
      },
      onError: (err) => toast.error(err.message),
    });

  const onboarding = trpc.settings.onboardingStatus.useQuery();
  const onboardingMissing =
    !onboarding.isLoading && !onboarding.error && !onboarding.data;
  const verifiedOnboardingStatus =
    onboarding.error || onboardingMissing || !onboarding.data
      ? null
      : onboarding.data;
  const hasDemo = verifiedOnboardingStatus
    ? verifiedOnboardingStatus.hasDemoData
    : false;
  const clearDemo = trpc.settings.clearDemoData.useMutation({
    onSuccess: () => {
      utils.settings.onboardingStatus.invalidate();
      toast.success(t("sampleDataRemoved"));
    },
    onError: (err) => toast.error(err.message),
  });
  const reseedDemo = trpc.settings.reseedDemoData.useMutation({
    onSuccess: () => {
      utils.settings.onboardingStatus.invalidate();
      toast.success(t("sampleDataAdded"));
    },
    onError: (err) => toast.error(err.message),
  });

  const handleExport = useCallback(
    async (type: "clients" | "patients" | "appointments" | "invoices") => {
      setExportingType(type);
      try {
        let data: Record<string, unknown>[] = [];
        if (type === "clients") {
          const result = await exportClients.refetch();
          data = requireSettingsExportData(
            result,
            t("couldNotExportClients"),
          ) as Record<string, unknown>[];
        } else if (type === "patients") {
          const result = await exportPatients.refetch();
          data = requireSettingsExportData(
            result,
            t("couldNotExportPatients"),
          ) as Record<string, unknown>[];
        } else if (type === "appointments") {
          const result = await exportAppointments.refetch();
          data = requireSettingsExportData(
            result,
            t("couldNotExportAppointments"),
          ) as Record<string, unknown>[];
        } else if (type === "invoices") {
          const result = await exportInvoices.refetch();
          // Flatten items for CSV
          const raw = requireSettingsExportData(
            result,
            t("couldNotExportInvoices"),
          );
          data = raw.map((inv) => {
            const { items, ...rest } = inv;
            return {
              ...rest,
              items: items
                .map((i: { description: string }) => i.description)
                .join("; "),
            } as Record<string, unknown>;
          });
        }
        downloadCSV(data, `${type}-export.csv`);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : t("couldNotExportData"),
        );
      } finally {
        setExportingType(null);
      }
    },
    [exportClients, exportPatients, exportAppointments, exportInvoices],
  );

  const handleFullBackupExport = useCallback(async () => {
    setExportingType("full-backup");
    try {
      if (!verifiedPracticeSettings) {
        throw new Error(t("couldNotLoadPracticeSettings"));
      }
      const result = await exportFullBackup.refetch();
      const backup = requireSettingsExportData(
        result,
        t("couldNotExportFullBackup"),
      );
      const date = formatSettingsDateInput(new Date(), settingsTimeZone);
      downloadJSON(backup, `openvpm-full-backup-${date}.json`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("couldNotExportFullBackup"),
      );
    } finally {
      setExportingType(null);
    }
  }, [exportFullBackup, settingsTimeZone, verifiedPracticeSettings]);

  const handleBackupFileSelect = useCallback(
    (file: File) => {
      function clearBackupFile() {
        setBackupFileName("");
        setBackupPayload(null);
        setBackupSummary(null);
        setRestoreResult(null);
        setConfirmFreshPractice(false);
      }

      if (file.size > PRACTICE_BACKUP_JSON_MAX_BYTES) {
        clearBackupFile();
        toast.error(t("backupTooLarge"));
        return;
      }

      setBackupFileName(file.name);
      setBackupPayload(null);
      setBackupSummary(null);
      setRestoreResult(null);
      setConfirmFreshPractice(false);

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = String(e.target?.result ?? "");
          if (!isPracticeBackupJsonSizeValid(text)) {
            clearBackupFile();
            toast.error(t("backupTooLarge"));
            return;
          }
          const parsed = JSON.parse(text);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error(t("backupJsonMustBeAn"));
          }
          const backup = parsed as Record<string, unknown>;
          setBackupPayload(backup);
          restoreBackup.mutate({ backup, dryRun: true });
        } catch (err) {
          setBackupFileName("");
          setBackupPayload(null);
          toast.error(
            err instanceof Error ? err.message : t("couldNotReadBackupJson"),
          );
        }
      };
      reader.onerror = () => {
        clearBackupFile();
        toast.error(t("couldNotReadBackupJson"));
      };
      reader.readAsText(file);
    },
    [restoreBackup],
  );

  const handleBackupRestore = useCallback(() => {
    if (!backupPayload || !confirmFreshPractice) return;
    if (!isPracticeBackupJsonSizeValid(backupPayload)) {
      toast.error(t("backupTooLarge"));
      return;
    }
    restoreBackup.mutate({
      backup: backupPayload,
      dryRun: false,
      confirmFreshPractice: true,
    });
  }, [backupPayload, confirmFreshPractice, restoreBackup]);

  const handleDeletionRequest = useCallback(() => {
    if (!confirmExportDownloaded || !confirmManualReview) return;
    requestAccountDeletion.mutate({
      contactEmail: deletionContactEmail.trim(),
      reason: deletionReason.trim() || undefined,
      confirmExportDownloaded: true,
      confirmManualReview: true,
    });
  }, [
    confirmExportDownloaded,
    confirmManualReview,
    deletionContactEmail,
    deletionReason,
    requestAccountDeletion,
  ]);

  const runImportPreview = useCallback(
    (text: string) => {
      if (!importMode || !migrationSource) {
        toast.error(t("chooseTheSystemYouAre2"));
        return;
      }
      setImportPreview(null);
      setImportResult(null);
      setImportRecoveryMessage("");
      importRequestKeyRef.current = importPreviewRequestKey(
        importMode,
        migrationSource,
        text,
      );
      const input = {
        csv: text,
        dryRun: true as const,
        source: migrationSource,
        migrationProtocol: "reviewed-v1" as const,
      };
      if (importMode === "clients") importClientsCsv.mutate(input);
      else if (importMode === "patients") importPatientsCsv.mutate(input);
      else if (importMode === "vaccinations")
        importVaccinationsCsv.mutate(input);
      else importSoapNotesCsv.mutate(input);
    },
    [
      importClientsCsv,
      importMode,
      importPatientsCsv,
      importSoapNotesCsv,
      importVaccinationsCsv,
      migrationSource,
    ],
  );

  const handleFileSelect = useCallback(
    (file: File) => {
      if (!importMode || !migrationSource) {
        toast.error(t("chooseTheSystemYouAre2"));
        return;
      }
      const readVersion = ++importFileReadVersionRef.current;
      function clearImportFile() {
        importRequestKeyRef.current = null;
        setCsvFileName("");
        setCsvText("");
        setImportPreview(null);
        setImportResult(null);
        setImportRecoveryMessage("");
      }

      if (file.size > IMPORT_CSV_MAX_BYTES) {
        clearImportFile();
        toast.error(t("csvTooLarge"));
        return;
      }

      setCsvFileName(file.name);
      setCsvText("");
      setImportPreview(null);
      setImportResult(null);
      setImportRecoveryMessage("");
      const reader = new FileReader();
      reader.onload = (e) => {
        if (importFileReadVersionRef.current !== readVersion) return;
        const text = String(e.target?.result ?? "");
        if (!text.trim()) {
          setCsvFileName("");
          toast.error(t("csvFileIsEmpty"));
          return;
        }
        if (!isImportCsvSizeValid(text)) {
          clearImportFile();
          toast.error(t("csvTooLarge"));
          return;
        }

        setCsvText(text);
        runImportPreview(text);
      };
      reader.onerror = () => {
        if (importFileReadVersionRef.current !== readVersion) return;
        setCsvFileName("");
        toast.error(t("couldNotReadCsvFile"));
      };
      reader.readAsText(file);
    },
    [importMode, migrationSource, runImportPreview],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith(".csv")) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect],
  );

  const handleImportConfirm = useCallback(() => {
    if (!csvText || !importMode || !importPreview) return;
    if (!isImportCsvSizeValid(csvText)) {
      toast.error(t("csvTooLarge"));
      return;
    }
    const currentRequestKey = importPreviewRequestKey(
      importMode,
      importSource,
      csvText,
    );
    if (importPreview.requestKey !== currentRequestKey) {
      importRequestKeyRef.current = null;
      setImportPreview(null);
      toast.error(t("theFileOrSourceChanged"));
      return;
    }
    if (importMode === "clients") {
      importClientsCsv.mutate({
        csv: csvText,
        dryRun: false,
        source: importSource,
        previewToken: importPreview.previewToken,
        migrationProtocol: "reviewed-v1",
      });
    } else if (importMode === "patients") {
      importPatientsCsv.mutate({
        csv: csvText,
        dryRun: false,
        source: importSource,
        previewToken: importPreview.previewToken,
        migrationProtocol: "reviewed-v1",
      });
    } else if (importMode === "vaccinations") {
      importVaccinationsCsv.mutate({
        csv: csvText,
        dryRun: false,
        source: importSource,
        previewToken: importPreview.previewToken,
        migrationProtocol: "reviewed-v1",
      });
    } else {
      importSoapNotesCsv.mutate({
        csv: csvText,
        dryRun: false,
        source: importSource,
        previewToken: importPreview.previewToken,
        migrationProtocol: "reviewed-v1",
      });
    }
  }, [
    csvText,
    importMode,
    importPreview,
    importSource,
    importClientsCsv,
    importPatientsCsv,
    importVaccinationsCsv,
    importSoapNotesCsv,
  ]);

  const isImportPending =
    importClientsCsv.isPending ||
    importPatientsCsv.isPending ||
    importVaccinationsCsv.isPending ||
    importSoapNotesCsv.isPending;
  const canRestoreBackup =
    Boolean(backupPayload) &&
    Boolean(backupSummary) &&
    backupSummary?.missingSections.length === 0 &&
    backupSummary?.restoreErrors.length === 0 &&
    confirmFreshPractice &&
    !restoreBackup.isPending;
  const deletionRequest = accountDeletionRequest.data;
  const deletionSettingsMissing =
    Boolean(deletionRequest?.requestedAt) &&
    (practiceSettingsMissing || !verifiedPracticeSettings);
  const deletionRequestedAt = deletionRequest?.requestedAt
    ? formatSettingsDateTime(deletionRequest.requestedAt, settingsTimeZone, locale)
    : null;
  const isDeletionStatusLoading =
    accountDeletionRequest.isLoading ||
    (Boolean(deletionRequest?.requestedAt) && practiceSettingsLoading);
  const deletionStatusError =
    accountDeletionRequest.error ??
    (deletionRequest?.requestedAt ? practiceSettingsError : null) ??
    (deletionSettingsMissing
      ? new Error(t("couldNotLoadPracticeSettings2"))
      : null);
  const isDeletionContactEmailValid = (email: string) =>
    email.trim().length <= SETTINGS_EMAIL_MAX_LENGTH &&
    isValidEmail(email.trim());
  const isDeletionReasonValid = (reason: string) =>
    reason.trim().length <= ACCOUNT_DELETION_REASON_MAX_LENGTH;
  const canSubmitDeletion =
    isDeletionContactEmailValid(deletionContactEmail) &&
    isDeletionReasonValid(deletionReason) &&
    confirmExportDownloaded &&
    confirmManualReview &&
    !requestAccountDeletion.isPending;

  return (
    <div className="space-y-8">
      {/* Sample data */}
      <div>
        <h3 className="text-sm font-semibold mb-1">{t("sampleData")}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t("aPracticeFullOfMade")}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            if (!verifiedOnboardingStatus) return;
            if (hasDemo) {
              clearDemo.mutate();
            } else {
              reseedDemo.mutate();
            }
          }}
          disabled={
            onboarding.isLoading ||
            Boolean(onboarding.error) ||
            onboardingMissing ||
            !verifiedOnboardingStatus ||
            clearDemo.isPending ||
            reseedDemo.isPending
          }
        >
          {hasDemo ? t("removeSampleData") : t("addSampleData")}
        </Button>
        {onboarding.error || onboardingMissing ? (
          <p className="mt-2 text-xs text-destructive">
            {onboarding.error?.message ??
              t("sampleStatusError")}
          </p>
        ) : null}
      </div>

      {/* Export Section */}
      <div>
        <h3 className="text-sm font-semibold mb-1">{t("exportData")}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t("downloadYourPracticeData")}
        </p>
        <div className="mb-3 max-w-2xl">
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            disabled={
              exportingType !== null ||
              practiceSettingsLoading ||
              Boolean(practiceSettingsError) ||
              practiceSettingsMissing ||
              !verifiedPracticeSettings
            }
            onClick={handleFullBackupExport}
          >
            {exportingType === "full-backup" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <Database className="h-4 w-4" />
            {t("exportDatabaseBackup")}
          </Button>
          {practiceSettingsError || practiceSettingsMissing ? (
            <p className="mt-2 text-xs text-destructive">
              {practiceSettingsError?.message ??
                t("backupSettingsError")}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            {t("includesStructuredRecordsAndAttachment")}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 max-w-2xl">
          {(
            [
              { key: "clients", label: t("exportClients"), icon: Users },
              {
                key: "patients",
                label: t("exportPatients"),
                icon: FileSpreadsheet,
              },
              {
                key: "appointments",
                label: t("exportAppointments"),
                icon: Calendar,
              },
              {
                key: "invoices",
                label: t("exportInvoices"),
                icon: FileSpreadsheet,
              },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <Button
              key={key}
              variant="outline"
              className="justify-start gap-2"
              disabled={exportingType !== null}
              onClick={() => handleExport(key)}
            >
              {exportingType === key ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <Icon className="h-4 w-4" />
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Database backup restore */}
      <div>
        <h3 className="text-sm font-semibold mb-1">{t("restoreDatabaseBackup")}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t("restoreStructuredDataIntoAn")}
        </p>
        <div className="max-w-2xl rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <p className="text-sm font-medium">{t("emptyPracticeRestore")}</p>
                <p className="mt-1 text-xs leading-5 text-amber-900 dark:text-amber-200">
                  {t("restoreIntro")}{" "}
                  {t("backupTooLarge")}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 bg-background"
                  disabled={restoreBackup.isPending}
                  onClick={() => backupFileInputRef.current?.click()}
                >
                  {restoreBackup.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {t("chooseBackupJson")}
                </Button>
                {backupFileName && (
                  <span className="truncate text-xs text-amber-900 dark:text-amber-200">
                    {backupFileName}
                  </span>
                )}
                <input
                  ref={backupFileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleBackupFileSelect(file);
                    e.currentTarget.value = "";
                  }}
                />
              </div>

              {backupSummary && (
                <div className="rounded-md border border-amber-200 bg-background/80 p-3 text-sm text-foreground dark:border-amber-900/60 dark:bg-background/60">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        backupSummary.missingSections.length > 0 ||
                        backupSummary.restoreErrors.length > 0
                          ? "destructive"
                          : "success"
                      }
                    >
                      {backupSummary.missingSections.length > 0
                        ? t("missingSections")
                        : backupSummary.restoreErrors.length > 0
                          ? t("invalidBackupData")
                          : t("verified")}
                    </Badge>
                    <span className="text-muted-foreground">
                      {t("rowsDetected", {
                        count: backupSummary.totalRows.toLocaleString(locale),
                      })}
                    </span>
                  </div>

                  {backupSummary.missingSections.length > 0 ? (
                    <p className="mt-2 text-xs text-destructive">
                      {t("missingSectionsList", { sections: backupSummary.missingSections.join(", ") })}
                    </p>
                  ) : backupSummary.restoreErrors.length > 0 ? (
                    <div className="mt-2 space-y-1 text-xs text-destructive">
                      {backupSummary.restoreErrors.slice(0, 3).map((error) => (
                        <p key={error}>{error}</p>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {Object.entries(backupSummary.counts)
                        .filter(([, count]) => count > 0)
                        .slice(0, 8)
                        .map(([section, count]) => (
                          <div
                            key={section}
                            className="rounded-md bg-muted/60 px-2 py-1"
                          >
                            <p className="truncate text-[11px] text-muted-foreground">
                              {section}
                            </p>
                            <p className="text-sm font-semibold">
                              {count.toLocaleString(locale)}
                            </p>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {restoreResult && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
                  <div className="flex items-center gap-2 font-medium">
                    <Check className="h-4 w-4" />
                    {t("restoredRows", {
                      count: restoreResult.totalRows.toLocaleString(locale),
                    })}
                  </div>
                </div>
              )}

              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={confirmFreshPractice}
                  disabled={
                    !backupSummary ||
                    backupSummary.missingSections.length > 0 ||
                    backupSummary.restoreErrors.length > 0 ||
                    restoreBackup.isPending
                  }
                  onChange={(e) =>
                    setConfirmFreshPractice(e.currentTarget.checked)
                  }
                  className="mt-0.5"
                />
                <span>
                  {t("iConfirmThisPracticeHas")}
                </span>
              </label>

              <Button
                type="button"
                className="gap-2"
                disabled={!canRestoreBackup}
                onClick={handleBackupRestore}
              >
                {restoreBackup.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Database className="h-4 w-4" />
                )}
                {t("restoreIntoEmpty")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Account deletion */}
      <div>
        <h3 className="text-sm font-semibold mb-1">{t("accountDeletion")}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t("startADeletionReviewAfter")}
        </p>
        <div className="max-w-2xl rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          {isDeletionStatusLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("loadingDeletionStatus")}
            </div>
          ) : deletionStatusError ? (
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">{t("couldNotLoadDeletionStatus")}</p>
                <p className="mt-1 text-xs">{deletionStatusError.message}</p>
              </div>
            </div>
          ) : deletionRequest ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="warning">{t("reviewRequested")}</Badge>
                {deletionRequestedAt && (
                  <span className="text-sm text-muted-foreground">
                    {deletionRequestedAt}
                  </span>
                )}
              </div>
              <div className="grid gap-1 text-sm">
                <div>
                  <span className="font-medium">{t("contact2")}</span>{" "}
                  {deletionRequest.contactEmail}
                </div>
                <div>
                  <span className="font-medium">{t("requestedBy")}</span>{" "}
                  {deletionRequest.requestedByEmail}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="account-deletion-contact"
                  className="mb-1 block text-sm font-medium"
                >
                  {t("contactEmail")}
                </label>
                <Input
                  id="account-deletion-contact"
                  type="email"
                  value={deletionContactEmail}
                  maxLength={SETTINGS_EMAIL_MAX_LENGTH}
                  onChange={(e) => setDeletionContactEmail(e.target.value)}
                  placeholder="owner@example.com"
                />
              </div>
              <div>
                <label
                  htmlFor="account-deletion-reason"
                  className="mb-1 block text-sm font-medium"
                >
                  {t("notes")}
                </label>
                <textarea
                  id="account-deletion-reason"
                  value={deletionReason}
                  onChange={(e) => setDeletionReason(e.target.value)}
                  maxLength={ACCOUNT_DELETION_REASON_MAX_LENGTH}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder={t("optionalContextForTheOps")}
                />
              </div>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={confirmExportDownloaded}
                  onChange={(e) =>
                    setConfirmExportDownloaded(e.currentTarget.checked)
                  }
                  className="mt-0.5"
                />
                <span>
                  {t("iDownloadedTheDatabaseBackup")}
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={confirmManualReview}
                  onChange={(e) =>
                    setConfirmManualReview(e.currentTarget.checked)
                  }
                  className="mt-0.5"
                />
                <span>
                  {t("iUnderstandDeletionNeedsManual")}
                </span>
              </label>
              <Button
                variant="destructive"
                className="gap-2"
                disabled={!canSubmitDeletion}
                onClick={handleDeletionRequest}
              >
                {requestAccountDeletion.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {t("requestDeletionReview")}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Import Section */}
      <div>
        <h3 className="text-sm font-semibold mb-1">{t("importData")}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t("importIntro")}
        </p>

        {/* Where the data is coming from (export instructions per source) */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {t("comingFrom")}
          </span>
          {MIGRATION_SOURCES.map((source) => (
            <button
              key={source.id}
              type="button"
              onClick={() => {
                importFileReadVersionRef.current += 1;
                importRequestKeyRef.current = null;
                setMigrationSource(source.id);
                setImportMode(null);
                setCsvText("");
                setCsvFileName("");
                setImportPreview(null);
                setImportResult(null);
                setImportRecoveryMessage("");
              }}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                migrationSource === source.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50",
              )}
            >
              {migrationCopy.sourceName(source.id)}
            </button>
          ))}
        </div>
        {migrationSource ? (
          <div className="mb-4 max-w-2xl space-y-3">
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <p>
                {migrationCopy.sourceExportHint(migrationSource)}
              </p>
            </div>
            <MigrationHelpRequest source={migrationSource} />
          </div>
        ) : (
          <p className="mb-4 text-xs font-medium text-amber-700">
            {t("chooseTheSystemYouAre")}
          </p>
        )}

        {/* Import mode selector */}
        <div className="flex flex-wrap gap-2 mb-4">
          {MIGRATION_STEPS.map(({ mode }, index) => (
            <Button
              key={mode}
              variant={importMode === mode ? "default" : "outline"}
              size="sm"
              disabled={!migrationSource}
              onClick={() => {
                importFileReadVersionRef.current += 1;
                setImportMode(mode);
                setCsvText("");
                setCsvFileName("");
                setImportPreview(null);
                setImportResult(null);
                setImportRecoveryMessage("");
              }}
            >
              <Upload className="mr-2 h-4 w-4" />
              {t("importStep", {
                index: index + 1,
                label: migrationCopy.stepLabel(mode),
              })}
            </Button>
          ))}
        </div>

        {importMode && (
          <div className="max-w-2xl space-y-4">
            {/* Expected columns hint */}
            <p className="text-xs text-muted-foreground">
              {t("expectedColumns", {
                hint: migrationCopy.stepColumnHint(importMode),
              })}
            </p>

            {/* Drop zone */}
            <div
              className={cn(
                "rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {t("dragAndDropACsv")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("csvDropHint")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("existingOwnersConnectByOne")}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                  e.currentTarget.value = "";
                }}
              />
            </div>

            {/* Server dry-run preview */}
            {csvFileName && (
              <p className="text-xs text-muted-foreground">
                {t("selectedFileLabel")}{" "}
                <span className="font-medium">{csvFileName}</span>
              </p>
            )}

            {importRecoveryMessage && csvText ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <p>{importRecoveryMessage}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={isImportPending}
                  onClick={() => runImportPreview(csvText)}
                >
                  {isImportPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {t("checkAgain")}
                </Button>
              </div>
            ) : null}

            {importPreview && (
              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        importPreview.willInsert > 0 ? "success" : "warning"
                      }
                    >
                      {t("dryRunComplete")}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {t("noDataHasBeenImported")}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <ImportStat
                      label={t("validRows")}
                      value={importPreview.total}
                    />
                    <ImportStat
                      label={t("willImport")}
                      value={importPreview.willInsert}
                    />
                    {typeof importPreview.duplicates === "number" && (
                      <ImportStat
                        label={t("duplicates")}
                        value={importPreview.duplicates ?? 0}
                      />
                    )}
                    {typeof importPreview.willReconcile === "number" &&
                      importPreview.willReconcile > 0 && (
                        <ImportStat
                          label={t("idsToConnect")}
                          value={importPreview.willReconcile}
                        />
                      )}
                    {importMode === "patients" && (
                      <ImportStat
                        label={t("missingOwners")}
                        value={importPreview.unmatchedClient ?? 0}
                      />
                    )}
                    {(importMode === "vaccinations" ||
                      importMode === "soapNotes") && (
                      <ImportStat
                        label={t("missingPets")}
                        value={importPreview.unmatchedPatient ?? 0}
                      />
                    )}
                    <ImportStat
                      label={t("rowIssues")}
                      value={importPreview.errors.length}
                    />
                  </div>

                  <ImportRowIssues errors={importPreview.errors} csv={csvText} />
                  <p className="mt-4 text-xs text-muted-foreground">
                    {t("onlyListedSaved", {
                      count:
                        importPreview.willInsert +
                        (importPreview.willReconcile ?? 0),
                    })}
                  </p>
                  <p className="mt-2 text-xs font-medium text-amber-700">
                    {t("startWithASmallRepresentative")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={
                      isImportPending ||
                      importPreview.willInsert +
                        (importPreview.willReconcile ?? 0) ===
                        0
                    }
                    onClick={handleImportConfirm}
                  >
                    {isImportPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 h-4 w-4" />
                    )}
                    {t("confirmImport", {
                      count:
                        importPreview.willInsert +
                        (importPreview.willReconcile ?? 0),
                    })}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      importFileReadVersionRef.current += 1;
                      importRequestKeyRef.current = null;
                      setCsvText("");
                      setCsvFileName("");
                      setImportPreview(null);
                      setImportRecoveryMessage("");
                    }}
                  >
                    {t("cancel")}
                  </Button>
                </div>
              </div>
            )}

            {/* Import result */}
            {importResult && (
              <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
                  <Check className="h-4 w-4" />
                  {t("importedRecords", { count: importResult.imported })}
                  {(importResult.reconciled ?? 0) > 0
                    ? t("connectedIds", { count: importResult.reconciled ?? 0 })
                    : ""}
                </div>
                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-destructive">
                      {t("errorCount", { count: importResult.errors.length })}
                    </p>
                    <ul className="text-xs text-destructive space-y-0.5">
                      {importResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Mutation error */}
            {(importClientsCsv.error ||
              importPatientsCsv.error ||
              importVaccinationsCsv.error ||
              importSoapNotesCsv.error) && (
              <p className="text-sm text-destructive">
                {importClientsCsv.error?.message ??
                  importPatientsCsv.error?.message ??
                  importVaccinationsCsv.error?.message ??
                  importSoapNotesCsv.error?.message}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ImportStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/60 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value.toLocaleString()}</p>
    </div>
  );
}

// ── Rooms ───────────────────────────────────────────────────
function RoomsTab() {
  const t = useTranslations("settings.page");
  const roomTypeLabel = useRoomTypeLabel();
  const utils = trpc.useUtils();
  const locationsQuery = trpc.settings.listLocations.useQuery();
  const {
    data: roomList,
    isLoading,
    error: roomsError,
    refetch: refetchRooms,
  } = trpc.settings.listRooms.useQuery();
  const createMutation = trpc.settings.createRoom.useMutation({
    onSuccess: () => {
      utils.settings.listRooms.invalidate();
      setShowAdd(false);
      setAddForm({
        name: "",
        type: "exam",
        locationId:
          locationsQuery.data?.find((location) => location.isPrimary)?.id ??
          locationsQuery.data?.[0]?.id ??
          "",
      });
      toast.success(t("roomCreated"));
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const deleteMutation = trpc.settings.deleteRoom.useMutation({
    onSuccess: () => {
      utils.settings.listRooms.invalidate();
      toast.success(t("roomDeleted"));
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    type: "exam" as "exam" | "surgery" | "treatment" | "boarding",
    locationId: "",
  });
  const isRoomNameValid = (name: string) =>
    name.trim().length > 0 && name.trim().length <= ROOM_NAME_MAX_LENGTH;
  const roomsMissing = !isLoading && !roomsError && !roomList;
  const roomLocations = locationsQuery.data ?? [];

  useEffect(() => {
    if (!addForm.locationId && roomLocations.length > 0) {
      setAddForm((current) => ({
        ...current,
        locationId:
          roomLocations.find((location) => location.isPrimary)?.id ??
          roomLocations[0]!.id,
      }));
    }
  }, [addForm.locationId, roomLocations]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (roomsError) {
    return <SettingsLoadError message={roomsError.message} />;
  }
  if (roomsMissing) {
    return (
      <SettingsLoadError
        title={t("couldNotLoadRooms")}
        message={t("roomsEmpty")}
        onRetry={() => void refetchRooms()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowAdd(!showAdd)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          {t("addRoom")}
        </Button>
      </div>

      {showAdd && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">{t("newRoom")}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              placeholder={t("roomName")}
              maxLength={ROOM_NAME_MAX_LENGTH}
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
            />
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={addForm.type}
              onChange={(e) =>
                setAddForm({
                  ...addForm,
                  type: e.target.value as typeof addForm.type,
                })
              }
            >
              {ROOM_TYPES.map((roomType) => (
                <option key={roomType} value={roomType}>
                  {t(`roomTypes.${roomType}`)}
                </option>
              ))}
            </select>
            <select
              aria-label={t("clinicLocation")}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={addForm.locationId}
              onChange={(event) =>
                setAddForm({ ...addForm, locationId: event.target.value })
              }
              disabled={locationsQuery.isLoading || roomLocations.length === 0}
            >
              <option value="">{t("selectLocation")}</option>
              {roomLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={
                !isRoomNameValid(addForm.name) ||
                !addForm.locationId ||
                createMutation.isPending
              }
              onClick={() => createMutation.mutate(addForm)}
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("create")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">{t("name")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("type")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("location2")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {roomList?.map((room) => (
              <tr
                key={room.id}
                className="border-b border-border last:border-0"
              >
                <td className="px-4 py-3 font-medium">{room.name}</td>
                <td className="px-4 py-3 text-muted-foreground capitalize">
                  {roomTypeLabel(room.type)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {roomLocations.find(
                    (location) => location.id === room.locationId,
                  )?.name ?? t("unassigned")}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate({ id: room.id })}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
            {roomList?.length === 0 && (
              <tr>
                <td colSpan={4} className="p-0">
                  <EmptyState
                    className="border-0 bg-transparent p-8"
                    icon={DoorOpen}
                    title={t("noRoomsConfigured")}
                    description={t("addRoomsSoAppointmentsCan")}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Wellness Plans ──────────────────────────────────────────
function WellnessPlansTab() {
  const t = useTranslations("settings.page");
  const formatCurrency = useCurrencyFormatter();
  const utils = trpc.useUtils();
  const {
    data: plans,
    isLoading,
    error: wellnessError,
    refetch: refetchWellnessPlans,
  } = trpc.wellness.listPlans.useQuery();
  const createMutation = trpc.wellness.createPlan.useMutation({
    onSuccess: () => {
      utils.wellness.listPlans.invalidate();
      setShowAdd(false);
      setAddForm({
        name: "",
        description: "",
        price: "",
        billingInterval: "monthly",
      });
      toast.success(t("wellnessPlanCreated"));
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const setPlanActive = trpc.wellness.setPlanActive.useMutation({
    onSuccess: (_plan, variables) => {
      utils.wellness.listPlans.invalidate();
      utils.wellness.listDue.invalidate();
      toast.success(
        variables.active
          ? t("wellnessPlanReactivated")
          : t("wellnessPlanDeactivated"),
      );
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<{
    name: string;
    description: string;
    price: string;
    billingInterval: "monthly" | "annual";
  }>({
    name: "",
    description: "",
    price: "",
    billingInterval: "monthly",
  });
  const priceValue = Number(addForm.price);
  const canCreate =
    addForm.name.trim().length > 0 &&
    addForm.name.trim().length <= WELLNESS_PLAN_NAME_MAX_LENGTH &&
    addForm.description.trim().length <= WELLNESS_PLAN_DESCRIPTION_MAX_LENGTH &&
    isWellnessPlanPriceInputValid(addForm.price) &&
    !createMutation.isPending;
  const wellnessPlansMissing = !isLoading && !wellnessError && !plans;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (wellnessError) {
    return <SettingsLoadError message={wellnessError.message} />;
  }
  if (wellnessPlansMissing) {
    return (
      <SettingsLoadError
        title={t("couldNotLoadWellnessPlans")}
        message={t("wellnessEmpty")}
        onRetry={() => void refetchWellnessPlans()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{t("scheduledInvoiceBilling")}</h3>
            <Badge variant="secondary">{t("noAutoCharge")}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("wellnessIntro")}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("addPlan")}
        </Button>
      </div>

      {showAdd && (
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">{t("newWellnessPlan")}</h3>
          <div className="grid gap-3 md:grid-cols-[1fr_9rem_9rem]">
            <Input
              placeholder={t("planName")}
              maxLength={WELLNESS_PLAN_NAME_MAX_LENGTH}
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
            />
            <Input
              type="number"
              min={WELLNESS_PLAN_PRICE_MIN}
              max={WELLNESS_PLAN_PRICE_MAX}
              step={10 ** -WELLNESS_PLAN_PRICE_SCALE}
              placeholder={t("price")}
              value={addForm.price}
              onChange={(e) =>
                setAddForm({ ...addForm, price: e.target.value })
              }
            />
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={addForm.billingInterval}
              onChange={(e) =>
                setAddForm({
                  ...addForm,
                  billingInterval: e.target
                    .value as typeof addForm.billingInterval,
                })
              }
            >
              <option value="monthly">{t("monthly")}</option>
              <option value="annual">{t("annual")}</option>
            </select>
          </div>
          <Input
            placeholder={t("descriptionOptional")}
            maxLength={WELLNESS_PLAN_DESCRIPTION_MAX_LENGTH}
            value={addForm.description}
            onChange={(e) =>
              setAddForm({ ...addForm, description: e.target.value })
            }
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!canCreate}
              onClick={() =>
                createMutation.mutate({
                  name: addForm.name.trim(),
                  description: addForm.description.trim() || undefined,
                  price: priceValue,
                  billingInterval: addForm.billingInterval,
                })
              }
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("create")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">{t("name")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("interval")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("price")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("status")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {plans?.map((plan) => (
              <tr
                key={plan.id}
                className="border-b border-border last:border-0"
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{plan.name}</div>
                  {plan.description && (
                    <div className="text-sm text-muted-foreground">
                      {plan.description}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="capitalize text-muted-foreground">
                    {t(`intervals.${plan.billingInterval}`)}
                  </div>
                  <Badge variant="outline" className="mt-1">
                    {t("invoiceSchedule")}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatCurrency(plan.price)}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={plan.active ? "default" : "secondary"}>
                    {plan.active ? t("active") : t("inactive")}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={setPlanActive.isPending}
                    onClick={() =>
                      setPlanActive.mutate({
                        planId: plan.id,
                        active: !plan.active,
                      })
                    }
                  >
                    {plan.active ? t("deactivate2") : t("reactivate")}
                  </Button>
                </td>
              </tr>
            ))}
            {plans?.length === 0 && (
              <tr>
                <td colSpan={5} className="p-0">
                  <EmptyState
                    className="border-0 bg-transparent p-8"
                    icon={HeartPulse}
                    title={t("noWellnessPlansConfigured")}
                    description={t("createAPlanToPackage")}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Templates ────────────────────────────────────────────────
const TEMPLATE_CATEGORIES = [
  "surgery",
  "wellness",
  "dental",
  "preventive",
  "emergency",
  "other",
] as const;

type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

const CATEGORY_BADGE: Record<string, string> = {
  surgery: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  wellness:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  dental: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  preventive:
    "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
  emergency:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

interface TemplateItem {
  draftId: number;
  itemType: "service" | "product";
  itemId?: string | null;
  description: string;
  defaultQuantity: number;
  defaultUnitPrice: string;
  sortOrder: number;
}

function TemplatesTab() {
  const t = useTranslations("settings.page");
  const formatCurrency = useCurrencyFormatter();
  const utils = trpc.useUtils();
  const [showAdd, setShowAdd] = useState(false);
  const nextTemplateItemDraftId = useRef(1);
  const {
    data: templateList,
    isLoading,
    error: templatesError,
    refetch: refetchTemplates,
  } = trpc.templates.list.useQuery();
  const createMutation = trpc.templates.create.useMutation({
    onSuccess: () => {
      utils.templates.list.invalidate();
      setShowAdd(false);
      resetAddForm();
      toast.success(t("templateCreated"));
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const updateMutation = trpc.templates.update.useMutation({
    onSuccess: () => {
      utils.templates.list.invalidate();
      toast.success(t("templateUpdated"));
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const [addForm, setAddForm] = useState({
    name: "",
    description: "",
    category: "other" as TemplateCategory,
  });
  const [addItems, setAddItems] = useState<TemplateItem[]>([
    {
      draftId: 0,
      itemType: "service",
      itemId: null,
      description: "",
      defaultQuantity: 1,
      defaultUnitPrice: "0",
      sortOrder: 0,
    },
  ]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );

  const resetAddForm = () => {
    setAddForm({ name: "", description: "", category: "other" });
    setAddItems([
      {
        draftId: nextTemplateItemDraftId.current++,
        itemType: "service",
        itemId: null,
        description: "",
        defaultQuantity: 1,
        defaultUnitPrice: "0",
        sortOrder: 0,
      },
    ]);
  };

  const addItemRow = () => {
    setAddItems((currentItems) => [
      ...currentItems,
      {
        draftId: nextTemplateItemDraftId.current++,
        itemType: "service",
        itemId: null,
        description: "",
        defaultQuantity: 1,
        defaultUnitPrice: "0",
        sortOrder: currentItems.length,
      },
    ]);
  };

  const removeItemRow = (index: number) => {
    setAddItems((currentItems) =>
      currentItems.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const updateItem = (
    index: number,
    field: Exclude<keyof TemplateItem, "draftId">,
    value: string | number | null,
  ) => {
    setAddItems((currentItems) =>
      currentItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const changeItemType = (
    index: number,
    itemType: TemplateItem["itemType"],
  ) => {
    setAddItems((currentItems) =>
      currentItems.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              itemType,
              itemId: null,
              description: "",
              defaultUnitPrice: "0",
            }
          : item,
      ),
    );
  };

  const selectTemplateCatalogItem = (
    index: number,
    catalogItem: TemplateCatalogItem | null,
  ) => {
    setAddItems((currentItems) =>
      currentItems.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              itemId: catalogItem?.id ?? null,
              description: catalogItem?.name ?? "",
              defaultUnitPrice: catalogItem?.unitPrice ?? "0",
            }
          : item,
      ),
    );
  };

  const templateItemsToCreate = addItems
    .map((item, index) => ({
      itemType: item.itemType,
      itemId: item.itemId || undefined,
      description: item.description.trim(),
      defaultQuantity: item.defaultQuantity,
      defaultUnitPrice: item.defaultUnitPrice.trim(),
      sortOrder: index,
    }))
    .filter((item) => item.description.length > 0);
  const hasCatalogLink = (itemId?: string | null) => Boolean(itemId);
  const isTemplateItemFormValid = (item: Omit<TemplateItem, "draftId">) =>
    hasCatalogLink(item.itemId) &&
    item.description.trim().length > 0 &&
    item.description.trim().length <=
      TREATMENT_TEMPLATE_ITEM_DESCRIPTION_MAX_LENGTH &&
    isTreatmentTemplateQuantityValid(item.defaultQuantity) &&
    isTreatmentTemplateUnitPriceInputValid(item.defaultUnitPrice) &&
    isTreatmentTemplateItemTotalValid(
      item.defaultUnitPrice,
      item.defaultQuantity,
    );
  const hasUnlinkedCatalogRows = addItems.some(
    (item) => !hasCatalogLink(item.itemId),
  );
  const canCreateTemplate =
    addForm.name.trim().length > 0 &&
    addForm.name.trim().length <= TREATMENT_TEMPLATE_NAME_MAX_LENGTH &&
    addForm.description.trim().length <=
      TREATMENT_TEMPLATE_DESCRIPTION_MAX_LENGTH &&
    templateItemsToCreate.length > 0 &&
    templateItemsToCreate.length <= TREATMENT_TEMPLATE_MAX_ITEMS &&
    templateItemsToCreate.every(isTemplateItemFormValid) &&
    !hasUnlinkedCatalogRows &&
    !createMutation.isPending;

  const selectedTemplate = templateList?.find(
    (t) => t.id === selectedTemplateId,
  );
  const {
    data: selectedTemplateDetail,
    isLoading: selectedTemplateLoading,
    error: selectedTemplateError,
    refetch: refetchSelectedTemplate,
  } = trpc.templates.getById.useQuery(
    { id: selectedTemplateId! },
    { enabled: !!selectedTemplateId },
  );
  const templatesMissing = !isLoading && !templatesError && !templateList;
  const selectedTemplateMissing =
    !!selectedTemplate &&
    !selectedTemplateLoading &&
    !selectedTemplateError &&
    !selectedTemplateDetail;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (templatesError) {
    return <SettingsLoadError message={templatesError.message} />;
  }
  if (templatesMissing) {
    return (
      <SettingsLoadError
        title={t("couldNotLoadTemplates")}
        message={t("templatesEmpty")}
        onRetry={() => void refetchTemplates()}
      />
    );
  }

  // Detail view for a selected template
  if (selectedTemplate) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedTemplateId(null)}
          >
            <X className="mr-2 h-4 w-4" />
            {t("back")}
          </Button>
          <h3 className="text-sm font-semibold">{selectedTemplate.name}</h3>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              selectedTemplate.isActive !== false
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
            )}
          >
            {selectedTemplate.isActive !== false ? t("active") : t("inactive")}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={updateMutation.isPending}
            onClick={() =>
              updateMutation.mutate({
                id: selectedTemplate.id,
                isActive: !selectedTemplate.isActive,
              })
            }
          >
            {updateMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {selectedTemplate.isActive !== false ? t("deactivate2") : t("activate")}
          </Button>
        </div>

        {selectedTemplate.description && (
          <p className="text-sm text-muted-foreground">
            {selectedTemplate.description}
          </p>
        )}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">{t("description")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("type")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("quantity")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("unitPrice")}</th>
              </tr>
            </thead>
            <tbody>
              {selectedTemplateError ? (
                <tr>
                  <td colSpan={4} className="p-4">
                    <SettingsLoadError
                      message={selectedTemplateError.message}
                    />
                  </td>
                </tr>
              ) : selectedTemplateLoading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    {t("loadingTemplateItems")}
                  </td>
                </tr>
              ) : selectedTemplateMissing ? (
                <tr>
                  <td colSpan={4} className="p-4">
                    <SettingsLoadError
                      title={t("couldNotLoadTemplateItems")}
                      message={t("templateDetailEmpty")}
                      onRetry={() => void refetchSelectedTemplate()}
                    />
                  </td>
                </tr>
              ) : selectedTemplateDetail?.items?.length ? (
                selectedTemplateDetail.items.map((item: any, i: number) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">
                      {item.description}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="capitalize">
                        {item.itemType === "service" ? t("service") : t("product")}
                      </span>
                      {item.itemType === "product" &&
                      item.hasActiveProductLink !== true ? (
                        <p className="mt-1 max-w-xs text-xs text-amber-700 dark:text-amber-400">
                          {t("missingOrArchivedInventoryProduct")}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.defaultQuantity}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {formatCurrency(item.defaultUnitPrice)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-0">
                    <EmptyState
                      className="border-0 bg-transparent p-8"
                      icon={Layers}
                      title={t("noItemsInThisTemplate")}
                      description={t("addDefaultServicesOrProducts")}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setShowAdd(!showAdd);
            resetAddForm();
          }}
          size="sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("addTemplate")}
        </Button>
      </div>

      {showAdd && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">{t("newTreatmentTemplate")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder={t("templateName")}
              maxLength={TREATMENT_TEMPLATE_NAME_MAX_LENGTH}
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
            />
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={addForm.category}
              onChange={(e) =>
                setAddForm({
                  ...addForm,
                  category: e.target.value as TemplateCategory,
                })
              }
            >
              {TEMPLATE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`templateCategories.${c}`)}
                </option>
              ))}
            </select>
          </div>
          <Input
            placeholder={t("descriptionOptional")}
            maxLength={TREATMENT_TEMPLATE_DESCRIPTION_MAX_LENGTH}
            value={addForm.description}
            onChange={(e) =>
              setAddForm({ ...addForm, description: e.target.value })
            }
          />

          {/* Items */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">{t("items")}</h4>
            {addItems.map((item, index) => (
              <div
                key={item.draftId}
                className="grid grid-cols-2 items-center gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]"
              >
                <div className="col-span-2 min-w-0 lg:col-span-1">
                  <TemplateCatalogPicker
                    itemType={item.itemType}
                    value={item.itemId ?? null}
                    selectedLabel={item.description}
                    excludedIds={addItems
                      .filter(
                        (candidate, candidateIndex) =>
                          candidateIndex !== index &&
                          candidate.itemType === item.itemType &&
                          Boolean(candidate.itemId),
                      )
                      .map((candidate) => candidate.itemId!)}
                    formatPrice={formatCurrency}
                    onSelect={(catalogItem) =>
                      selectTemplateCatalogItem(index, catalogItem)
                    }
                  />
                </div>
                <select
                  aria-label={t("itemType", { n: index + 1 })}
                  className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                  value={item.itemType}
                  onChange={(e) =>
                    changeItemType(
                      index,
                      e.target.value as TemplateItem["itemType"],
                    )
                  }
                >
                  <option value="service">{t("service")}</option>
                  <option value="product">{t("product")}</option>
                </select>
                <Input
                  type="number"
                  placeholder={t("qty")}
                  min={TREATMENT_TEMPLATE_ITEM_QUANTITY_MIN}
                  max={TREATMENT_TEMPLATE_ITEM_QUANTITY_MAX}
                  step={1}
                  className="w-full lg:w-20"
                  value={item.defaultQuantity}
                  onChange={(e) =>
                    updateItem(
                      index,
                      "defaultQuantity",
                      parseInt(e.target.value) || 1,
                    )
                  }
                />
                <Input
                  type="number"
                  placeholder={t("price")}
                  min={0}
                  max={TREATMENT_TEMPLATE_UNIT_PRICE_MAX}
                  step="0.01"
                  className="w-full lg:w-28"
                  value={item.defaultUnitPrice}
                  onChange={(e) =>
                    updateItem(index, "defaultUnitPrice", e.target.value)
                  }
                />
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t("removeItem", { n: index + 1 })}
                  disabled={addItems.length <= 1}
                  onClick={() => removeItemRow(index)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            {hasUnlinkedCatalogRows ? (
              <p className="text-sm text-muted-foreground">
                {t("searchForAndSelectAn")}
              </p>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              disabled={addItems.length >= TREATMENT_TEMPLATE_MAX_ITEMS}
              onClick={addItemRow}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("addItem")}
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!canCreateTemplate}
              onClick={() =>
                createMutation.mutate({
                  name: addForm.name.trim(),
                  description: addForm.description.trim() || undefined,
                  category: addForm.category,
                  items: templateItemsToCreate,
                })
              }
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("create")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              {t("cancel")}
            </Button>
          </div>
          {createMutation.error && (
            <p className="text-sm text-destructive">
              {createMutation.error.message}
            </p>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">{t("name")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("category")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("items")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("status")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {templateList?.map((template) => (
              <tr
                key={template.id}
                className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/30"
                onClick={() => setSelectedTemplateId(template.id)}
              >
                <td className="px-4 py-3 font-medium">{template.name}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                      CATEGORY_BADGE[template.category ?? "other"] ??
                        CATEGORY_BADGE.other,
                    )}
                  >
                    {(TEMPLATE_CATEGORIES as readonly (string | null)[]).includes(template.category)
                      ? t(`templateCategories.${template.category}`)
                      : template.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">—</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                      template.isActive !== false
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
                    )}
                  >
                    {template.isActive !== false ? t("active") : t("inactive")}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateMutation.mutate({
                        id: template.id,
                        isActive: !template.isActive,
                      });
                    }}
                  >
                    {template.isActive !== false ? (
                      <X className="h-4 w-4 text-destructive" />
                    ) : (
                      <Check className="h-4 w-4 text-green-600" />
                    )}
                  </Button>
                </td>
              </tr>
            ))}
            {templateList?.length === 0 && (
              <tr>
                <td colSpan={5} className="p-0">
                  <EmptyState
                    className="border-0 bg-transparent p-8"
                    icon={Layers}
                    title={t("noTemplatesConfigured")}
                    description={t("createReusableTreatmentTemplatesFor")}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
