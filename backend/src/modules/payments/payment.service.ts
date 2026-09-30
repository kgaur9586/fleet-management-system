import { ClientSession, FilterQuery, Types } from 'mongoose';
import { ConflictError, NotFoundError } from '../../common/errors';
import { withTransaction } from '../../common/transaction';
import { InvoiceModel, IInvoice } from '../invoices/invoice.model';
import { PaymentModel, IPayment } from './payment.model';

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

interface CreatePaymentInput {
  invoiceId: string;
  firmId: string;
  amount: number;
  paymentDate: Date;
  paymentMethod: IPayment['paymentMethod'];
  referenceNumber?: string;
  status?: IPayment['status'];
  notes?: string;
  createdBy: string;
}

interface PaymentQuery {
  page?: number;
  limit?: number;
  invoiceId?: string;
  firmId?: string;
  status?: IPayment['status'];
  startDate?: string;
  endDate?: string;
}

export class PaymentService {
  static async create(data: CreatePaymentInput) {
    const invoice = await InvoiceModel.findOne({ _id: data.invoiceId, isDeleted: false });
    if (!invoice) throw new NotFoundError('Invoice not found');
    if (invoice.status !== 'finalized') {
      throw new ConflictError('Payments can only be recorded against finalized invoices');
    }
    if (String(invoice.firmId) !== String(data.firmId)) {
      throw new ConflictError('Payment firm does not match the invoice firm');
    }

    const paymentStatus = data.status ?? 'received';
    const received = await this.getReceivedAmount(String(invoice._id));
    if (paymentStatus === 'received' && round2(received + data.amount) > round2(invoice.summary.totalAmount)) {
      throw new ConflictError('Payment exceeds the invoice outstanding amount');
    }

    return withTransaction(async (session) => {
      const [payment] = await PaymentModel.create([{ ...data, status: paymentStatus }], { session });
      await this.syncInvoiceSettlement(String(invoice._id), session);
      return payment;
    });
  }

  /** Recomputes the invoice's denormalised settlement fields from its received payments. */
  private static async syncInvoiceSettlement(invoiceId: string, session?: ClientSession) {
    const invoice = await InvoiceModel.findById(invoiceId).session(session ?? null);
    if (!invoice) throw new NotFoundError('Invoice not found');

    const totalPaid = round2(await this.getReceivedAmount(invoiceId, session));
    const outstandingAmount = Math.max(0, round2(invoice.summary.totalAmount - totalPaid));

    invoice.totalPaid = totalPaid;
    invoice.outstandingAmount = outstandingAmount;
    invoice.paymentStatus = outstandingAmount === 0 && totalPaid > 0 ? 'paid' : totalPaid > 0 ? 'partially_paid' : 'unpaid';
    await invoice.save({ session });
    return invoice;
  }

  static async list(options: PaymentQuery) {
    const { page = 1, limit = 20, invoiceId, firmId, status, startDate, endDate } = options;
    const query: FilterQuery<IPayment> = {};
    if (invoiceId) query.invoiceId = invoiceId;
    if (firmId) query.firmId = firmId;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.paymentDate = {};
      if (startDate) query.paymentDate.$gte = new Date(startDate);
      if (endDate) query.paymentDate.$lt = new Date(`${endDate}T23:59:59.999Z`);
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      PaymentModel.find(query)
        .sort({ paymentDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('invoiceId', 'invoiceNumber month year status summary.totalAmount')
        .populate('firmId', 'name billingName'),
      PaymentModel.countDocuments(query),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  static async summary(options: { firmId?: string; month?: number; year?: number }) {
    const invoiceQuery: FilterQuery<IInvoice> = { status: 'finalized', isDeleted: false };
    if (options.firmId) invoiceQuery.firmId = options.firmId;
    if (options.month) invoiceQuery.month = options.month;
    if (options.year) invoiceQuery.year = options.year;

    const invoices = await InvoiceModel.find(invoiceQuery).select('_id summary.totalAmount totalPaid outstandingAmount');
    const invoiceIds = invoices.map((invoice) => invoice._id);
    const history = await PaymentModel.find({ invoiceId: { $in: invoiceIds } })
      .sort({ paymentDate: -1, createdAt: -1 })
      .populate('invoiceId', 'invoiceNumber month year');

    const totalInvoiced = invoices.reduce((total, invoice) => total + Number(invoice.summary.totalAmount || 0), 0);
    const totalReceived = invoices.reduce((total, invoice) => total + Number(invoice.totalPaid || 0), 0);
    const outstandingAmount = invoices.reduce((total, invoice) => total + Number(invoice.outstandingAmount || 0), 0);

    return {
      firmId: options.firmId,
      month: options.month,
      year: options.year,
      totalInvoiced: round2(totalInvoiced),
      totalReceived: round2(totalReceived),
      outstandingAmount: round2(outstandingAmount),
      paymentHistory: history,
    };
  }

  // Aggregation does not cast strings to ObjectId, so the id must be converted explicitly.
  private static async getReceivedAmount(invoiceId: string, session?: ClientSession) {
    const result = await PaymentModel.aggregate([
      { $match: { invoiceId: new Types.ObjectId(invoiceId), status: 'received' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]).session(session ?? null);
    return Number(result[0]?.total || 0);
  }
}
