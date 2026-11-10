"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AlertCircle, ArrowLeft, Ban, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "use-intl";
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
import {
  phoneNumbersMatchForConsent,
  SMS_CONSENT_DISCLOSURE,
} from "@/lib/messaging/consent";

function EditClientLoadingPanel() {
  const t = useTranslations("clients.form");
  return (
    <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {t("loadingClient")}
    </div>
  );
}

export default function EditClientPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("clients.form");
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("checkingAccess")}
      </div>
    );
  }

  if (!canManageClientFormRole(session?.user?.role)) {
    return (
      <div className="max-w-2xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/clients/${params.id}`)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("backToClient")}
        </Button>
        <EmptyState
          icon={AlertCircle}
          title={t("readOnlyTitle")}
          description={t("readOnlyEdit")}
          action={{
            label: t("backToClient"),
            onClick: () => router.push(`/clients/${params.id}`),
          }}
        />
      </div>
    );
  }

  return <EditClientForm />;
}

function canManageClientFormRole(role?: string | null): boolean {
  return (
    role === "admin" ||
    role === "veterinarian" ||
    role === "technician" ||
    role === "front_desk"
  );
}

function EditClientForm() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("clients.form");
  const locale = useLocale();
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
  const [smsConsentTouched, setSmsConsentTouched] = useState(false);
  const [preferredContactMethod, setPreferredContactMethod] =
    useState<ClientContactMethod>("phone");
  const [preferredContactTouched, setPreferredContactTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    data: client,
    isLoading,
    error: loadError,
    refetch,
  } = trpc.clients.getById.useQuery(
    { id: params.id },
    { enabled: !!params.id },
  );

  useEffect(() => {
    if (client) {
      setForm({
        firstName: client.firstName ?? "",
        lastName: client.lastName ?? "",
        email: client.email ?? "",
        phone: client.phone ?? "",
        address: client.address ?? "",
        city: client.city ?? "",
        state: client.state ?? "",
        zip: client.zip ?? "",
      });
      setSmsConsent(client.smsConsent ?? false);
      setSmsConsentTouched(false);
      setPreferredContactMethod(client.preferredContactMethod ?? "phone");
      setPreferredContactTouched(false);
    }
  }, [client]);

  const updateClient = trpc.clients.update.useMutation({
    onSuccess: () => {
      toast.success(t("updated"));
      router.push(`/clients/${params.id}`);
    },
    onError: (err) => {
      toast.error(err.message);
      setError(err.message);
    },
  });
  const revokeSms = trpc.clients.revokeSms.useMutation({
    onSuccess: async ({ clientsRevoked }) => {
      toast.success(t("smsRevoked", { count: clientsRevoked }));
      setSmsConsent(false);
      setSmsConsentTouched(false);
      await refetch();
    },
    onError: (err) => {
      toast.error(err.message);
      setError(err.message);
    },
  });

  const smsPhoneValid = normalizeE164(form.phone) !== null;
  const persistedSmsPhone = normalizeE164(client?.phone);
  const phoneChanged = client
    ? !phoneNumbersMatchForConsent(client.phone, form.phone)
    : false;
  const persistedConsentEvidenceComplete = Boolean(
    client?.smsConsent &&
    client.smsConsentAt &&
    client.smsConsentSource?.trim() &&
    client.smsConsentDisclosure?.trim(),
  );
  const smsPreferenceReady = Boolean(
    smsConsent &&
    smsPhoneValid &&
    (smsConsentTouched || (!phoneChanged && persistedConsentEvidenceComplete)),
  );
  const smsPreferenceNeedsValidation =
    preferredContactMethod === "sms" &&
    (preferredContactTouched || phoneChanged || smsConsentTouched);
  const canSubmit =
    isRequiredClientTextValid(form.firstName, CLIENT_NAME_MAX_LENGTH) &&
    isRequiredClientTextValid(form.lastName, CLIENT_NAME_MAX_LENGTH) &&
    isOptionalClientTextValid(form.email, CLIENT_EMAIL_MAX_LENGTH) &&
    isOptionalClientTextValid(form.phone, CLIENT_PHONE_MAX_LENGTH) &&
    isOptionalClientTextValid(form.address, CLIENT_ADDRESS_MAX_LENGTH) &&
    isOptionalClientTextValid(form.city, CLIENT_CITY_MAX_LENGTH) &&
    isOptionalClientTextValid(form.state, CLIENT_STATE_MAX_LENGTH) &&
    isOptionalClientTextValid(form.zip, CLIENT_ZIP_MAX_LENGTH) &&
    (!smsConsentTouched || !smsConsent || smsPhoneValid) &&
    (!smsPreferenceNeedsValidation || smsPreferenceReady);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!client) {
      setError(t("loadBeforeSave"));
      return;
    }
    if (smsConsentTouched && smsConsent && !smsPhoneValid) {
      setError(
        t("smsPhoneInvalid"),
      );
      return;
    }
    if (smsPreferenceNeedsValidation && !smsPreferenceReady) {
      setError(
        t("smsCurrentConsentNeeded"),
      );
      return;
    }
    if (!canSubmit) {
      setError(t("checkFields"));
      return;
    }

    updateClient.mutate({
      id: params.id,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || undefined,
      zip: form.zip.trim() || undefined,
      ...(preferredContactTouched ? { preferredContactMethod } : {}),
      ...(smsConsentTouched ? { smsConsent } : {}),
    });
  };

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "phone" && client) {
      // Consent belongs to the destination. Any material phone change requires
      // a fresh, explicit check after the new number is entered.
      setSmsConsent(
        phoneNumbersMatchForConsent(client.phone, value)
          ? (client.smsConsent ?? false)
          : false,
      );
      setSmsConsentTouched(false);
      if (!phoneNumbersMatchForConsent(client.phone, value)) {
        if (preferredContactMethod === "sms") {
          setPreferredContactMethod("phone");
          setPreferredContactTouched(true);
        }
      }
    }
  };

  if (isLoading) {
    return <EditClientLoadingPanel />;
  }

  if (loadError || !client) {
    return (
      <EmptyState
        icon={AlertCircle}
        title={t("loadFailedTitle")}
        description={
          loadError?.message ??
          t("loadFailedHelp")
        }
        action={{
          label: t("back"),
          onClick: () => router.push("/clients"),
          icon: ArrowLeft,
        }}
      />
    );
  }

  return (
    <div className="max-w-2xl">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push(`/clients/${params.id}`)}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("backToClient")}
      </Button>

      <h2 className="font-heading text-xl font-semibold">{t("editTitle")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("editIntro")}
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
              {t("firstName")}
            </label>
            <Input
              id="firstName"
              value={form.firstName}
              onChange={(e) => updateField("firstName", e.target.value)}
              placeholder={t("firstNamePlaceholder")}
              className="mt-1"
              maxLength={CLIENT_NAME_MAX_LENGTH}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="lastName">
              {t("lastName")}
            </label>
            <Input
              id="lastName"
              value={form.lastName}
              onChange={(e) => updateField("lastName", e.target.value)}
              placeholder={t("lastNamePlaceholder")}
              className="mt-1"
              maxLength={CLIENT_NAME_MAX_LENGTH}
              required
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium" htmlFor="email">
              {t("email")}
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
              {t("phone")}
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

        <div className="rounded-md border border-border p-3">
          <label
            className="text-sm font-medium"
            htmlFor="preferredContactMethod"
          >
            {t("preferredContact")}
          </label>
          <select
            id="preferredContactMethod"
            value={preferredContactMethod}
            onChange={(event) => {
              setPreferredContactMethod(
                event.target.value as ClientContactMethod,
              );
              setPreferredContactTouched(true);
            }}
            className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="phone">{t("contact.phone")}</option>
            <option value="email">{t("contact.email")}</option>
            <option value="sms">{t("contact.sms")}</option>
            <option value="portal">{t("contact.portal")}</option>
          </select>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("smsHelpEdit")}
          </p>
          {preferredContactMethod === "sms" && !smsPreferenceReady ? (
            <p className="mt-2 text-xs font-medium text-amber-700">
              {smsPreferenceNeedsValidation
                ? t("smsReconfirm")
                : t("smsPaused")}
            </p>
          ) : null}
        </div>

        <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
          <Checkbox
            checked={smsConsent}
            onChange={(e) => {
              setSmsConsent(e.target.checked);
              setSmsConsentTouched(true);
              if (!e.target.checked && preferredContactMethod === "sms") {
                setPreferredContactMethod("phone");
                setPreferredContactTouched(true);
              }
            }}
            disabled={!smsPhoneValid && !smsConsent}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">
              {t("smsConfirm")}
            </span>
            <span className="block text-xs text-muted-foreground">
              {SMS_CONSENT_DISCLOSURE.snapshot}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {t("smsConfirmHelpEdit")}
              {phoneChanged
                ? ` ${t("smsPhoneChanged")}`
                : !smsPhoneValid && !smsConsent
                  ? ` ${t("smsEnterPhone")}`
                  : ""}
            </span>
          </span>
        </label>

        <div className="rounded-md border border-border p-3">
          <p className="text-sm font-medium">{t("doNotText.title")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("doNotText.help")}
            {phoneChanged ? ` ${t("doNotText.saveFirst")}` : ""}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            disabled={!persistedSmsPhone || phoneChanged || revokeSms.isPending}
            onClick={() => {
              setError(null);
              if (
                window.confirm(
                  t("doNotText.confirm"),
                )
              ) {
                revokeSms.mutate({
                  id: params.id,
                  expectedPhone: persistedSmsPhone!,
                });
              }
            }}
          >
            {revokeSms.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Ban className="mr-2 h-4 w-4" />
            )}
            {t("doNotText.button")}
          </Button>
        </div>

        <div className="rounded-md border border-border p-3">
          <p className="text-sm font-medium">{t("consentHistory.title")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("consentHistory.help")}
          </p>
          {client.smsConsentHistory.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {t("consentHistory.empty")}
            </p>
          ) : (
            <ol className="mt-3 space-y-2">
              {client.smsConsentHistory.map((event) => (
                <li
                  key={event.id}
                  className="rounded border border-border/70 bg-muted/30 p-2 text-xs"
                >
                  <p className="font-medium">
                    {event.action === "granted"
                      ? t("consentHistory.granted")
                      : t("consentHistory.revoked")}
                    {` · ${event.destinationE164}`}
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    {new Date(event.occurredAt).toLocaleString(locale)} ·{" "}
                    {event.source}
                    {event.actorName
                      ? ` · ${event.actorName}`
                      : event.provider
                        ? ` · ${event.provider}`
                        : ` · ${t("consentHistory.system")}`}
                  </p>
                  {event.detail ? (
                    <p className="mt-1 text-muted-foreground">{event.detail}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </div>

        <div>
          <label className="text-sm font-medium" htmlFor="address">
            {t("address")}
          </label>
          <Input
            id="address"
            value={form.address}
            onChange={(e) => updateField("address", e.target.value)}
            placeholder={t("addressPlaceholder")}
            className="mt-1"
            maxLength={CLIENT_ADDRESS_MAX_LENGTH}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="text-sm font-medium" htmlFor="city">
              {t("city")}
            </label>
            <Input
              id="city"
              value={form.city}
              onChange={(e) => updateField("city", e.target.value)}
              placeholder={t("city")}
              className="mt-1"
              maxLength={CLIENT_CITY_MAX_LENGTH}
            />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="state">
              {t("state")}
            </label>
            <Input
              id="state"
              value={form.state}
              onChange={(e) => updateField("state", e.target.value)}
              placeholder={t("state")}
              className="mt-1"
              maxLength={CLIENT_STATE_MAX_LENGTH}
            />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="zip">
              {t("zip")}
            </label>
            <Input
              id="zip"
              value={form.zip}
              onChange={(e) => updateField("zip", e.target.value)}
              placeholder={t("zipPlaceholder")}
              className="mt-1"
              maxLength={CLIENT_ZIP_MAX_LENGTH}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="submit" disabled={!canSubmit || updateClient.isPending}>
            {updateClient.isPending ? t("saving") : t("saveChanges")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/clients/${params.id}`)}
          >
            {t("cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}
