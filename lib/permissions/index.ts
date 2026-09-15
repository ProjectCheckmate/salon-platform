import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { prisma } from "@/lib/db/prisma";
import type { Role } from "@prisma/client";

export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}

/**
 * Every API route / server action that touches tenant data MUST call this
 * instead of trusting a salonId from the request body or query string.
 * This is the single source of truth for "can this session act on this salon".
 */
export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new UnauthorizedError("Not authenticated");
  return session;
}

export async function requireRole(...allowed: Role[]) {
  const session = await requireSession();
  const role = (session.user as any).role as Role;
  if (!allowed.includes(role)) throw new ForbiddenError("Insufficient role");
  return session;
}

/**
 * Confirms the current user owns (or staffs at) the given salon.
 * Never accept salonId-based authorization without this check.
 */
export async function requireSalonAccess(salonId: string) {
  const session = await requireSession();
  const userId = (session.user as any).id as string;
  const role = (session.user as any).role as Role;

  if (role === "ADMIN") return session; // platform admin, full access

  const salon = await prisma.salon.findUnique({ where: { id: salonId } });
  if (!salon) throw new ForbiddenError("Salon not found");

  if (salon.ownerId === userId) return session;

  const staffRecord = await prisma.staff.findFirst({
    where: { salonId, userId, active: true },
  });
  if (staffRecord) return session;

  throw new ForbiddenError("No access to this salon");
}
