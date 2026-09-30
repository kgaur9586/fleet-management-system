import { ClientSession, Types } from 'mongoose';
import { logger } from '../../config/logger';
import { AuditLogModel, AuditAction, IAuditLog } from './audit-log.model';

interface RecordAuditInput {
  action: AuditAction;
  entityType: string;
  entityId: string | Types.ObjectId;
  userId?: string;
  reason?: string;
  changes?: IAuditLog['changes'];
  session?: ClientSession;
}

export class AuditService {
  /** Audit failures must never abort the business operation they describe. */
  static async record({ session, ...entry }: RecordAuditInput) {
    try {
      await AuditLogModel.create([{ ...entry, timestamp: new Date() }], { session });
    } catch (error) {
      logger.error(`Failed to write audit log for ${entry.action}: ${(error as Error).message}`);
    }
  }

  static async listForEntity(entityType: string, entityId: string, limit = 50) {
    return AuditLogModel.find({ entityType, entityId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate('userId', 'name email');
  }
}
