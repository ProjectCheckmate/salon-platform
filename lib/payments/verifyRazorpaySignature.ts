import crypto from "crypto";

/**
 * Razorpay signs every webhook payload with HMAC-SHA256 using your webhook
 * secret, sent as the X-Razorpay-Signature header. This is the ONLY way a
 * payment should ever be marked successful server-side — spec section 24:
 * "Never mark an online payment as successful solely based on frontend
 * input." This function is pure (no network, no DB) specifically so it can
 * be unit-tested without hitting Razorpay's servers, while the actual
 * webhook route (which DOES need network/DB) stays thin.
 *
 * Uses crypto.timingSafeEqual rather than string/hex comparison to avoid a
 * timing side-channel that could theoretically help an attacker guess a
 * valid signature byte-by-byte.
 */
export function verifyRazorpaySignature(
  rawBody: string,
  signatureHeader: string,
  webhookSecret: string
): boolean {
  if (!signatureHeader || !webhookSecret) return false;

  const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");

  let expectedBuf: Buffer;
  let actualBuf: Buffer;
  try {
    expectedBuf = Buffer.from(expected, "hex");
    actualBuf = Buffer.from(signatureHeader, "hex");
  } catch {
    return false;
  }
  if (expectedBuf.length !== actualBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
