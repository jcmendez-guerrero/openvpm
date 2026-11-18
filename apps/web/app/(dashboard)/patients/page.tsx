"use client";

import Link from "next/link";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Search, Plus, PawPrint, GitMerge } from "lucide-react";
import { useTranslations } from "use-intl";
import { trpc } from "@/lib/trpc";
import { useSpeciesLabel } from "@/lib/patients/use-species-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/common/empty-state";
import { TableSkeleton } from "@/components/common/loading";
import { PATIENT_SEARCH_MAX_LENGTH } from "@/lib/patients/policy";
import {
  PATIENT_SPECIES,
  PATIENT_SPECIES_EMOJI,
  type PatientSpecies,
} from "@/lib/patients/species";

const speciesEmoji: Record<string, string> = PATIENT_SPECIES_EMOJI;

type SpeciesFilter = "" | PatientSpecies;

const speciesFilters: SpeciesFilter[] = ["", ...PATIENT_SPECIES];

function canManagePatientsRole(role?: string | null): boolean {
  return (
    role === "admin" ||
    role === "veterinarian" ||
    role === "technician" ||
    role === "front_desk"
  );
}

const SEXES = ["male", "female", "male_neutered", "female_spayed"];

function formatSex(sex: string | null, t: ReturnType<typeof useTranslations>): string {
  if (!sex) return "\u2014";
  return SEXES.includes(sex) ? t(`sexShort.${sex}`) : sex;
}

export default function PatientsPage() {
  const router = useRouter();
  const t = useTranslations("patients");
  const speciesLabel = useSpeciesLabel();
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const [species, setSpecies] = useState<SpeciesFilter>("");
  const trimmedSearch = search.trim();
  const hasSearch = trimmedSearch.length > 0;
  const hasFilters = hasSearch || Boolean(species);
  const canManagePatients = canManagePatientsRole(session?.user?.role);
  const canReviewDuplicates = session?.user?.role === "admin";

  const { data, isLoading, error } = trpc.patients.list.useQuery({
    search: hasSearch ? trimmedSearch : undefined,
    species: species || undefined,
    limit: 25,
    offset: 0,
  });
  const patientsMissing = !isLoading && !error && !data;

  return (
    <div>
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold">{t("list.title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("list.subtitle")}
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          {canReviewDuplicates ? (
            <Button
              variant="outline"
              onClick={() => router.push("/patients/duplicates")}
              className="h-11 w-full sm:h-10 sm:w-auto"
            >
              <GitMerge className="mr-2 h-4 w-4" />
              {t("list.reviewDuplicates")}
            </Button>
          ) : null}
          {canManagePatients && (
            <Button
              onClick={() => router.push("/patients/new")}
              className="h-11 w-full sm:h-10 sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("list.new")}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="relative w-full min-w-0 sm:max-w-sm sm:flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("list.searchPlaceholder")}
            value={search}
            maxLength={PATIENT_SEARCH_MAX_LENGTH}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 pl-9 sm:h-10"
          />
        </div>
        <select
          value={species}
          onChange={(e) => setSpecies(e.target.value as SpeciesFilter)}
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-10 sm:w-auto"
        >
          {speciesFilters.map((value) => (
            <option key={value} value={value}>
              {value ? speciesLabel(value) : t("list.allSpecies")}
            </option>
          ))}
        </select>
        {data && (
          <p className="text-sm text-muted-foreground sm:shrink-0">
            {t("list.count", { count: data.total })}
          </p>
        )}
      </div>

      {error || patientsMissing ? (
        <div className="mt-6 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {error?.message ?? t("list.loadFailed")}
        </div>
      ) : isLoading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : data && data.items.length > 0 ? (
        <>
          <div className="mt-6 space-y-3 sm:hidden">
            {data.items.map((patient) => {
              const ownerName =
                patient.clientFirstName && patient.clientLastName
                  ? `${patient.clientFirstName} ${patient.clientLastName}`
                  : t("list.noOwner");

              return (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() => router.push(`/patients/${patient.id}`)}
                  aria-label={t("list.open", { name: patient.name })}
                  className="min-h-11 w-full min-w-0 overflow-hidden rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <span className="flex min-w-0 items-start justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                      <span className="mr-1.5" aria-hidden="true">
                        {speciesEmoji[patient.species ?? "other"] ?? "🐾"}
                      </span>
                      {patient.name}
                    </span>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2 py-1 text-xs font-medium ${
                        patient.status === "active"
                          ? "bg-emerald-100 text-emerald-700"
                          : patient.status === "deceased"
                            ? "bg-gray-100 text-gray-600"
                            : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {t(`status.${patient.status ?? "active"}`)}
                    </span>
                  </span>
                  <span className="mt-2 block min-w-0 space-y-1 text-sm text-muted-foreground">
                    <span className="block truncate">
                      {[patient.breed, speciesLabel(patient.species)]
                        .filter(Boolean)
                        .join(" · ") || t("list.noBreed")}
                    </span>
                    <span className="block truncate">{t("list.owner", { name: ownerName })}</span>
                    <span className="block text-xs">
                      {t("list.sex", { sex: formatSex(patient.sex, t) })}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 hidden overflow-x-auto rounded-lg border border-border sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t("list.columns.name")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t("list.columns.breed")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t("list.columns.owner")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t("list.columns.sex")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t("list.columns.status")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((patient) => (
                  <tr
                    key={patient.id}
                    onClick={() => router.push(`/patients/${patient.id}`)}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">
                      <span className="mr-1.5">
                        {speciesEmoji[patient.species ?? "other"] ??
                          "\uD83D\uDC3E"}
                      </span>
                      <Link
                        href={`/patients/${patient.id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                      >
                        {patient.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {patient.breed || "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {patient.clientFirstName && patient.clientLastName
                        ? `${patient.clientFirstName} ${patient.clientLastName}`
                        : "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatSex(patient.sex, t)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          patient.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : patient.status === "deceased"
                              ? "bg-gray-100 text-gray-600"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {t(`status.${patient.status ?? "active"}`)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <EmptyState
          className="mt-6"
          icon={PawPrint}
          title={
            hasFilters ? t("list.noMatches") : t("list.emptyTitle")
          }
          description={
            hasFilters
              ? t("list.noMatchesHelp")
              : t("list.emptyHelp")
          }
          action={
            !hasFilters && canManagePatients
              ? {
                  label: t("list.addFirst"),
                  onClick: () => router.push("/patients/new"),
                  icon: Plus,
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
