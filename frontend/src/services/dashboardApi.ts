import { tripsApi } from './tripsApi';
import { vehiclesApi } from './vehiclesApi';

const toDateParam = (date: Date) => date.toISOString().slice(0, 10);
const toMonthParam = (date: Date) => date.toISOString().slice(0, 7);

export interface DashboardSnapshot {
  fleet: {
    totalVehicles: number;
    activeVehicles: number;
    inactiveVehicles: number;
  };
  operations: {
    tripsToday: number;
    tripsThisMonth: number;
    vehiclesCurrentlyActive: number;
  };
}

export async function getDashboardSnapshot(date = new Date()): Promise<DashboardSnapshot> {
  const today = toDateParam(date);
  const month = toMonthParam(date);
  const [allVehicles, activeVehicles, inactiveVehicles, tripsToday, tripsThisMonth] = await Promise.all([
    vehiclesApi.list({ page: 1, limit: 1 }),
    vehiclesApi.list({ page: 1, limit: 1, isActive: true }),
    vehiclesApi.list({ page: 1, limit: 1, isActive: false }),
    tripsApi.list({ page: 1, limit: 1, fromDate: today, toDate: today }),
    tripsApi.list({ page: 1, limit: 1, month }),
  ]);

  return {
    fleet: {
      totalVehicles: allVehicles.meta.total,
      activeVehicles: activeVehicles.meta.total,
      inactiveVehicles: inactiveVehicles.meta.total,
    },
    operations: {
      tripsToday: tripsToday.meta.total,
      tripsThisMonth: tripsThisMonth.meta.total,
      vehiclesCurrentlyActive: activeVehicles.meta.total,
    },
  };
}