import mongoose from 'mongoose';
import { VehicleModel } from '../src/modules/vehicles/vehicle.model';

/**
 * Removes the retired per-vehicle hiring charge.
 * Trip snapshots and invoices are left unchanged, so bills already generated keep their amounts.
 * Safe to run more than once.
 */
export async function removeVehicleHiringCharges() {
  const result = await VehicleModel.collection.updateMany(
    { 'operationalRates.hiringChargePerRound': { $exists: true } },
    { $unset: { 'operationalRates.hiringChargePerRound': '' } },
  );
  return { matched: result.matchedCount, modified: result.modifiedCount };
}

async function main() {
  const { connectDB } = await import('../src/config/database');
  await connectDB();
  const result = await removeVehicleHiringCharges();
  console.log(`Vehicles matched: ${result.matched}. Vehicles updated: ${result.modified}. Trips and invoices were not changed.`);
  await mongoose.disconnect();
}

const entry = process.argv[1]?.replace(/\\/g, '/');
if (entry?.endsWith('scripts/remove-vehicle-hiring-charges.ts') || entry?.endsWith('scripts/remove-vehicle-hiring-charges.js')) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
