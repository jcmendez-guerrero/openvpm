import { afterEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import superjson from "superjson";

vi.mock("@/i18n/clinic-default-cache", () => ({
  getClinicDefaultLanguage: async () => "en",
}));

const { createRouter, portalProcedure } = await import("../trpc");

const MESSAGE = "A lab result cannot be reviewed without recorded values.";
const router = createRouter({
  fail: portalProcedure.query(() => {
    throw new TRPCError({ code: "BAD_REQUEST", message: MESSAGE });
  }),
});

function transactionDb() {
  const db: Record<string, unknown> = { execute: async () => undefined };
  db.transaction = async (fn: (tx: unknown) => unknown) => fn(db);
  return db;
}

async function errorMessage(preferredLanguage: string | null, browserLanguage: string) {
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req: new Request("https://portal.example/api/trpc/fail"),
    router,
    createContext: () =>
      ({
        db: transactionDb(),
        language: browserLanguage,
        languageChoice: null,
        acceptLanguage: browserLanguage,
        portalClient: {
          id: "c1",
          practiceId: "p1",
          firstName: "Portal",
          lastName: "Client",
          email: null,
          phone: null,
          preferredLanguage,
        },
        portalSessionId: "session-id",
      }) as never,
  });
  const body = await response.json();
  return superjson.deserialize<{ message: string }>(body.error).message;
}

afterEach(() => vi.unstubAllEnvs());

describe("portal error language", () => {
  it("uses the client's saved language over the browser", async () => {
    vi.stubEnv("LANGUAGE_SELECTION_ENABLED", "true");
    expect(await errorMessage("es", "en")).not.toBe(MESSAGE);
    expect(await errorMessage("en", "es")).toBe(MESSAGE);
  });

  it("falls back to the browser when the client has no saved language", async () => {
    vi.stubEnv("LANGUAGE_SELECTION_ENABLED", "true");
    expect(await errorMessage(null, "es")).not.toBe(MESSAGE);
  });

  it("stays English while the flag is off", async () => {
    vi.stubEnv("LANGUAGE_SELECTION_ENABLED", "false");
    expect(await errorMessage("es", "en")).toBe(MESSAGE);
  });
});
