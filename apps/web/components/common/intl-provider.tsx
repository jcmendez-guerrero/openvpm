"use client";

import { createContext, useContext } from "react";
import { IntlProvider } from "use-intl";
import type { Language } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";

const SelectionEnabled = createContext(false);

/** Whether the language switch may render (server-only release flag). */
export function useLanguageSelectionEnabled(): boolean {
  return useContext(SelectionEnabled);
}

export function AppIntlProvider({
  language,
  messages,
  selectionEnabled,
  children,
}: {
  language: Language;
  messages: Messages;
  selectionEnabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <SelectionEnabled.Provider value={selectionEnabled}>
      <IntlProvider locale={language} messages={messages}>
        {children}
      </IntlProvider>
    </SelectionEnabled.Provider>
  );
}
