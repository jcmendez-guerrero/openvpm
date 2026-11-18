import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/audit", () => ({ recordAuditLog: vi.fn(async () => undefined) }));
vi.mock("@/lib/webhook-dispatcher", () => ({ dispatchWebhookEvent: vi.fn(async () => undefined) }));

const { clientsRouter } = await import("../routers/clients");

const PRACTICE_ID = "00000000-0000-0000-0000-0000000000aa";
const CLIENT_ID = "00000000-0000-0000-0000-000000000002";

function setup(opts: { updatedRows?: unknown[] } = {}) {
  const select = vi.fn(() => {
    const builder = {
      from: () => builder,
      where: () => builder,
      limit: () => builder,
      then: (resolve: (rows: unknown[]) => unknown) => Promise.resolve([{ id: PRACTICE_ID }]).then(resolve),
    };
    return builder;
  });
  const insertValues = vi.fn((row: Record<string, unknown>) => ({
    returning: async () => [{ id: CLIENT_ID, ...row }],
  }));
  const updateSet = vi.fn(() => ({
    where: () => ({ returning: async () => opts.updatedRows ?? [{ id: CLIENT_ID }] }),
  }));
  const db: Record<string, unknown> = {
    transaction: async (fn: (tx: unknown) => unknown) => fn(db),
    execute: vi.fn(async () => undefined),
    select,
    insert: () => ({ values: insertValues }),
    update: () => ({ set: updateSet }),
  };
  const caller = clientsRouter.createCaller({
    db,
    session: { user: { id: "u1", email: "a@example.com", name: "A", role: "admin", practiceId: PRACTICE_ID } },
  } as never);
  return { caller, insertValues, updateSet };
}

afterEach(() => vi.clearAllMocks());

describe("client preferred language", () => {
  it("is stored on create and update, and can be cleared", async () => {
    const { caller, insertValues, updateSet } = setup();
    await caller.create({ firstName: "Ana", lastName: "Ruiz", preferredLanguage: "es" });
    expect(insertValues.mock.calls[0]?.[0]).toMatchObject({ preferredLanguage: "es", practiceId: PRACTICE_ID });

    await caller.update({ id: CLIENT_ID, preferredLanguage: "en" });
    await caller.update({ id: CLIENT_ID, preferredLanguage: null });
    expect((updateSet.mock.calls as unknown[][]).map((call) => (call[0] as Record<string, unknown>).preferredLanguage)).toEqual(["en", null]);
  });

  it("rejects unsupported languages", async () => {
    const { caller } = setup();
    await expect(
      caller.create({ firstName: "Ana", lastName: "Ruiz", preferredLanguage: "fr" as never }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.update({ id: CLIENT_ID, preferredLanguage: "es-MX" as never })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("cannot update a client from another practice", async () => {
    // The update is scoped to the caller's practice, so another clinic's client matches no row.
    const { caller } = setup({ updatedRows: [] });
    await expect(caller.update({ id: CLIENT_ID, preferredLanguage: "es" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
