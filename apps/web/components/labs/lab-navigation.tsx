import { useTranslations } from "use-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** The PDF inbox and ordered results are two views of the same lab workspace. */
export function LabNavigation({ active }: { active: "results" | "reports" }) {
  const t = useTranslations("labs.nav");
  return (
    <nav className="flex flex-wrap gap-2" aria-label={t("label")}>
      <Button
        asChild
        variant={active === "results" ? "secondary" : "ghost"}
        size="sm"
      >
        <Link
          href="/lab-results"
          aria-current={active === "results" ? "page" : undefined}
        >
          {t("results")}
        </Link>
      </Button>
      <Button
        asChild
        variant={active === "reports" ? "secondary" : "ghost"}
        size="sm"
      >
        <Link
          href="/lab-reports"
          aria-current={active === "reports" ? "page" : undefined}
        >
          {t("reports")}
        </Link>
      </Button>
    </nav>
  );
}
