export const VACCINATION_NAME_MAX_LENGTH = 255;
export const VACCINATION_PRODUCT_NAME_MAX_LENGTH = 255;
export const VACCINATION_LOT_NUMBER_MAX_LENGTH = 64;
export const VACCINATION_MANUFACTURER_MAX_LENGTH = 128;
export const VACCINATION_RABIES_TAG_MAX_LENGTH = 64;
export const VACCINATION_LICENSED_DURATION_MIN_MONTHS = 1;
export const VACCINATION_LICENSED_DURATION_MAX_MONTHS = 120;

// English "rabies" plus Spanish "rabia" / "antirrábica" (accent optional), so
// rabies certificate checks apply whichever language staff type the name in.
const RABIES_VACCINE_NAME =
  /(^|\s|[-_/])(rabies|rabia|antirr[aá]bic[ao]s?)($|\s|[-_/])/i;

export function isRabiesVaccineName(value: string): boolean {
  return RABIES_VACCINE_NAME.test(value.normalize("NFC").trim());
}

const DATE_INPUT_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isVaccinationRequiredTextInputValid(
  value: string,
  maxLength: number,
): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength;
}

export function isVaccinationOptionalTextInputValid(
  value: string,
  maxLength: number,
): boolean {
  return value.trim().length <= maxLength;
}

export function isVaccinationDateInputValid(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    DATE_INPUT_RE.test(value) &&
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function isVaccinationOptionalDateInputValid(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length === 0 || isVaccinationDateInputValid(trimmed);
}
