"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { useTranslations } from "use-intl";
import { ClientLanguageSelect } from "@/components/clients/client-language-select";
import type { Language } from "@/i18n/config";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/common/empty-state";
import { toast } from "sonner";
import {
  CLIENT_ADDRESS_MAX_LENGTH,
  CLIENT_CITY_MAX_LENGTH,
  CLIENT_EMAIL_MAX_LENGTH,
  CLIENT_NAME_MAX_LENGTH,
  CLIENT_PHONE_MAX_LENGTH,
  CLIENT_STATE_MAX_LENGTH,
  CLIENT_ZIP_MAX_LENGTH,
  type ClientContactMethod,
  isOptionalClientTextValid,
  isRequiredClientTextValid,
} from "@/lib/clients/policy";
import { normalizeE164 } from "@/lib/messaging/phone";
import { SMS_CONSENT_DISCLOSURE } from "@/lib/messaging/consent";

function canManageClientFormRole(role?: string | null): boolean {
  return (
    role === "admin" ||
    role === "veterinarian" ||
    role === "technician" ||
    role === "front_desk"
  );
}

function NewClientPageFallback() {
  const t = useTranslations("clients.form");
  return (
    <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {t("checkingAccess")}
    </div>
  );
}

export default function NewClientPage() {
  return (
    <Suspense fallback={<NewClientPageFallback />}>
      <NewClientPageContent />
    </Suspense>
  );
}

function NewClientPageContent() {
  const router = useRouter();
  const t = useTranslations("clients.form");
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const firstClinicDay = searchParams.get("setup") === "first-visit";

  if (status === "loading") {
    return <NewClientPageFallback />;
  }

  if (!canManageClientFormRole(session?.user?.role)) {
    return (
      <div className="max-w-2xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/clients")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("back")}
        </Button>
        <EmptyState
          icon={AlertCircle}
          title={t("readOnlyTitle")}
          description={t("readOnlyCreate")}
          action={{
            label: t("back"),
            onClick: () => router.push("/clients"),
          }}
        />
      </div>
    );
  }

  return <NewClientForm firstClinicDay={firstClinicDay} />;
}

function NewClientForm({ firstClinicDay }: { firstClinicDay: boolean }) {
  const router = useRouter();
  const t = useTranslations("clients");
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
  });
  const [smsConsent, setSmsConsent] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState<Language | null>(null);
  const [preferredContactMethod, setPreferredContactMethod] =
    useState<ClientContactMethod>("phone");
  const [error, setError] = useState<string | null>(null);

  const createClient = trpc.clients.create.useMutation({
    onSuccess: async (client) => {
      await utils.clients.list.invalidate();
      toast.success(t("form.created"));
      if (firstClinicDay) {
        const ownerName = `${client.firstName} ${client.lastName}`;
        router.push(
          `/patients/new?clientId=${encodeURIComponent(client.id)}&clientName=${encodeURIComponent(ownerName)}&setup=first-visit`,
        );
        return;
      }
      router.push(`/clients/${client.id}`);
    },
    onError: (err) => {
      toast.error(err.message);
      setError(err.message);
    },
  });

  const smsPhoneValid = normalizeE164(form.phone) !== null;
  const canSubmit =
    isRequiredClientTextValid(form.firstName, CLIENT_NAME_MAX_LENGTH) &&
    isRequiredClientTextValid(form.lastName, CLIENT_NAME_MAX_LENGTH) &&
    isOptionalClientTextValid(form.email, CLIENT_EMAIL_MAX_LENGTH) &&
    isOptionalClientTextValid(form.phone, CLIENT_PHONE_MAX_LENGTH) &&
    isOptionalClientTextValid(form.address, CLIENT_ADDRESS_MAX_LENGTH) &&
    isOptionalClientTextValid(form.city, CLIENT_CITY_MAX_LENGTH) &&
    isOptionalClientTextValid(form.state, CLIENT_STATE_MAX_LENGTH) &&
    isOptionalClientTextValid(form.zip, CLIENT_ZIP_MAX_LENGTH) &&
    (!smsConsent || smsPhoneValid) &&
    (preferredContactMethod !== "sms" || (smsConsent && smsPhoneValid));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (smsConsent && !smsPhoneValid) {
      setError(
        t("form.smsPhoneInvalid"),
      );
      return;
    }
    if (preferredContactMethod === "sms" && !smsConsent) {
      setError(
        t("form.smsConsentNeeded"),
      );
      return;
    }
    if (!canSubmit) {
      setError(t("form.checkFields"));
      return;
    }

    createClient.mutate({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || undefined,
      zip: form.zip.trim() || undefined,
      preferredContactMethod,
      preferredLanguage,
      smsConsent,
    });
  };

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "phone" && !normalizeE164(value)) {
      setSmsConsent(false);
      setPreferredContactMethod((current) =>
        current === "sms" ? "phone" : current,
      );
    }
  };

  return (
    <div className="max-w-2xl">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/clients")}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("form.back")}
      </Button>

      <h2 className="font-heading text-xl font-semibold">{t("list.new")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {firstClinicDay
          ? t("form.firstDayIntro")
          : t("form.newIntro")}
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium" htmlFor="firstName">
              {t("form.firstName")}
            </label>
            <Input
              id="firstName"
              value={form.firstName}
              onChange={(e) => updateField("firstName", e.target.value)}
              placeholder={t("form.firstNamePlaceholder")}
              className="mt-1"
              maxLength={CLIENT_NAME_MAX_LENGTH}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="lastName">
              {t("form.lastName")}
            </label>
            <Input
              id="lastName"
              value={form.lastName}
              onChange={(e) => updateField("lastName", e.target.value)}
              placeholder={t("form.lastNamePlaceholder")}
              className="mt-1"
              maxLength={CLIENT_NAME_MAX_LENGTH}
              required
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium" htmlFor="email">
              {t("form.email")}
            </label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              placeholder="email@example.com"
              className="mt-1"
              maxLength={CLIENT_EMAIL_MAX_LENGTH}
            />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="phone">
              {t("form.phone")}
            </label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              placeholder="(555) 123-4567"
              className="mt-1"
              maxLength={CLIENT_PHONE_MAX_LENGTH}
            />
          </div>
        </div>

        <ClientLanguageSelect value={preferredLanguage} onChange={setPreferredLanguage} />

        <div className="rounded-md border border-border p-3">
          <label
            className="text-sm font-medium"
            htmlFor="preferredContactMethod"
          >
            {t("form.preferredContact")}
          </label>
          <select
            id="preferredContactMethod"
            value={preferredContactMethod}
            onChange={(event) =>
              setPreferredContactMethod(
                event.target.value as ClientContactMethod,
              )
            }
            className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="phone">{t("form.contact.phone")}</option>
            <option value="email">{t("form.contact.email")}</option>
            <option value="sms">{t("form.contact.sms")}</option>
            <option value="portal">{t("form.contact.portal")}</option>
          </select>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("form.smsHelp")}
          </p>
          {preferredContactMethod === "sms" && !smsConsent ? (
            <p className="mt-2 text-xs font-medium text-amber-700">
              {t("form.smsNeedsConsent")}
            </p>
          ) : null}
        </div>

        <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
          <Checkbox
            checked={smsConsent}
            onChange={(e) => {
              setSmsConsent(e.target.checked);
              if (!e.target.checked) {
                setPreferredContactMethod((current) =>
                  current === "sms" ? "phone" : current,
                );
              }
            }}
            disabled={!smsPhoneValid}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">
              {t("form.smsConfirm")}
            </span>
            <span className="block text-xs text-muted-foreground">
              {SMS_CONSENT_DISCLOSURE.snapshot}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {t("form.smsConfirmHelp")}
              {!smsPhoneValid ? ` ${t("form.smsEnterPhone")}` : ""}
            </span>
          </span>
        </label>

        <div>
          <label className="text-sm font-medium" htmlFor="address">
            {t("form.address")}
          </label>
          <Input
            id="address"
            value={form.address}
            onChange={(e) => updateField("address", e.target.value)}
            placeholder={t("form.addressPlaceholder")}
            className="mt-1"
            maxLength={CLIENT_ADDRESS_MAX_LENGTH}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="text-sm font-medium" htmlFor="city">
              {t("form.city")}
            </label>
            <Input
              id="city"
              value={form.city}
              onChange={(e) => updateField("city", e.target.value)}
              placeholder={t("form.city")}
              className="mt-1"
              maxLength={CLIENT_CITY_MAX_LENGTH}
            />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="state">
              {t("form.state")}
            </label>
            <Input
              id="state"
              value={form.state}
              onChange={(e) => updateField("state", e.target.value)}
              placeholder={t("form.state")}
              className="mt-1"
              maxLength={CLIENT_STATE_MAX_LENGTH}
            />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="zip">
              {t("form.zip")}
            </label>
            <Input
              id="zip"
              value={form.zip}
              onChange={(e) => updateField("zip", e.target.value)}
              placeholder={t("form.zipPlaceholder")}
              className="mt-1"
              maxLength={CLIENT_ZIP_MAX_LENGTH}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="submit" disabled={!canSubmit || createClient.isPending}>
            {createClient.isPending ? t("form.creating") : t("form.create")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/clients")}
          >
            {t("form.cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}
