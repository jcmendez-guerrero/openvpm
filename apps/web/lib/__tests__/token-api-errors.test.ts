import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";

const read = (path: string) => readFileSync(path, "utf8");

describe("token page API errors are translatable", () => {
  it.each([
    ["sign", "app/api/sign/[token]/route.ts", "app/sign/[token]/sign-client.tsx"],
    [
      "treatmentPlan",
      "app/api/treatment-plan/[token]/route.ts",
      "app/treatment-plan/[token]/treatment-plan-decision-client.tsx",
    ],
  ] as const)("%s: every mapped error is one the API returns", (ns, route, client) => {
    const routeSource = read(route);
    const clientSource = read(client);
    for (const [key, text] of Object.entries(en[ns].apiErrors)) {
      expect(routeSource).toContain(`"${text}"`);
      expect(clientSource).toContain(`"${text}": "${key}"`);
    }
  });
});
