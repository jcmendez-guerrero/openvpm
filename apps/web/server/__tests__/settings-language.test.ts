import { afterEach, describe, expect, it, vi } from "vitest";

const { settingsRouter } = await import("../routers/settings");

const PRACTICE_ID = "00000000-0000-0000-0000-0000000000aa";
const USER_ID = "00000000-0000-0000-0000-000000000001";

function caller(db: Record<string, unknown>, role = "front_desk") {
  const session = {
    user: { id: USER_ID, email: "staff@example.com", name: "Staff", role, practiceId: PRACTICE_ID },
  };
  return settingsRouter.createCaller({ db, session } as never);
}

/** Fake db: select(...).from().where().limit() returns the next queued rows; update captured. */
function createDb(selectResults: unknown[][] = []) {
  const updates: { set: unknown; where: unknown }[] = [];
  const limit = vi.fn(async () => selectResults.shift() ?? []);
  const where = vi.fn(() => ({ limit }));
  const select = vi.fn(() => ({ from: () => ({ where }) }));
  const update = vi.fn(() => ({
    set: (set: unknown) => ({
      where: (whereArg: unknown) => {
        updates.push({ set, where: whereArg });
        return { returning: async () => [{ id: USER_ID }] };
      },
    }),
  }));
  const db: Record<string, unknown> = {
    select,
    update,
    execute: vi.fn(async () => undefined),
    transaction: async (fn: (tx: unknown) => unknown) => fn(db),
  };
  return { db, updates, select };
}

afterEach(() => vi.clearAllMocks());

describe("settings.getMyLanguage", () => {
  it("returns the saved language and the clinic default", async () => {
    const { db } = createDb([[{ language: "es" }], [{ defaultLanguage: "en" }]]);
    await expect(caller(db).getMyLanguage()).resolves.toEqual({ language: "es", clinicDefault: "en" });
  });

  it("returns null when the user follows the clinic default", async () => {
    const { db } = createDb([[{ language: null }], [{ defaultLanguage: "es" }]]);
    await expect(caller(db).getMyLanguage()).resolves.toEqual({ language: null, clinicDefault: "es" });
  });
});

describe("settings.setMyLanguage", () => {
  it("updates only the caller's own row", async () => {
    const { db, updates } = createDb();
    await expect(caller(db).setMyLanguage({ language: "es" })).resolves.toEqual({ language: "es" });
    expect(updates).toHaveLength(1);
    expect(updates[0]?.set).toEqual({ language: "es" });
  });

  it("accepts null to follow the clinic default", async () => {
    const { db, updates } = createDb();
    await expect(caller(db).setMyLanguage({ language: null })).resolves.toEqual({ language: null });
    expect(updates[0]?.set).toEqual({ language: null });
  });

  it("rejects languages outside the supported list", async () => {
    const { db, updates } = createDb();
    await expect(caller(db).setMyLanguage({ language: "fr" } as never)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(updates).toHaveLength(0);
  });
});

describe("settings.updatePractice defaultLanguage", () => {
  it("requires the Admin role", async () => {
    const { db, updates } = createDb();
    await expect(
      caller(db, "front_desk").updatePractice({ defaultLanguage: "es" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(updates).toHaveLength(0);
  });

  it("rejects unsupported values", async () => {
    const { db } = createDb();
    await expect(
      caller(db, "admin").updatePractice({ defaultLanguage: "fr" } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
