import mongoose from 'mongoose';

/** Converts a Mongoose Decimal128 (or plain number/string) to a JS number for arithmetic. */
export const toNumber = (value: mongoose.Types.Decimal128 | number | string | undefined | null): number => {
  if (value === undefined || value === null) return 0;
  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Standard 2-decimal-place rounding for INR amounts, avoiding binary floating-point drift. */
export const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
