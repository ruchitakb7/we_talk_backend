export type MessageStatus = "sent" | "delivered" | "read";

export type StatusTransition = {
  deliveredCountDelta: number;
  seenCountDelta: number;
};

export const aggregateMessageStatus = (
  deliveredCount: number,
  seenCount: number,
  totalRecipients: number
): MessageStatus => {
  if (totalRecipients === 0 || seenCount === totalRecipients) {
    return "read";
  }

  if (deliveredCount === totalRecipients) {
    return "delivered";
  }

  return "sent";
};

export const initialRecipientStatus = (isOnline: boolean): MessageStatus =>
  isOnline ? "delivered" : "sent";

export const getStatusTransition = (
  current: MessageStatus,
  target: MessageStatus
): StatusTransition | null => {
  if (current === "sent" && target === "delivered") {
    return { deliveredCountDelta: 1, seenCountDelta: 0 };
  }

  if (current === "sent" && target === "read") {
    return { deliveredCountDelta: 1, seenCountDelta: 1 };
  }

  if (current === "delivered" && target === "read") {
    return { deliveredCountDelta: 0, seenCountDelta: 1 };
  }

  return null;
};
