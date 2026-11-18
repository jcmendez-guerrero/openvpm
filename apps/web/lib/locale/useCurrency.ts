"use client";

import { useLocale } from "use-intl";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "./format";

/**
 * Returns a currency formatter bound to the current practice's region
 * (currency + country), so amounts render with the right symbol and locale
 * instead of being hardcoded to USD. React Query dedupes the underlying
 * getTaxConfig request across every component that calls this.
 */
export function useCurrencyFormatter() {
  const { data } = trpc.billing.getTaxConfig.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const language = useLocale();
  const currency = data?.currency ?? "usd";
  const country = data?.country ?? "US";
  // Documents for a client pass the client's language; screens use the viewer's.
  return (value: number | string | null | undefined, documentLanguage: string = language) =>
    formatCurrency(value, currency, country, documentLanguage);
}
