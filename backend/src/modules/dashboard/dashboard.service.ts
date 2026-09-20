import { FilterQuery } from 'mongoose';
import { DriverModel } from '../drivers/driver.model';
import { ExpenseModel, IExpense } from '../expenses/expense.model';
import { InvoiceModel, IInvoice } from '../invoices/invoice.model';
import { PaymentModel, IPayment } from '../payments/payment.model';
import { TripModel } from '../trips/trip.model';
import { VehicleModel } from '../vehicles/vehicle.model';
import { VehicleDocumentModel } from '../documents/vehicle-document.model';

const dayRange = (date: Date) => {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return { $gte: start, $lt: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
};

const monthRange = (year: number, month: number) => ({
  $gte: new Date(Date.UTC(year, month - 1, 1)),
  $lt: new Date(Date.UTC(year, month, 1)),
});

const mapVehicleTotals = (rows: Array<{
  _id: unknown;
  total: number;
  totalTrips: number;
  totalKm: number;
  contractualFuelQuantity: number;
  fuelReimbursement: number;
  hiringUnits: number;
  hiringAmount: number;
  billableToll: number;
  otherBillableAmount: number;
  contractualAverages?: string[];
  fuelRates?: string[];
  vehicle?: { registrationNumber?: string; vehicleType?: string }[];
}>) => rows.map((row) => ({
  vehicleId: String(row._id),
  registrationNumber: row.vehicle?.[0]?.registrationNumber ?? 'Unknown vehicle',
  vehicleType: row.vehicle?.[0]?.vehicleType ?? null,
  totalTrips: Number(row.totalTrips || 0),
  totalKm: Number(row.totalKm || 0),
  contractualAverage: [...new Set(row.contractualAverages ?? [])].join(', ') || '-',
  contractualFuelQuantity: Number(row.contractualFuelQuantity || 0),
  fuelRate: [...new Set(row.fuelRates ?? [])].join(', ') || '-',
  fuelReimbursement: Number(row.fuelReimbursement || 0),
  hiringUnits: Number(row.hiringUnits || 0),
  hiringAmount: Number(row.hiringAmount || 0),
  billableToll: Number(row.billableToll || 0),
  otherBillableAmount: Number(row.otherBillableAmount || 0),
  total: Number(row.total || 0),
  count: Number(row.totalTrips || 0),
}));

export class DashboardService {
  static async getSnapshot(month?: number, year?: number) {
    const now = new Date();
    const selectedMonth = month ?? now.getUTCMonth() + 1;
    const selectedYear = year ?? now.getUTCFullYear();
    const currentMonth = monthRange(selectedYear, selectedMonth);
    const today = dayRange(now);
    const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const finalizedInvoiceQuery: FilterQuery<IInvoice> = {
      isDeleted: false,
      status: 'finalized',
      month: selectedMonth,
      year: selectedYear,
    };
    const paymentMonthQuery: FilterQuery<IPayment> = {
      status: 'received',
      paymentDate: currentMonth,
    };
    const expenseMonthQuery: FilterQuery<IExpense> = {
      isDeleted: false,
      date: currentMonth,
    };

    const [
      totalVehicles,
      activeVehicles,
      totalDrivers,
      tripsToday,
      tripsThisMonth,
      billingTotals,
      monthlyPayments,
      monthlyExpenses,
      vehicleBilling,
      vehicleExpenses,
      outstandingRows,
      expiringDocuments,
      expiredDocuments,
    ] = await Promise.all([
      VehicleModel.countDocuments({ isDeleted: false }),
      VehicleModel.countDocuments({ isDeleted: false, isActive: true }),
      DriverModel.countDocuments({ isDeleted: false }),
      TripModel.countDocuments({ isDeleted: false, operationalStatus: { $ne: 'cancelled' }, tripDate: today }),
      TripModel.countDocuments({ isDeleted: false, operationalStatus: { $ne: 'cancelled' }, tripDate: currentMonth }),
      InvoiceModel.aggregate([
        { $match: finalizedInvoiceQuery },
        { $group: { _id: null, total: { $sum: '$summary.totalAmount' }, count: { $sum: 1 } } },
      ]),
      PaymentModel.aggregate([
        { $match: paymentMonthQuery },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      ExpenseModel.aggregate([
        { $match: expenseMonthQuery },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      InvoiceModel.aggregate([
        { $match: finalizedInvoiceQuery },
        { $unwind: '$lineItems' },
        { $group: {
          _id: '$vehicleId',
          totalTrips: { $sum: 1 },
          totalKm: { $sum: { $toDouble: '$lineItems.snapshot.distanceKm' } },
          contractualAverages: { $addToSet: '$lineItems.snapshot.contractualAverage' },
          contractualFuelQuantity: { $sum: { $toDouble: '$lineItems.snapshot.fuelLitres' } },
          fuelRates: { $addToSet: '$lineItems.snapshot.fuelRate' },
          fuelReimbursement: { $sum: { $toDouble: '$lineItems.snapshot.fuelAmount' } },
          hiringUnits: { $sum: { $toDouble: '$lineItems.snapshot.hiringMultiplier' } },
          hiringAmount: { $sum: { $toDouble: '$lineItems.snapshot.hiringAmount' } },
          billableToll: { $sum: { $toDouble: '$lineItems.snapshot.tollAmount' } },
          otherBillableAmount: { $sum: { $toDouble: '$lineItems.snapshot.otherBillableAmount' } },
          total: { $sum: { $toDouble: '$lineItems.snapshot.totalAmount' } },
        } },
        { $lookup: { from: 'vehicles', localField: '_id', foreignField: '_id', as: 'vehicle' } },
        { $sort: { total: -1 } },
      ]),
      ExpenseModel.aggregate([
        { $match: expenseMonthQuery },
        { $group: { _id: '$vehicle', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $lookup: { from: 'vehicles', localField: '_id', foreignField: '_id', as: 'vehicle' } },
        { $sort: { total: -1 } },
      ]),
      InvoiceModel.aggregate([
        { $match: { isDeleted: false, status: 'finalized' } },
        { $lookup: { from: 'payments', let: { invoiceId: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$invoiceId', '$$invoiceId'] }, { $eq: ['$status', 'received'] }] } } }, { $group: { _id: null, total: { $sum: '$amount' } } }], as: 'received' } },
        { $project: { invoiceNumber: 1, firmId: 1, total: '$summary.totalAmount', received: { $ifNull: [{ $arrayElemAt: ['$received.total', 0] }, 0] } } },
        { $addFields: { outstanding: { $max: [{ $subtract: ['$total', '$received'] }, 0] } } },
        { $match: { outstanding: { $gt: 0 } } },
        { $group: { _id: null, amount: { $sum: '$outstanding' }, count: { $sum: 1 } } },
      ]),
      VehicleDocumentModel.aggregate([
        { $match: { expiryDate: { $gte: now, $lte: soon } } },
        { $lookup: { from: 'vehicles', localField: 'vehicleId', foreignField: '_id', as: 'vehicle' } },
        { $project: { _id: 1, vehicleId: 1, documentType: 1, documentNumber: 1, expiryDate: 1, vehicle: { $arrayElemAt: ['$vehicle', 0] } } },
        { $sort: { expiryDate: 1 } },
      ]),
      VehicleDocumentModel.aggregate([
        { $match: { expiryDate: { $lt: now } } },
        { $lookup: { from: 'vehicles', localField: 'vehicleId', foreignField: '_id', as: 'vehicle' } },
        { $project: { _id: 1, vehicleId: 1, documentType: 1, documentNumber: 1, expiryDate: 1, vehicle: { $arrayElemAt: ['$vehicle', 0] } } },
        { $sort: { expiryDate: 1 } },
      ]),
    ]);

    const billingTotal = Number(billingTotals[0]?.total || 0);
    const receivedTotal = Number(monthlyPayments[0]?.total || 0);
    const expenseTotal = Number(monthlyExpenses[0]?.total || 0);

    return {
      period: { month: selectedMonth, year: selectedYear },
      fleet: {
        totalVehicles,
        activeVehicles,
        inactiveVehicles: totalVehicles - activeVehicles,
        totalDrivers,
      },
      operations: { tripsToday, tripsThisMonth },
      finance: {
        monthlyBilling: billingTotal,
        monthlyPaymentsReceived: receivedTotal,
        outstandingInvoices: {
          count: Number(outstandingRows[0]?.count || 0),
          amount: Number(outstandingRows[0]?.amount || 0),
        },
        monthlyExpenses: expenseTotal,
      },
      vehicleBilling: mapVehicleTotals(vehicleBilling),
      vehicleExpenses: mapVehicleTotals(vehicleExpenses),
      documentAlerts: {
        expiringSoon: expiringDocuments.map((document) => ({
          documentId: String(document._id),
          vehicleId: String(document.vehicleId),
          registrationNumber: document.vehicle?.registrationNumber ?? 'Unknown vehicle',
          documentType: document.documentType,
          documentNumber: document.documentNumber,
          expiryDate: document.expiryDate,
        })),
        expired: expiredDocuments.map((document) => ({
          documentId: String(document._id),
          vehicleId: String(document.vehicleId),
          registrationNumber: document.vehicle?.registrationNumber ?? 'Unknown vehicle',
          documentType: document.documentType,
          documentNumber: document.documentNumber,
          expiryDate: document.expiryDate,
        })),
      },
      source: {
        billingInvoiceCount: Number(billingTotals[0]?.count || 0),
        paymentCount: Number(monthlyPayments[0]?.count || 0),
        expenseCount: Number(monthlyExpenses[0]?.count || 0),
      },
    };
  }
}
