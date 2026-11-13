"use client";

import { useTranslations } from "use-intl";

import { useMemo } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { rowIssuesCsv, summarizeRowIssues } from "@/lib/csv/import";

export function ImportRowIssues({ errors, csv }: { errors: string[]; csv: string }) {
  const t = useTranslations("settings.importIssues");
  const summary = useMemo(() => summarizeRowIssues(errors), [errors]);
  if (!errors.length) return null;

  function download() {
    const report = rowIssuesCsv(csv, errors);
    if (!report) {
      toast.error(t("fixTheFileLevelIssues"));
      return;
    }
    const url = URL.createObjectURL(new Blob(["\uFEFF", report], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "openvpm-import-rows-to-review.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <section aria-label={t("importIssuesToReview")} className="mt-4 rounded-lg border border-amber-200 bg-amber-50/40 p-4 dark:border-amber-900 dark:bg-amber-950/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-sm font-semibold">
          {summary.affectedRows ? `${summary.affectedRows} data row${summary.affectedRows === 1 ? "" : "s"} to review` : t("checkTheCsvFile")}
        </h4>
        {summary.affectedRows > 0 ? (
          <Button type="button" variant="outline" size="sm" onClick={download} className="min-h-11">
            <Download className="mr-2 h-4 w-4" aria-hidden="true" /> {t("downloadRowsToReview")}
          </Button>
        ) : null}
      </div>
      {summary.fileIssues.length ? (
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm">
          {summary.fileIssues.map((issue) => <li key={issue}>{issue}</li>)}
        </ul>
      ) : null}
      <ul className="mt-3 max-h-72 space-y-3 overflow-y-auto text-sm">
        {summary.groups.map((group) => (
          <li key={group.message}>
            <p><span className="font-medium">{t("rowCount", { count: group.count })}</span> — {group.message}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("dataRows", { rows: group.rows.join(", "), remaining: group.remaining ?? 0 })}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        {t("rowsHelp")}
      </p>
    </section>
  );
}
