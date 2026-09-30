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
export type Page<T> = PaginatedData<T>;