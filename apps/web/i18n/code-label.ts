// A stored code (role, status, payment method…) as a translated label.
// Unknown codes keep the old display: underscores shown as spaces.
type Translate = ((key: never) => string) & { has: (key: never) => boolean };

export function codeLabel(t: Translate, prefix: string, code: string | null | undefined): string {
  if (!code) return "";
  const key = (prefix ? `${prefix}.${code}` : code) as never;
  return t.has(key) ? t(key) : code.replace(/_/g, " ");
}
