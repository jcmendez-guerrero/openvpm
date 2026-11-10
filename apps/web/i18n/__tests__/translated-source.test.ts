import { describe, expect, it } from "vitest";
import { inlineEnglish } from "../translated-source";

describe("inlineEnglish", () => {
  const header = 'const t = useTranslations("shell");\n';

  it("turns translated attributes back into plain string attributes", () => {
    expect(inlineEnglish(`${header}<nav aria-label={t("mainNavigation")} />`)).toContain(
      '<nav aria-label="Main navigation" />',
    );
  });

  it("inlines JSX text children", () => {
    expect(inlineEnglish(`${header}<p>{t("search.empty")}</p>`)).toContain(
      "<p>No patients or clients found.</p>",
    );
  });

  it("inlines calls with arguments as their raw message", () => {
    expect(
      inlineEnglish(`${header}const x = t("unreadInbox", { count: n });`),
    ).toContain('const x = "{count} unread inbox conversations";');
  });

  it("handles nested calls in arguments", () => {
    expect(
      inlineEnglish(`${header}<p>{t("verifyEmail.promptWithEmail", { email: fmt(a) })}</p>`),
    ).toContain("<p>Verify your email ({email}) to secure your account and keep reminders deliverable.</p>");
  });

  it("respects each translator's namespace and leaves dynamic or unknown keys alone", () => {
    const source =
      'const t = useTranslations("shell.trial");\nconst c = useTranslations();\n' +
      '{t("billing")} {c("common.actions.save")} {t(`nav.${k}`)} {t("missing")}';
    const out = inlineEnglish(source);
    expect(out).toContain("Billing Save {t(`nav.${k}`)} {t(\"missing\")}");
  });
});

describe("inlineEnglish with one translator name in several components", () => {
  it("uses the nearest declaration above each call", () => {
    const source =
      'function A() { const t = useTranslations("shell"); return <p>{t("mainNavigation")}</p>; }\n' +
      'function B() { const t = useTranslations("shell.trial"); return <p>{t("billing")}</p>; }';
    const out = inlineEnglish(source);
    expect(out).toContain("<p>Main navigation</p>");
    expect(out).toContain("<p>Billing</p>");
  });

  it("does not borrow a key from another component's namespace", () => {
    const source =
      'function A() { const t = useTranslations("shell.trial"); }\n' +
      'function B() { const t = useTranslations("shell"); return <p>{t("billing")}</p>; }';
    expect(inlineEnglish(source)).toContain('<p>{t("billing")}</p>');
  });
});
