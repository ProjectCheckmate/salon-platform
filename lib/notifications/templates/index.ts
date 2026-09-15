/**
 * Every template is a pure function: fixed inputs in, fixed string out.
 * No template ever fabricates a detail not passed in — if a caller doesn't
 * have a real value for something, that's a bug in the caller, not
 * something this layer should paper over with a placeholder.
 */

export function bookingConfirmation(params: {
  customerName: string;
  salonName: string;
  serviceName: string;
  dateTime: string;
  priceRupees: number;
}) {
  return `Hi ${params.customerName}, your ${params.serviceName} at ${params.salonName} is confirmed for ${params.dateTime}. Total: Rs.${params.priceRupees}.`;
}

export function appointmentReminder(params: { customerName: string; salonName: string; dateTime: string }) {
  return `Hi ${params.customerName}, reminder: your appointment at ${params.salonName} is at ${params.dateTime}. See you soon!`;
}

export function cancellationNotice(params: {
  customerName: string;
  salonName: string;
  dateTime: string;
  feeRupees: number;
}) {
  const feeLine = params.feeRupees > 0 ? ` A Rs.${params.feeRupees} cancellation fee applies.` : "";
  return `Hi ${params.customerName}, your appointment at ${params.salonName} on ${params.dateTime} has been cancelled.${feeLine}`;
}

export function reschedulingNotice(params: { customerName: string; salonName: string; newDateTime: string }) {
  return `Hi ${params.customerName}, your appointment at ${params.salonName} has been rescheduled to ${params.newDateTime}.`;
}

export function paymentReceipt(params: {
  customerName: string;
  salonName: string;
  amountRupees: number;
  invoiceNumber: string;
}) {
  return `Hi ${params.customerName}, we've received Rs.${params.amountRupees} for your visit to ${params.salonName}. Invoice ${params.invoiceNumber}.`;
}

export function reviewRequest(params: { customerName: string; salonName: string }) {
  return `Hi ${params.customerName}, thanks for visiting ${params.salonName}! Would you mind leaving a quick review?`;
}

export function rebookingReminder(params: { customerName: string; salonName: string; daysSinceLastVisit: number }) {
  return `Hi ${params.customerName}, it's been ${params.daysSinceLastVisit} days since your last visit to ${params.salonName}. Ready to book again?`;
}

export function inactiveCustomerCampaign(params: { customerName: string; salonName: string; offerText?: string }) {
  const offer = params.offerText ? ` ${params.offerText}` : "";
  return `Hi ${params.customerName}, we miss you at ${params.salonName}!${offer}`;
}

export function birthdayOffer(params: { customerName: string; salonName: string; offerText: string }) {
  return `Happy Birthday ${params.customerName}! ${params.salonName} has a gift for you: ${params.offerText}`;
}

export function promotionalOffer(params: { customerName: string; salonName: string; offerText: string }) {
  return `Hi ${params.customerName}, ${params.salonName} has a new offer: ${params.offerText}`;
}

export function emptySlotAlert(params: { customerName: string; salonName: string; slotTime: string }) {
  return `Hi ${params.customerName}, a slot just opened up at ${params.salonName} for ${params.slotTime}. Want to grab it?`;
}
