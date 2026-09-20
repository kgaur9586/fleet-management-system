import apiClient from './apiClient';

export interface VehicleTotal {
  vehicleId: string;
  registrationNumber: string;
  vehicleType: string | null;
  totalTrips: number;
  totalKm: number;
  contractualAverage: string;
  contractualFuelQuantity: number;
  fuelRate: string;
  fuelReimbursement: number;
  hiringUnits: number;
  hiringAmount: number;
  billableToll: number;
  otherBillableAmount: number;
  total: number;
  count: number;
}

export interface DocumentAlert {
  documentId: string;
  vehicleId: string;
  registrationNumber: string;
  documentType: string;
  documentNumber?: string;
  expiryDate: string;
}

export interface DashboardSnapshot {
  period: { month: number; year: number };
  fleet: { totalVehicles: number; activeVehicles: number; inactiveVehicles: number; totalDrivers: number };
  operations: { tripsToday: number; tripsThisMonth: number };
  finance: {
    monthlyBilling: number;
    monthlyPaymentsReceived: number;
    outstandingInvoices: { count: number; amount: number };
    monthlyExpenses: number;
  };
  vehicleBilling: VehicleTotal[];
  vehicleExpenses: VehicleTotal[];
  documentAlerts: { expiringSoon: DocumentAlert[]; expired: DocumentAlert[] };
  source: { billingInvoiceCount: number; paymentCount: number; expenseCount: number };
}

export async function getDashboardSnapshot(date = new Date()): Promise<DashboardSnapshot> {
  return apiClient.get<DashboardSnapshot>('/dashboard', {
    params: { month: date.getMonth() + 1, year: date.getFullYear() },
  });
}
