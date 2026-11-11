import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderOfflineMessages } from "../../scripts/offline-messages.mjs";
import { OFFLINE_MESSAGES } from "../../offline/messages.generated";

describe("offline shell messages", () => {
  it("match the catalogs (run `node scripts/build-offline.mjs` after catalog edits)", async () => {
    const root = process.cwd();
    expect(readFileSync(join(root, "offline/messages.generated.ts"), "utf8")).toBe(
      await renderOfflineMessages(root),
    );
  });

  it("have the same keys in Spanish as in English", () => {
    const keys = (value: unknown, prefix = ""): string[] =>
      typeof value === "string"
        ? [prefix]
        : Object.entries(value as object).flatMap(([k, v]) => keys(v, `${prefix}.${k}`));
    expect(keys(OFFLINE_MESSAGES.es)).toEqual(keys(OFFLINE_MESSAGES.en));
  });
});
