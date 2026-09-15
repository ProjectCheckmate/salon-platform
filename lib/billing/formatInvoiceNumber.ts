/**
 * Human-readable invoice numbers, e.g. INV-A1B2C3-000042. The salon prefix
 * uses the first 6 chars of the salonId (cuid, already unique) and the
 * sequence number is the count of invoices already issued for that salon
 * + 1, so it reads naturally as "this salon's 42nd invoice" without a
 * separate counter table to keep in sync.
 */
export function formatInvoiceNumber(salonId: string, sequence: number): string {
  const prefix = salonId.slice(0, 6).toUpperCase();
  return `INV-${prefix}-${String(sequence).padStart(6, "0")}`;
}
