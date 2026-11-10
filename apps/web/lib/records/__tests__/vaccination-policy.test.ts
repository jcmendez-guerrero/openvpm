import { describe, expect, it } from "vitest";
import { isRabiesVaccineName } from "../vaccination-policy";

describe("rabies vaccine identification", () => {
  it.each([
    "Rabies",
    "Canine Rabies 3 Year",
    "RABIES-BOOSTER",
    "rabies_vaccine",
    "Rabies/Feline",
    "Rabia",
    "Vacuna antirrábica",
    "ANTIRRABICA 3 años",
    "Antirrábico canino",
    "Vacuna anti-rabia",
    "Vacuna antirrábica", // accent typed as a separate combining mark
  ])("recognizes %s", (name) => {
    expect(isRabiesVaccineName(name)).toBe(true);
  });

  it.each([
    "Parvovirus",
    "Coronavirus",
    "Crabies",
    "Rabieslike",
    "Rabiar",
    "Sarabia",
    "Antirrábicaxyz",
  ])(
    "does not classify %s as rabies",
    (name) => {
      expect(isRabiesVaccineName(name)).toBe(false);
    },
  );
});
