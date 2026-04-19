import { db } from "../db";
import { auditLog, type AuditLogEntry } from "@shared/schema";

export interface LogAuditInput {
  actorUserId: string | null;
  leagueId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function logAudit(input: LogAuditInput): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actorUserId: input.actorUserId ?? null,
      leagueId: input.leagueId ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: (input.metadata ?? null) as unknown as object | null,
    });
  } catch (err) {
    console.warn("[audit] Failed to write audit log entry:", {
      action: input.action,
      err: err instanceof Error ? err.message : err,
    });
  }
}

export type { AuditLogEntry };
