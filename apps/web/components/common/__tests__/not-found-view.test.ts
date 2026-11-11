import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import { NotFoundView } from "../not-found-view";

const inEnglish = (element: React.ReactElement) =>
  createElement(IntlProvider, { locale: "en", messages: en, children: element });

describe("NotFoundView", () => {
  it("renders a branded 404 recovery state", () => {
    const markup = renderToStaticMarkup(inEnglish(createElement(NotFoundView)));

    expect(markup).toContain("404");
    expect(markup).toContain("Page not found");
    expect(markup).toContain("This page may have moved");
    expect(markup).toContain('href="/"');
    expect(markup).toContain("Go to Dashboard");
    expect(markup).toContain('id="main-content"');
  });
});
