import { sendSms, type SmsDispatchResult } from "@/lib/sms-dispatch";
import type { Language } from "@/i18n/config";
import { getTranslatorFor } from "@/i18n/messages";

export {
  prepareCampaignSmsBody,
  reconcileSmsSendAttempt,
  resendSmsAttempt,
  sendSms,
  SMS_COMPLIANCE_FOOTER,
  SMS_MAX_BODY_LENGTH,
} from "@/lib/sms-dispatch";
export type {
  SmsDispatchOutcome,
  SmsDispatchResult,
  SmsSendOptions,
} from "@/lib/sms-dispatch";

// ---------------------------------------------------------------------------
// Core send function
//
// Transport is provider-agnostic (lib/messaging): explicit locations bind the
// persisted provider and sender from one active location_messaging row. Calls
// without a location retain the env-selected provider/sender fallback for dev.
// This module keeps the hosted entitlement gate and usage metering.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Appointment reminder SMS
// ---------------------------------------------------------------------------

export async function sendAppointmentReminderSms(data: {
  to: string;
  patientName: string;
  appointmentDate: string;
  appointmentTime: string;
  practiceName: string;
  practicePhone?: string;
  practiceId: string;
  locationId?: string;
  clientId?: string;
  communicationId?: string;
  source?: string;
  sourceId?: string;
  idempotencyKey?: string;
  reminderClaimToken?: string;
  /** The client's language; defaults to English. */
  language?: Language;
}): Promise<SmsDispatchResult> {
  const t = getTranslatorFor(data.language ?? "en");
  const body = t("sms.appointmentReminder", {
    patient: data.patientName,
    date: data.appointmentDate,
    time: data.appointmentTime,
    contact: data.practicePhone
      ? t("sms.callToReschedule", { phone: data.practicePhone })
      : t("sms.contactToReschedule"),
  });

  const result = await sendSms({
    to: data.to,
    body,
    practiceId: data.practiceId,
    locationId: data.locationId,
    clientId: data.clientId,
    communicationId: data.communicationId,
    source: data.source ?? "appointment_reminder",
    sourceId: data.sourceId,
    idempotencyKey: data.idempotencyKey,
    reminderClaimToken: data.reminderClaimToken,
  });
  return result;
}

// ---------------------------------------------------------------------------
// Vaccination reminder SMS
// ---------------------------------------------------------------------------

export async function sendVaccinationReminderSms(data: {
  to: string;
  patientName: string;
  vaccineName: string;
  practiceName: string;
  practicePhone?: string;
  practiceId: string;
  locationId?: string;
  clientId?: string;
  communicationId?: string;
  sourceId?: string;
  idempotencyKey?: string;
  /** The client's language; defaults to English. */
  language?: Language;
}): Promise<SmsDispatchResult> {
  const t = getTranslatorFor(data.language ?? "en");
  const body = t("sms.vaccinationReminder", {
    patient: data.patientName,
    vaccine: data.vaccineName,
    contact: data.practicePhone
      ? t("sms.callToSchedule", { phone: data.practicePhone })
      : t("sms.contactToSchedule"),
  });

  const result = await sendSms({
    to: data.to,
    body,
    practiceId: data.practiceId,
    locationId: data.locationId,
    clientId: data.clientId,
    communicationId: data.communicationId,
    source: "vaccination_recall",
    sourceId: data.sourceId,
    idempotencyKey: data.idempotencyKey,
  });
  return result;
}

// ---------------------------------------------------------------------------
// Care reminder SMS
// ---------------------------------------------------------------------------

export async function sendCareReminderSms(data: {
  to: string;
  patientName: string;
  reminderTitle: string;
  dueDate: string;
  practiceName: string;
  practicePhone?: string;
  practiceId: string;
  locationId: string;
  clientId: string;
  communicationId: string;
  sourceId: string;
  idempotencyKey: string;
  /** The client's language; defaults to English. */
  language?: Language;
}): Promise<SmsDispatchResult> {
  const t = getTranslatorFor(data.language ?? "en");
  return sendSms({
    to: data.to,
    body: t("sms.careReminder", {
      patient: data.patientName,
      title: data.reminderTitle,
      date: data.dueDate,
      contact: data.practicePhone
        ? t("sms.callWithQuestions", { phone: data.practicePhone })
        : t("sms.contactWithQuestions"),
    }),
    practiceId: data.practiceId,
    locationId: data.locationId,
    clientId: data.clientId,
    communicationId: data.communicationId,
    source: "care_reminder",
    sourceId: data.sourceId,
    idempotencyKey: data.idempotencyKey,
  });
}
