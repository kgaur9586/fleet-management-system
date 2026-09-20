import { FilterQuery } from 'mongoose';
import { ConflictError, NotFoundError } from '../../common/errors';
import { InvoiceModel, IInvoice } from '../invoices/invoice.model';
import { PaymentModel, IPayment } from './payment.model';

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
    if (paymentStatus === 'received' && received + data.amount > invoice.summary.totalAmount) {
      throw new ConflictError('Payment exceeds the invoice outstanding amount');
    }

    return PaymentModel.create({ ...data, status: paymentStatus });
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

    const invoices = await InvoiceModel.find(invoiceQuery).select('_id summary.totalAmount');
    const invoiceIds = invoices.map((invoice) => invoice._id);
    const paymentQuery: FilterQuery<IPayment> = { invoiceId: { $in: invoiceIds }, status: 'received' };
    const [payments, history] = await Promise.all([
      PaymentModel.find(paymentQuery).select('amount'),
      PaymentModel.find({ invoiceId: { $in: invoiceIds } }).sort({ paymentDate: -1, createdAt: -1 }).populate('invoiceId', 'invoiceNumber month year'),
    ]);

    const totalInvoiced = invoices.reduce((total, invoice) => total + Number(invoice.summary.totalAmount || 0), 0);
    const totalReceived = payments.reduce((total, payment) => total + Number(payment.amount || 0), 0);

    return {
      firmId: options.firmId,
      month: options.month,
      year: options.year,
      totalInvoiced,
      totalReceived,
      outstandingAmount: Math.max(0, totalInvoiced - totalReceived),
      paymentHistory: history,
    };
  }

  private static async getReceivedAmount(invoiceId: string) {
    const result = await PaymentModel.aggregate([
      { $match: { invoiceId, status: 'received' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return Number(result[0]?.total || 0);
  }
}
