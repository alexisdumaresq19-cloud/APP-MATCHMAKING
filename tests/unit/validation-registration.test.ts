import { describe, expect, it } from "vitest";
import { fieldErrorsOf } from "@/lib/validation/common";
import {
  NEEDS_OR_SECTORS_MESSAGE,
  participantProfileSchema,
  registrationSchema,
  stepMatchingSchema,
} from "@/lib/validation/registration";

const base = {
  firstName: "Marie",
  lastName: "Tremblay",
  email: "marie@exemple.quebec",
  phone: "",
  jobTitle: "",
  companyName: "Garderie Les Petits Pas",
  sectorId: "cksector000000000000001",
  region: "Montréal",
  city: "Montréal",
  website: "",
  description: "",
  offers: ["garde d'enfants"],
  goalsText: "",
  consent: "on",
  formStartedAt: String(Date.now() - 10_000),
};

describe("registration validation — needs or sought sectors", () => {
  it("accepts sought sectors without free-text needs", () => {
    const result = registrationSchema.safeParse({
      ...base,
      needs: [],
      soughtSectorIds: ["cksector000000000000002", "cksector000000000000002", " "],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.needs).toEqual([]);
      expect(result.data.soughtSectorIds).toEqual(["cksector000000000000002"]);
    }
  });

  it("accepts free-text needs without sought sectors", () => {
    const result = registrationSchema.safeParse({
      ...base,
      needs: ["traiteur"],
      soughtSectorIds: [],
    });
    expect(result.success).toBe(true);
  });

  it("refuses when both are empty, on every schema (checks survive object composition)", () => {
    for (const schema of [registrationSchema, stepMatchingSchema, participantProfileSchema]) {
      const result = schema.safeParse({ ...base, needs: [], soughtSectorIds: [] });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(fieldErrorsOf(result.error).soughtSectorIds).toEqual([NEEDS_OR_SECTORS_MESSAGE]);
      }
    }
  });

  it("still requires at least one offer", () => {
    const result = stepMatchingSchema.safeParse({
      offers: [],
      needs: [],
      soughtSectorIds: ["cksector000000000000002"],
      goalsText: "",
      consent: "on",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrorsOf(result.error).offers).toBeDefined();
  });
});
