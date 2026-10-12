import mongoose from 'mongoose';
import { InvoiceModel } from '../invoices/invoice.model';
import { ExpenseModel } from '../expenses/expense.model';
import { PaymentModel } from '../payments/payment.model';
import { VehicleModel } from '../vehicles/vehicle.model';
import { FirmModel } from '../firms/firm.model';
import { TripModel } from '../trips/trip.model';
import { VehicleDocumentModel } from '../documents/vehicle-document.model';
import { getVehicleDocumentStatus } from '../documents/vehicle-document.status';
import { SalaryRecordModel } from '../salary/salary-record.model';
import { toNumber, round2 } from '../../common/decimal';
import { NotFoundError } from '../../common/errors';

const monthRange = (year: number, month: number) => ({
  $gte: new Date(Date.UTC(year, month - 1, 1)),
  $lt: new Date(Date.UTC(year, month, 1)),
});

export class ReportService {
  /** RPT-01: vehicle-wise billed revenue vs actual expenses for a month, with the resulting margin. */
  static async vehicleRevenue(month: number, year: number) {
    const [revenueRows, expenseRows, vehicles] = await Promise.all([
      InvoiceModel.aggregate([
        { $match: { isDeleted: false, status: 'finalized', month, year } },
        { $group: { _id: '$vehicleId', revenue: { $sum: '$summary.totalAmount' }, tripCount: { $sum: '$summary.tripCount' } } },
      ]),
      ExpenseModel.aggregate([
        { $match: { isDeleted: false, date: monthRange(year, month), vehicle: { $ne: null } } },
        { $group: { _id: '$vehicle', expenses: { $sum: '$amount' } } },
      ]),
      VehicleModel.find({ isDeleted: false }).select('registrationNumber vehicleType capacity').lean(),
    ]);

    const vehicleById = new Map(vehicles.map((vehicle) => [String(vehicle._id), vehicle]));
    const revenueById = new Map(revenueRows.map((row) => [String(row._id), row]));
    const expenseById = new Map(expenseRows.map((row) => [String(row._id), row]));
    const vehicleIds = new Set([...revenueById.keys(), ...expenseById.keys()]);

    const rows = [...vehicleIds].map((vehicleId) => {
      const vehicle = vehicleById.get(vehicleId);
      const revenue = revenueById.get(vehicleId)?.revenue ?? 0;
      const expenses = expenseById.get(vehicleId)?.expenses ?? 0;
      return {
        vehicleId,
        registrationNumber: vehicle?.registrationNumber ?? 'Deleted vehicle',
        vehicleType: vehicle?.vehicleType ?? null,
        tripCount: revenueById.get(vehicleId)?.tripCount ?? 0,
        revenue,
        expenses,
        margin: Math.round((revenue - expenses) * 100) / 100,
      };
    });
    rows.sort((a, b) => b.revenue - a.revenue);
    return rows;
  }

  /** RPT-02: firm-wise totals billed, received, and outstanding for a month. */
  static async firmBilling(month: number, year: number) {
    const rows = await InvoiceModel.aggregate([
      { $match: { isDeleted: false, status: 'finalized', month, year } },
      {
        $group: {
          _id: '$firmId',
          totalBilled: { $sum: '$summary.totalAmount' },
          totalReceived: { $sum: '$totalPaid' },
          totalOutstanding: { $sum: '$outstandingAmount' },
          invoiceCount: { $sum: 1 },
        },
      },
      { $lookup: { from: 'firms', localField: '_id', foreignField: '_id', as: 'firm' } },
      { $unwind: { path: '$firm', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          firmId: '$_id',
          firmName: { $ifNull: ['$firm.billingName', { $ifNull: ['$firm.name', 'Deleted firm'] }] },
          invoiceCount: 1,
          totalBilled: 1,
          totalReceived: 1,
          totalOutstanding: 1,
        },
      },
      { $sort: { totalBilled: -1 } },
    ]);
    return rows;
  }

  /** RPT-03: expense total per category for a month, plus the grand total. */
  static async expenseSummary(month: number, year: number) {
    const rows = await ExpenseModel.aggregate([
      { $match: { isDeleted: false, date: monthRange(year, month) } },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $project: { _id: 0, category: '$_id', total: 1, count: 1 } },
      { $sort: { total: -1 } },
    ]);
    const grandTotal = Math.round(rows.reduce((sum, row) => sum + row.total, 0) * 100) / 100;
    return { categories: rows, grandTotal };
  }

  /** RPT-04: filterable register of every bill with its lifecycle and settlement state. */
  static async billRegister(filters: { month?: number; year?: number; firmId?: string; status?: string }) {
    const match: Record<string, unknown> = { isDeleted: false };
    if (filters.month) match.month = filters.month;
    if (filters.year) match.year = filters.year;
    if (filters.firmId) match.firmId = new mongoose.Types.ObjectId(filters.firmId);
    if (filters.status) match.status = filters.status;

    const rows = await InvoiceModel.find(match)
      .select('invoiceNumber bookNumber firmId vehicleId month year status paymentStatus summary.totalAmount totalPaid outstandingAmount generatedAt finalizedAt')
      .populate('firmId', 'name billingName')
      .populate('vehicleId', 'registrationNumber')
      .sort({ year: -1, month: -1, createdAt: -1 })
      .lean();

    return rows.map((row) => {
      const firm = row.firmId as unknown as { name?: string; billingName?: string } | null;
      const vehicle = row.vehicleId as unknown as { registrationNumber?: string } | null;
      return {
        invoiceId: String(row._id),
        invoiceNumber: row.invoiceNumber ?? null,
        bookNumber: row.bookNumber ?? null,
        firmName: firm?.billingName ?? firm?.name ?? 'Deleted firm',
        registrationNumber: vehicle?.registrationNumber ?? 'Deleted vehicle',
        month: row.month,
        year: row.year,
        status: row.status,
        paymentStatus: row.paymentStatus,
        totalAmount: row.summary?.totalAmount ?? 0,
        totalPaid: row.totalPaid ?? 0,
        outstandingAmount: row.outstandingAmount ?? 0,
        generatedAt: row.generatedAt,
        finalizedAt: row.finalizedAt ?? null,
      };
    });
  }

  /** RPT-05: every bill raised to a firm plus its full payment history and running outstanding total. */
  static async firmReceivables(firmId: string) {
    const firm = await FirmModel.findOne({ _id: firmId, isDeleted: false }).lean();
    if (!firm) throw new NotFoundError('Firm not found');

    const invoices = await InvoiceModel.find({ firmId, isDeleted: false, status: 'finalized' })
      .select('invoiceNumber bookNumber vehicleId month year summary.totalAmount totalPaid outstandingAmount paymentStatus finalizedAt')
      .populate('vehicleId', 'registrationNumber')
      .sort({ year: -1, month: -1 })
      .lean();

    const invoiceIds = invoices.map((invoice) => invoice._id);
    const payments = await PaymentModel.find({ invoiceId: { $in: invoiceIds }, status: 'received' })
      .sort({ paymentDate: -1 })
      .lean();

    const totalBilled = Math.round(invoices.reduce((sum, invoice) => sum + (invoice.summary?.totalAmount ?? 0), 0) * 100) / 100;
    const totalReceived = Math.round(invoices.reduce((sum, invoice) => sum + (invoice.totalPaid ?? 0), 0) * 100) / 100;
    const totalOutstanding = Math.round(invoices.reduce((sum, invoice) => sum + (invoice.outstandingAmount ?? 0), 0) * 100) / 100;

    return {
      firm: { _id: String(firm._id), name: firm.billingName ?? firm.name },
      totals: { totalBilled, totalReceived, totalOutstanding },
      invoices: invoices.map((invoice) => ({
        invoiceId: String(invoice._id),
        invoiceNumber: invoice.invoiceNumber ?? null,
        bookNumber: invoice.bookNumber ?? null,
        registrationNumber: (invoice.vehicleId as unknown as { registrationNumber?: string } | null)?.registrationNumber ?? 'Deleted vehicle',
        month: invoice.month,
        year: invoice.year,
        totalAmount: invoice.summary?.totalAmount ?? 0,
        totalPaid: invoice.totalPaid ?? 0,
        outstandingAmount: invoice.outstandingAmount ?? 0,
        paymentStatus: invoice.paymentStatus,
        finalizedAt: invoice.finalizedAt ?? null,
      })),
      payments: payments.map((payment) => ({
        paymentId: String(payment._id),
        invoiceId: String(payment.invoiceId),
        amount: payment.amount,
        paymentDate: payment.paymentDate,
        paymentMethod: payment.paymentMethod,
        referenceNumber: payment.referenceNumber ?? null,
      })),
    };
  }

  /** RPT-06: trip count and total KM per vehicle/firm for a month. */
  static async tripCountAndKm(month: number, year: number) {
    const rows = await TripModel.aggregate([
      { $match: { isDeleted: false, tripDate: monthRange(year, month) } },
      { $group: { _id: { vehicleId: '$vehicleId', firmId: '$firmId' }, tripCount: { $sum: 1 }, totalKm: { $sum: '$totalKm' } } },
      { $lookup: { from: 'vehicles', localField: '_id.vehicleId', foreignField: '_id', as: 'vehicle' } },
      { $unwind: { path: '$vehicle', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'firms', localField: '_id.firmId', foreignField: '_id', as: 'firm' } },
      { $unwind: { path: '$firm', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          vehicleId: '$_id.vehicleId',
          firmId: '$_id.firmId',
          registrationNumber: { $ifNull: ['$vehicle.registrationNumber', 'Deleted vehicle'] },
          firmName: { $ifNull: ['$firm.billingName', { $ifNull: ['$firm.name', 'Deleted firm'] }] },
          tripCount: 1,
          totalKm: 1,
        },
      },
      { $sort: { totalKm: -1 } },
    ]);
    return rows;
  }

  /** RPT-07: actual fuel expense vs contractual (billed) fuel reimbursement per vehicle for a month. */
  static async fuelVsHsd(month: number, year: number) {
    const [actualRows, billedRows, vehicles] = await Promise.all([
      ExpenseModel.aggregate([
        { $match: { isDeleted: false, category: 'fuel', date: monthRange(year, month), vehicle: { $ne: null } } },
        { $group: { _id: '$vehicle', actualFuelSpend: { $sum: '$amount' }, litresPurchased: { $sum: { $ifNull: ['$fuelDetails.litresPurchased', 0] } } } },
      ]),
      InvoiceModel.aggregate([
        { $match: { isDeleted: false, status: 'finalized', month, year } },
        { $group: { _id: '$vehicleId', billedFuelAmount: { $sum: '$summary.fuelAmount' } } },
      ]),
      VehicleModel.find({ isDeleted: false }).select('registrationNumber vehicleType').lean(),
    ]);

    const vehicleById = new Map(vehicles.map((vehicle) => [String(vehicle._id), vehicle]));
    const actualById = new Map(actualRows.map((row) => [String(row._id), row]));
    const billedById = new Map(billedRows.map((row) => [String(row._id), row]));
    const vehicleIds = new Set([...actualById.keys(), ...billedById.keys()]);

    const rows = [...vehicleIds].map((vehicleId) => {
      const vehicle = vehicleById.get(vehicleId);
      const actualFuelSpend = actualById.get(vehicleId)?.actualFuelSpend ?? 0;
      const litresPurchased = actualById.get(vehicleId)?.litresPurchased ?? 0;
      const billedFuelAmount = billedById.get(vehicleId)?.billedFuelAmount ?? 0;
      return {
        vehicleId,
        registrationNumber: vehicle?.registrationNumber ?? 'Deleted vehicle',
        vehicleType: vehicle?.vehicleType ?? null,
        litresPurchased,
        actualFuelSpend,
        billedFuelAmount,
        variance: round2(billedFuelAmount - actualFuelSpend),
      };
    });
    rows.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
    return rows;
  }

  /** RPT-08: actual trip toll paid vs billed toll per vehicle for a month. */
  static async tollVariance(month: number, year: number) {
    const [actualRows, billedRows, vehicles] = await Promise.all([
      TripModel.aggregate([
        { $match: { isDeleted: false, tripDate: monthRange(year, month) } },
        { $group: { _id: '$vehicleId', actualToll: { $sum: { $toDouble: '$toll.amount' } } } },
      ]),
      InvoiceModel.aggregate([
        { $match: { isDeleted: false, status: 'finalized', month, year } },
        { $group: { _id: '$vehicleId', billedToll: { $sum: '$summary.tollAmount' } } },
      ]),
      VehicleModel.find({ isDeleted: false }).select('registrationNumber vehicleType').lean(),
    ]);

    const vehicleById = new Map(vehicles.map((vehicle) => [String(vehicle._id), vehicle]));
    const actualById = new Map(actualRows.map((row) => [String(row._id), row]));
    const billedById = new Map(billedRows.map((row) => [String(row._id), row]));
    const vehicleIds = new Set([...actualById.keys(), ...billedById.keys()]);

    const rows = [...vehicleIds].map((vehicleId) => {
      const vehicle = vehicleById.get(vehicleId);
      const actualToll = round2(actualById.get(vehicleId)?.actualToll ?? 0);
      const billedToll = billedById.get(vehicleId)?.billedToll ?? 0;
      return {
        vehicleId,
        registrationNumber: vehicle?.registrationNumber ?? 'Deleted vehicle',
        vehicleType: vehicle?.vehicleType ?? null,
        actualToll,
        billedToll,
        variance: round2(billedToll - actualToll),
      };
    });
    rows.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
    return rows;
  }

  /** RPT-09: maintenance/service expense history, optionally filtered by vehicle and date range. */
  static async maintenanceHistory(filters: { vehicleId?: string; startDate?: Date; endDate?: Date }) {
    const match: Record<string, unknown> = { isDeleted: false, category: { $in: ['maintenance', 'service'] } };
    if (filters.vehicleId) match.vehicle = new mongoose.Types.ObjectId(filters.vehicleId);
    if (filters.startDate || filters.endDate) {
      const dateMatch: Record<string, Date> = {};
      if (filters.startDate) dateMatch.$gte = filters.startDate;
      if (filters.endDate) dateMatch.$lte = filters.endDate;
      match.date = dateMatch;
    }

    const rows = await ExpenseModel.find(match).populate('vehicle', 'registrationNumber').sort({ date: -1 }).lean();
    return rows.map((row) => ({
      expenseId: String(row._id),
      date: row.date,
      registrationNumber: (row.vehicle as unknown as { registrationNumber?: string } | null)?.registrationNumber ?? 'Not linked',
      category: row.category,
      type: row.category === 'maintenance' ? row.maintenanceDetails?.maintenanceType : row.serviceDetails?.serviceType,
      vendor: row.vendor ?? row.maintenanceDetails?.workshopName ?? row.serviceDetails?.workshopName ?? null,
      amount: row.amount,
      description: row.description,
    }));
  }

  /** RPT-10: vehicle document expiry status, optionally filtered by vehicle and document type. */
  static async documentExpiry(filters: { vehicleId?: string; documentType?: string }) {
    const match: Record<string, unknown> = {};
    if (filters.vehicleId) match.vehicleId = new mongoose.Types.ObjectId(filters.vehicleId);
    if (filters.documentType) match.documentType = filters.documentType;

    const rows = await VehicleDocumentModel.find(match).populate('vehicleId', 'registrationNumber').sort({ expiryDate: 1 }).lean();
    const now = new Date();
    return rows.map((row) => {
      const expiryDate = new Date(row.expiryDate);
      const daysToExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      return {
        documentId: String(row._id),
        registrationNumber: (row.vehicleId as unknown as { registrationNumber?: string } | null)?.registrationNumber ?? 'Deleted vehicle',
        documentType: row.documentType,
        documentNumber: row.documentNumber ?? null,
        expiryDate: row.expiryDate,
        daysToExpiry,
        isExpired: daysToExpiry < 0,
        status: getVehicleDocumentStatus(expiryDate, now),
      };
    });
  }

  /** RPT-11: driver wage summary, optionally filtered by driver and/or month/year. */
  static async driverWageSummary(filters: { driverId?: string; month?: number; year?: number }) {
    const match: Record<string, unknown> = {};
    if (filters.driverId) match.driverId = new mongoose.Types.ObjectId(filters.driverId);
    if (filters.month) match.month = filters.month;
    if (filters.year) match.year = filters.year;

    const rows = await SalaryRecordModel.find(match).populate('driverId', 'name mobile').sort({ year: -1, month: -1 }).lean();
    return rows.map((row) => ({
      salaryRecordId: String(row._id),
      driverName: (row.driverId as unknown as { name?: string } | null)?.name ?? 'Deleted driver',
      month: row.month,
      year: row.year,
      daysWorked: row.daysWorked,
      grossWages: toNumber(row.grossWages),
      advanceDeduction: toNumber(row.advanceDeduction),
      otherDeductions: toNumber(row.otherDeductions),
      netPayable: toNumber(row.netPayable),
      paymentStatus: row.paymentStatus,
      paidOn: row.paidOn ?? null,
    }));
  }
}
