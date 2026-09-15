export interface NotificationMessage {
  to: string; // phone or email, depending on channel
  channel: "WHATSAPP" | "SMS" | "EMAIL";
  templateKey: string;
  variables: Record<string, string | number>;
  renderedText: string; // already-rendered, human-readable body (see templates/)
}

export interface NotificationProvider {
  send(message: NotificationMessage): Promise<{ success: boolean; providerMessageId?: string }>;
}

/**
 * Logs instead of sending. This is the ONLY provider wired up right now —
 * spec section 31 explicitly requires: "If credentials are not available,
 * implement a mock/development notification provider and clearly separate
 * it from production" and "Do not fake WhatsApp API integration." No code
 * anywhere in this project claims a WhatsApp message was actually
 * delivered; this provider is deliberately named Mock so it's never
 * mistaken for one.
 */
export class MockNotificationProvider implements NotificationProvider {
  async send(message: NotificationMessage) {
    console.log(
      `[MockNotificationProvider] Would send ${message.channel} to ${message.to}: "${message.renderedText}"`
    );
    return { success: true, providerMessageId: `mock_${Date.now()}` };
  }
}

export function getNotificationProvider(): NotificationProvider {
  const provider = process.env.NOTIFICATION_PROVIDER || "mock";
  if (provider === "mock") return new MockNotificationProvider();
  throw new Error(
    `Notification provider "${provider}" not implemented. Wire a real WhatsApp/SMS/Email ` +
      `provider here once credentials are available — see .env.example for the expected variables.`
  );
}
