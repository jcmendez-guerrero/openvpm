"use client";

import { useTranslations } from "use-intl";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { AlertCircle, PawPrint } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { EmptyState } from "@/components/common/empty-state";
import {
  isPortalBookingReasonValid,
  isPortalBookingStartWithinBounds,
  PORTAL_BOOKING_REASON_MAX_LENGTH,
  portalBookingTimeBounds,
} from "@/lib/portal/booking";
import { formatPortalDateInput } from "@/lib/portal/date";

export default function BookAppointmentPage() {
  const t = useTranslations("portal.book");
  const formId = useId();
  const patientFieldId = `${formId}-patient`;
  const typeFieldId = `${formId}-type`;
  const locationFieldId = `${formId}-location`;
  const dateFieldId = `${formId}-date`;
  const timeFieldId = `${formId}-time`;
  const timeHelpId = `${formId}-time-help`;
  const reasonFieldId = `${formId}-reason`;

  const client = trpc.portal.getClient.useQuery({});
  const types = trpc.portal.getAppointmentTypes.useQuery({});
  const request = trpc.portal.requestAppointment.useMutation();

  const [patientId, setPatientId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [reason, setReason] = useState("");

  const appointmentTypesMissing =
    !types.isLoading && !types.error && !types.data;
  const appointmentTypesUnavailable =
    Boolean(types.error) || appointmentTypesMissing;
  const verifiedAppointmentTypes =
    types.error || appointmentTypesMissing || !types.data ? null : types.data;
  const appointmentTypes = verifiedAppointmentTypes ?? [];
  const selectedType = verifiedAppointmentTypes?.find((t) => t.id === typeId);
  const selectedDurationMinutes = selectedType?.durationMinutes ?? 30;
  const timeBounds = portalBookingTimeBounds(selectedDurationMinutes);
  const hasValidBookingWindow = Boolean(timeBounds.maxTime);
  const hasValidPreferredTime = isPortalBookingStartWithinBounds(
    preferredTime,
    selectedDurationMinutes
  );
  const hasValidAppointmentType = Boolean(typeId && selectedType);
  const hasValidReason = isPortalBookingReasonValid(reason);
  const showTimeBoundsError =
    preferredTime !== "" && hasValidBookingWindow && !hasValidPreferredTime;

  // Suggested request times for the chosen date.
  const slots = trpc.portal.availableSlots.useQuery(
    {
      date: preferredDate,
      durationMinutes: selectedDurationMinutes,
      typeId: typeId || undefined,
      locationId: locationId || undefined
    },
    { enabled: !!preferredDate && hasValidAppointmentType && !!locationId }
  );

  useEffect(() => {
    if (client.data?.locations.length === 1 && !locationId) {
      setLocationId(client.data.locations[0]!.id);
    }
  }, [client.data, locationId]);
  const slotsUnavailable = Boolean(
    preferredDate &&
      !slots.isLoading &&
      (Boolean(slots.error) || !slots.data)
  );

  if (client.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (client.error || !client.data) {
    return (
      <div className="max-w-xl">
        <EmptyState
          className="py-12"
          icon={AlertCircle}
          title={t("unableToLoadBookingForm")}
          description={t("thisPortalLinkIsInvalid")}
        />
      </div>
    );
  }

  const clientData = client.data;
  if (clientData.locations.length === 0) {
    return (
      <div className="max-w-xl">
        <EmptyState
          className="py-12"
          icon={AlertCircle}
          title={t("appointmentRequestsAreUnavailable")}
          description={t("theClinicHasNotConfigured")}
        />
      </div>
    );
  }

  if (types.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (appointmentTypesUnavailable || appointmentTypes.length === 0) {
    return (
      <div className="max-w-xl">
        <EmptyState
          className="py-12"
          icon={AlertCircle}
          title={t("appointmentRequestsAreUnavailable")}
          description={t("theClinicHasNotMade")}
        />
      </div>
    );
  }

  const selectedLocation = clientData.locations.find(
    (location) => location.id === locationId,
  );
  const today = formatPortalDateInput(new Date(), clientData.timezone);
  const pets = clientData.patients;
  const selectedPet = pets.find((pet) => pet.id === patientId);
  const canSubmit = Boolean(
    patientId &&
    selectedLocation &&
    preferredDate &&
    hasValidAppointmentType &&
    hasValidPreferredTime &&
    hasValidReason &&
    !request.isPending
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    request.mutate({
      patientId,
      typeId,
      locationId,
      preferredDate,
      preferredTime,
      reason: reason.trim(),
    });
  }

  if (request.data?.success) {
    return (
      <div className="text-center py-16">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">{t("requestSent")}</h1>
        <p className="text-gray-600 max-w-sm mx-auto mb-6">{request.data.message}</p>
        <div className="mx-auto mb-6 max-w-sm rounded-xl border border-gray-200 bg-gray-50 p-4 text-left text-sm">
          <p className="mb-3 font-semibold text-gray-900">
            {t("requestedNotYetConfirmed")}
          </p>
          <dl className="space-y-2 text-gray-600">
            <div className="flex justify-between gap-4">
              <dt>{t("pet")}</dt>
              <dd className="font-medium text-gray-900">
                {selectedPet?.name ?? t("patient")}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>{t("visit")}</dt>
              <dd className="font-medium text-gray-900">
                {selectedType?.name ?? t("appointment")}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>{t("preferredTime")}</dt>
              <dd className="font-medium text-gray-900">
                {t("dateAtTime", { date: preferredDate, time: preferredTime })}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>{t("clinic")}</dt>
              <dd className="text-right font-medium text-gray-900">
                {selectedLocation?.name ?? t("clinic")}
              </dd>
            </div>
          </dl>
        </div>
        <Link
          href="/portal/appointments"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
        >
          {t("viewYourAppointments")}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <Link
        href="/portal/appointments"
        className="mb-6 inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        {t("backToAppointments")}
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("requestAnAppointment")}</h1>
      <p className="text-gray-500 text-sm mb-8">
        {t("pickATimeThatWorks")}
      </p>

      {pets.length === 0 ? (
        <EmptyState
          className="py-10"
          icon={PawPrint}
          title={t("noPetsOnFileYet")}
          description={t("yourClinicWillAddPets")}
        />
      ) : (
        <form onSubmit={submit} className="space-y-5">
          {clientData.locations.length > 1 ? (
            <div>
              <label
                htmlFor={locationFieldId}
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                {t("clinicLocation")}
              </label>
              <select
                id={locationFieldId}
                value={locationId}
                onChange={(event) => {
                  setLocationId(event.target.value);
                  setPreferredTime("");
                }}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="" disabled>
                  {t("chooseALocation")}
                </option>
                {clientData.locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
              {selectedLocation?.address ? (
                <p className="mt-1.5 text-xs text-gray-500">
                  {selectedLocation.address}
                </p>
              ) : null}
            </div>
          ) : clientData.locations[0] ? (
            <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
              <span className="font-medium text-gray-800">
                {clientData.locations[0].name}
              </span>
              {clientData.locations[0].address
                ? ` · ${clientData.locations[0].address}`
                : ""}
            </p>
          ) : null}

          <div>
            <label
              htmlFor={patientFieldId}
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              {t("pet")}
            </label>
            <select
              id={patientFieldId}
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">{t("selectAPet")}</option>
              {pets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor={typeFieldId}
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              {t("reasonForVisit")}
            </label>
            <select
              id={typeFieldId}
              value={typeId}
              onChange={(e) => {
                setTypeId(e.target.value);
                setPreferredTime("");
              }}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="" disabled>
                {t("selectAVisitType")}
              </option>
              {appointmentTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor={dateFieldId}
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                {t("preferredDate")}
              </label>
              <input
                id={dateFieldId}
                type="date"
                value={preferredDate}
                onChange={(e) => {
                  setPreferredDate(e.target.value);
                  setPreferredTime("");
                }}
                min={today}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label
                htmlFor={timeFieldId}
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                {t("preferredTime")}
              </label>
              <input
                id={timeFieldId}
                type="time"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                min={timeBounds.minTime}
                max={timeBounds.maxTime ?? timeBounds.minTime}
                disabled={!hasValidBookingWindow}
                aria-invalid={showTimeBoundsError}
                aria-describedby={timeHelpId}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p
                id={timeHelpId}
                className={`mt-1.5 text-xs ${
                  showTimeBoundsError ? "text-red-600" : "text-gray-500"
                }`}
              >
                {showTimeBoundsError
                  ? t("timeRange", { min: timeBounds.minTime, max: timeBounds.maxTime ?? "" })
                  : timeBounds.maxTime
                  ? t("timeRange", { min: timeBounds.minTime, max: timeBounds.maxTime ?? "" })
                  : t("thisVisitTypeIsLonger")}
              </p>
            </div>
          </div>

          {preferredDate && slots.isLoading && (
            <p className="text-xs text-gray-500">{t("checkingSuggestedTimes")}</p>
          )}

          {slotsUnavailable && (
            <p className="text-xs text-red-600">
              {t("suggestedTimesCouldNotBe")}
            </p>
          )}

          {preferredDate &&
            !slots.isLoading &&
            !slots.error &&
            slots.data &&
            slots.data.length === 0 && (
              <p className="text-xs text-gray-500">
                {t("noSuggestedRequestTimesAre")}
              </p>
            )}

          {preferredDate &&
            !slots.isLoading &&
            !slots.error &&
            slots.data &&
            slots.data.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">
                  {t("suggestedTimes", { date: preferredDate })}
                </p>
                <div className="flex flex-wrap gap-2">
                  {slots.data.map((s) => (
                    <button
                      key={s.iso}
                      type="button"
                      onClick={() => setPreferredTime(s.time)}
                      className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                        preferredTime === s.time
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-gray-200 text-gray-600 hover:border-primary/40"
                      }`}
                    >
                      {s.time}
                    </button>
                  ))}
                </div>
              </div>
            )}

          <div>
            <label
              htmlFor={reasonFieldId}
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              {t("anythingWeShouldKnow")}
            </label>
            <textarea
              id={reasonFieldId}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={3}
              maxLength={PORTAL_BOOKING_REASON_MAX_LENGTH}
              aria-invalid={reason.length > 0 && !hasValidReason}
              placeholder={t("brieflyDescribeTheReasonFor")}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {request.error && (
            <p className="text-sm text-red-600">{request.error.message}</p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {request.isPending ? t("sending") : t("requestAppointment")}
          </button>
        </form>
      )}
    </div>
  );
}
