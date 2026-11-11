import { LanguageSwitch } from "@/components/common/language-switch";

/** Sign-in screens get a language switch above the page, before anyone has an account. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LanguageSwitch className="flex justify-end px-4 pt-3" />
      {children}
    </>
  );
}
