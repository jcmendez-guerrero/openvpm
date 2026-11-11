export type CommunicationStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

export type CommunicationStatusInput = {
  status: string | null | undefined;
  channel?: string | null;
  direction?: string | null;
  readAt?: Date | string | null;
  reminderOutcome?: string | null;
};

// English text per status key; the UI passes a translator for `communications.status`.
const communicationStatusText = {
  pending: "Pending",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  failed: "Failed",
  deliveryUnknown: "Delivery unknown",
  readByClinic: "Read by clinic",
  unread: "Unread",
  readByClient: "Read by client",
  deliveredToPortal: "Delivered to portal",
} as const;
export type CommunicationStatusKey = keyof typeof communicationStatusText;
const unreadInboundStatuses = new Set(["pending", "sent", "delivered"]);

function communicationStatusKey(
  input: CommunicationStatusInput,
): CommunicationStatusKey | null {
  const status = input.status?.trim();
  if (!status) return null;

  // The provider never confirmed this send; it may have been delivered.
  if (status === "pending" && input.reminderOutcome === "outcome_unknown") {
    return "deliveryUnknown";
  }

  if (input.direction === "inbound") {
    if (input.readAt || status === "read") return "readByClinic";
    if (unreadInboundStatuses.has(status)) return "unread";
  }

  if (input.direction === "outbound" && input.channel === "portal") {
    if (status === "read") return "readByClient";
    if (status === "delivered") return "deliveredToPortal";
  }

  return ["pending", "sent", "delivered", "read", "failed"].includes(status)
    ? (status as CommunicationStatus)
    : null;
}

export function communicationStatusLabel(
  input: CommunicationStatusInput,
  t?: (key: CommunicationStatusKey) => string,
): string {
  const key = communicationStatusKey(input);
  if (!key) return input.status?.trim() ?? "";
  return t ? t(key) : communicationStatusText[key];
}
