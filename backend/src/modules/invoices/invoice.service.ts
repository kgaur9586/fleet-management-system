import crypto from 'crypto';
import { FilterQuery } from 'mongoose';
import { BadRequestError, ConflictError, NotFoundError } from '../../common/errors';
import { ContractModel } from '../contracts/contract.model';
import { ContractVersionModel } from '../contracts/contract-version.model';
import { VehicleModel } from '../vehicles/vehicle.model';
import { FirmModel } from '../firms/firm.model';
import { DriverModel } from '../drivers/driver.model';
import { RouteModel } from '../routes/route.model';
import { TripModel } from '../trips/trip.model';
import { calculateTripBilling } from '../billing/billing-engine';
import { InvoiceModel, IInvoice } from './invoice.model';
import { invoiceCompanySnapshot } from './invoice.config';
import { renderFinalizedInvoicePdf } from './invoice.pdf';

interface InvoiceGenerateInput {
  firmId: string;
  vehicleId: string;
  month: number;
  year: number;
  notes?: string;
}

interface InvoiceUpdateInput {
  notes?: string;
}

const normalizeDecimal = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value === null || value === undefined) return 0;
  const asString = String(value).trim();
  if (!asString) return 0;
  const parsed = Number(asString);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toDateRange = (year: number, month: number) => ({
  $gte: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)),
  $lt: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)),
});

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class InvoiceService {
  static async generate(data: InvoiceGenerateInput, generatedBy?: string) {
    if (!generatedBy) throw new BadRequestError('User context is required to generate an invoice');

    const { firmId, vehicleId, month, year } = data;
    const existing = await InvoiceModel.findOne({ firmId, vehicleId, month, year, isDeleted: false });
    if (existing) {
      throw new ConflictError('An invoice already exists for this firm, vehicle, and billing month');
    }

    const start = toDateRange(year, month);
    const firm = await FirmModel.findOne({ _id: firmId, isDeleted: false }).lean();
    if (!firm) throw new NotFoundError('Firm not found');

    const selectedVehicle = await VehicleModel.findOne({ _id: vehicleId, isDeleted: false }).lean();
    if (!selectedVehicle) throw new NotFoundError('Vehicle not found');

    const trips = await TripModel.find({
      firmId,
      vehicleId,
      tripDate: start,
      operationalStatus: 'completed',
      isDeleted: false,
      billingInvoiceId: { $exists: false },
    }).sort({ tripDate: 1 });

    if (!trips.length) {
      throw new NotFoundError('No completed trips found for the selected firm, vehicle, and month');
    }

    const lineItems: any[] = [];
    let summary = {
      vehicleCount: 1,
      tripCount: 0,
      totalDistanceKm: 0,
      fuelAmount: 0,
      hiringAmount: 0,
      tollAmount: 0,
      otherBillableAmount: 0,
      totalAmount: 0,
    };

    for (const trip of trips) {
      const contract = await ContractModel.findById(trip.contractId).lean();
      const version = await ContractVersionModel.findById(trip.contractVersionId).lean();
      const [vehicle, driver, route] = await Promise.all([
        VehicleModel.findById(trip.vehicleId).lean(),
        DriverModel.findById(trip.driverId).lean(),
        trip.routeId ? RouteModel.findById(trip.routeId).lean() : null,
      ]);

      if (!contract || !version || !vehicle || !driver || (trip.routeId && !route)) {
        throw new NotFoundError('Trip references are incomplete or deleted');
      }

      const billingRate = normalizeDecimal((version as any).billingRules?.fuelRatePerLitre);
      const tollAmount = trip.toll && trip.toll.amount ? normalizeDecimal((trip.toll as any).amount) : 0;

      const result = calculateTripBilling(
        {
          tripId: String(trip._id),
          distanceKm: Number(trip.totalKm),
          tollAmount,
        },
        {
          vehicleId: String(vehicle._id),
          capacity: Number(vehicle.capacity),
        },
        { contractId: String(contract._id) },
        { contractVersionId: String(version._id), version: (version as any).version },
        (version as any).billingRules,
        billingRate
      );

      const lineItem = {
        tripId: trip._id,
        vehicleId: trip.vehicleId,
        driverId: trip.driverId,
        contractId: trip.contractId,
        contractVersionId: trip.contractVersionId,
        contractVersion: (version as any).version,
        tripSnapshot: {
          tripDate: trip.tripDate,
          vehicle: { id: String(vehicle._id), registrationNumber: vehicle.registrationNumber, vehicleType: vehicle.vehicleType },
          driver: { id: String(driver._id), name: driver.name },
          route: route ? { id: String(route._id), name: route.name, routeCode: route.routeCode } : null,
          pickupLocation: trip.pickupLocation,
          dropLocation: trip.dropLocation,
          startKm: trip.startKm,
          endKm: trip.endKm,
          totalKm: trip.totalKm,
          operationalStatus: trip.operationalStatus,
          contract: { id: String(contract._id), name: contract.name },
          contractVersion: { id: String(version._id), version: (version as any).version },
          distanceKm: result.distanceKm,
          tollAmount: result.tollAmount,
        },
        vehicleSnapshot: {
          registrationNumber: vehicle.registrationNumber,
          vehicleType: vehicle.vehicleType,
          capacity: vehicle.capacity,
        },
        snapshot: result,
        createdAt: new Date(),
      };

      lineItems.push(lineItem);

      summary.tripCount += 1;
      summary.totalDistanceKm += Number(result.distanceKm || 0);
      summary.fuelAmount += Number(result.fuelAmount || 0);
      summary.hiringAmount += Number(result.hiringAmount || 0);
      summary.tollAmount += Number(result.tollAmount || 0);
      summary.otherBillableAmount += Number(result.otherBillableAmount || 0);
      summary.totalAmount += Number(result.totalAmount || 0);
    }

    const tripIds = trips.map((trip) => String(trip._id));
    const invoice = await InvoiceModel.create({
      firmId,
      vehicleId,
      month,
      year,
      invoiceNumber: `INV-${year}${String(month).padStart(2, '0')}-${String(firmId).slice(-6)}-${String(vehicleId).slice(-6)}`,
      generatedBy,
      notes: data.notes,
      status: 'draft',
      companySnapshot: invoiceCompanySnapshot,
      firmSnapshot: {
        name: firm.name,
        billingName: firm.billingName,
        address: firm.address ? [firm.address.street, firm.address.city, firm.address.state, firm.address.pinCode].filter(Boolean).join(', ') : undefined,
        gstNumber: firm.gstNumber,
      },
      vehicleSnapshot: {
        registrationNumber: selectedVehicle.registrationNumber,
        vehicleType: selectedVehicle.vehicleType,
        capacity: selectedVehicle.capacity,
      },
      generatedAt: new Date(),
      lineItems,
      summary,
      duplicateTripGuard: {
        tripCount: tripIds.length,
        tripIds,
        hash: crypto.createHash('sha256').update(tripIds.sort().join(',')).digest('hex'),
        generatedAt: new Date(),
      },
    });

    await TripModel.updateMany({ _id: { $in: trips.map((trip) => trip._id) } }, { $set: { billingInvoiceId: invoice._id } });

    return InvoiceModel.findById(invoice._id).populate('firmId', 'name billingName').populate('vehicleId', 'registrationNumber capacity');
  }

  static async list(options: { page?: number; limit?: number; search?: string; firmId?: string; vehicleId?: string; status?: IInvoice['status']; month?: number; year?: number; }) {
    const { page = 1, limit = 10, search, firmId, vehicleId, status, month, year } = options;
    const query: FilterQuery<IInvoice> = { isDeleted: false };
    if (search) query.invoiceNumber = { $regex: escapeRegex(search), $options: 'i' };
    if (firmId) query.firmId = firmId;
    if (vehicleId) query.vehicleId = vehicleId;
    if (status) query.status = status;
    if (month) query.month = month;
    if (year) query.year = year;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      InvoiceModel.find(query)
        .sort({ year: -1, month: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('firmId', 'name billingName')
        .populate('vehicleId', 'registrationNumber capacity'),
      InvoiceModel.countDocuments(query),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  static async getById(id: string) {
    const invoice = await InvoiceModel.findOne({ _id: id, isDeleted: false })
      .populate('firmId', 'name billingName')
      .populate('vehicleId', 'registrationNumber capacity')
      .populate('generatedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('finalizedBy', 'name email');

    if (!invoice) throw new NotFoundError('Invoice not found');
    return invoice;
  }

  static async approve(id: string, data: InvoiceUpdateInput, approvedBy?: string) {
    const invoice = await this.requireInvoice(id);
    if (invoice.status === 'finalized') {
      throw new ConflictError('A finalized invoice cannot be approved again');
    }
    if (invoice.status === 'approved') {
      return invoice;
    }

    invoice.status = 'approved';
    invoice.approvedBy = approvedBy as any;
    invoice.approvedAt = new Date();
    invoice.approvalNotes = data.notes;
    return invoice.save();
  }

  static async finalize(id: string, data: InvoiceUpdateInput, finalizedBy?: string) {
    const invoice = await this.requireInvoice(id);
    if (invoice.status !== 'approved') {
      throw new ConflictError('Only approved invoices can be finalized');
    }

    invoice.status = 'finalized';
    invoice.finalizedBy = finalizedBy as any;
    invoice.finalizedAt = new Date();
    invoice.finalizationNotes = data.notes;
    return invoice.save();
  }

  static async getFinalizedPdf(id: string) {
    const invoice = await this.requireInvoice(id);
    if (invoice.status !== 'finalized') {
      throw new ConflictError('Only finalized invoices can be downloaded as PDF');
    }
    return {
      invoice,
      content: await renderFinalizedInvoicePdf(invoice),
    };
  }

  private static async requireInvoice(id: string) {
    const invoice = await InvoiceModel.findOne({ _id: id, isDeleted: false });
    if (!invoice) throw new NotFoundError('Invoice not found');
    return invoice;
  }
}
