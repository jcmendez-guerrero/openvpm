"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { AlertCircle, ArrowLeft, Check, Loader2 } from "lucide-react";
import { useTranslations } from "use-intl";
import { trpc } from "@/lib/trpc";
import { useSpeciesLabel } from "@/lib/patients/use-species-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/common/empty-state";
import { toast } from "sonner";
import {
  CLIENT_SEARCH_MAX_LENGTH,
  isClientSearchInputValid,
} from "@/lib/clients/policy";
import {
  PATIENT_BREED_MAX_LENGTH,
  PATIENT_COLOR_MAX_LENGTH,
  PATIENT_MICROCHIP_NUMBER_MAX_LENGTH,
  PATIENT_NAME_MAX_LENGTH,
  isOptionalPatientTextValid,
  isRequiredPatientTextValid,
} from "@/lib/patients/policy";
import { PATIENT_SPECIES } from "@/lib/patients/species";

const sexOptions = ["male", "female", "male_neutered", "female_spayed"] as const;

export default function NewPatientPage() {
  const router = useRouter();
  const t = useTranslations("patients.form");
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("checkingAccess")}
      </div>
    );
  }

  if (!canManagePatientFormRole(session?.user?.role)) {
    return (
      <div className="max-w-2xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/patients")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("back")}
        </Button>
        <EmptyState
          icon={AlertCircle}
          title={t("readOnlyTitle")}
          description={t("readOnlyCreate")}
          action={{
            label: t("back"),
            onClick: () => router.push("/patients"),
          }}
        />
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("loading")}
        </div>
      }
    >
      <NewPatientForm />
    </Suspense>
  );
}

function canManagePatientFormRole(role?: string | null): boolean {
  return (
    role === "admin" ||
    role === "veterinarian" ||
    role === "technician" ||
    role === "front_desk"
  );
}

function NewPatientForm() {
  const router = useRouter();
  const t = useTranslations("patients");
  const speciesLabel = useSpeciesLabel();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({
    clientId: "",
    name: "",
    species: "canine" as string,
    breed: "",
    sex: "" as string,
    dob: "",
    color: "",
    microchipNumber: "",
  });
  const [clientSearch, setClientSearch] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [selectedClientName, setSelectedClientName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const preselectedClientId = searchParams.get("clientId") ?? "";
  const preselectedClientName = (searchParams.get("clientName") ?? "").trim();
  const firstClinicDay = searchParams.get("setup") === "first-visit";
  const trimmedClientSearch = clientSearch.trim();
  const canSearchClients = isClientSearchInputValid(clientSearch);

  const {
    data: clientResults,
    isLoading: isSearchingClients,
    error: clientSearchError,
  } = trpc.clients.search.useQuery(
    { query: trimmedClientSearch },
    { enabled: canSearchClients },
  );
  const clientSearchMissing =
    canSearchClients &&
    !selectedClientName &&
    !isSearchingClients &&
    !clientSearchError &&
    !clientResults;

  useEffect(() => {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        preselectedClientId,
      ) ||
      !preselectedClientName ||
      preselectedClientName.length > CLIENT_SEARCH_MAX_LENGTH
    ) {
      return;
    }
    setForm((current) =>
      current.clientId
        ? current
        : { ...current, clientId: preselectedClientId },
    );
    setSelectedClientName((current) => current || preselectedClientName);
  }, [preselectedClientId, preselectedClientName]);

  const createPatient = trpc.patients.create.useMutation({
    onSuccess: (patient) => {
      toast.success(t("form.created"));
      if (firstClinicDay) {
        router.push(
          `/schedule?setup=first-visit&patient=${encodeURIComponent(patient.name)}`,
        );
        return;
      }
      router.push(`/patients/${patient.id}`);
    },
    onError: (err) => {
      toast.error(err.message);
      setError(err.message);
    },
  });

  const canSubmit =
    !!form.clientId &&
    isRequiredPatientTextValid(form.name, PATIENT_NAME_MAX_LENGTH) &&
    isOptionalPatientTextValid(form.breed, PATIENT_BREED_MAX_LENGTH) &&
    isOptionalPatientTextValid(form.color, PATIENT_COLOR_MAX_LENGTH) &&
    isOptionalPatientTextValid(
      form.microchipNumber,
      PATIENT_MICROCHIP_NUMBER_MAX_LENGTH,
    );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const submittedDob =
      (e.currentTarget.elements.namedItem("dob") as HTMLInputElement | null)
        ?.value ?? form.dob;

    if (!form.clientId) {
      setError(t("form.ownerRequired"));
      return;
    }
    if (!form.name.trim()) {
      setError(t("form.nameRequired"));
      return;
    }
    if (!canSubmit) {
      setError(t("form.checkFields"));
      return;
    }

    createPatient.mutate({
      clientId: form.clientId,
      name: form.name.trim(),
      species: form.species as any,
      breed: form.breed.trim() || undefined,
      sex: form.sex ? (form.sex as any) : undefined,
      dob: submittedDob || undefined,
      color: form.color.trim() || undefined,
      microchipNumber: form.microchipNumber.trim() || undefined,
    });
  };

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const selectClient = (client: {
    id: string;
    firstName: string;
    lastName: string;
  }) => {
    setForm((prev) => ({ ...prev, clientId: client.id }));
    setSelectedClientName(`${client.firstName} ${client.lastName}`);
    setClientSearch("");
    setShowClientDropdown(false);
  };

  return (
    <div className="max-w-2xl">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/patients")}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("form.back")}
      </Button>

      <h2 className="font-heading text-xl font-semibold">{t("list.new")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {firstClinicDay
          ? t("form.firstDayIntro")
          : t("form.newIntro")}
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {/* Client Search */}
        <div>
          <label className="text-sm font-medium">{t("form.owner")}</label>
          {selectedClientName ? (
            <div className="mt-1 flex items-center gap-2">
              <div className="flex h-10 flex-1 items-center rounded-md border border-input bg-muted/50 px-3 text-sm">
                <Check className="mr-2 h-4 w-4 text-emerald-600" />
                {selectedClientName}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setForm((prev) => ({ ...prev, clientId: "" }));
                  setSelectedClientName("");
                }}
              >
                {t("form.change")}
              </Button>
            </div>
          ) : (
            <div className="relative mt-1">
              <Input
                placeholder={t("form.clientSearchPlaceholder")}
                value={clientSearch}
                maxLength={CLIENT_SEARCH_MAX_LENGTH}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setShowClientDropdown(true);
                }}
                onFocus={() => setShowClientDropdown(true)}
                onBlur={() => {
                  // Delay to allow click on dropdown item
                  setTimeout(() => setShowClientDropdown(false), 200);
                }}
              />
              {showClientDropdown && canSearchClients && (
                <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-card shadow-lg">
                  {clientSearchError || clientSearchMissing ? (
                    <div className="p-3 text-sm text-destructive">
                      {clientSearchError?.message ??
                        t("form.clientSearchFailed")}
                    </div>
                  ) : isSearchingClients ? (
                    <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t("form.searchingClients")}
                    </div>
                  ) : clientResults && clientResults.length > 0 ? (
                    clientResults.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 first:rounded-t-md last:rounded-b-md"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectClient(client)}
                      >
                        <span className="font-medium">
                          {client.firstName} {client.lastName}
                        </span>
                        <span className="text-muted-foreground">
                          {client.email || client.phone || ""}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="p-3 text-center text-sm text-muted-foreground">
                      {t("form.noClients")}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium" htmlFor="name">
            {t("form.name")}
          </label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder={t("form.namePlaceholder")}
            className="mt-1"
            maxLength={PATIENT_NAME_MAX_LENGTH}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium" htmlFor="species">
              {t("form.species")}
            </label>
            <select
              id="species"
              value={form.species}
              onChange={(e) => updateField("species", e.target.value)}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {PATIENT_SPECIES.map((value) => (
                <option key={value} value={value}>
                  {speciesLabel(value)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="breed">
              {t("form.breed")}
            </label>
            <Input
              id="breed"
              value={form.breed}
              onChange={(e) => updateField("breed", e.target.value)}
              placeholder={t("form.breed")}
              className="mt-1"
              maxLength={PATIENT_BREED_MAX_LENGTH}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium" htmlFor="sex">
              {t("form.sex")}
            </label>
            <select
              id="sex"
              value={form.sex}
              onChange={(e) => updateField("sex", e.target.value)}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">{t("form.selectSex")}</option>
              {sexOptions.map((value) => (
                <option key={value} value={value}>
                  {t(`sex.${value}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="dob">
              {t("form.dob")}
            </label>
            <Input
              id="dob"
              name="dob"
              type="date"
              value={form.dob}
              onChange={(e) => updateField("dob", e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium" htmlFor="color">
              {t("form.color")}
            </label>
            <Input
              id="color"
              value={form.color}
              onChange={(e) => updateField("color", e.target.value)}
              placeholder={t("form.colorPlaceholder")}
              className="mt-1"
              maxLength={PATIENT_COLOR_MAX_LENGTH}
            />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="microchipNumber">
              {t("form.microchip")}
            </label>
            <Input
              id="microchipNumber"
              value={form.microchipNumber}
              onChange={(e) => updateField("microchipNumber", e.target.value)}
              placeholder={t("form.microchipPlaceholder")}
              className="mt-1"
              maxLength={PATIENT_MICROCHIP_NUMBER_MAX_LENGTH}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            disabled={!canSubmit || createPatient.isPending}
          >
            {createPatient.isPending ? t("form.creating") : t("form.create")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/patients")}
          >
            {t("form.cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}
