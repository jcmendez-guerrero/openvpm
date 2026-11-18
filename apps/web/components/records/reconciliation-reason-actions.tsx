"use client";

import { useTranslations } from "use-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ReconciliationReasonActions({
  label,
  canNoCharge,
  canVoid,
  disabled,
  onResolve,
}: {
  label: string;
  canNoCharge: boolean;
  canVoid: boolean;
  disabled: boolean;
  onResolve: (resolution: {
    status: "no_charge" | "voided";
    reason: string;
  }) => void;
}) {
  const t = useTranslations("records.reconciliation");
  const [status, setStatus] = useState<"no_charge" | "voided" | null>(null);
  const [reason, setReason] = useState("");
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {canNoCharge && (
          <Button
            type="button"
            variant="outline"
            aria-pressed={status === "no_charge"}
            disabled={disabled}
            onClick={() => setStatus("no_charge")}
          >
            {t("noCharge")}
          </Button>
        )}
        {canVoid && (
          <Button
            type="button"
            variant="outline"
            aria-pressed={status === "voided"}
            disabled={disabled}
            onClick={() => setStatus("voided")}
          >
            {t("void")}
          </Button>
        )}
      </div>
      {!canNoCharge && (
        <p className="text-xs text-muted-foreground">
          {t("noChargeRole")}
        </p>
      )}
      {status && (
        <div className="space-y-2 rounded-md border p-3">
          <label className="block text-sm">
            {status === "voided"
              ? t("whyVoid")
              : t("whyNoCharge")}
            <Input
              autoFocus
              value={reason}
              maxLength={500}
              aria-label={t("reasonLabel", { label })}
              disabled={disabled}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            {t("reasonHelp")}
          </p>
          <Button
            type="button"
            disabled={disabled || reason.trim().length < 3}
            onClick={() => onResolve({ status, reason: reason.trim() })}
          >
            {status === "voided" ? t("confirmVoid") : t("confirmNoCharge")}
          </Button>
        </div>
      )}
    </div>
  );
}
