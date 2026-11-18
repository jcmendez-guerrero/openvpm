"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "use-intl";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

export function UnfinishedFieldVisits() {
  const t = useTranslations("dashboard.fieldVisits");
  const [offset, setOffset] = useState(0);
  const visits = trpc.dashboard.unfinishedFieldVisits.useQuery(
    { offset },
    {
      refetchInterval: 60000,
    },
  );
  if (visits.isLoading || (!visits.error && !visits.data?.enabled)) return null;
  return (
    <section
      className="rounded-lg border border-border bg-card p-5"
      aria-labelledby="unfinished-field-visits"
    >
      <h2
        id="unfinished-field-visits"
        className="font-heading text-lg font-semibold"
      >
        {t("title")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("intro")}
      </p>
      {visits.error ? (
        <div className="mt-3 text-sm text-destructive" role="alert">
          {t("loadFailed")}{" "}
          <Button variant="outline" size="sm" onClick={() => visits.refetch()}>
            {t("retry")}
          </Button>
        </div>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-border">
            {visits.data?.items.map((visit) => (
              <li
                key={visit.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div>
                  <span className="font-medium">{visit.patientName}</span>
                  <p className="text-xs text-muted-foreground">
                    {t("pending")}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/encounters/${visit.id}`}>{t("resume")}</Link>
                </Button>
              </li>
            ))}
          </ul>
          {!visits.data?.items.length ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {t("empty")}
            </p>
          ) : null}
          {offset > 0 || visits.data?.hasMore ? (
            <div className="mt-3 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0 || visits.isFetching}
                onClick={() => setOffset(Math.max(0, offset - 20))}
              >
                {t("previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!visits.data?.hasMore || visits.isFetching}
                onClick={() => setOffset(offset + 20)}
              >
                {t("next")}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
