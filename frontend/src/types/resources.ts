import type { PaginatedData } from './api';

export type DecimalValue = number | string | { $numberDecimal?: string };

export interface Company {
  _id: string; name: string; legalName?: string; address?: { street?: string; city?: string; state?: string; pinCode?: string };
  contactDetails?: { name?: string; email?: string; mobile?: string }; gstNumber?: string; isActive: boolean;
  notes?: string; isDeleted: boolean; createdAt: string; updatedAt: string;
}
export type CompanyPayload = Omit<Partial<Company>, '_id' | 'isDeleted' | 'createdAt' | 'updatedAt'> & Pick<Company, 'name'>;

export interface Vehicle {
  _id: string; registrationNumber: string; vehicleType: string; capacity: number;
  make?: string; vehicleModel?: string; firmId?: string | { _id: string; name: string }; vehicleNumberPerFirm?: number; status: 'available' | 'on_trip' | 'maintenance';
  isActive: boolean; isDeleted: boolean; metadata?: Record<string, unknown>; createdAt: string; updatedAt: string;
}
export type VehiclePayload = Omit<Partial<Vehicle>, '_id' | 'isDeleted' | 'createdAt' | 'updatedAt'> & Pick<Vehicle, 'registrationNumber' | 'vehicleType' | 'capacity'>;

export interface DriverHistoryEvent { eventType: 'hired' | 'suspended' | 'terminated' | 'rejoined' | 'other'; date?: string; notes?: string }
export interface Driver {
  _id: string; name: string; mobile: string; employeeId?: string; joiningDate?: string; dailyWage: DecimalValue;
  isActive: boolean; notes?: string; history: DriverHistoryEvent[]; isDeleted: boolean; createdAt: string; updatedAt: string;
}
export interface DriverPayload { name: string; mobile: string; employeeId?: string; joiningDate?: string; dailyWage: number; isActive?: boolean; notes?: string; history?: DriverHistoryEvent[] }

export interface Firm {
  _id: string; name: string; companyId?: string; billingName?: string; billPrefix?: string; address?: { street?: string; city?: string; state?: string; pinCode?: string };
  contactDetails?: { name?: string; email?: string; mobile?: string };
  bankDetails?: { accountName?: string; accountNumber?: string; ifscCode?: string; bankName?: string; branchName?: string };
  gstNumber?: string; isActive: boolean;
  billingConfiguration?: Record<string, unknown>; notes?: string; isDeleted: boolean; createdAt: string; updatedAt: string;
}
export type FirmPayload = Omit<Partial<Firm>, '_id' | 'isDeleted' | 'createdAt' | 'updatedAt'> & Pick<Firm, 'name'>;

export interface Route { _id: string; name: string; routeCode?: string; pickupLocation: string; dropLocation: string; intermediateStops?: string[]; expectedDistanceKm?: number; isActive: boolean; notes?: string; isDeleted: boolean; createdAt: string; updatedAt: string }
export type RoutePayload = Omit<Partial<Route>, '_id' | 'isDeleted' | 'createdAt' | 'updatedAt'> & Pick<Route, 'name' | 'pickupLocation' | 'dropLocation'>;

export interface BillingRules { capacityRates: Array<{ capacity: number; contractualAverageKmPerLitre: DecimalValue; baseHiringRatePerRound: DecimalValue; hiringMultiplierRules?: Array<{ minKm: number; maxKm?: number; multiplier: number }> }>; fuelRatePerLitre: DecimalValue; kmThresholds: Array<{ upToKm?: number; rounds: number }>; tollTreatment: 'excluded' | 'actual' | 'fixed'; otherBillableCharges?: Array<{ code: string; name: string; amount: DecimalValue; basis: 'flat' | 'perTrip' | 'perKm' | 'perRound'; isActive?: boolean }> }
export interface Contract { _id: string; firmId: string; companyId?: string; name: string; description?: string; isActive: boolean; isDeleted: boolean; createdAt: string; updatedAt: string }
export interface ContractVersion { _id: string; contractId: string; version: number; effectiveFrom: string; effectiveTo?: string; billingRules: BillingRules; notes?: string; createdAt: string; updatedAt: string }
export interface ContractPayload { firmId: string; companyId?: string; name: string; description?: string; isActive?: boolean }
export interface ContractVersionPayload { effectiveFrom: string; effectiveTo?: string | null; billingRules: BillingRules; notes?: string }

export interface Trip { _id: string; tripDate: string; vehicleId: string; driverId: string; firmId: string; contractId: string; contractVersionId: string; routeId?: string; pickupLocation: string; dropLocation: string; startKm?: number; endKm?: number; totalKm: number; operationalStatus: 'planned' | 'in_progress' | 'completed' | 'cancelled'; toll?: { amount: DecimalValue; reference?: string; notes?: string }; operationalInfo?: Record<string, unknown>; notes?: string; isDeleted: boolean; deletedAt?: string; createdAt: string; updatedAt: string }
export interface TripPayload { tripDate: string; vehicleId: string; driverId: string; firmId: string; contractId: string; routeId?: string | null; pickupLocation: string; dropLocation: string; startKm?: number; endKm?: number; totalKm: number; operationalStatus?: Trip['operationalStatus']; toll?: { amount: number; reference?: string; notes?: string }; operationalInfo?: Record<string, unknown>; notes?: string }
export interface TripQuery { page?: number; limit?: number; search?: string; fromDate?: string; toDate?: string; month?: string; vehicleId?: string; driverId?: string; firmId?: string; operationalStatus?: Trip['operationalStatus'] }

export type ExpenseCategory = 'fuel' | 'toll' | 'maintenance' | 'service' | 'insurance' | 'driver_wages' | 'driver_advance' | 'loading_unloading' | 'other';
export type ExpensePaymentStatus = 'pending' | 'paid' | 'partial' | 'cancelled';
export interface Expense {
  _id: string; category: ExpenseCategory; date: string; amount: number;
  vehicle?: string | { _id: string; registrationNumber: string }; firm?: string | { _id: string; name: string }; trip?: string;
  vendor?: string; description: string; attachmentUrl?: string; notes?: string;
  paymentStatus?: ExpensePaymentStatus; paymentDate?: string;
  fuelDetails?: { litresPurchased?: number; ratePerLitre?: number; pumpName?: string };
  tollDetails?: { month?: number; year?: number; source?: string };
  maintenanceDetails?: { maintenanceType?: string; workshopName?: string; odometer?: number };
  serviceDetails?: { serviceType?: string; workshopName?: string; odometer?: number };
  insuranceDetails?: { insurerName?: string; policyNumber?: string; coverageType?: string };
  loadingUnloadingDetails?: { contractorName?: string; month?: number; year?: number; chargeType?: string; reference?: string };
  isDeleted: boolean; createdAt: string; updatedAt: string;
}
export type ExpensePayload = Omit<Partial<Expense>, '_id' | 'vehicle' | 'firm' | 'isDeleted' | 'createdAt' | 'updatedAt'> & {
  category: ExpenseCategory; date: string; amount: number; description: string; vehicleId?: string; firmId?: string; tripId?: string;
};
export interface ExpenseQuery { page?: number; limit?: number; category?: ExpenseCategory; vehicleId?: string; firmId?: string; search?: string; startDate?: string; endDate?: string }
export interface ExpenseSummary {
  month: number; year: number; monthlyTotal: number;
  categoryTotals: Record<string, number>;
  vehicleTotals: Array<{ vehicleId: string; registrationNumber?: string | null; vehicleType?: string | null; total: number; count: number }>;
  paymentStatusTotals: Record<string, { total: number; count: number }>;
}

export type PaymentMethod = 'cash' | 'bank_transfer' | 'cheque' | 'upi' | 'other';
export type PaymentRecordStatus = 'pending' | 'received' | 'cancelled';
export interface Payment {
  _id: string; invoiceId: string | { _id: string; invoiceNumber?: string; month: number; year: number; summary?: { totalAmount: number } };
  firmId: string | { _id: string; name: string; billingName?: string };
  amount: number; paymentDate: string; paymentMethod: PaymentMethod; referenceNumber?: string; status: PaymentRecordStatus; notes?: string;
  createdAt: string; updatedAt: string;
}
export interface PaymentPayload { invoiceId: string; firmId: string; amount: number; paymentDate: string; paymentMethod: PaymentMethod; referenceNumber?: string; status?: PaymentRecordStatus; notes?: string }
export interface PaymentQuery { page?: number; limit?: number; invoiceId?: string; firmId?: string; status?: PaymentRecordStatus; startDate?: string; endDate?: string }

export type VehicleDocumentType = 'rc' | 'insurance' | 'permit' | 'fitness' | 'pollution' | 'other';
export type VehicleDocumentStatus = 'active' | 'expiring_soon' | 'expired';
export interface VehicleDocument {
  _id: string; vehicleId: string | { _id: string; registrationNumber: string }; documentType: VehicleDocumentType;
  documentNumber?: string; issueDate?: string; expiryDate: string; fileReference?: string; fileName?: string; contentType?: string; fileSize?: number;
  notes?: string; createdAt: string; updatedAt: string;
}
export interface VehicleDocumentQuery { vehicleId?: string; documentType?: VehicleDocumentType; status?: VehicleDocumentStatus; page?: number; limit?: number }

export type Page<T> = PaginatedData<T>;