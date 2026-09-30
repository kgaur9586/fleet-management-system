import mongoose, { Document, Schema } from 'mongoose';

export type AuditAction =
  | 'invoice.generated'
  | 'invoice.approved'
  | 'invoice.finalized'
  | 'invoice.reopened'
  | 'payment.recorded'
  | 'contract.version_created';

export interface IAuditLog extends Document {
  action: AuditAction;
  entityType: string;
  entityId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  reason?: string;
  changes?: { before?: Record<string, unknown>; after?: Record<string, unknown> };
  timestamp: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    reason: { type: String, trim: true },
    changes: { type: Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  // Append-only: entries are never updated, so timestamps would be misleading.
  { timestamps: false }
);

auditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });

export const AuditLogModel = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
