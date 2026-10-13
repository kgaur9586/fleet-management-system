import mongoose, { ClientSession } from 'mongoose';
import { logger } from '../config/logger';

let transactionsSupported: boolean | null = null;

/** Standalone mongod rejects session-based transactions with these codes/messages. */
const isUnsupportedTransactionError = (error: unknown) => {
  const candidate = error as { code?: number; codeName?: string; message?: string };
  if (candidate?.code === 20 || candidate?.codeName === 'IllegalOperation') return true;
  return Boolean(candidate?.message && /Transaction numbers are only allowed on a replica set/i.test(candidate.message));
};

/**
 * Runs `work` inside a MongoDB transaction so multi-document writes commit or roll back together.
 * Falls back to a non-transactional run on standalone deployments, which cannot support sessions.
 */
export async function withTransaction<T>(work: (session?: ClientSession) => Promise<T>): Promise<T> {
  if (transactionsSupported === false) return work(undefined);

  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    transactionsSupported = true;
    return result as T;
  } catch (error) {
    if (transactionsSupported === null && isUnsupportedTransactionError(error)) {
      transactionsSupported = false;
      logger.warn('MongoDB deployment does not support transactions; multi-document writes are not atomic.');
      return work(undefined);
    }
    throw error;
  } finally {
    await session.endSession();
  }
}
