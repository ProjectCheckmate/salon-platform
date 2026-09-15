import { prisma } from "@/lib/db/prisma";

interface AuditParams {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Every state-changing admin/owner action that touches money, approval
 * status, or another user's data should call this. See spec section 26
 * (payment audit log) and section 53 (audit logs) — this is the one place
 * that writes to `audit_logs`, so behavior stays consistent everywhere.
 */
export async function logAudit(params: AuditParams) {
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId ?? null,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      metadata: params.metadata as any,
    },
  });
}
