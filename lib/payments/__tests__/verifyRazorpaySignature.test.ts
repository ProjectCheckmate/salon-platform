import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifyRazorpaySignature } from "../verifyRazorpaySignature";

const secret = "test_webhook_secret";
const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_123" } } } });

function sign(payload: string, key: string) {
  return crypto.createHmac("sha256", key).update(payload).digest("hex");
}

describe("verifyRazorpaySignature", () => {
  it("accepts a correctly-signed payload", () => {
    const signature = sign(body, secret);
    expect(verifyRazorpaySignature(body, signature, secret)).toBe(true);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const signature = sign(body, "wrong_secret");
    expect(verifyRazorpaySignature(body, signature, secret)).toBe(false);
  });

  it("rejects a signature for tampered body content", () => {
    const signature = sign(body, secret);
    const tamperedBody = body.replace("payment.captured", "payment.failed");
    expect(verifyRazorpaySignature(tamperedBody, signature, secret)).toBe(false);
  });

  it("rejects an empty or missing signature header", () => {
    expect(verifyRazorpaySignature(body, "", secret)).toBe(false);
  });

  it("rejects when the webhook secret itself is empty", () => {
    const signature = sign(body, secret);
    expect(verifyRazorpaySignature(body, signature, "")).toBe(false);
  });

  it("never throws on garbage, non-hex signature input", () => {
    expect(() => verifyRazorpaySignature(body, "not-valid-hex-!!!", secret)).not.toThrow();
    expect(verifyRazorpaySignature(body, "not-valid-hex-!!!", secret)).toBe(false);
  });
});
