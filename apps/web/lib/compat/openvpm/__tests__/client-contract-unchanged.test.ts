import { describe, expect, it } from "vitest";
import { z } from "zod";
import { toApiClient } from "../mappers";
import { clientRow } from "./fixtures";

// The public /api/v1 client shape as shipped before languages; .strict() fails on any new field.
const publishedClient = z
  .object({
    id: z.string(),
    first_name: z.string(),
    last_name: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    address: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    zip: z.string().nullable(),
    preferred_contact_method: z.string().nullable(),
    notes: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict();

describe("/api/v1 client contract", () => {
  it("does not expose the client's preferred language", () => {
    const api = toApiClient(clientRow({ preferredLanguage: "es" }));
    expect(() => publishedClient.parse(api)).not.toThrow();
    expect(JSON.stringify(api)).not.toContain("language");
  });
});
