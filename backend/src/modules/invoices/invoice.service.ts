import crypto from 'crypto';
import { FilterQuery } from 'mongoose';
import { BadRequestError, ConflictError, NotFoundError } from '../../common/errors';
import { withTransaction } from '../../common/transaction';
import { ContractModel } from '../contracts/contract.model';
import { ContractVersionModel } from '../contracts/contract-version.model';
import { VehicleModel } from '../vehicles/vehicle.model';
import { FirmModel } from '../firms/firm.model';
import { DriverModel } from '../drivers/driver.model';
import { RouteModel } from '../routes/route.model';
import { TripModel } from '../trips/trip.model';
import { CompanyModel } from '../companies/company.model';
import { HsdRateService } from '../hsd-rates/hsd-rate.service';
import { AuditService } from '../audit/audit.service';
import { calculateTripBilling } from '../billing/billing-engine';
import { InvoiceModel, IInvoice } from './invoice.model';
import { invoiceCompanySnapshot } from './invoice.config';
import { buildBillNumber } from './invoice.numbering';
import { renderFinalizedInvoicePdf } from './invoice.pdf';

interface InvoiceGenerateInput {
  firmId: string;
  vehicleId: string;
  month: number;
  year: number;
  notes?: string;
  bookNumber?: string;
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

const joinAddress = (address?: { street?: string; city?: string; state?: string; pinCode?: string } | null) =>
  address ? [address.street, address.city, address.state, address.pinCode].filter(Boolean).join(', ') || undefined : undefined;

export class InvoiceService {
  /** Shared by generate() and regenerate(): turns a set of completed trips into billed line items. */
  private static async buildLineItemsFromTrips(trips: InstanceType<typeof TripModel>[]) {
    const lineItems: any[] = [];
    const summary = {
      vehicleCount: 1,
      tripCount: 0,
      totalDistanceKm: 0,
      fuelAmount: 0,
      hiringAmount: 0,
      tollAmount: 0,
      otherBillableAmount: 0,
      courierAmount: 0,
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

      const billingRate = (await HsdRateService.resolveRateForDate(trip.tripDate)) ?? normalizeDecimal((version as any).billingRules?.fuelRatePerLitre);
      const tollAmount = trip.toll && trip.toll.amount ? normalizeDecimal((trip.toll as any).amount) : 0;
      const tripHiringCharge = trip.hiringChargePerRound ?? trip.rateSnapshot?.hiringChargePerRound;
      const tripMultiplier = trip.hiringMultiplier ?? trip.rateSnapshot?.hiringMultiplier;
      const courierAmount = trip.courierCharges;

      const result = calculateTripBilling(
        {
          tripId: String(trip._id),
          distanceKm: Number(trip.totalKm),
          tollAmount,
          hiringMultiplier: tripMultiplier != null ? String(tripMultiplier) : undefined,
          courierAmount: courierAmount != null ? String(courierAmount) : undefined,
        },
        {
          vehicleId: String(vehicle._id),
          capacity: Number(vehicle.capacity),
          averageKmPerLitre: trip.rateSnapshot?.averageKmPerLitre,
          baseHiringRatePerRound: tripHiringCharge != null ? String(tripHiringCharge) : undefined,
        },
        { contractId: String(contract._id) },
        { contractVersionId: String(version._id), version: (version as any).version },
        (version as any).billingRules,
        trip.rateSnapshot?.fuelRatePerLitre ?? billingRate
      );

      lineItems.push({
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
          courierAmount: result.courierAmount,
        },
        vehicleSnapshot: {
          registrationNumber: vehicle.registrationNumber,
          vehicleType: vehicle.vehicleType,
          capacity: vehicle.capacity,
        },
        snapshot: {
          ...result,
          baseHiringRateSource: trip.hiringChargePerRound != null
            ? 'trip'
            : trip.rateSnapshot?.hiringChargePerRound != null
              ? trip.rateSnapshot.sources?.hiringChargePerRound ?? 'trip_snapshot'
              : 'contract_capacity',
        },
        createdAt: new Date(),
      });

      summary.tripCount += 1;
      summary.totalDistanceKm += Number(result.distanceKm || 0);
      summary.fuelAmount += Number(result.fuelAmount || 0);
      summary.hiringAmount += Number(result.hiringAmount || 0);
      summary.tollAmount += Number(result.tollAmount || 0);
      summary.otherBillableAmount += Number(result.otherBillableAmount || 0);
      summary.courierAmount += Number(result.courierAmount || 0);
      summary.totalAmount += Number(result.totalAmount || 0);
    }

    return { lineItems, summary };
  }

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

    const { lineItems, summary } = await this.buildLineItemsFromTrips(trips);

    const tripIds = trips.map((trip) => String(trip._id));
    const companySnapshot = await this.resolveCompanySnapshot(firm.companyId ? String(firm.companyId) : undefined);
    const invoiceId = await withTransaction(async (session) => {
      const [created] = await InvoiceModel.create(
        [
          {
            firmId,
            vehicleId,
            month,
            year,
            generatedBy,
            notes: data.notes,
            status: 'draft',
            bookNumber: data.bookNumber,
            companySnapshot,
            firmSnapshot: {
              name: firm.name,
              billingName: firm.billingName,
              billPrefix: firm.billPrefix,
              address: joinAddress(firm.address),
              phone: firm.contactDetails?.mobile,
              gstNumber: firm.gstNumber,
              bankDetails: firm.bankDetails,
            },
            vehicleSnapshot: {
              registrationNumber: selectedVehicle.registrationNumber,
              vehicleType: selectedVehicle.vehicleType,
              capacity: selectedVehicle.capacity,
            },
            generatedAt: new Date(),
            lineItems,
            summary,
            paymentStatus: 'unpaid',
            totalPaid: 0,
            outstandingAmount: 0,
            duplicateTripGuard: {
              tripCount: tripIds.length,
              tripIds,
              hash: crypto.createHash('sha256').update([...tripIds].sort().join(',')).digest('hex'),
              generatedAt: new Date(),
            },
          },
        ],
        { session }
      );

      await TripModel.updateMany(
        { _id: { $in: trips.map((trip) => trip._id) }, billingInvoiceId: { $exists: false } },
        { $set: { billingInvoiceId: created._id } },
        { session }
      );

      return created._id;
    });

    await AuditService.record({
      action: 'invoice.generated',
      entityType: 'invoice',
      entityId: invoiceId as any,
      userId: generatedBy,
      changes: { after: { tripCount: tripIds.length, grandTotal: summary.totalAmount } },
    });

    return InvoiceModel.findById(invoiceId).populate('firmId', 'name billingName').populate('vehicleId', 'registrationNumber capacity');
  }

  /**
   * Rebuilds a draft invoice's line items from its firm/vehicle/month's currently eligible trips.
   * Use after editing or adding trips post-generation (typically following a reopen).
   */
  static async regenerate(id: string, regeneratedBy?: string) {
    const invoice = await this.requireInvoice(id);
    if (invoice.status !== 'draft') {
      throw new ConflictError('Only draft invoices can be regenerated; reopen a finalized invoice first');
    }

    const trips = await TripModel.find({
      firmId: invoice.firmId,
      vehicleId: invoice.vehicleId,
      tripDate: toDateRange(invoice.year, invoice.month),
      operationalStatus: 'completed',
      isDeleted: false,
      $or: [
        { billingInvoiceId: invoice._id },
        { billingInvoiceId: { $exists: false } },
      ],
    }).sort({ tripDate: 1 });

    const { lineItems, summary } = await this.buildLineItemsFromTrips(trips);
    const tripIds = trips.map((trip) => String(trip._id));

    await withTransaction(async (session) => {
      const includedTripIds = trips.map((trip) => trip._id);
      invoice.lineItems = lineItems;
      invoice.summary = summary as any;
      invoice.duplicateTripGuard = {
        tripCount: tripIds.length,
        tripIds,
        hash: crypto.createHash('sha256').update([...tripIds].sort().join(',')).digest('hex'),
        generatedAt: new Date(),
      };
      invoice.generatedAt = new Date();
      await invoice.save({ session });

      await TripModel.updateMany(
        { billingInvoiceId: invoice._id, _id: { $nin: includedTripIds } },
        { $unset: { billingInvoiceId: '' } },
        { session }
      );
      if (includedTripIds.length) {
        await TripModel.updateMany(
          {
            _id: { $in: includedTripIds },
            $or: [{ billingInvoiceId: invoice._id }, { billingInvoiceId: { $exists: false } }],
          },
          { $set: { billingInvoiceId: invoice._id } },
          { session }
        );
      }
    });

    await AuditService.record({
      action: 'invoice.regenerated',
      entityType: 'invoice',
      entityId: invoice._id as any,
      userId: regeneratedBy,
      changes: { after: { tripCount: tripIds.length, grandTotal: summary.totalAmount } },
    });

    return InvoiceModel.findById(id).populate('firmId', 'name billingName').populate('vehicleId', 'registrationNumber capacity');
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
    let invoice = await this.requireInvoice(id);
    if (invoice.status === 'finalized') {
      throw new ConflictError('A finalized invoice cannot be approved again');
    }
    if (invoice.status === 'approved') {
      return invoice;
    }

    if (invoice.status === 'draft') {
      await this.regenerate(id, approvedBy);
      invoice = await this.requireInvoice(id);
    }
    if (!invoice.lineItems.length) {
      throw new ConflictError('An invoice with no trip lines cannot be approved');
    }

    invoice.status = 'approved';
    invoice.approvedBy = approvedBy as any;
    invoice.approvedAt = new Date();
    invoice.approvalNotes = data.notes;
    const approved = await invoice.save();
    await AuditService.record({
      action: 'invoice.approved',
      entityType: 'invoice',
      entityId: invoice._id as any,
      userId: approvedBy,
    });
    return approved;
  }

  static async finalize(id: string, data: InvoiceUpdateInput, finalizedBy?: string) {
    const invoice = await this.requireInvoice(id);
    if (invoice.status !== 'approved') {
      throw new ConflictError('Only approved invoices can be finalized');
    }

    invoice.invoiceNumber = invoice.invoiceNumber ?? (await this.issueBillNumber(invoice));
    invoice.status = 'finalized';
    invoice.finalizedBy = finalizedBy as any;
    invoice.finalizedAt = new Date();
    invoice.finalizationNotes = data.notes;
    invoice.totalPaid = invoice.totalPaid ?? 0;
    invoice.outstandingAmount = Math.max(0, invoice.summary.totalAmount - invoice.totalPaid);
    invoice.paymentStatus = invoice.outstandingAmount === 0 ? 'paid' : invoice.totalPaid > 0 ? 'partially_paid' : 'unpaid';
    const finalized = await invoice.save();
    await AuditService.record({
      action: 'invoice.finalized',
      entityType: 'invoice',
      entityId: invoice._id as any,
      userId: finalizedBy,
      changes: { after: { invoiceNumber: invoice.invoiceNumber, grandTotal: invoice.summary.totalAmount } },
    });
    return finalized;
  }

  /**
   * Returns a finalized invoice to draft so its trips can be corrected.
   * The bill number is retained in history; settled invoices cannot be reopened.
   */
  static async reopen(id: string, reason: string, reopenedBy?: string) {
    const invoice = await this.requireInvoice(id);
    if (invoice.status !== 'finalized') {
      throw new ConflictError('Only finalized invoices can be reopened');
    }
    if ((invoice.totalPaid ?? 0) > 0) {
      throw new ConflictError('This invoice has recorded payments; reverse them before reopening');
    }

    const previousStatus = invoice.status;
    const previousInvoiceNumber = invoice.invoiceNumber;

    invoice.reopenHistory = [
      ...(invoice.reopenHistory ?? []),
      { reopenedAt: new Date(), reopenedBy: reopenedBy as any, reason, previousStatus, previousInvoiceNumber },
    ];
    invoice.status = 'draft';
    invoice.finalizedAt = undefined;
    invoice.finalizedBy = undefined;
    invoice.approvedAt = undefined;
    invoice.approvedBy = undefined;
    invoice.outstandingAmount = 0;
    invoice.paymentStatus = 'unpaid';

    // Unlink the invoice's trips so edits (or a fresh regenerate) can pick them back up.
    const reopened = await withTransaction(async (session) => {
      await TripModel.updateMany({ billingInvoiceId: invoice._id }, { $unset: { billingInvoiceId: '' } }, { session });
      return invoice.save({ session });
    });
    await AuditService.record({
      action: 'invoice.reopened',
      entityType: 'invoice',
      entityId: invoice._id as any,
      userId: reopenedBy,
      reason,
      changes: { before: { status: previousStatus, invoiceNumber: previousInvoiceNumber }, after: { status: 'draft' } },
    });
    return reopened;
  }

  static async history(id: string) {
    await this.requireInvoice(id);
    return AuditService.listForEntity('invoice', id);
  }

  /** Bill numbers are only issued at finalization, per the agreed billing workflow. */
  private static async issueBillNumber(invoice: IInvoice) {
    const [firm, vehicle] = await Promise.all([
      FirmModel.findById(invoice.firmId).select('billPrefix name').lean(),
      VehicleModel.findById(invoice.vehicleId).select('vehicleNumberPerFirm registrationNumber').lean(),
    ]);

    if (!firm?.billPrefix) {
      throw new ConflictError(`Firm "${firm?.name ?? invoice.firmId}" has no bill prefix configured; set one before finalizing`);
    }
    if (!vehicle?.vehicleNumberPerFirm) {
      throw new ConflictError(
        `Vehicle "${vehicle?.registrationNumber ?? invoice.vehicleId}" has no firm vehicle number configured; set one before finalizing`
      );
    }

    return buildBillNumber({
      billPrefix: firm.billPrefix,
      month: invoice.month,
      year: invoice.year,
      vehicleNumberPerFirm: vehicle.vehicleNumberPerFirm,
    });
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

  /** The factory receiving the bill; falls back to env config for firms not yet linked to a company. */
  private static async resolveCompanySnapshot(companyId?: string) {
    if (!companyId) return invoiceCompanySnapshot;
    const company = await CompanyModel.findOne({ _id: companyId, isDeleted: false }).lean();
    if (!company) return invoiceCompanySnapshot;
    return {
      name: company.legalName || company.name,
      address: joinAddress(company.address),
      phone: company.contactDetails?.mobile,
      email: company.contactDetails?.email,
      taxId: company.gstNumber,
    };
  }

  private static async requireInvoice(id: string) {
    const invoice = await InvoiceModel.findOne({ _id: id, isDeleted: false });
    if (!invoice) throw new NotFoundError('Invoice not found');
    return invoice;
  }
}
