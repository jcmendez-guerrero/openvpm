import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { AppErrorBody, AppErrorView } from "../app-error-view";

const inEnglish = (element: React.ReactElement) =>
  createElement(IntlProvider, { locale: "en", messages: en, children: element });

describe("AppErrorView", () => {
  it("keeps app error pages addressable by the root skip link", () => {
    const markup = renderToStaticMarkup(inEnglish(
      createElement(AppErrorView, {
        error: new Error("boom"),
        reset: () => undefined,
        source: "app-error",
      }))
    );

    expect(markup).toContain("<main");
    expect(markup).toContain('id="main-content"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('aria-labelledby="app-error-title"');
    expect(markup).toContain("Something went wrong");
    expect(markup).toContain("Try Again");
  });
});

describe("AppErrorBody", () => {
  it("renders English without a language provider, for global-error", () => {
    const markup = renderToStaticMarkup(
      createElement(AppErrorBody, { error: new Error("boom"), reset: () => undefined, source: "global-error" }),
    );
    expect(markup).toContain(en.errorPages.app.title);
    expect(markup).toContain(en.errorPages.app.body);
  });

  it("shows Spanish under a Spanish provider", () => {
    const markup = renderToStaticMarkup(
      createElement(IntlProvider, {
        locale: "es",
        messages: es,
        children: createElement(AppErrorView, { error: new Error("boom"), reset: () => undefined, source: "app-error" }),
      }),
    );
    expect(markup).toContain("Algo salió mal");
  });
});
