import { describe, expect, it, vi } from "vitest";

vi.mock("@openpims/db/client", () => ({ db: {} }));

const { createClinicDefaultCache } = await import("../clinic-default-cache");

describe("clinic default cache", () => {
  it("loads once per practice within the TTL, then reloads", async () => {
    let clock = 0;
    let stored = "es";
    const load = vi.fn(async () => stored);
    const get = createClinicDefaultCache(load, 60_000, () => clock);

    expect(await get("p1")).toBe("es");
    stored = "en";
    clock = 59_999;
    expect(await get("p1")).toBe("es");
    expect(load).toHaveBeenCalledTimes(1);

    clock = 60_000;
    expect(await get("p1")).toBe("en");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keeps practices separate", async () => {
    const get = createClinicDefaultCache(async (id) => (id === "a" ? "es" : "en"));
    expect(await get("a")).toBe("es");
    expect(await get("b")).toBe("en");
  });

  it("falls back to English for missing or unsupported values", async () => {
    expect(await createClinicDefaultCache(async () => undefined)("p")).toBe("en");
    expect(await createClinicDefaultCache(async () => "fr")("p")).toBe("en");
  });
});
