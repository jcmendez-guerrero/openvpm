import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  headers: new Map<string, string>(),
  getServerSession: vi.fn(),
  secretRejected: vi.fn(() => false),
  tokenFromCookie: vi.fn(),
  resolvePortalSession: vi.fn(),
  clinicDefault: vi.fn(async () => "en"),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => ({ get: (k: string) => m.headers.get(k) ?? null }),
}));
vi.mock("next-auth", () => ({ getServerSession: m.getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/auth-secret", () => ({ nextAuthSecretRejected: m.secretRejected }));
vi.mock("@openpims/db/client", () => ({ db: {} }));
vi.mock("@/lib/tenant-db", () => ({
  withSystem: (_db: unknown, fn: (tx: unknown) => unknown) => fn({}),
}));
vi.mock("@/lib/portal/session", () => ({
  portalSessionTokenFromCookie: m.tokenFromCookie,
  resolvePortalSession: m.resolvePortalSession,
}));
vi.mock("../clinic-default-cache", () => ({ getClinicDefaultLanguage: m.clinicDefault }));

const { getRequestLanguage } = await import("../request");

function visit(path: string, acceptLanguage = "en-US") {
  m.headers = new Map([
    ["x-openvpm-path", path],
    ["accept-language", acceptLanguage],
    ["cookie", "portal_session=abc"],
  ]);
}

afterEach(() => vi.unstubAllEnvs());

describe("getRequestLanguage portal branch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("LANGUAGE_SELECTION_ENABLED", "true");
    m.getServerSession.mockResolvedValue(null);
    m.secretRejected.mockReturnValue(false);
    m.tokenFromCookie.mockReturnValue("abc");
  });

  it("uses the client's saved language for a valid portal session", async () => {
    m.resolvePortalSession.mockResolvedValue({
      client: { preferredLanguage: "es", practiceId: "p1" },
    });
    visit("/portal/home", "en-US");
    expect(await getRequestLanguage()).toBe("es");
  });

  it("falls back to the browser without a session or with an invalid one", async () => {
    m.tokenFromCookie.mockReturnValue(null);
    visit("/portal/home", "es-MX");
    expect(await getRequestLanguage()).toBe("es");
    expect(m.resolvePortalSession).not.toHaveBeenCalled();

    m.tokenFromCookie.mockReturnValue("abc");
    m.resolvePortalSession.mockResolvedValue(null);
    visit("/portal/home", "en-US");
    expect(await getRequestLanguage()).toBe("en");

    m.resolvePortalSession.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    visit("/portal/home", "es");
    expect(await getRequestLanguage()).toBe("es");
  });

  it("skips the session lookup on /portal/access/<token>", async () => {
    visit("/portal/access/tok", "en-US");
    expect(await getRequestLanguage()).toBe("en");
    expect(m.tokenFromCookie).not.toHaveBeenCalled();
    expect(m.resolvePortalSession).not.toHaveBeenCalled();
  });

  it("never reads a staff session when the auth secret is unusable", async () => {
    m.secretRejected.mockReturnValue(true);
    visit("/login", "es");
    expect(await getRequestLanguage()).toBe("es");
    expect(m.getServerSession).not.toHaveBeenCalled();
  });

  it("returns English without reading anything while the flag is off", async () => {
    vi.stubEnv("LANGUAGE_SELECTION_ENABLED", "false");
    visit("/portal/home", "es");
    expect(await getRequestLanguage()).toBe("en");
    expect(m.tokenFromCookie).not.toHaveBeenCalled();
  });
});
