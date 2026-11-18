import { useTranslations } from "use-intl";
import { PATIENT_SPECIES } from "./species";

/** Translated species name; values outside the known list are shown as entered. */
export function useSpeciesLabel(): (species: string | null | undefined) => string {
  const t = useTranslations("patients.species");
  return (species) => {
    if (!species) return "";
    return (PATIENT_SPECIES as readonly string[]).includes(species) ? t(species) : species;
  };
}
