import PDFDocument from 'pdfkit';
import { IInvoice } from './invoice.model';

const money = (value: string | number) => Number(value || 0).toFixed(2);
const wholeMoney = (value: string | number) => Number(value || 0).toFixed(0);
const num = (value: string | number, digits = 2) => {
  const parsed = Number(value || 0);
  return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(digits);
};
const date = (value: Date | string | undefined) => (value ? new Date(value).toLocaleDateString('en-IN') : '-');
const shortDate = (value: Date | string) =>
  new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' });
const monthName = (month: number) =>
  new Date(Date.UTC(2000, month - 1, 1)).toLocaleString('en-IN', { month: 'long', timeZone: 'UTC' }).toUpperCase();

const PAGE_LEFT = 32;
const PAGE_RIGHT = 563;
const TABLE_WIDTH = PAGE_RIGHT - PAGE_LEFT;

type BillColumn = { key: string; label: string; width: number; align: 'left' | 'center' | 'right' };

/** Columns follow the reference bill. Courier is inserted only when the bill has courier charges. */
const baseColumns = (): BillColumn[] => [
  { key: 'sl', label: 'SL\nNO.', width: 22, align: 'center' },
  { key: 'date', label: 'DATE', width: 42, align: 'center' },
  { key: 'from', label: 'FROM', width: 60, align: 'left' },
  { key: 'to', label: 'TO', width: 50, align: 'left' },
  { key: 'km', label: 'KM', width: 32, align: 'right' },
  { key: 'rounds', label: 'ROUNDS\n(BY KMS)', width: 42, align: 'right' },
  { key: 'avg', label: 'AVG', width: 28, align: 'right' },
  { key: 'litres', label: 'HSD\n(LTR.)', width: 42, align: 'right' },
  { key: 'rate', label: 'HSD\nRATE', width: 38, align: 'right' },
  { key: 'hsd', label: 'HSD\nAMOUNT', width: 52, align: 'right' },
  { key: 'hiring', label: 'HIRING\nCHARGE', width: 48, align: 'right' },
  { key: 'toll', label: 'TOLL\nAMOUNT', width: 44, align: 'right' },
  { key: 'total', label: 'TOTAL\nAMOUNT', width: 31, align: 'right' },
];

const columnsFor = (showCourier: boolean): BillColumn[] => {
  const columns = baseColumns();
  if (!showCourier) return columns;
  const from = columns.find((column) => column.key === 'from');
  const to = columns.find((column) => column.key === 'to');
  if (from) from.width -= 22;
  if (to) to.width -= 22;
  const totalIndex = columns.findIndex((column) => column.key === 'total');
  columns.splice(totalIndex, 0, { key: 'courier', label: 'COURIER\nCHARGE', width: 44, align: 'right' });
  return columns;
};

const columnX = (columns: BillColumn[], index: number) =>
  PAGE_LEFT + columns.slice(0, index).reduce((total, column) => total + column.width, 0);

// The final column absorbs rounding slack so the grid ends flush with the page edge.
const columnWidth = (columns: BillColumn[], index: number) =>
  index === columns.length - 1 ? PAGE_RIGHT - columnX(columns, index) : columns[index].width;

const drawDividers = (document: PDFKit.PDFDocument, columns: BillColumn[], y: number, height: number, colour: string) => {
  columns.forEach((_, index) => {
    if (index === 0) return;
    document.moveTo(columnX(columns, index), y).lineTo(columnX(columns, index), y + height).strokeColor(colour).lineWidth(0.4).stroke();
  });
};

const drawTableHeader = (document: PDFKit.PDFDocument, y: number, columns: BillColumn[]) => {
  const height = 26;
  document.rect(PAGE_LEFT, y, TABLE_WIDTH, height).fillAndStroke('#e8eef4', '#17324d');
  document.fillColor('#17324d').font('Helvetica-Bold').fontSize(5.6);
  columns.forEach((column, index) => {
    document.text(column.label, columnX(columns, index) + 2, y + 6, { width: columnWidth(columns, index) - 4, align: 'center' });
  });
  drawDividers(document, columns, y, height, '#17324d');
  return y + height;
};

const drawRow = (document: PDFKit.PDFDocument, y: number, columns: BillColumn[], values: string[]) => {
  const height = 16;
  document.rect(PAGE_LEFT, y, TABLE_WIDTH, height).strokeColor('#8ea6bd').lineWidth(0.4).stroke();
  document.fillColor('#1f2933').font('Helvetica').fontSize(6.4);
  values.forEach((value, index) => {
    document.text(value, columnX(columns, index) + 2, y + 5, {
      width: columnWidth(columns, index) - 4,
      align: columns[index].align,
      lineBreak: false,
    });
  });
  drawDividers(document, columns, y, height, '#8ea6bd');
  return y + height;
};

export const renderFinalizedInvoicePdf = (invoice: IInvoice): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: 'A4', margin: 32, compress: false });
    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);

    const company = invoice.companySnapshot;
    const firm = invoice.firmSnapshot;
    const vehicle = invoice.vehicleSnapshot;
    const issuerName = `M/S ${firm.billingName ?? firm.name}`;
    const issuerX = 330;
    const billDate = invoice.finalizedAt ?? invoice.generatedAt;

    document.font('Helvetica-Bold').fontSize(9).fillColor('#17324d');
    document.text(`BILL NO:- ${invoice.invoiceNumber ?? '-'}`, PAGE_LEFT, 34);
    document.text(`BOOK NO:- ${invoice.bookNumber ?? '-'}`, PAGE_LEFT, 34, { width: TABLE_WIDTH, align: 'right' });

    // The firm issues the bill; the company (factory) receives it.
    document.fillColor('#1f2933').font('Helvetica-Bold').fontSize(9).text('TO,', PAGE_LEFT, 58);
    document.fontSize(10).text(company.name, PAGE_LEFT, 70);
    document.font('Helvetica').fontSize(8);
    [company.address, company.taxId ? `GSTIN: ${company.taxId}` : undefined]
      .filter(Boolean)
      .forEach((line, index) => document.text(line as string, PAGE_LEFT, 84 + index * 11, { width: 250 }));

    document.font('Helvetica-Bold').fontSize(10).text(issuerName, issuerX, 58, {
      width: PAGE_RIGHT - issuerX,
      align: 'right',
    });
    document.font('Helvetica').fontSize(8);
    [firm.address, firm.phone ? `MOB:- ${firm.phone}` : undefined, firm.gstNumber ? `GST:- ${firm.gstNumber}` : undefined]
      .filter(Boolean)
      .forEach((line, index) =>
        document.text(line as string, issuerX, 74 + index * 11, { width: PAGE_RIGHT - issuerX, align: 'right' })
      );

    document.font('Helvetica-Bold').fontSize(8.5).fillColor('#1f2933');
    document.text(`VEHICLE NO.:- ${vehicle.registrationNumber}`, PAGE_LEFT, 124);
    document.text(`TANKER CAP:- ${vehicle.capacity}`, PAGE_LEFT, 137);
    document.text(`PERIOD:- MONTH ${monthName(invoice.month)} ${invoice.year}`, issuerX, 124, {
      width: PAGE_RIGHT - issuerX,
      align: 'right',
    });
    document.text(`BILL GENERATE DATE:- ${date(billDate)}`, issuerX, 137, {
      width: PAGE_RIGHT - issuerX,
      align: 'right',
    });

    const showCourier = Number(invoice.summary.courierAmount || 0) > 0;
    const columns = columnsFor(showCourier);
    const manualMultiplier = invoice.lineItems.some((item) => item.snapshot.hiringMultiplierSource === 'trip');
    const lineValues = (lineItem: IInvoice['lineItems'][number], index: number) => {
      const trip = lineItem.tripSnapshot;
      const snapshot = lineItem.snapshot;
      const rounds = `${num(snapshot.hiringMultiplier)}${snapshot.hiringMultiplierSource === 'trip' ? '*' : ''}`;
      const byKey: Record<string, string> = {
        sl: String(index + 1),
        date: shortDate(trip.tripDate),
        from: trip.pickupLocation,
        to: trip.dropLocation,
        km: num(snapshot.distanceKm, 0),
        rounds,
        avg: num(snapshot.contractualAverage),
        litres: num(snapshot.fuelLitres, 1),
        rate: money(snapshot.fuelRate),
        hsd: money(snapshot.fuelAmount),
        hiring: money(snapshot.hiringAmount),
        toll: money(snapshot.tollAmount),
        courier: money(snapshot.courierAmount || 0),
        total: money(snapshot.totalAmount),
      };
      return columns.map((column) => byKey[column.key] ?? '');
    };

    let y = drawTableHeader(document, 158, columns);

    invoice.lineItems.forEach((lineItem, index) => {
      if (y > 700) {
        document.addPage();
        y = drawTableHeader(document, 40, columns);
      }
      y = drawRow(document, y, columns, lineValues(lineItem, index));
    });

    if (y > 690) {
      document.addPage();
      y = 40;
    }

    const summary = invoice.summary;
    const totalLitres = invoice.lineItems.reduce((total, item) => total + Number(item.snapshot.fuelLitres || 0), 0);
    const totalRounds = invoice.lineItems.reduce((total, item) => total + Number(item.snapshot.hiringMultiplier || 0), 0);

    document.rect(PAGE_LEFT, y, TABLE_WIDTH, 18).fillAndStroke('#e8eef4', '#17324d');
    document.fillColor('#17324d').font('Helvetica-Bold').fontSize(6.6);
    const totalByKey: Record<string, string> = {
      from: 'GRAND TOTAL:-',
      km: num(summary.totalDistanceKm, 0),
      rounds: num(totalRounds),
      litres: num(totalLitres, 1),
      hsd: money(summary.fuelAmount),
      hiring: money(summary.hiringAmount),
      toll: money(summary.tollAmount),
      courier: money(summary.courierAmount || 0),
      total: wholeMoney(summary.totalAmount),
    };
    columns.forEach((column, index) => {
      document.text(totalByKey[column.key] ?? '', columnX(columns, index) + 2, y + 6, {
        width: columnWidth(columns, index) - 4,
        align: column.key === 'from' ? 'left' : column.align,
        lineBreak: false,
      });
    });
    y += 18;

    if (manualMultiplier) {
      document.fillColor('#1f2933').font('Helvetica').fontSize(7.5);
      document.text('* Hiring multiplier entered on the trip.', PAGE_LEFT, y + 6);
      y += 14;
    }

    if (summary.otherBillableAmount > 0) {
      document.fillColor('#1f2933').font('Helvetica').fontSize(7.5);
      document.text(`Other billable charges included: ${money(summary.otherBillableAmount)}`, PAGE_LEFT, y + 6);
      y += 16;
    }

    const bank = firm.bankDetails;
    const footerY = Math.max(y + 24, 640);
    document.fillColor('#17324d').font('Helvetica-Bold').fontSize(8.5).text('BANK DETAILS:-', PAGE_LEFT, footerY);
    document.fillColor('#1f2933').font('Helvetica').fontSize(8);
    [
      bank?.accountName ? `ACCOUNT NAME:- ${bank.accountName}` : undefined,
      bank?.accountNumber ? `ACCOUNT NO.:- ${bank.accountNumber}` : undefined,
      bank?.ifscCode ? `IFSC CODE:- ${bank.ifscCode}` : undefined,
      bank?.bankName ? `BANK:- ${bank.bankName}` : undefined,
      bank?.branchName ? `BRANCH:- ${bank.branchName}` : undefined,
    ]
      .filter(Boolean)
      .forEach((line, index) => document.text(line as string, PAGE_LEFT, footerY + 14 + index * 11, { width: 280 }));

    document.font('Helvetica-Bold').fontSize(8.5).fillColor('#1f2933');
    document.text(`FOR ${issuerName}`, issuerX, footerY + 40, { width: PAGE_RIGHT - issuerX, align: 'right' });
    document.font('Helvetica').text('AUTHORIZED SIGNATURE', issuerX, footerY + 74, {
      width: PAGE_RIGHT - issuerX,
      align: 'right',
    });

    document
      .font('Helvetica')
      .fontSize(6.5)
      .fillColor('#7b8794')
      .text('Reproduced from the finalized calculation snapshot stored with this bill.', PAGE_LEFT, 800);
    document.end();
  });
