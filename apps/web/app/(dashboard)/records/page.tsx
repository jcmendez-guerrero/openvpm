"use client";

import { useLocale, useTranslations } from "use-intl";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Search,
  FileText,
  Syringe,
  Pill,
  ClipboardList,
  Plus,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Scissors,
  Tag,
  AlertTriangle,
  CheckCircle2,
  History,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useSpeciesLabel } from "@/lib/patients/use-species-label";
import { formatDateInputForTimeZone } from "@/lib/date-input";
import { useOnlineStatus } from "@/lib/use-online-status";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes-guard";
import { formatClinicalDateTime } from "@/lib/records/clinical-dates";
import { soapSectionText } from "@/lib/records/soap-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/empty-state";
import { ClinicalCorrectionControl } from "@/components/records/clinical-correction-control";
import {
  PrescriptionInventoryProductPicker,
  type PrescriptionInventoryProduct,
} from "@/components/records/prescription-inventory-product-picker";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  PATIENT_SEARCH_MAX_LENGTH,
  isPatientSearchInputValid,
} from "@/lib/patients/policy";
import type { PrescriptionSafetyWarning } from "@/lib/records/prescription-safety";
import { buildLabTrends } from "@/lib/records/clinical-trends";
import {
  PRESCRIPTION_COUNT_MAX,
  PRESCRIPTION_DOSAGE_MAX_LENGTH,
  PRESCRIPTION_FREQUENCY_MAX_LENGTH,
  PRESCRIPTION_INSTRUCTIONS_MAX_LENGTH,
  PRESCRIPTION_MEDICATION_NAME_MAX_LENGTH,
  PRESCRIPTION_QUANTITY_MIN,
  PRESCRIPTION_REFILLS_MIN,
  isPrescriptionNonnegativeIntegerInputValid,
  isPrescriptionOptionalQuantityInputValid,
  isPrescriptionOptionalTextInputValid,
  isPrescriptionQuantityInputValid,
  isPrescriptionRequiredTextInputValid,
} from "@/lib/records/prescription-policy";
import {
  LAB_REFERENCE_MAX,
  LAB_REFERENCE_MIN,
  LAB_REFERENCE_STEP,
  LAB_RESULT_VALUE_MAX_LENGTH,
  LAB_TEST_NAME_MAX_LENGTH,
  LAB_UNIT_MAX_LENGTH,
  isLabOptionalReferenceInputValid,
  isLabOptionalTextInputValid,
  isLabReferenceRangeOrdered,
  isLabRequiredTextInputValid,
} from "@/lib/records/lab-policy";
import {
  VaccinationFormFields,
  initialVaccinationForm,
  isVaccinationFormValid,
  type VaccinationFormState,
} from "@/components/records/vaccination-form-fields";
import {
  PROBLEM_DESCRIPTION_MAX_LENGTH,
  PROBLEM_STATUSES,
  type ProblemStatus,
  isProblemOptionalDateInputValid,
  isProblemRequiredTextInputValid,
} from "@/lib/records/problem-policy";
import {
  PROCEDURE_ANESTHESIA_MAX_LENGTH,
  PROCEDURE_DESCRIPTION_MAX_LENGTH,
  PROCEDURE_DURATION_MAX_MINUTES,
  PROCEDURE_DURATION_MIN_MINUTES,
  PROCEDURE_NAME_MAX_LENGTH,
  PROCEDURE_NOTES_MAX_LENGTH,
  isProcedureOptionalDurationInputValid,
  isProcedureOptionalTextInputValid,
  isProcedureRequiredTextInputValid,
} from "@/lib/records/procedure-policy";

type Tab = "soap" | "vaccinations" | "prescriptions" | "problems" | "labResults" | "procedures";

const tabs: { id: Tab; icon: React.ElementType }[] = [
  { id: "soap", icon: FileText },
  { id: "vaccinations", icon: Syringe },
  { id: "prescriptions", icon: Pill },
  { id: "problems", icon: ClipboardList },
  { id: "labResults", icon: FlaskConical },
  { id: "procedures", icon: Scissors },
];

function isTab(value: string | null): value is Tab {
  return tabs.some((tab) => tab.id === value);
}

function RecordsChartChunkLoading() {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 h-5 w-32 animate-pulse rounded bg-muted" />
      <div className="h-56 w-full animate-pulse rounded bg-muted" />
    </div>
  );
}

function PrescriptionLifecycleChunkLoading() {
  return <div className="h-8 w-24 animate-pulse rounded bg-muted" />;
}

const LabTrendCharts = dynamic(
  () =>
    import("@/components/patients/patient-trend-charts").then(
      (mod) => mod.LabTrendCharts
    ),
  {
    ssr: false,
    loading: RecordsChartChunkLoading,
  }
);

const PrescriptionLifecycleControl = dynamic(
  () =>
    import("@/components/records/prescription-lifecycle-control").then(
      (mod) => mod.PrescriptionLifecycleControl,
    ),
  {
    ssr: false,
    loading: PrescriptionLifecycleChunkLoading,
  },
);

const CLINICAL_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "numeric",
  day: "numeric",
};

function clinicalDateInputToUtcDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function dateInputDayNumber(value: string): number | null {
  const date = clinicalDateInputToUtcDate(value);
  if (!date) return null;
  return Math.floor(date.getTime() / (1000 * 60 * 60 * 24));
}

function formatClinicalDate(
  value: Date | string | null | undefined,
  timeZone?: string | null,
  fallback = "--",
  locale = "en-US"
): string {
  if (!value) return fallback;

  if (typeof value === "string") {
    const dateOnly = clinicalDateInputToUtcDate(value);
    if (dateOnly) {
      return dateOnly.toLocaleDateString(locale, {
        ...CLINICAL_DATE_FORMAT,
        timeZone: "UTC",
      });
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  const options = {
    ...CLINICAL_DATE_FORMAT,
    timeZone: timeZone ?? undefined,
  };

  try {
    return date.toLocaleDateString(locale, options);
  } catch {
    return date.toLocaleDateString(locale, {
      ...options,
      timeZone: undefined,
    });
  }
}

function getVaccineDueStatus(
  nextDueDate: string | null,
  timeZone?: string | null
): {
  label: "na" | "overdue" | "dueSoon" | "current";
  className: string;
} {
  if (!nextDueDate) return { label: "na", className: "text-muted-foreground" };
  const today = formatDateInputForTimeZone(new Date(), timeZone);
  const todayDay = dateInputDayNumber(today);
  const dueDay = dateInputDayNumber(nextDueDate);
  if (todayDay === null || dueDay === null) {
    return { label: "na", className: "text-muted-foreground" };
  }
  const daysUntilDue = dueDay - todayDay;

  if (daysUntilDue < 0)
    return {
      label: "overdue",
      className:
        "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    };
  if (daysUntilDue <= 30)
    return {
      label: "dueSoon",
      className:
        "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    };
  return {
    label: "current",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  };
}

function getLabStatusBadge(status: string | null) {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    case "completed":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "reviewed":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  }
}

function isOutOfRange(
  resultValue: string | null,
  low: string | null,
  high: string | null
): boolean {
  if (!resultValue) return false;
  const val = parseFloat(resultValue);
  if (isNaN(val)) return false;
  if (low !== null && low !== undefined) {
    const lowVal = parseFloat(low);
    if (!isNaN(lowVal) && val < lowVal) return true;
  }
  if (high !== null && high !== undefined) {
    const highVal = parseFloat(high);
    if (!isNaN(highVal) && val > highVal) return true;
  }
  return false;
}

function getPrescriptionStatusBadge(status: string | null) {
  switch (status) {
    case "active":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "completed":
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
    case "discontinued":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  }
}

// Tabs restricted from front_desk: SOAP Notes, Prescriptions, Lab Results, Procedures
const frontDeskRestrictedTabs: Tab[] = ["soap", "prescriptions", "labResults", "procedures"];

type LabResultFormState = {
  testName: string;
  resultValue: string;
  unit: string;
  referenceRangeLow: string;
  referenceRangeHigh: string;
  resultFlag: "unknown" | "normal" | "abnormal" | "critical";
};

type ReplacementPatientOption = {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
};

type ProblemFormState = {
  description: string;
  status: ProblemStatus;
  onsetDate: string;
};

type ProcedureFormState = {
  name: string;
  description: string;
  anesthesiaUsed: string;
  durationMinutes: string;
  notes: string;
};

type PrescriptionFormState = {
  medicationName: string;
  productId: string;
  dosage: string;
  frequency: string;
  quantity: string;
  refillsRemaining: string;
  startDate: string;
  endDate: string;
  instructions: string;
  acknowledgeSafetyWarnings: boolean;
};

function initialLabResultForm(): LabResultFormState {
  return {
    testName: "",
    resultValue: "",
    unit: "",
    referenceRangeLow: "",
    referenceRangeHigh: "",
    resultFlag: "unknown",
  };
}

function initialProblemForm(): ProblemFormState {
  return {
    description: "",
    status: "active",
    onsetDate: "",
  };
}

function initialProcedureForm(): ProcedureFormState {
  return {
    name: "",
    description: "",
    anesthesiaUsed: "",
    durationMinutes: "",
    notes: "",
  };
}

function dateInputValue(date: Date, timeZone?: string | null): string {
  return formatDateInputForTimeZone(date, timeZone);
}

function initialPrescriptionForm(timeZone?: string | null): PrescriptionFormState {
  return {
    medicationName: "",
    productId: "",
    dosage: "",
    frequency: "",
    quantity: "",
    refillsRemaining: "0",
    startDate: dateInputValue(new Date(), timeZone),
    endDate: "",
    instructions: "",
    acknowledgeSafetyWarnings: false,
  };
}

function optionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function safetyBadgeVariant(
  warning: PrescriptionSafetyWarning
): "destructive" | "warning" | "secondary" {
  if (warning.severity === "major") return "destructive";
  if (warning.severity === "moderate") return "warning";
  return "secondary";
}

function PrescriptionSafetyPanel({
  medicationName,
  isLoading,
  errorMessage,
  warnings,
}: {
  medicationName: string;
  isLoading: boolean;
  errorMessage?: string;
  warnings: PrescriptionSafetyWarning[];
}) {
  const t = useTranslations("records.page.safety");
  if (medicationName.trim().length < 2) return null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t("checking")}
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{t("failed", { message: errorMessage })}</span>
      </div>
    );
  }

  if (warnings.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        <CheckCircle2 className="h-4 w-4" />
        {t("none")}
      </div>
    );
  }

  const hasBlockingWarning = warnings.some((warning) => warning.requiresOverride);

  return (
    <div
      className={cn(
        "rounded-md border p-3",
        hasBlockingWarning
          ? "border-amber-300 bg-amber-50"
          : "border-border bg-muted/30"
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <AlertTriangle
          className={cn(
            "h-4 w-4",
            hasBlockingWarning ? "text-amber-700" : "text-muted-foreground"
          )}
        />
        {t("title")}
      </div>
      <div className="space-y-2">
        {warnings.map((warning, index) => (
          <div
            key={`${warning.type}-${warning.title}-${index}`}
            className="rounded-md border border-border/60 bg-background px-3 py-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{warning.title}</p>
              <Badge variant={safetyBadgeVariant(warning)} className="capitalize">
                {warning.severity}
              </Badge>
              {warning.requiresOverride && (
                <Badge variant="outline">{t("override")}</Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {warning.message}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecordsErrorPanel({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive",
        className
      )}
    >
      {message}
    </div>
  );
}

function RecordsLoadingPanel({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function CorrectedLabResultHistory({
  resultId,
  timeZone,
}: {
  resultId: string;
  timeZone?: string | null;
}) {
  const t = useTranslations("labs.results");
  const tp = useTranslations("records.page");
  const locale = useLocale();
  const [expanded, setExpanded] = useState(false);
  const history = trpc.records.listLabResultHistory.useQuery(
    { id: resultId },
    { enabled: expanded, staleTime: 60_000 }
  );

  return (
    <div className="mt-2 border-t border-border pt-2">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="px-2"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <History className="mr-1.5 h-4 w-4" aria-hidden="true" />
        {expanded ? t("hideHistory") : t("showHistory")}
      </Button>
      {expanded ? (
        <div className="mt-2 space-y-2" aria-live="polite">
          {history.isLoading ? (
            <p className="text-xs text-muted-foreground">{t("loadingEvidence")}</p>
          ) : history.error ? (
            <p role="alert" className="text-xs text-destructive">
              {t("historyFailed", { message: history.error.message })}
            </p>
          ) : history.data?.length ? (
            <ol className="space-y-2">
              {history.data.map((event) => (
                <li
                  key={event.id}
                  className="rounded-md bg-muted/50 px-3 py-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium capitalize">
                      {t(`events.${event.eventType}`)}
                    </span>
                    <span className="text-muted-foreground">
                      {formatClinicalDateTime(
                        event.createdAt,
                        timeZone,
                        tp("timeUnavailable"),
                        locale
                      )}{" "}
                      · {event.actorName}
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {event.resultValue
                      ? `${t("snapshot", { value: event.resultValue })}${event.unit ? ` ${event.unit}` : ""}${
                          event.referenceRangeLow != null &&
                          event.referenceRangeHigh != null
                            ? ` · ${t("referenceLower", { low: event.referenceRangeLow, high: event.referenceRangeHigh })}`
                            : ""
                        } · ${t(`flags.${event.resultFlag}`)}`
                      : t("valuesPendingEvent")}
                  </p>
                  {event.note ? <p className="mt-1">{event.note}</p> : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("noHistory")}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function RecordsPageContent() {
  const router = useRouter();
  const t = useTranslations("records.page");
  const ts = useTranslations("patients.soap");
  const ta = useTranslations("patients.addendum");
  const tl = useTranslations("labs.results");
  const tsec = useTranslations("records.soap");
  const locale = useLocale();
  const speciesLabel = useSpeciesLabel();
  const utils = trpc.useUtils();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const isOnline = useOnlineStatus();
  const linkedPatientId = searchParams.get("patientId") ?? "";
  const linkedAppointmentId = searchParams.get("appointmentId") ?? "";
  const requestedTab = searchParams.get("tab");
  const shouldOpenNewRecord = searchParams.get("new") === "1";
  const requestedAmendLabResultId = searchParams.get("amendLabResultId");
  const visitContextKey = linkedPatientId ? searchParams.toString() : "";
  const appliedVisitLink = useRef<string | null>(null);
  const appliedSoapHash = useRef<string | null>(null);
  const appliedLabAmendLink = useRef<string | null>(null);
  const prescriptionOperationId = useRef<string | null>(null);
  const labResultCreationOperationId = useRef<string | null>(null);
  const labCorrectionOperationIds = useRef(new Map<string, string>());
  const labReviewOperationIds = useRef(new Map<string, string>());
  const userRole = session?.user?.role;
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<{
    id: string;
    name: string;
    species: string | null;
    breed: string | null;
    clientFirstName: string | null;
    clientLastName: string | null;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("soap");
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [showVaccinationForm, setShowVaccinationForm] = useState(false);
  const [showProblemForm, setShowProblemForm] = useState(false);
  const [showLabForm, setShowLabForm] = useState(false);
  const [replacesLabResultId, setReplacesLabResultId] = useState<string | null>(
    null
  );
  const [replacementPatient, setReplacementPatient] =
    useState<ReplacementPatientOption | null>(null);
  const [replacementPatientSearch, setReplacementPatientSearch] = useState("");
  const [showProcedureForm, setShowProcedureForm] = useState(false);
  const [showPrescriptionForm, setShowPrescriptionForm] = useState(false);
  const [vaccinationForm, setVaccinationForm] = useState<VaccinationFormState>(
    () => initialVaccinationForm()
  );
  const [problemForm, setProblemForm] = useState<ProblemFormState>(() =>
    initialProblemForm()
  );
  const [labForm, setLabForm] = useState<LabResultFormState>(() =>
    initialLabResultForm()
  );
  const [procedureForm, setProcedureForm] = useState<ProcedureFormState>(() =>
    initialProcedureForm()
  );
  const [prescriptionForm, setPrescriptionForm] = useState<PrescriptionFormState>(
    () => initialPrescriptionForm()
  );
  const [selectedPrescriptionProduct, setSelectedPrescriptionProduct] =
    useState<PrescriptionInventoryProduct | null>(null);
  const trimmedSearchQuery = searchQuery.trim();
  const canSearchPatients = isPatientSearchInputValid(searchQuery);
  const canSearchReplacementPatients =
    Boolean(replacesLabResultId) &&
    isPatientSearchInputValid(replacementPatientSearch);

  const linkedPatientQuery = trpc.patients.getById.useQuery(
    { id: linkedPatientId || "00000000-0000-0000-0000-000000000000" },
    { enabled: Boolean(linkedPatientId) }
  );

  useEffect(() => {
    if (
      !visitContextKey ||
      appliedVisitLink.current === visitContextKey ||
      !linkedPatientQuery.data ||
      linkedPatientQuery.data.id !== linkedPatientId
    ) {
      return;
    }
    const linkedPatient = linkedPatientQuery.data;
    setSelectedPatient({
      id: linkedPatient.id,
      name: linkedPatient.name,
      species: linkedPatient.species,
      breed: linkedPatient.breed,
      clientFirstName: linkedPatient.clientFirstName,
      clientLastName: linkedPatient.clientLastName,
    });
    setSearchQuery(linkedPatient.name);
    const linkedTab = requestedTab;
    if (isTab(linkedTab)) {
      setActiveTab(linkedTab);
    }
    setShowVaccinationForm(false);
    setVaccinationForm(initialVaccinationForm());
    setShowLabForm(false);
    setLabForm(initialLabResultForm());
    setReplacesLabResultId(null);
    setReplacementPatient(null);
    setReplacementPatientSearch("");
    setShowProcedureForm(false);
    setProcedureForm(initialProcedureForm());
    setShowPrescriptionForm(false);
    setPrescriptionForm(initialPrescriptionForm());
    if (shouldOpenNewRecord) {
      if (linkedTab === "vaccinations") setShowVaccinationForm(true);
      if (linkedTab === "prescriptions") setShowPrescriptionForm(true);
      if (linkedTab === "labResults") setShowLabForm(true);
      if (linkedTab === "procedures") setShowProcedureForm(true);
    }
    appliedVisitLink.current = visitContextKey;
  }, [
    linkedAppointmentId,
    linkedPatientId,
    linkedPatientQuery.data,
    requestedTab,
    shouldOpenNewRecord,
    visitContextKey,
  ]);

  const {
    data: searchResults,
    isLoading: isSearchingPatients,
    error: patientSearchError,
  } = trpc.patients.search.useQuery(
    { query: trimmedSearchQuery },
    { enabled: canSearchPatients }
  );
  const patientSearchMissing =
    canSearchPatients &&
    !selectedPatient &&
    !isSearchingPatients &&
    !patientSearchError &&
    !searchResults;
  const replacementPatientResults = trpc.patients.search.useQuery(
    { query: replacementPatientSearch.trim() },
    { enabled: canSearchReplacementPatients }
  );

  const patientId = selectedPatient?.id ?? "";
  const visitContextMatchesPatient =
    !linkedAppointmentId ||
    (Boolean(linkedPatientId) && linkedPatientId === patientId);
  const recordsSettings = trpc.records.settings.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const vaccinationProviders =
    trpc.records.listVaccinationProviders.useQuery(undefined, {
      enabled: showVaccinationForm,
      staleTime: 5 * 60 * 1000,
    });
  const recordsSettingsError = recordsSettings.error;
  const recordsSettingsLoading = recordsSettings.isLoading;
  const recordsSettingsMissing =
    !recordsSettingsLoading && !recordsSettingsError && !recordsSettings.data;
  const verifiedRecordsSettings =
    recordsSettingsError || recordsSettingsMissing || !recordsSettings.data
      ? null
      : recordsSettings.data;
  const recordsTimeZone = verifiedRecordsSettings
    ? verifiedRecordsSettings.timezone
    : undefined;
  const recordsPracticeName =
    verifiedRecordsSettings?.name ?? "Veterinary Practice";
  const recordsPracticePhone = verifiedRecordsSettings
    ? verifiedRecordsSettings.phone
    : undefined;
  const hasUnsavedRecordForm =
    (showVaccinationForm &&
      JSON.stringify(vaccinationForm) !==
        JSON.stringify(initialVaccinationForm())) ||
    (showProblemForm &&
      JSON.stringify(problemForm) !== JSON.stringify(initialProblemForm())) ||
    (showLabForm &&
      JSON.stringify(labForm) !== JSON.stringify(initialLabResultForm())) ||
    (showProcedureForm &&
      JSON.stringify(procedureForm) !==
        JSON.stringify(initialProcedureForm())) ||
    (showPrescriptionForm &&
      JSON.stringify(prescriptionForm) !==
        JSON.stringify(initialPrescriptionForm(recordsTimeZone)));
  useUnsavedChangesGuard(
    hasUnsavedRecordForm,
    t("leaveWarning")
  );

  const {
    data: soapNotes,
    isLoading: isLoadingSoapNotes,
    error: soapNotesError,
  } = trpc.records.listSoapNotes.useQuery(
    { patientId },
    { enabled: !!patientId }
  );
  const soapNotesMissing =
    Boolean(patientId) && !isLoadingSoapNotes && !soapNotesError && !soapNotes;
  useEffect(() => {
    if (!soapNotes || typeof window === "undefined") return;
    const match = window.location.hash.match(/^#soap-note-(.+)$/);
    const noteId = match?.[1];
    if (
      !noteId ||
      appliedSoapHash.current === noteId ||
      !soapNotes.some((note) => note.id === noteId)
    ) {
      return;
    }
    appliedSoapHash.current = noteId;
    setActiveTab("soap");
    setExpandedNoteId(noteId);
    window.requestAnimationFrame(() =>
      document
        .getElementById(`soap-note-${noteId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }, [soapNotes]);
  const correctSoap = trpc.records.markSoapNoteEnteredInError.useMutation({
    onSuccess: async () => {
      toast.success(t("toasts.soapCorrected"));
      await utils.records.listSoapNotes.invalidate({ patientId });
    },
    onError: (error) => toast.error(error.message),
  });
  const [addendumNoteId, setAddendumNoteId] = useState<string | null>(null);
  const [addendumContent, setAddendumContent] = useState("");
  const [addendumOperationId, setAddendumOperationId] = useState<string | null>(
    null,
  );
  const addSoapAddendum = trpc.records.addSoapNoteAddendum.useMutation({
    onSuccess: async () => {
      setAddendumNoteId(null);
      setAddendumContent("");
      setAddendumOperationId(null);
      toast.success(t("toasts.addendum"));
      await utils.records.listSoapNotes.invalidate({ patientId });
    },
    onError: (error) => toast.error(error.message),
  });
  const {
    data: vaccinations,
    isLoading: isLoadingVaccinations,
    error: vaccinationsError,
    refetch: refetchVaccinations,
  } = trpc.records.listVaccinations.useQuery(
    { patientId },
    { enabled: !!patientId }
  );
  const vaccinationsMissing =
    Boolean(patientId) &&
    !isLoadingVaccinations &&
    !vaccinationsError &&
    !vaccinations;
  const correctVaccination =
    trpc.records.markVaccinationEnteredInError.useMutation({
      onSuccess: async () => {
        toast.success(t("toasts.vaccineCorrected"));
        await utils.records.listVaccinations.invalidate({ patientId });
      },
      onError: (error) => toast.error(error.message),
    });
  const {
    data: prescriptionsList,
    isLoading: isLoadingPrescriptions,
    error: prescriptionsError,
    refetch: refetchPrescriptions,
  } =
    trpc.records.listPrescriptions.useQuery(
      { patientId },
      { enabled: !!patientId }
    );
  const prescriptionsMissing =
    Boolean(patientId) &&
    !isLoadingPrescriptions &&
    !prescriptionsError &&
    !prescriptionsList;
  const {
    data: problems,
    isLoading: isLoadingProblems,
    error: problemsError,
    refetch: refetchProblems,
  } = trpc.records.listProblems.useQuery(
    { patientId },
    { enabled: !!patientId }
  );
  const problemsMissing =
    Boolean(patientId) && !isLoadingProblems && !problemsError && !problems;
  const {
    data: labResultsList,
    isLoading: isLoadingLabResults,
    error: labResultsError,
    refetch: refetchLabResults,
  } =
    trpc.records.listLabResults.useQuery(
      { patientId },
      { enabled: !!patientId }
    );
  const labResultsMissing =
    Boolean(patientId) &&
    !isLoadingLabResults &&
    !labResultsError &&
    !labResultsList;
  const replacementSourceLabResult = replacesLabResultId
    ? labResultsList?.find((result) => result.id === replacesLabResultId) ?? null
    : null;
  const labTrendGroups = useMemo(
    () =>
      buildLabTrends(
        (labResultsList ?? []).filter((result) => !result.correctionId),
        recordsTimeZone
      ),
    [labResultsList, recordsTimeZone]
  );
  const {
    data: proceduresList,
    isLoading: isLoadingProcedures,
    error: proceduresError,
    refetch: refetchProcedures,
  } =
    trpc.records.listProcedures.useQuery(
      { patientId },
      { enabled: !!patientId }
    );
  const proceduresMissing =
    Boolean(patientId) &&
    !isLoadingProcedures &&
    !proceduresError &&
    !proceduresList;
  const canPrescribe = userRole === "admin" || userRole === "veterinarian";
  const canCorrectClinicalRecords =
    userRole === "admin" || userRole === "veterinarian";
  const canCreateVaccinations =
    userRole === "admin" ||
    userRole === "veterinarian" ||
    userRole === "technician";
  const canManageProblems =
    userRole === "admin" ||
    userRole === "veterinarian" ||
    userRole === "technician";
  const canManageLabResults =
    userRole === "admin" ||
    userRole === "veterinarian" ||
    userRole === "technician";
  const canReviewLabResults =
    userRole === "admin" || userRole === "veterinarian";

  useEffect(() => {
    if (
      !canCorrectClinicalRecords ||
      !requestedAmendLabResultId ||
      appliedLabAmendLink.current === requestedAmendLabResultId
    ) {
      return;
    }
    const source = labResultsList?.find(
      (result) => result.id === requestedAmendLabResultId
    );
    if (!source || !source.correctionId || source.replacementLabResultId) return;
    setActiveTab("labResults");
    setLabForm({
      testName: source.testName,
      resultValue: "",
      unit: "",
      referenceRangeLow: "",
      referenceRangeHigh: "",
      resultFlag: "unknown",
    });
    setReplacesLabResultId(source.id);
    setReplacementPatient(selectedPatient);
    setReplacementPatientSearch("");
    setShowLabForm(true);
    labResultCreationOperationId.current = null;
    appliedLabAmendLink.current = source.id;
  }, [
    canCorrectClinicalRecords,
    labResultsList,
    requestedAmendLabResultId,
    selectedPatient,
  ]);
  const canCreateProcedures =
    userRole === "admin" || userRole === "veterinarian";
  const medicationNameForSafety = prescriptionForm.medicationName.trim();
  const prescriptionSafetyEnabled =
    canPrescribe &&
    showPrescriptionForm &&
    !!patientId &&
    medicationNameForSafety.length >= 2;
  const prescriptionSafety = trpc.records.checkPrescriptionSafety.useQuery(
    { patientId, medicationName: medicationNameForSafety },
    {
      enabled: prescriptionSafetyEnabled,
    }
  );
  const prescriptionSafetyMissing =
    prescriptionSafetyEnabled &&
    !prescriptionSafety.isFetching &&
    !prescriptionSafety.error &&
    !prescriptionSafety.data;
  const prescriptionSafetyUnavailable =
    prescriptionSafetyEnabled &&
    (prescriptionSafety.isFetching ||
      Boolean(prescriptionSafety.error) ||
      prescriptionSafetyMissing ||
      !prescriptionSafety.data);
  const verifiedPrescriptionSafety =
    prescriptionSafetyEnabled &&
    !prescriptionSafetyUnavailable &&
    prescriptionSafety.data
      ? prescriptionSafety.data
      : null;
  const linkedProductQuery = trpc.inventory.getById.useQuery(
    { id: prescriptionForm.productId || "00000000-0000-0000-0000-000000000000" },
    { enabled: Boolean(prescriptionForm.productId), staleTime: 0 },
  );
  const linkedPrescriptionProduct = prescriptionForm.productId
    ? selectedPrescriptionProduct && { ...selectedPrescriptionProduct, ...linkedProductQuery.data }
    : null;
  const prescriptionQuantity = optionalNumber(prescriptionForm.quantity);
  const hasValidPrescriptionQuantityForInventory =
    !prescriptionForm.productId ||
    (isPrescriptionQuantityInputValid(prescriptionForm.quantity) &&
      linkedPrescriptionProduct !== null &&
      linkedPrescriptionProduct.inventoryTracked &&
      !linkedProductQuery.isError &&
      !linkedProductQuery.isFetching &&
      prescriptionQuantity !== undefined &&
      prescriptionQuantity <= linkedPrescriptionProduct.stockQuantity);
  const visibleTabs = tabs.filter(
    (tab) =>
      userRole !== "front_desk" || !frontDeskRestrictedTabs.includes(tab.id)
  );
  const currentTab = visibleTabs.some((tab) => tab.id === activeTab)
    ? activeTab
    : visibleTabs[0]?.id;

  async function refreshLinkedVisit() {
    if (!linkedAppointmentId) return;
    await Promise.all([
      utils.encounters.getCloseout.invalidate({
        appointmentId: linkedAppointmentId,
      }),
      utils.encounters.getVisitReconciliation.invalidate({
        appointmentId: linkedAppointmentId,
      }),
    ]);
  }

  const createVaccination = trpc.records.createVaccination.useMutation({
    onSuccess: async () => {
      toast.success(t("toasts.vaccineRecorded"));
      await Promise.all([refetchVaccinations(), refreshLinkedVisit()]);
      setShowVaccinationForm(false);
      setVaccinationForm(initialVaccinationForm());
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const createProblem = trpc.records.createProblem.useMutation({
    onSuccess: () => {
      toast.success(t("toasts.problemAdded"));
      refetchProblems();
      setShowProblemForm(false);
      setProblemForm(initialProblemForm());
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const updateProblemStatus = trpc.records.updateProblemStatus.useMutation({
    onSuccess: () => {
      toast.success(t("toasts.problemStatus"));
      refetchProblems();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const createLabResult = trpc.records.createLabResult.useMutation({
    onSuccess: async (result) => {
      toast.success(
        replacesLabResultId
          ? t("toasts.labReplacement")
          : t("toasts.labCreated")
      );
      await Promise.all([
        refetchLabResults(),
        utils.records.listLabReviewInbox.invalidate(),
        refreshLinkedVisit(),
      ]);
      setShowLabForm(false);
      setLabForm(initialLabResultForm());
      setReplacesLabResultId(null);
      labResultCreationOperationId.current = null;
      if (replacementPatient && result.patientId === replacementPatient.id) {
        setSelectedPatient(replacementPatient);
        setSearchQuery(replacementPatient.name);
        router.replace(
          `/records?patientId=${replacementPatient.id}&tab=labResults#lab-result-${result.id}`
        );
      }
      setReplacementPatient(null);
      setReplacementPatientSearch("");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const correctLabResult = trpc.records.markLabResultEnteredInError.useMutation(
    {
      onSuccess: async (correction) => {
        toast.success(t("toasts.labCorrected"));
        if (correction.labResultId) {
          labCorrectionOperationIds.current.delete(correction.labResultId);
        }
        await Promise.all([
          refetchLabResults(),
          utils.records.listLabReviewInbox.invalidate(),
        ]);
      },
      onError: (error) => toast.error(error.message),
    }
  );
  const updateLabResultStatus = trpc.records.updateLabResultStatus.useMutation({
    onSuccess: (result) => {
      toast.success(t("toasts.labStatus"));
      labReviewOperationIds.current.delete(result.id);
      refetchLabResults();
      utils.records.listLabReviewInbox.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const createProcedure = trpc.records.createProcedure.useMutation({
    onSuccess: async () => {
      toast.success(t("toasts.procedure"));
      await Promise.all([refetchProcedures(), refreshLinkedVisit()]);
      setShowProcedureForm(false);
      setProcedureForm(initialProcedureForm());
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const createPrescription = trpc.records.createPrescription.useMutation({
    onSuccess: async () => {
      toast.success(t("toasts.prescription"));
      await Promise.all([refetchPrescriptions(), refreshLinkedVisit()]);
      setShowPrescriptionForm(false);
      setPrescriptionForm(initialPrescriptionForm(recordsTimeZone));
      prescriptionOperationId.current = null;
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const canSubmitVaccination =
    Boolean(patientId) &&
    isOnline &&
    visitContextMatchesPatient &&
    isVaccinationFormValid(vaccinationForm) &&
    !createVaccination.isPending;
  const canSubmitProblem =
    Boolean(patientId) &&
    isOnline &&
    isProblemRequiredTextInputValid(
      problemForm.description,
      PROBLEM_DESCRIPTION_MAX_LENGTH
    ) &&
    PROBLEM_STATUSES.includes(problemForm.status) &&
    isProblemOptionalDateInputValid(problemForm.onsetDate) &&
    !createProblem.isPending;
  const canSubmitLabResult =
    Boolean(patientId) &&
    isOnline &&
    visitContextMatchesPatient &&
    (!linkedAppointmentId || !replacesLabResultId) &&
    (!replacesLabResultId || Boolean(replacementPatient)) &&
    (!replacesLabResultId || Boolean(labForm.resultValue.trim())) &&
    isLabRequiredTextInputValid(labForm.testName, LAB_TEST_NAME_MAX_LENGTH) &&
    isLabOptionalTextInputValid(
      labForm.resultValue,
      LAB_RESULT_VALUE_MAX_LENGTH
    ) &&
    isLabOptionalTextInputValid(labForm.unit, LAB_UNIT_MAX_LENGTH) &&
    isLabOptionalReferenceInputValid(labForm.referenceRangeLow) &&
    isLabOptionalReferenceInputValid(labForm.referenceRangeHigh) &&
    isLabReferenceRangeOrdered(
      labForm.referenceRangeLow,
      labForm.referenceRangeHigh
    ) &&
    !createLabResult.isPending;
  const canSubmitProcedure =
    Boolean(patientId) &&
    isOnline &&
    visitContextMatchesPatient &&
    isProcedureRequiredTextInputValid(
      procedureForm.name,
      PROCEDURE_NAME_MAX_LENGTH
    ) &&
    isProcedureOptionalTextInputValid(
      procedureForm.description,
      PROCEDURE_DESCRIPTION_MAX_LENGTH
    ) &&
    isProcedureOptionalTextInputValid(
      procedureForm.anesthesiaUsed,
      PROCEDURE_ANESTHESIA_MAX_LENGTH
    ) &&
    isProcedureOptionalDurationInputValid(procedureForm.durationMinutes) &&
    isProcedureOptionalTextInputValid(
      procedureForm.notes,
      PROCEDURE_NOTES_MAX_LENGTH
    ) &&
    !createProcedure.isPending;
  const canSubmitPrescription =
    Boolean(patientId) &&
    isOnline &&
    visitContextMatchesPatient &&
    isPrescriptionRequiredTextInputValid(
      prescriptionForm.medicationName,
      PRESCRIPTION_MEDICATION_NAME_MAX_LENGTH
    ) &&
    isPrescriptionRequiredTextInputValid(
      prescriptionForm.dosage,
      PRESCRIPTION_DOSAGE_MAX_LENGTH
    ) &&
    isPrescriptionRequiredTextInputValid(
      prescriptionForm.frequency,
      PRESCRIPTION_FREQUENCY_MAX_LENGTH
    ) &&
    isPrescriptionOptionalQuantityInputValid(
      prescriptionForm.quantity
    ) &&
    isPrescriptionNonnegativeIntegerInputValid(
      prescriptionForm.refillsRemaining
    ) &&
    isPrescriptionOptionalTextInputValid(
      prescriptionForm.instructions,
      PRESCRIPTION_INSTRUCTIONS_MAX_LENGTH
    ) &&
    Boolean(prescriptionForm.startDate) &&
    (!prescriptionForm.endDate ||
      prescriptionForm.endDate >= prescriptionForm.startDate) &&
    hasValidPrescriptionQuantityForInventory &&
    !prescriptionSafetyUnavailable &&
    (!verifiedPrescriptionSafety?.requiresOverride ||
      prescriptionForm.acknowledgeSafetyWarnings) &&
    !createPrescription.isPending;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold">
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
      </div>

      {/* Patient Search */}
      <div className="mt-6 relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("search")}
            value={searchQuery}
            maxLength={PATIENT_SEARCH_MAX_LENGTH}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!e.target.value) setSelectedPatient(null);
            }}
            className="h-11 pl-10 sm:h-10"
          />
        </div>

        {/* Search Dropdown */}
        {canSearchPatients &&
          !selectedPatient &&
          (isSearchingPatients ||
            patientSearchError ||
            patientSearchMissing ||
            searchResults) && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
            {patientSearchError || patientSearchMissing ? (
              <div className="px-4 py-3 text-sm text-destructive">
                {patientSearchError?.message ??
                  t("searchFailed")}
              </div>
            ) : isSearchingPatients ? (
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("searching")}
              </div>
            ) : searchResults && searchResults.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                {t("noPatients")}
              </div>
            ) : (
              searchResults?.map((patient) => (
                <button
                  key={patient.id}
                  onClick={() => {
                    setSelectedPatient(patient);
                    setSearchQuery(patient.name);
                    setShowVaccinationForm(false);
                    setVaccinationForm(initialVaccinationForm());
                    setShowProblemForm(false);
                    setProblemForm(initialProblemForm());
                    setShowLabForm(false);
                    setLabForm(initialLabResultForm());
                    setShowProcedureForm(false);
                    setProcedureForm(initialProcedureForm());
                    setShowPrescriptionForm(false);
                    setPrescriptionForm(initialPrescriptionForm());
                  }}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-muted/50 first:rounded-t-lg last:rounded-b-lg transition-colors"
                >
                  <div>
                    <span className="font-medium">{patient.name}</span>
                    <span className="ml-2 text-muted-foreground">
                      {speciesLabel(patient.species)}
                      {patient.breed ? ` - ${patient.breed}` : ""}
                    </span>
                  </div>
                  {patient.clientFirstName && (
                    <span className="text-xs text-muted-foreground">
                      {t("owner", { name: `${patient.clientFirstName} ${patient.clientLastName ?? ""}`.trim() })}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Selected Patient Banner */}
      {selectedPatient && (
        <div className="mt-4 flex flex-col items-stretch gap-3 rounded-lg border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-sm">
            <span className="block truncate font-medium sm:inline">
              {selectedPatient.name}
            </span>
            <span className="block truncate text-muted-foreground sm:ml-2 sm:inline">
              {speciesLabel(selectedPatient.species)}
              {selectedPatient.breed ? ` - ${selectedPatient.breed}` : ""}
            </span>
            {selectedPatient.clientFirstName && (
              <span className="block truncate text-muted-foreground sm:ml-3 sm:inline">
                {t("owner", { name: `${selectedPatient.clientFirstName} ${selectedPatient.clientLastName ?? ""}`.trim() })}
              </span>
            )}
          </div>
          {!linkedAppointmentId ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-11 w-full sm:h-9 sm:w-auto"
              onClick={() => {
                setSelectedPatient(null);
                setSearchQuery("");
                setShowVaccinationForm(false);
                setVaccinationForm(initialVaccinationForm());
                setShowProblemForm(false);
                setProblemForm(initialProblemForm());
                setShowLabForm(false);
                setLabForm(initialLabResultForm());
                setShowProcedureForm(false);
                setProcedureForm(initialProcedureForm());
                setShowPrescriptionForm(false);
                setPrescriptionForm(initialPrescriptionForm());
              }}
            >
              {t("changePatient")}
            </Button>
          ) : null}
        </div>
      )}

      {selectedPatient &&
      linkedAppointmentId &&
      linkedPatientId === selectedPatient.id ? (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-teal-300 bg-teal-50 px-4 py-3 text-sm text-teal-950 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-100 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">{t("visit.title")}</p>
            <p className="mt-0.5 text-xs">
              {t("visit.help")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-11 flex-1 sm:h-9 sm:flex-none"
              asChild
            >
              <Link href={`/encounters/${linkedAppointmentId}`}>
                {t("visit.back")}
              </Link>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-11 flex-1 sm:h-9 sm:flex-none"
              asChild
            >
              <Link
                href={`/records?patientId=${encodeURIComponent(linkedPatientId)}&tab=${encodeURIComponent(requestedTab ?? "soap")}`}
              >
                {t("visit.leave")}
              </Link>
            </Button>
          </div>
        </div>
      ) : null}

      {selectedPatient && !isOnline ? (
        <div
          className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
          role="status"
        >
          Offline — clinical forms stay only on this device. Keep this page
          open and reconnect before saving a record.
        </div>
      ) : null}

      {/* Tabs */}
      {selectedPatient && (
        <>
          <div className="mt-6 max-w-full overflow-x-auto border-b border-border">
            <div className="flex min-w-max gap-0">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "relative flex min-h-11 shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors",
                      currentTab === tab.id
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {t(`tabs.${tab.id}`)}
                    {currentTab === tab.id && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Content */}
          <div className="mt-6">
            {recordsSettingsError || recordsSettingsMissing ? (
              <RecordsErrorPanel
                message={
                  recordsSettingsError
                    ? t("settingsFailedMessage", { message: recordsSettingsError.message })
                    : t("settingsFailed")
                }
              />
            ) : recordsSettingsLoading ? (
              <RecordsLoadingPanel label={t("loadingSettings")} />
            ) : (
              <>
            {/* SOAP Notes Tab */}
            {currentTab === "soap" && (
              <div>
                {soapNotesError || soapNotesMissing ? (
                  <RecordsErrorPanel
                    message={
                      soapNotesError
                        ? t("soapFailedMessage", { message: soapNotesError.message })
                        : t("soapFailed")
                    }
                  />
                ) : isLoadingSoapNotes ? (
                  <RecordsLoadingPanel label={t("loadingSoap")} />
                ) : soapNotes && soapNotes.length > 0 ? (
                  <div className="space-y-3">
                        {soapNotes.map((note) => {
                          const isExpanded = expandedNoteId === note.id;
                          const hasOtherCurrentAppointmentSoap = Boolean(
                            note.appointmentId &&
                            soapNotes.some(
                              (candidate) =>
                                candidate.id !== note.id &&
                                candidate.appointmentId ===
                                  note.appointmentId &&
                                candidate.status === "finalized" &&
                                !candidate.correctionId,
                            ),
                          );
                          const hasAppointmentSoapDraft = Boolean(
                            note.appointmentId &&
                              soapNotes.some(
                                (candidate) =>
                                  candidate.id !== note.id &&
                                  candidate.appointmentId ===
                                    note.appointmentId &&
                                  candidate.status === "draft",
                              ),
                          );
                          return (
                            <div
                              key={note.id}
                              id={`soap-note-${note.id}`}
                              className={cn(
                                "rounded-lg border border-border bg-card",
                                note.correctionId &&
                                  "border-destructive/40 bg-destructive/5",
                              )}
                            >
                              <button
                                onClick={() =>
                                  setExpandedNoteId(isExpanded ? null : note.id)
                                }
                                className="flex w-full items-center justify-between px-4 py-3 text-left"
                              >
                                <div className="flex items-center gap-4">
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-medium">
                                        {note.createdAt
                                          ? formatClinicalDate(
                                              note.createdAt,
                                              recordsTimeZone, undefined, locale,
                                            )
                                          : t("noDate")}
                                      </p>
                                      {note.imported ? (
                                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                          {ts("imported")}
                                        </span>
                                      ) : null}
                                      <span
                                        className={cn(
                                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                                          note.status === "draft"
                                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
                                        )}
                                      >
                                        {note.status === "draft"
                                          ? ts("draft")
                                          : ts("finalized")}
                                      </span>
                                      {note.correctionId ? (
                                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                                          {t("enteredInError")}
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      {note.imported
                                        ? note.authorName
                                          ? ts("importedBy", { name: note.authorName })
                                          : ts("importedRecord")
                                        : (note.authorName ?? ts("unknownAuthor"))}
                                    </p>
                                  </div>
                                  <p className="text-sm text-muted-foreground line-clamp-1 max-w-md">
                                    {soapSectionText(
                                      note.assessment ||
                                        note.subjective ||
                                        note.objective ||
                                        note.plan,
                                    ) || t("noNote")}
                                  </p>
                                </div>
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                              </button>
                              {isExpanded && (
                                <div className="border-t border-border px-4 py-4 space-y-4">
                                  {note.status === "finalized" ? (
                                    <p className="text-xs text-muted-foreground">
                                      {ts("finalizedBy", { name: note.finalizerName ?? ts("unknownClinician") })}
                                      {note.finalizedAt
                                        ? ` ${ts("finalizedOn", { date: formatClinicalDateTime(note.finalizedAt, recordsTimeZone, undefined, locale) })}`
                                        : ""}
                                    </p>
                                  ) : note.appointmentId &&
                                    canCorrectClinicalRecords ? (
                                    <a
                                      href={`/records/new-soap/${encodeURIComponent(patientId)}?appointmentId=${encodeURIComponent(note.appointmentId)}`}
                                      className="inline-flex text-sm font-medium text-primary hover:underline"
                                    >
                                      {ts("resume")}
                                    </a>
                                  ) : null}
                                  {note.replacesSoapNoteId ? (
                                    <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                                      <p className="font-medium text-primary">
                                        {ts("currentReplacement")}
                                      </p>
                                      <a
                                        href={`#soap-note-${note.replacesSoapNoteId}`}
                                        className="mt-1 inline-flex text-xs font-medium text-primary hover:underline"
                                      >
                                        {ts("viewOriginal")}
                                      </a>
                                    </div>
                                  ) : null}
                                  <div>
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                      {tsec("subjective")}
                                    </h4>
                                    <p className="text-sm">
                                      {soapSectionText(note.subjective) || "--"}
                                    </p>
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                      {tsec("objective")}
                                    </h4>
                                    <p className="text-sm">
                                      {soapSectionText(note.objective) || "--"}
                                    </p>
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                      {tsec("assessment")}
                                    </h4>
                                    <p className="text-sm">
                                      {soapSectionText(note.assessment) || "--"}
                                    </p>
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                      {tsec("plan")}
                                    </h4>
                                    <p className="text-sm">
                                      {soapSectionText(note.plan) || "--"}
                                    </p>
                                  </div>
                                  {note.addenda.length > 0 ? (
                                    <div className="space-y-2 border-t border-border pt-3">
                                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        {ts("addenda")}
                                      </h4>
                                      {note.addenda.map((addendum) => (
                                        <div
                                          key={addendum.id}
                                          className="rounded-md bg-muted/40 p-3"
                                        >
                                          <p className="text-xs font-medium">
                                            {addendum.authorName} -{" "}
                                            {formatClinicalDateTime(
                                              addendum.createdAt,
                                              recordsTimeZone,
                                              undefined,
                                              locale,
                                            )}
                                          </p>
                                          <p className="mt-1 whitespace-pre-wrap text-sm">
                                            {soapSectionText(addendum.content)}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                  {note.status === "finalized" &&
                                  !note.correctionId &&
                                  canCorrectClinicalRecords ? (
                                    addendumNoteId === note.id ? (
                                      <div className="rounded-md border border-border p-3">
                                        <label
                                          className="text-sm font-medium"
                                          htmlFor={`records-addendum-${note.id}`}
                                        >
                                          {ta("title")}
                                        </label>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                          {ta("help")}
                                        </p>
                                        <textarea
                                          id={`records-addendum-${note.id}`}
                                          value={addendumContent}
                                          onChange={(event) =>
                                            setAddendumContent(
                                              event.target.value,
                                            )
                                          }
                                          maxLength={10_000}
                                          rows={3}
                                          className="mt-2 w-full rounded-md border border-border bg-background p-2 text-sm"
                                        />
                                        <div className="mt-2 flex gap-2">
                                          <Button
                                            size="sm"
                                            disabled={
                                              !addendumContent.trim() ||
                                              addSoapAddendum.isPending
                                            }
                                            onClick={() =>
                                              addSoapAddendum.mutate({
                                                patientId,
                                                noteId: note.id,
                                                operationId:
                                                  addendumOperationId!,
                                                content: addendumContent,
                                              })
                                            }
                                          >
                                            {addSoapAddendum.isPending
                                              ? ta("saving")
                                              : ta("save")}
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={addSoapAddendum.isPending}
                                            onClick={() => {
                                              setAddendumNoteId(null);
                                              setAddendumContent("");
                                              setAddendumOperationId(null);
                                            }}
                                          >
                                            {ta("cancel")}
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setAddendumNoteId(note.id);
                                          setAddendumContent("");
                                          setAddendumOperationId(
                                            crypto.randomUUID(),
                                          );
                                        }}
                                      >
                                        <Plus className="mr-2 h-4 w-4" />
                                        {ta("add")}
                                      </Button>
                                    )
                                  ) : null}
                                  {note.status === "finalized" ? (
                                    <>
                                      <ClinicalCorrectionControl
                                        timeZone={recordsTimeZone}
                                        correction={
                                          note.correctionId &&
                                          note.correctionReason &&
                                          note.correctedAt
                                            ? {
                                                id: note.correctionId,
                                                reason: note.correctionReason,
                                                correctedAt: note.correctedAt,
                                                correctedByName:
                                                  note.correctedByName,
                                              }
                                            : null
                                        }
                                        triggerLabel={ts("void")}
                                        description={ts("voidHelp")}
                                        canCorrect={canCorrectClinicalRecords}
                                        isPending={
                                          correctSoap.isPending &&
                                          correctSoap.variables?.recordId ===
                                            note.id
                                        }
                                        onCorrect={(reason) =>
                                          correctSoap.mutateAsync({
                                            patientId,
                                            recordId: note.id,
                                            reason,
                                          })
                                        }
                                      />
                                      {note.replacementSoapNoteId ? (
                                        <div className="mt-3 flex justify-end">
                                          <a
                                            href={`#soap-note-${note.replacementSoapNoteId}`}
                                            className="text-sm font-medium text-primary hover:underline"
                                          >
                                            {ts("viewReplacement")}
                                          </a>
                                        </div>
                                      ) : canCorrectClinicalRecords &&
                                        (!note.correctionId ||
                                          (!hasOtherCurrentAppointmentSoap &&
                                            !hasAppointmentSoapDraft)) ? (
                                        <div className="mt-3 flex justify-end">
                                          <Button asChild size="sm">
                                            <Link
                                              href={`/records/replace-soap/${encodeURIComponent(patientId)}?sourceNoteId=${encodeURIComponent(note.id)}&return=records`}
                                            >
                                              {note.correctionId
                                                ? ts("createMissing")
                                                : ts("replace")}
                                            </Link>
                                          </Button>
                                        </div>
                                      ) : hasAppointmentSoapDraft &&
                                        note.appointmentId ? (
                                        <div className="mt-3 flex justify-end">
                                          <Button asChild size="sm" variant="outline">
                                            <a
                                              href={`/records/new-soap/${encodeURIComponent(patientId)}?appointmentId=${encodeURIComponent(note.appointmentId)}`}
                                            >
                                              {ts("reviewDraft")}
                                            </a>
                                          </Button>
                                        </div>
                                      ) : note.correctionId &&
                                        hasOtherCurrentAppointmentSoap ? (
                                        <p className="mt-3 text-right text-xs text-muted-foreground">
                                          {ts("alreadyCurrent")}
                                        </p>
                                      ) : null}
                                    </>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          );
                        })}
                  </div>
                ) : (
                  <EmptyState
                    icon={FileText}
                    title={t("noSoapTitle")}
                    description={t("noSoapHelp")}
                  />
                )}
              </div>
            )}

            {/* Vaccinations Tab */}
            {currentTab === "vaccinations" && (
              <div>
                {canCreateVaccinations && (
                  <div className="mb-4 flex justify-end">
                    <Button
                      size="sm"
                      className="h-11 w-full sm:h-9 sm:w-auto"
                      variant={showVaccinationForm ? "outline" : "default"}
                      onClick={() => {
                        if (showVaccinationForm) {
                          setVaccinationForm(initialVaccinationForm());
                        }
                        setShowVaccinationForm(!showVaccinationForm);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {t("vacc.add")}
                    </Button>
                  </div>
                )}

                {canCreateVaccinations && showVaccinationForm && (
                  <form
                    className="mb-6 rounded-lg border border-border bg-card p-4 space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!canSubmitVaccination) return;
                      createVaccination.mutate({
                        patientId,
                        appointmentId: linkedAppointmentId || undefined,
                        vaccineName: vaccinationForm.vaccineName.trim(),
                        productName:
                          vaccinationForm.productName.trim() || undefined,
                        lotNumber:
                          vaccinationForm.lotNumber.trim() || undefined,
                        manufacturer:
                          vaccinationForm.manufacturer.trim() || undefined,
                        productExpirationDate:
                          vaccinationForm.productExpirationDate || undefined,
                        doseType: vaccinationForm.doseType || undefined,
                        licensedDurationMonths:
                          vaccinationForm.licensedDurationMonths
                            ? Number(vaccinationForm.licensedDurationMonths)
                            : undefined,
                        rabiesTagNumber:
                          vaccinationForm.rabiesTagNumber.trim() || undefined,
                        supervisingVeterinarianId:
                          vaccinationForm.supervisingVeterinarianId ||
                          undefined,
                        nextDueDate:
                          vaccinationForm.nextDueDate.trim() || undefined,
                      });
                    }}
                  >
                    <VaccinationFormFields
                      form={vaccinationForm}
                      setForm={setVaccinationForm}
                      providers={vaccinationProviders.data}
                      currentUserId={session?.user?.id}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        size="sm"
                        className="h-11 sm:h-9"
                        disabled={!canSubmitVaccination}
                      >
                        {createVaccination.isPending ? t("saving") : t("save")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-11 sm:h-9"
                        onClick={() => {
                          setShowVaccinationForm(false);
                          setVaccinationForm(initialVaccinationForm());
                        }}
                      >
                        {t("cancel")}
                      </Button>
                    </div>
                  </form>
                )}

                {vaccinationsError || vaccinationsMissing ? (
                  <RecordsErrorPanel
                    message={
                      vaccinationsError
                        ? t("vacc.failedMessage", { message: vaccinationsError.message })
                        : t("vacc.failed")
                    }
                  />
                ) : isLoadingVaccinations ? (
                  <RecordsLoadingPanel label={t("vacc.loading")} />
                ) : vaccinations && vaccinations.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            {t("vacc.columns.vaccine")}
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            {t("vacc.columns.given")}
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            {t("vacc.columns.nextDue")}
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            {t("vacc.columns.by")}
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            {t("columns.status")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                            {vaccinations.map((vax) => {
                              const dueStatus = getVaccineDueStatus(
                                vax.nextDueDate,
                                recordsTimeZone,
                              );
                              return (
                                <tr
                                  key={vax.id}
                                  className={cn(
                                    "border-b border-border last:border-0",
                                    vax.correctionId &&
                                      "bg-destructive/5 text-muted-foreground",
                                  )}
                                >
                                  <td className="px-4 py-3 font-medium">
                                    {vax.vaccineName}
                                  </td>
                                  <td className="px-4 py-3">
                                    {vax.administeredAt
                                      ? formatClinicalDate(
                                          vax.administeredAt,
                                          recordsTimeZone, undefined, locale,
                                        )
                                      : "--"}
                                  </td>
                                  <td className="px-4 py-3">
                                    {vax.nextDueDate
                                      ? formatClinicalDate(
                                          vax.nextDueDate,
                                          recordsTimeZone, undefined, locale,
                                        )
                                      : "--"}
                                  </td>
                                  <td className="px-4 py-3 text-muted-foreground">
                                    {vax.administeredByName ?? "--"}
                                  </td>
                                  <td className="px-4 py-3">
                                    {vax.correctionId ? (
                                      <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
                                        {t("enteredInError")}
                                      </span>
                                    ) : (
                                      <span
                                        className={cn(
                                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                                          dueStatus.className,
                                        )}
                                      >
                                        {t(`vaccineDue.${dueStatus.label}`)}
                                      </span>
                                    )}
                                    <ClinicalCorrectionControl
                                      timeZone={recordsTimeZone}
                                      correction={
                                        vax.correctionId &&
                                        vax.correctionReason &&
                                        vax.correctedAt
                                          ? {
                                              id: vax.correctionId,
                                              reason: vax.correctionReason,
                                              correctedAt: vax.correctedAt,
                                              correctedByName:
                                                vax.correctedByName,
                                            }
                                          : null
                                      }
                                      canCorrect={canCorrectClinicalRecords}
                                      isPending={
                                        correctVaccination.isPending &&
                                        correctVaccination.variables
                                          ?.recordId === vax.id
                                      }
                                      onCorrect={(reason) =>
                                        correctVaccination.mutateAsync({
                                          patientId,
                                          recordId: vax.id,
                                          reason,
                                        })
                                      }
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    icon={Syringe}
                    title={t("vacc.empty")}
                  />
                )}
              </div>
            )}

            {/* Prescriptions Tab */}
            {currentTab === "prescriptions" && (
              <div>
                {canPrescribe && (
                  <div className="mb-4 flex justify-end">
                    <Button
                      size="sm"
                      className="h-11 w-full sm:h-9 sm:w-auto"
                      variant={showPrescriptionForm ? "outline" : "default"}
                      onClick={() => {
                        if (showPrescriptionForm) {
                          prescriptionOperationId.current = null;
                          setShowPrescriptionForm(false);
                          setPrescriptionForm((current) => ({
                            ...current,
                            acknowledgeSafetyWarnings: false,
                          }));
                          return;
                        }
                        prescriptionOperationId.current = null;
                        setShowPrescriptionForm(true);
                        setPrescriptionForm(
                          initialPrescriptionForm(recordsTimeZone)
                        );
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {t("rx.new")}
                    </Button>
                  </div>
                )}

                {canPrescribe && showPrescriptionForm && (
                  <form
                    className="mb-6 rounded-lg border border-border bg-card p-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const warnings =
                        verifiedPrescriptionSafety?.warnings ?? [];
                      const requiresOverride =
                        verifiedPrescriptionSafety?.requiresOverride ?? false;
                      if (
                        requiresOverride &&
                        !prescriptionForm.acknowledgeSafetyWarnings
                      ) {
                        toast.error(
                          t("rx.ackRequired")
                        );
                        return;
                      }
                      if (!canSubmitPrescription) return;

                      prescriptionOperationId.current ??= crypto.randomUUID();
                      createPrescription.mutate({
                        patientId,
                        operationId: prescriptionOperationId.current,
                        appointmentId: linkedAppointmentId || undefined,
                        medicationName:
                          prescriptionForm.medicationName.trim(),
                        productId: prescriptionForm.productId || undefined,
                        dosage: prescriptionForm.dosage.trim(),
                        frequency: prescriptionForm.frequency.trim(),
                        quantity: optionalNumber(prescriptionForm.quantity),
                        refillsRemaining:
                          optionalNumber(
                            prescriptionForm.refillsRemaining
                          ) ?? 0,
                        startDate: prescriptionForm.startDate,
                        endDate:
                          prescriptionForm.endDate.trim() || undefined,
                        instructions:
                          prescriptionForm.instructions.trim() || undefined,
                        acknowledgeSafetyWarnings:
                          warnings.length > 0 &&
                          prescriptionForm.acknowledgeSafetyWarnings,
                      });
                    }}
                  >
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("rx.medicationRequired")}
                        </label>
                        <Input
                          required
                          value={prescriptionForm.medicationName}
                          maxLength={PRESCRIPTION_MEDICATION_NAME_MAX_LENGTH}
                          onChange={(e) =>
                            setPrescriptionForm((current) => ({
                              ...current,
                              medicationName: e.target.value,
                              acknowledgeSafetyWarnings: false,
                            }))
                          }
                          placeholder={t("rx.placeholders.medication")}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("rx.inventoryItem")}
                        </label>
                        <PrescriptionInventoryProductPicker
                          value={prescriptionForm.productId}
                          selectedProduct={linkedPrescriptionProduct}
                          onChange={(selectedProduct) => {
                            const productId = selectedProduct?.id ?? "";
                            setSelectedPrescriptionProduct(selectedProduct);
                            setPrescriptionForm((current) => ({
                              ...current,
                              productId,
                              medicationName:
                                selectedProduct && !current.medicationName.trim()
                                  ? selectedProduct.name
                                  : current.medicationName,
                              acknowledgeSafetyWarnings: false,
                            }));
                          }}
                        />
                        {prescriptionForm.productId &&
                        linkedPrescriptionProduct ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("rx.unitsNote", { price: linkedPrescriptionProduct.unitPrice })}
                          </p>
                        ) : null}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("rx.dosageRequired")}
                        </label>
                        <Input
                          required
                          value={prescriptionForm.dosage}
                          maxLength={PRESCRIPTION_DOSAGE_MAX_LENGTH}
                          onChange={(e) =>
                            setPrescriptionForm((current) => ({
                              ...current,
                              dosage: e.target.value,
                            }))
                          }
                          placeholder={t("rx.placeholders.dosage")}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("rx.frequencyRequired")}
                        </label>
                        <Input
                          required
                          value={prescriptionForm.frequency}
                          maxLength={PRESCRIPTION_FREQUENCY_MAX_LENGTH}
                          onChange={(e) =>
                            setPrescriptionForm((current) => ({
                              ...current,
                              frequency: e.target.value,
                            }))
                          }
                          placeholder={t("rx.placeholders.frequency")}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {linkedPrescriptionProduct
                            ? t("rx.quantityUnits")
                            : t("rx.quantity")}
                        </label>
                        <Input
                          type="number"
                          min={PRESCRIPTION_QUANTITY_MIN}
                          max={PRESCRIPTION_COUNT_MAX}
                          step="0.001"
                          aria-label={t("rx.quantityLabel")}
                          aria-describedby={linkedPrescriptionProduct ? "prescription-stock-feedback" : undefined}
                          aria-invalid={Boolean(prescriptionForm.productId) && !hasValidPrescriptionQuantityForInventory}
                          value={prescriptionForm.quantity}
                          onChange={(e) =>
                            setPrescriptionForm((current) => ({
                              ...current,
                              quantity: e.target.value,
                            }))
                          }
                          placeholder={t("rx.placeholders.quantity")}
                        />
                        {linkedPrescriptionProduct ? (
                          <div id="prescription-stock-feedback" className="mt-2 text-xs" role="status">
                            <p>{linkedPrescriptionProduct.inventoryTracked
                              ? t("rx.available", { count: linkedPrescriptionProduct.stockQuantity })
                              : t("rx.untracked")}</p>
                            {!hasValidPrescriptionQuantityForInventory && !linkedProductQuery.isFetching && linkedPrescriptionProduct.inventoryTracked ? (
                              <p className="mt-1 text-destructive">{linkedProductQuery.isError
                                ? t("rx.verifyFailed")
                                : t("rx.insufficient")}</p>
                            ) : null}
                            <a className="mt-1 inline-block underline" href="/inventory" target="_blank" rel="noopener noreferrer">{t("rx.reviewInventory")}</a>
                            <button type="button" className="ml-3 underline" disabled={linkedProductQuery.isFetching} onClick={() => void linkedProductQuery.refetch()}>
                              {linkedProductQuery.isFetching ? t("rx.checkingStock") : t("rx.refreshStock")}
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("rx.refills")}
                        </label>
                        <Input
                          type="number"
                          min={PRESCRIPTION_REFILLS_MIN}
                          max={PRESCRIPTION_COUNT_MAX}
                          step={1}
                          value={prescriptionForm.refillsRemaining}
                          onChange={(e) =>
                            setPrescriptionForm((current) => ({
                              ...current,
                              refillsRemaining: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("rx.startRequired")}
                        </label>
                        <Input
                          type="date"
                          required
                          value={prescriptionForm.startDate}
                          onChange={(e) =>
                            setPrescriptionForm((current) => ({
                              ...current,
                              startDate: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("rx.end")}
                        </label>
                        <Input
                          type="date"
                          value={prescriptionForm.endDate}
                          min={prescriptionForm.startDate || undefined}
                          onChange={(e) =>
                            setPrescriptionForm((current) => ({
                              ...current,
                              endDate: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("rx.instructions")}
                        </label>
                        <Input
                          value={prescriptionForm.instructions}
                          maxLength={PRESCRIPTION_INSTRUCTIONS_MAX_LENGTH}
                          onChange={(e) =>
                            setPrescriptionForm((current) => ({
                              ...current,
                              instructions: e.target.value,
                            }))
                          }
                          placeholder={t("rx.placeholders.instructions")}
                        />
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        {t("rx.controlled")}
                      </p>
                      <PrescriptionSafetyPanel
                        medicationName={medicationNameForSafety}
                        isLoading={prescriptionSafety.isFetching}
                        errorMessage={
                          prescriptionSafety.error?.message ??
                          (prescriptionSafetyMissing
                            ? t("rx.pleaseRetry")
                            : undefined)
                        }
                        warnings={verifiedPrescriptionSafety?.warnings ?? []}
                      />

                      {verifiedPrescriptionSafety?.requiresOverride && (
                        <label className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                          <Checkbox
                            checked={
                              prescriptionForm.acknowledgeSafetyWarnings
                            }
                            onChange={(e) =>
                              setPrescriptionForm((current) => ({
                                ...current,
                                acknowledgeSafetyWarnings:
                                  e.currentTarget.checked,
                              }))
                            }
                            className="mt-0.5"
                          />
                          <span>
                            {t("rx.accept")}
                          </span>
                        </label>
                      )}
                    </div>

                    <div className="mt-4 flex gap-2">
                      <Button
                        type="submit"
                        size="sm"
                        className="h-11 sm:h-9"
                        disabled={!canSubmitPrescription}
                      >
                        {createPrescription.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        {t("rx.save")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-11 sm:h-9"
                        onClick={() => {
                          prescriptionOperationId.current = null;
                          setShowPrescriptionForm(false);
                          setPrescriptionForm(
                            initialPrescriptionForm(recordsTimeZone)
                          );
                        }}
                      >
                        {t("cancel")}
                      </Button>
                    </div>
                  </form>
                )}

                {prescriptionsError || prescriptionsMissing ? (
                  <RecordsErrorPanel
                    message={
                      prescriptionsError
                        ? t("rx.failedMessage", { message: prescriptionsError.message })
                        : t("rx.failed")
                    }
                  />
                ) : isLoadingPrescriptions ? (
                  <RecordsLoadingPanel label={t("rx.loading")} />
                ) : prescriptionsList && prescriptionsList.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            {t("rx.columns.medication")}
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            {t("rx.columns.dosage")}
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            {t("rx.columns.frequency")}
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            {t("rx.columns.inventory")}
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            {t("columns.status")}
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            {t("rx.refills")}
                          </th>
                          <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                            {t("columns.actions")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {prescriptionsList.map((rx) => (
                          <tr
                            key={rx.id}
                            className="border-b border-border last:border-0"
                          >
                            <td className="px-4 py-3 font-medium">
                              {rx.medicationName}
                            </td>
                            <td className="px-4 py-3">{rx.dosage ?? "--"}</td>
                            <td className="px-4 py-3">
                              {rx.frequency ?? "--"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {rx.productName ? (
                                <span>
                                  {rx.productName}
                                  {rx.quantity != null ? (
                                    <span className="block text-xs">
                                      {t("rx.dispensed", { quantity: rx.quantity })}
                                    </span>
                                  ) : null}
                                </span>
                              ) : (
                                "--"
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                                  getPrescriptionStatusBadge(rx.effectiveStatus)
                                )}
                              >
                                {t(`rx.status.${rx.effectiveStatus ?? "unknown"}`)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {rx.refillsRemaining ?? 0}
                            </td>
                            <td className="space-y-2 px-4 py-3 text-right align-top">
                              <div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title={
                                    rx.effectiveStatus === "active"
                                      ? t("rx.printLabel")
                                      : t("rx.onlyActiveLabel")
                                  }
                                  disabled={rx.effectiveStatus !== "active"}
                                  onClick={async () => {
                                  const clientName = [
                                    selectedPatient?.clientFirstName,
                                    selectedPatient?.clientLastName,
                                  ]
                                    .filter(Boolean)
                                    .join(" ");
                                  const { generatePrescriptionLabelPdf } =
                                    await import("@/lib/pdf");
                                  generatePrescriptionLabelPdf({
                                    practiceName: recordsPracticeName,
                                    practicePhone:
                                      recordsPracticePhone ?? undefined,
                                    patientName: selectedPatient?.name ?? "",
                                    clientName,
                                    species: selectedPatient?.species ?? "",
                                    medicationName: rx.medicationName,
                                    dosage: rx.dosage ?? "",
                                    frequency: rx.frequency ?? "",
                                    instructions: rx.instructions ?? undefined,
                                    prescribedBy: rx.prescriberName ?? "",
                                    startDate: rx.startDate
                                      ? formatClinicalDate(
                                          rx.startDate,
                                          recordsTimeZone, undefined, locale
                                        )
                                      : formatClinicalDate(
                                          dateInputValue(
                                            new Date(),
                                            recordsTimeZone
                                          ),
                                          recordsTimeZone, undefined, locale
                                        ),
                                    quantity: rx.quantity != null ? String(rx.quantity) : undefined,
                                    refillsRemaining: rx.refillsRemaining ?? undefined,
                                  }).save(
                                    `label-${rx.medicationName.replace(/\s+/g, "-").toLowerCase()}.pdf`
                                  );
                                  }}
                                >
                                  <Tag className="mr-1 h-3.5 w-3.5" />
                                  {t("rx.printLabel")}
                                </Button>
                              </div>
                              <PrescriptionLifecycleControl
                                prescription={{
                                  id: rx.id,
                                  effectiveStatus: rx.effectiveStatus,
                                  productId: rx.productId,
                                  quantity: rx.quantity,
                                  refillsRemaining: rx.refillsRemaining,
                                }}
                                canManage={canPrescribe}
                                timeZone={recordsTimeZone}
                                onChanged={async () => {
                                  await refetchPrescriptions();
                                  if (linkedAppointmentId) {
                                    await utils.encounters.getCloseout.invalidate({
                                      appointmentId: linkedAppointmentId,
                                    });
                                  }
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState icon={Pill} title={t("rx.empty")} />
                )}
              </div>
            )}

            {/* Problems Tab */}
            {currentTab === "problems" && (
              <div>
                {canManageProblems && (
                  <div className="mb-4 flex justify-end">
                    <Button
                      size="sm"
                      className="h-11 w-full sm:h-9 sm:w-auto"
                      variant={showProblemForm ? "outline" : "default"}
                      onClick={() => {
                        if (showProblemForm) {
                          setProblemForm(initialProblemForm());
                        }
                        setShowProblemForm(!showProblemForm);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {t("problems.add")}
                    </Button>
                  </div>
                )}

                {canManageProblems && showProblemForm && (
                  <form
                    className="mb-6 rounded-lg border border-border bg-card p-4 space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!canSubmitProblem) return;
                      createProblem.mutate({
                        patientId,
                        description: problemForm.description.trim(),
                        status: problemForm.status,
                        onsetDate: problemForm.onsetDate.trim() || undefined,
                      });
                    }}
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("problems.problemRequired")}
                        </label>
                        <Input
                          name="description"
                          required
                          value={problemForm.description}
                          maxLength={PROBLEM_DESCRIPTION_MAX_LENGTH}
                          onChange={(e) =>
                            setProblemForm((form) => ({
                              ...form,
                              description: e.target.value,
                            }))
                          }
                          placeholder={t("problems.placeholder")}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("columns.status")}
                        </label>
                        <select
                          name="status"
                          value={problemForm.status}
                          onChange={(e) =>
                            setProblemForm((form) => ({
                              ...form,
                              status: e.target.value as ProblemStatus,
                            }))
                          }
                          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          {PROBLEM_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {t(`problems.status.${status}`)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("problems.onset")}
                        </label>
                        <Input
                          name="onsetDate"
                          type="date"
                          value={problemForm.onsetDate}
                          aria-invalid={
                            !isProblemOptionalDateInputValid(
                              problemForm.onsetDate
                            )
                          }
                          onChange={(e) =>
                            setProblemForm((form) => ({
                              ...form,
                              onsetDate: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        size="sm"
                        className="h-11 sm:h-9"
                        disabled={!canSubmitProblem}
                      >
                        {createProblem.isPending ? t("saving") : t("save")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-11 sm:h-9"
                        onClick={() => {
                          setShowProblemForm(false);
                          setProblemForm(initialProblemForm());
                        }}
                      >
                        {t("cancel")}
                      </Button>
                    </div>
                  </form>
                )}

                {problemsError || problemsMissing ? (
                  <RecordsErrorPanel
                    message={
                      problemsError
                        ? t("problems.failedMessage", { message: problemsError.message })
                        : t("problems.failed")
                    }
                  />
                ) : isLoadingProblems ? (
                  <RecordsLoadingPanel label={t("problems.loading")} />
                ) : problems && problems.length > 0 ? (
                  <div className="space-y-2">
                    {problems.map((problem) => (
                      <div
                        key={problem.id}
                        className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p
                            className={cn(
                              "text-sm",
                              problem.status === "active"
                                ? "font-semibold"
                                : "font-normal"
                            )}
                          >
                            {problem.description}
                          </p>
                          {problem.onsetDate && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {t("problems.onsetPrefix")}{" "}
                              {formatClinicalDate(
                                problem.onsetDate,
                                recordsTimeZone, undefined, locale
                              )}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                              problem.status === "active"
                                ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                : problem.status === "chronic"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                            )}
                          >
                            {t(`problems.statusLower.${problem.status ?? "active"}`)}
                          </span>
                          {canManageProblems && (
                            <div className="flex flex-wrap gap-1">
                              {problem.status !== "active" && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={updateProblemStatus.isPending}
                                  onClick={() =>
                                    updateProblemStatus.mutate({
                                      id: problem.id,
                                      status: "active",
                                    })
                                  }
                                >
                                  {t("problems.reopen")}
                                </Button>
                              )}
                              {problem.status !== "chronic" && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={updateProblemStatus.isPending}
                                  onClick={() =>
                                    updateProblemStatus.mutate({
                                      id: problem.id,
                                      status: "chronic",
                                    })
                                  }
                                >
                                  {t("problems.chronic")}
                                </Button>
                              )}
                              {problem.status !== "resolved" && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={updateProblemStatus.isPending}
                                  onClick={() =>
                                    updateProblemStatus.mutate({
                                      id: problem.id,
                                      status: "resolved",
                                    })
                                  }
                                >
                                  {t("problems.resolve")}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={ClipboardList}
                    title={t("problems.empty")}
                  />
                )}
              </div>
            )}

            {/* Lab Results Tab */}
            {currentTab === "labResults" && (
              <div>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-medium">
                        {t("labs.manualOnly")}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-amber-900 dark:text-amber-200">
                        {t("labs.manualHelp")}
                      </p>
                    </div>
                  </div>
                  {canManageLabResults && (
                    <Button
                      size="sm"
                      className="h-11 w-full sm:h-9 sm:w-auto"
                      onClick={() => {
                        if (showLabForm) setLabForm(initialLabResultForm());
                        setReplacesLabResultId(null);
                        setReplacementPatient(null);
                        setReplacementPatientSearch("");
                        labResultCreationOperationId.current = null;
                        setShowLabForm(!showLabForm);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {t("labs.addManual")}
                    </Button>
                  )}
                </div>

                {canManageLabResults && showLabForm && (
                  <form
                    className="mb-6 rounded-lg border border-border bg-card p-4 space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!canSubmitLabResult) return;
                      labResultCreationOperationId.current ??= crypto.randomUUID();
                      createLabResult.mutate({
                        patientId:
                          replacesLabResultId && replacementPatient
                            ? replacementPatient.id
                            : patientId,
                        appointmentId:
                          replacesLabResultId &&
                          replacementPatient?.id === selectedPatient?.id
                            ? replacementSourceLabResult?.appointmentId ??
                              undefined
                            : linkedAppointmentId || undefined,
                        testName: labForm.testName.trim(),
                        resultValue: labForm.resultValue.trim() || undefined,
                        unit: labForm.unit.trim() || undefined,
                        referenceRangeLow:
                          labForm.referenceRangeLow.trim() || undefined,
                        referenceRangeHigh:
                          labForm.referenceRangeHigh.trim() || undefined,
                        status: labForm.resultValue.trim()
                          ? "completed"
                          : "pending",
                        resultFlag: labForm.resultValue.trim()
                          ? labForm.resultFlag
                          : "unknown",
                        operationId: labResultCreationOperationId.current,
                        replacesLabResultId:
                          replacesLabResultId ?? undefined,
                      });
                    }}
                  >
                    {replacesLabResultId ? (
                      <div className="space-y-3 rounded-md border border-blue-300 bg-blue-50 px-3 py-3 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
                        <div>
                          <p className="font-medium">
                            {t("labs.creatingReplacement")}
                          </p>
                          <p className="mt-1 text-xs">
                            {t("labs.replacementSummary", {
                              source: selectedPatient?.name ?? t("labs.unknown"),
                              destination: replacementPatient?.name ?? t("labs.choosePatient"),
                            })}
                          </p>
                          <p className="mt-2 text-xs">
                            {t("labs.replacementBilling")}
                          </p>
                        </div>
                        <div className="rounded-md border border-blue-200 bg-background/80 p-3 text-foreground dark:border-blue-900">
                          <label className="block text-xs font-medium">
                            {t("labs.replacementPatient")}
                            <Input
                              className="mt-1"
                              value={replacementPatientSearch}
                              onChange={(event) =>
                                setReplacementPatientSearch(event.target.value)
                              }
                              placeholder={t("labs.replacementSearch")}
                            />
                          </label>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("labs.replacementHelp", { name: selectedPatient?.name ?? t("labs.thisPatient") })}
                          </p>
                          {canSearchReplacementPatients ? (
                            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                              {replacementPatientResults.isLoading ? (
                                <p className="px-2 py-1 text-xs text-muted-foreground">
                                  {t("labs.searchingPatients")}
                                </p>
                              ) : replacementPatientResults.data?.length ? (
                                replacementPatientResults.data.map((option) => (
                                  <button
                                    key={option.id}
                                    type="button"
                                    className={cn(
                                      "flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs hover:bg-muted",
                                      replacementPatient?.id === option.id &&
                                        "bg-muted font-medium"
                                    )}
                                    onClick={() => {
                                      setReplacementPatient(option);
                                      setReplacementPatientSearch("");
                                      labResultCreationOperationId.current =
                                        null;
                                    }}
                                  >
                                    <span>{option.name}</span>
                                    <span className="text-muted-foreground">
                                      {[
                                        option.clientFirstName,
                                        option.clientLastName,
                                      ]
                                        .filter(Boolean)
                                        .join(" ") || t("labs.ownerUnavailable")}
                                    </span>
                                  </button>
                                ))
                              ) : (
                                <p className="px-2 py-1 text-xs text-muted-foreground">
                                  {t("labs.noMatchingPatient")}
                                </p>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("labs.testNameRequired")}
                        </label>
                        <Input
                          name="testName"
                          required
                          value={labForm.testName}
                          maxLength={LAB_TEST_NAME_MAX_LENGTH}
                          onChange={(e) =>
                            setLabForm((form) => ({
                              ...form,
                              testName: e.target.value,
                            }))
                          }
                          placeholder={t("labs.placeholders.test")}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("labs.resultValue")}
                        </label>
                        <Input
                          name="resultValue"
                          value={labForm.resultValue}
                          maxLength={LAB_RESULT_VALUE_MAX_LENGTH}
                          onChange={(e) =>
                            setLabForm((form) => ({
                              ...form,
                              resultValue: e.target.value,
                            }))
                          }
                          placeholder={t("labs.placeholders.value")}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="lab-result-flag"
                          className="block text-xs font-medium text-muted-foreground mb-1"
                        >
                          {t("labs.flag")}
                        </label>
                        <select
                          id="lab-result-flag"
                          value={labForm.resultFlag}
                          disabled={!labForm.resultValue.trim()}
                          onChange={(event) =>
                            setLabForm((form) => ({
                              ...form,
                              resultFlag: event.target.value as LabResultFormState["resultFlag"],
                            }))
                          }
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="unknown">{tl("flagOption.unknown")}</option>
                          <option value="normal">{tl("flagOption.normal")}</option>
                          <option value="abnormal">{tl("flagOption.abnormal")}</option>
                          <option value="critical">{tl("flagOption.critical")}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("labs.unit")}
                        </label>
                        <Input
                          name="unit"
                          value={labForm.unit}
                          maxLength={LAB_UNIT_MAX_LENGTH}
                          onChange={(e) =>
                            setLabForm((form) => ({
                              ...form,
                              unit: e.target.value,
                            }))
                          }
                          placeholder={t("labs.placeholders.unit")}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("labs.refLow")}
                        </label>
                        <Input
                          name="referenceRangeLow"
                          type="number"
                          value={labForm.referenceRangeLow}
                          min={LAB_REFERENCE_MIN}
                          max={LAB_REFERENCE_MAX}
                          step={LAB_REFERENCE_STEP}
                          aria-invalid={
                            !isLabOptionalReferenceInputValid(
                              labForm.referenceRangeLow
                            )
                          }
                          onChange={(e) =>
                            setLabForm((form) => ({
                              ...form,
                              referenceRangeLow: e.target.value,
                            }))
                          }
                          placeholder={t("labs.placeholders.low")}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("labs.refHigh")}
                        </label>
                        <Input
                          name="referenceRangeHigh"
                          type="number"
                          value={labForm.referenceRangeHigh}
                          min={LAB_REFERENCE_MIN}
                          max={LAB_REFERENCE_MAX}
                          step={LAB_REFERENCE_STEP}
                          aria-invalid={
                            !isLabOptionalReferenceInputValid(
                              labForm.referenceRangeHigh
                            ) ||
                            !isLabReferenceRangeOrdered(
                              labForm.referenceRangeLow,
                              labForm.referenceRangeHigh
                            )
                          }
                          onChange={(e) =>
                            setLabForm((form) => ({
                              ...form,
                              referenceRangeHigh: e.target.value,
                            }))
                          }
                          placeholder={t("labs.placeholders.high")}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {replacesLabResultId
                        ? t("labs.replacementValueHelp")
                        : t("labs.valueHelp")}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        size="sm"
                        className="h-11 sm:h-9"
                        disabled={!canSubmitLabResult}
                      >
                        {createLabResult.isPending ? t("saving") : t("save")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-11 sm:h-9"
                        onClick={() => {
                          setShowLabForm(false);
                          setLabForm(initialLabResultForm());
                          setReplacesLabResultId(null);
                          setReplacementPatient(null);
                          setReplacementPatientSearch("");
                          appliedLabAmendLink.current = null;
                          const params = new URLSearchParams(
                            searchParams.toString()
                          );
                          params.delete("amendLabResultId");
                          router.replace(`/records?${params.toString()}`);
                          labResultCreationOperationId.current = null;
                        }}
                      >
                        {t("cancel")}
                      </Button>
                    </div>
                  </form>
                )}

                {labResultsError || labResultsMissing ? (
                  <RecordsErrorPanel
                    message={
                      labResultsError
                        ? t("labs.failedMessage", { message: labResultsError.message })
                        : t("labs.failed")
                    }
                  />
                ) : isLoadingLabResults ? (
                  <RecordsLoadingPanel label={t("labs.loading")} />
                ) : labResultsList && labResultsList.length > 0 ? (
                  <div className="space-y-4">
                    {labTrendGroups.length > 0 && (
                      <LabTrendCharts groups={labTrendGroups} />
                    )}
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/50">
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                              {t("labs.columns.test")}
                            </th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                              {t("labs.columns.result")}
                            </th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                              {t("labs.unit")}
                            </th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                              {t("labs.columns.range")}
                            </th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                              {t("columns.status")}
                            </th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                              {t("labs.columns.evidence")}
                            </th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                              {t("labs.columns.orderedBy")}
                            </th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                              {t("columns.date")}
                            </th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                              {t("columns.actions")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {labResultsList.map((lab) => {
                            const outOfRange = isOutOfRange(
                              lab.resultValue,
                              lab.referenceRangeLow,
                              lab.referenceRangeHigh
                            );
                            return (
                              <tr
                                key={lab.id}
                                id={`lab-result-${lab.id}`}
                                className={cn(
                                  "border-b border-border last:border-0",
                                  lab.correctionId &&
                                    "bg-destructive/5 text-muted-foreground"
                                )}
                              >
                                <td className="px-4 py-3 font-medium">
                                  {lab.testName}
                                  {lab.replacesLabResultId ? (
                                    <a
                                      href={`/records?patientId=${lab.replacesLabResultPatientId ?? patientId}&tab=labResults#lab-result-${lab.replacesLabResultId}`}
                                      className="mt-1 block text-xs font-normal text-primary hover:underline"
                                    >
                                      {t("labs.replacesError")}
                                    </a>
                                  ) : null}
                                  {lab.replacementLabResultId ? (
                                    <a
                                      href={`/records?patientId=${lab.replacementLabResultPatientId ?? patientId}&tab=labResults#lab-result-${lab.replacementLabResultId}`}
                                      className="mt-1 block text-xs font-normal text-primary hover:underline"
                                    >
                                      {t("labs.viewReplacement")}
                                    </a>
                                  ) : null}
                                </td>
                                <td
                                  className={cn(
                                    "px-4 py-3",
                                    outOfRange
                                      ? "text-red-600 font-semibold dark:text-red-400"
                                      : ""
                                  )}
                                >
                                  {lab.resultValue ?? "--"}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {lab.unit ?? "--"}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {lab.referenceRangeLow != null &&
                                  lab.referenceRangeHigh != null
                                    ? `${lab.referenceRangeLow} - ${lab.referenceRangeHigh}`
                                    : "--"}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-col items-start gap-1">
                                    <span
                                      className={cn(
                                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                                        getLabStatusBadge(lab.status)
                                      )}
                                    >
                                      {tl(`status.${lab.status}`)}
                                    </span>
                                    {lab.resultFlag !== "unknown" ? (
                                      <span className={cn(
                                        "text-xs font-medium capitalize",
                                        lab.resultFlag === "critical"
                                          ? "text-red-700 dark:text-red-300"
                                          : lab.resultFlag === "abnormal"
                                            ? "text-amber-700 dark:text-amber-300"
                                            : "text-emerald-700 dark:text-emerald-300",
                                      )}>
                                        {tl(`flags.${lab.resultFlag}`)}
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground">
                                  {lab.completedAt ? (
                                    <span className="block">
                                      {t("labs.completed", {
                                        date: formatClinicalDate(lab.completedAt, recordsTimeZone, undefined, locale),
                                        actor: lab.completionActorName ?? t("labs.actorUnavailable"),
                                      })}
                                    </span>
                                  ) : (
                                    t("labs.awaitingValues")
                                  )}
                                  {lab.reviewedAt ? (
                                    <span className="mt-1 block">
                                      {t("labs.reviewed", { date: formatClinicalDate(lab.reviewedAt, recordsTimeZone, undefined, locale) })}{lab.reviewedByName ? ` ${t("labs.reviewedBy", { name: lab.reviewedByName })}` : ""}
                                    </span>
                                  ) : null}
                                  {lab.followUpStatus === "open" ? (
                                    <span className="mt-1 block font-medium text-amber-700 dark:text-amber-300">
                                      {t("labs.followUp", { name: lab.followUpAssigneeName ?? t("labs.assigned") })}
                                    </span>
                                  ) : null}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {lab.orderedByName ?? "--"}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {lab.createdAt
                                    ? formatClinicalDate(
                                        lab.createdAt,
                                        recordsTimeZone, undefined, locale
                                      )
                                    : "--"}
                                </td>
                                <td className="px-4 py-3">
                                  {lab.correctionId ? (
                                    <div className="min-w-64">
                                      <ClinicalCorrectionControl
                                        timeZone={recordsTimeZone}
                                        correction={
                                          lab.correctionReason && lab.correctedAt
                                            ? {
                                                id: lab.correctionId,
                                                reason: lab.correctionReason,
                                                correctedAt: lab.correctedAt,
                                                correctedByName:
                                                  lab.correctedByName,
                                              }
                                            : null
                                        }
                                        canCorrect={false}
                                        isPending={false}
                                        onCorrect={async () => undefined}
                                      />
                                      <CorrectedLabResultHistory
                                        resultId={lab.id}
                                        timeZone={recordsTimeZone}
                                      />
                                      {canCorrectClinicalRecords &&
                                      !lab.replacementLabResultId ? (
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="mt-2"
                                          onClick={() => {
                                            const params = new URLSearchParams(
                                              searchParams.toString()
                                            );
                                            params.set("patientId", patientId);
                                            params.set("tab", "labResults");
                                            params.set(
                                              "amendLabResultId",
                                              lab.id
                                            );
                                            router.replace(
                                              `/records?${params.toString()}#lab-result-${lab.id}`
                                            );
                                            setLabForm({
                                              testName: lab.testName,
                                              resultValue: "",
                                              unit: "",
                                              referenceRangeLow: "",
                                              referenceRangeHigh: "",
                                              resultFlag: "unknown",
                                            });
                                            setReplacesLabResultId(lab.id);
                                            setReplacementPatient(
                                              selectedPatient
                                            );
                                            setReplacementPatientSearch("");
                                            setShowLabForm(true);
                                            labResultCreationOperationId.current =
                                              null;
                                          }}
                                        >
                                          {t("labs.createReplacement")}
                                        </Button>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <div className="min-w-52 space-y-2">
                                      {canReviewLabResults &&
                                      lab.status === "completed" &&
                                      (lab.resultFlag !== "critical" ||
                                        lab.followUpStatus !== "not_required") ? (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() =>
                                            updateLabResultStatus.mutate({
                                              id: lab.id,
                                              status: "reviewed",
                                              operationId:
                                                labReviewOperationIds.current.get(lab.id) ??
                                                (() => {
                                                  const operationId = crypto.randomUUID();
                                                  labReviewOperationIds.current.set(lab.id, operationId);
                                                  return operationId;
                                                })(),
                                            })
                                          }
                                          disabled={
                                            updateLabResultStatus.isPending
                                          }
                                        >
                                          {t("labs.markReviewed")}
                                        </Button>
                                      ) : lab.status === "completed" &&
                                        lab.resultFlag === "critical" &&
                                        lab.followUpStatus === "not_required" &&
                                        canManageLabResults ? (
                                        <Button asChild variant="ghost" size="sm">
                                          <Link href={`/lab-results?resultId=${lab.id}`}>
                                            {t("labs.assignFollowUp")}
                                          </Link>
                                        </Button>
                                      ) : lab.status === "pending" && canManageLabResults ? (
                                        <Button asChild variant="ghost" size="sm">
                                          <Link href={`/lab-results?resultId=${lab.id}`}>
                                            {t("labs.openSelected")}
                                          </Link>
                                        </Button>
                                      ) : null}
                                      <ClinicalCorrectionControl
                                        timeZone={recordsTimeZone}
                                        correction={null}
                                        canCorrect={canCorrectClinicalRecords}
                                        isPending={correctLabResult.isPending}
                                        description={t("labs.correctionHelp")}
                                        onCorrect={async (reason) => {
                                          let operationId =
                                            labCorrectionOperationIds.current.get(
                                              lab.id
                                            );
                                          if (!operationId) {
                                            operationId = crypto.randomUUID();
                                            labCorrectionOperationIds.current.set(
                                              lab.id,
                                              operationId
                                            );
                                          }
                                          await correctLabResult.mutateAsync({
                                            patientId,
                                            recordId: lab.id,
                                            operationId,
                                            reason,
                                          });
                                        }}
                                      />
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <EmptyState icon={FlaskConical} title={t("labs.empty")} />
                )}
              </div>
            )}

            {/* Procedures Tab */}
            {currentTab === "procedures" && (
              <div>
                {canCreateProcedures && (
                  <div className="flex justify-end mb-4">
                    <Button
                      size="sm"
                      className="h-11 w-full sm:h-9 sm:w-auto"
                      onClick={() => {
                        if (showProcedureForm) {
                          setProcedureForm(initialProcedureForm());
                        }
                        setShowProcedureForm(!showProcedureForm);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {t("procedures.add")}
                    </Button>
                  </div>
                )}

                {canCreateProcedures && showProcedureForm && (
                  <form
                    className="mb-6 rounded-lg border border-border bg-card p-4 space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!canSubmitProcedure) return;
                      const durationMinutes =
                        procedureForm.durationMinutes.trim();
                      createProcedure.mutate({
                        patientId,
                        appointmentId: linkedAppointmentId || undefined,
                        name: procedureForm.name.trim(),
                        description:
                          procedureForm.description.trim() || undefined,
                        anesthesiaUsed:
                          procedureForm.anesthesiaUsed.trim() || undefined,
                        durationMinutes: durationMinutes
                          ? Number(durationMinutes)
                          : undefined,
                        notes: procedureForm.notes.trim() || undefined,
                      });
                    }}
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("procedures.nameRequired")}
                        </label>
                        <Input
                          name="name"
                          required
                          value={procedureForm.name}
                          maxLength={PROCEDURE_NAME_MAX_LENGTH}
                          onChange={(e) =>
                            setProcedureForm((form) => ({
                              ...form,
                              name: e.target.value,
                            }))
                          }
                          placeholder={t("procedures.placeholders.name")}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("procedures.durationMinutes")}
                        </label>
                        <Input
                          name="durationMinutes"
                          type="number"
                          value={procedureForm.durationMinutes}
                          min={PROCEDURE_DURATION_MIN_MINUTES}
                          max={PROCEDURE_DURATION_MAX_MINUTES}
                          step={1}
                          aria-invalid={
                            !isProcedureOptionalDurationInputValid(
                              procedureForm.durationMinutes
                            )
                          }
                          onChange={(e) =>
                            setProcedureForm((form) => ({
                              ...form,
                              durationMinutes: e.target.value,
                            }))
                          }
                          placeholder={t("procedures.placeholders.duration")}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("procedures.description")}
                        </label>
                        <Input
                          name="description"
                          value={procedureForm.description}
                          maxLength={PROCEDURE_DESCRIPTION_MAX_LENGTH}
                          onChange={(e) =>
                            setProcedureForm((form) => ({
                              ...form,
                              description: e.target.value,
                            }))
                          }
                          placeholder={t("procedures.placeholders.description")}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("procedures.anesthesiaUsed")}
                        </label>
                        <Input
                          name="anesthesiaUsed"
                          value={procedureForm.anesthesiaUsed}
                          maxLength={PROCEDURE_ANESTHESIA_MAX_LENGTH}
                          onChange={(e) =>
                            setProcedureForm((form) => ({
                              ...form,
                              anesthesiaUsed: e.target.value,
                            }))
                          }
                          placeholder={t("procedures.placeholders.anesthesia")}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {t("procedures.notes")}
                        </label>
                        <Input
                          name="notes"
                          value={procedureForm.notes}
                          maxLength={PROCEDURE_NOTES_MAX_LENGTH}
                          onChange={(e) =>
                            setProcedureForm((form) => ({
                              ...form,
                              notes: e.target.value,
                            }))
                          }
                          placeholder={t("procedures.placeholders.notes")}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        size="sm"
                        className="h-11 sm:h-9"
                        disabled={!canSubmitProcedure}
                      >
                        {createProcedure.isPending ? t("saving") : t("save")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-11 sm:h-9"
                        onClick={() => {
                          setShowProcedureForm(false);
                          setProcedureForm(initialProcedureForm());
                        }}
                      >
                        {t("cancel")}
                      </Button>
                    </div>
                  </form>
                )}

                {proceduresError || proceduresMissing ? (
                  <RecordsErrorPanel
                    message={
                      proceduresError
                        ? t("procedures.failedMessage", { message: proceduresError.message })
                        : t("procedures.failed")
                    }
                  />
                ) : isLoadingProcedures ? (
                  <RecordsLoadingPanel label={t("procedures.loading")} />
                ) : proceduresList && proceduresList.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            {t("procedures.columns.name")}
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            {t("procedures.columns.by")}
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            {t("procedures.columns.duration")}
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            {t("procedures.columns.anesthesia")}
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            {t("columns.date")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {proceduresList.map((proc) => (
                          <tr
                            key={proc.id}
                            className="border-b border-border last:border-0"
                          >
                            <td className="px-4 py-3">
                              <p className="font-medium">{proc.name}</p>
                              {proc.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {proc.description}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {proc.performedByName ?? "--"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {proc.durationMinutes
                                ? t("procedures.minutes", { count: proc.durationMinutes })
                                : "--"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {proc.anesthesiaUsed ?? "--"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {proc.createdAt
                                ? formatClinicalDate(
                                    proc.createdAt,
                                    recordsTimeZone, undefined, locale
                                  )
                                : "--"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState icon={Scissors} title={t("procedures.empty")} />
                )}
              </div>
            )}
              </>
            )}
          </div>
        </>
      )}

      {/* Prompt to search if no patient selected */}
      {!selectedPatient && (
        <EmptyState
          className="mt-6"
          icon={Search}
          title={t("searchPrompt")}
        />
      )}
    </div>
  );
}

export default function RecordsPage() {
  const t = useTranslations("records.page");
  return (
    <Suspense fallback={<RecordsLoadingPanel label={t("loadingRecords")} />}>
      <RecordsPageContent />
    </Suspense>
  );
}
