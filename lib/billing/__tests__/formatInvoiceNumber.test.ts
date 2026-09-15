import { describe, it, expect } from "vitest";
import { formatInvoiceNumber } from "../formatInvoiceNumber";

describe("formatInvoiceNumber", () => {
  it("uppercases the salon prefix and zero-pads the sequence", () => {
    expect(formatInvoiceNumber("abcdef123456", 42)).toBe("INV-ABCDEF-000042");
  });

  it("handles a sequence number beyond 6 digits without truncating it", () => {
    expect(formatInvoiceNumber("abcdef123456", 1234567)).toBe("INV-ABCDEF-1234567");
  });
});
