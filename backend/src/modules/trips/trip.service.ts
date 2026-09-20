import { FilterQuery } from 'mongoose';
import { BadRequestError, ConflictError, NotFoundError } from '../../common/errors';
import { ContractModel } from '../contracts/contract.model';
import { ContractService } from '../contracts/contract.service';
import { DriverModel } from '../drivers/driver.model';
import { FirmModel } from '../firms/firm.model';
import { RouteModel } from '../routes/route.model';
import { VehicleModel } from '../vehicles/vehicle.model';
import { ITrip, TripModel } from './trip.model';

interface TripQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  fromDate?: Date;
  toDate?: Date;
  month?: string;
  vehicleId?: string;
  driverId?: string;
  firmId?: string;
  operationalStatus?: ITrip['operationalStatus'];
}

type TripInput = {
  tripDate?: Date | string;
  vehicleId?: string;
  driverId?: string;
  firmId?: string;
  contractId?: string;
  routeId?: string | null;
  pickupLocation?: string;
  dropLocation?: string;
  startKm?: number;
  endKm?: number;
  totalKm?: number;
  operationalStatus?: ITrip['operationalStatus'];
  operationalInfo?: Record<string, unknown>;
  notes?: string;
  toll?: { amount: number; reference?: string; notes?: string };
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class TripService {
  static async create(data: TripInput) {
    const tripDate = this.requireDate(data.tripDate);
    const references = await this.validateReferences(data, tripDate);
    const contractVersion = await ContractService.getEffectiveVersion(data.contractId as string, tripDate);

    return TripModel.create({
      ...data,
      tripDate,
      vehicleId: references.vehicle._id,
      driverId: references.driver._id,
      firmId: references.firm._id,
      contractId: references.contract._id,
      contractVersionId: contractVersion._id,
      routeId: data.routeId || undefined,
    });
  }

  static async update(id: string, data: TripInput) {
    const trip = await this.requireTrip(id);
    if (trip.operationalStatus === 'cancelled') {
      throw new ConflictError('Cancelled trips cannot be updated');
    }

    const merged = {
      tripDate: this.requireDate(data.tripDate ?? trip.tripDate),
      vehicleId: data.vehicleId ?? String(trip.vehicleId),
      driverId: data.driverId ?? String(trip.driverId),
      firmId: data.firmId ?? String(trip.firmId),
      contractId: data.contractId ?? String(trip.contractId),
      routeId: data.routeId === undefined ? String(trip.routeId ?? '') || null : data.routeId,
      pickupLocation: data.pickupLocation ?? trip.pickupLocation,
      dropLocation: data.dropLocation ?? trip.dropLocation,
      startKm: data.startKm ?? trip.startKm,
      endKm: data.endKm ?? trip.endKm,
      totalKm: data.totalKm ?? trip.totalKm,
    };
    this.validateKilometers(merged);
    const references = await this.validateReferences(merged, merged.tripDate);
    const contractChanged = String(trip.contractId) !== merged.contractId || trip.tripDate.getTime() !== merged.tripDate.getTime();
    const contractVersion = contractChanged
      ? await ContractService.getEffectiveVersion(merged.contractId, merged.tripDate)
      : null;

    Object.assign(trip, data, {
      ...merged,
      vehicleId: references.vehicle._id,
      driverId: references.driver._id,
      firmId: references.firm._id,
      contractId: references.contract._id,
      contractVersionId: contractVersion?._id ?? trip.contractVersionId,
      routeId: merged.routeId || undefined,
    });
    return trip.save();
  }

  static async getById(id: string) {
    return this.requireTrip(id);
  }

  static async delete(id: string) {
    const trip = await this.requireTrip(id);
    if (trip.operationalStatus === 'completed') {
      throw new ConflictError('Completed trips must be cancelled explicitly before deletion');
    }
    trip.operationalStatus = 'cancelled';
    trip.isDeleted = true;
    trip.deletedAt = new Date();
    await trip.save();
    return true;
  }

  static async list(options: TripQueryOptions) {
    const { page = 1, limit = 10, search, fromDate, toDate, month, vehicleId, driverId, firmId, operationalStatus } = options;
    const query: FilterQuery<ITrip> = { isDeleted: false };
    const dateRange = this.getDateRange(fromDate, toDate, month);
    if (dateRange) query.tripDate = dateRange;
    if (search) {
      const searchRegex = { $regex: escapeRegex(search), $options: 'i' };
      query.$or = [{ pickupLocation: searchRegex }, { dropLocation: searchRegex }, { notes: searchRegex }];
    }
    if (vehicleId) query.vehicleId = vehicleId;
    if (driverId) query.driverId = driverId;
    if (firmId) query.firmId = firmId;
    if (operationalStatus) query.operationalStatus = operationalStatus;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      TripModel.find(query).sort({ tripDate: -1, createdAt: -1 }).skip(skip).limit(limit),
      TripModel.countDocuments(query),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  private static async validateReferences(data: TripInput, tripDate: Date) {
    this.validateKilometers(data);
    const [vehicle, driver, firm, contract, route] = await Promise.all([
      VehicleModel.findOne({ _id: data.vehicleId, isDeleted: false, isActive: true }),
      DriverModel.findOne({ _id: data.driverId, isDeleted: false, isActive: true }),
      FirmModel.findOne({ _id: data.firmId, isDeleted: false, isActive: true }),
      ContractModel.findOne({ _id: data.contractId, isDeleted: false, isActive: true }),
      data.routeId ? RouteModel.findOne({ _id: data.routeId, isDeleted: false, isActive: true }) : null,
    ]);
    if (!vehicle) throw new NotFoundError('Active vehicle not found');
    if (!driver) throw new NotFoundError('Active driver not found');
    if (!firm) throw new NotFoundError('Active firm not found');
    if (!contract) throw new NotFoundError('Active contract not found');
    if (!route && data.routeId) throw new NotFoundError('Active route not found');
    if (vehicle.firmId && String(vehicle.firmId) !== String(firm._id)) {
      throw new ConflictError('Vehicle does not belong to the selected firm');
    }
    if (String(contract.firmId) !== String(firm._id)) {
      throw new ConflictError('Contract does not belong to the selected firm');
    }
    return { vehicle, driver, firm, contract, route, tripDate };
  }

  private static validateKilometers(data: { startKm?: number; endKm?: number; totalKm?: number }) {
    if (data.totalKm === undefined || data.totalKm <= 0) throw new BadRequestError('Total kilometers must be greater than zero');
    if (data.startKm !== undefined && data.endKm !== undefined) {
      if (data.endKm < data.startKm) throw new BadRequestError('End kilometers cannot be less than start kilometers');
      if (data.totalKm !== data.endKm - data.startKm) throw new BadRequestError('Total kilometers must equal end kilometers minus start kilometers');
    }
  }

  private static getDateRange(fromDate?: Date, toDate?: Date, month?: string) {
    if (month) {
      const [year, monthNumber] = month.split('-').map(Number);
      return { $gte: new Date(Date.UTC(year, monthNumber - 1, 1)), $lt: new Date(Date.UTC(year, monthNumber, 1)) };
    }
    if (!fromDate && !toDate) return undefined;
    const range: { $gte?: Date; $lt?: Date } = {};
    if (fromDate) range.$gte = fromDate;
    if (toDate) range.$lt = new Date(toDate.getTime() + 24 * 60 * 60 * 1000);
    return range;
  }

  private static requireDate(value?: Date | string) {
    const date = value instanceof Date ? value : value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) throw new BadRequestError('Trip date is invalid');
    return date;
  }

  private static async requireTrip(id: string) {
    const trip = await TripModel.findOne({ _id: id, isDeleted: false });
    if (!trip) throw new NotFoundError('Trip not found');
    return trip;
  }
}