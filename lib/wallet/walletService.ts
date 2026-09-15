import { prisma } from "@/lib/db/prisma";

export class InsufficientWalletBalanceError extends Error {
  constructor() {
    super("Insufficient wallet balance.");
  }
}

async function getOrCreateWallet(userId: string) {
  return prisma.wallet.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

export async function creditWallet(params: {
  userId: string;
  amountCents: number;
  reason: string;
  appointmentId?: string;
}) {
  if (params.amountCents <= 0) return; // nothing to credit — silently no-op rather than erroring on a 0 reward edge case

  await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.upsert({
      where: { userId: params.userId },
      update: { balanceCents: { increment: params.amountCents } },
      create: { userId: params.userId, balanceCents: params.amountCents },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "CREDIT",
        amountCents: params.amountCents,
        reason: params.reason,
        appointmentId: params.appointmentId,
      },
    });
  });
}

/**
 * Debits the wallet ONLY if the balance can actually cover it, checked and
 * updated atomically via a conditional `updateMany` (`balanceCents: { gte:
 * amountCents }`) rather than a separate read-then-write — this closes the
 * same kind of race window the booking engine's double-booking prevention
 * closes: two concurrent debits can't both succeed and drive the balance
 * negative, because the DB-level WHERE clause is evaluated atomically per
 * row, not in application code.
 */
export async function debitWallet(params: {
  userId: string;
  amountCents: number;
  reason: string;
  appointmentId?: string;
}) {
  if (params.amountCents <= 0) return;

  const wallet = await getOrCreateWallet(params.userId);

  await prisma.$transaction(async (tx) => {
    const result = await tx.wallet.updateMany({
      where: { id: wallet.id, balanceCents: { gte: params.amountCents } },
      data: { balanceCents: { decrement: params.amountCents } },
    });
    if (result.count === 0) {
      throw new InsufficientWalletBalanceError();
    }
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "DEBIT",
        amountCents: params.amountCents,
        reason: params.reason,
        appointmentId: params.appointmentId,
      },
    });
  });
}
