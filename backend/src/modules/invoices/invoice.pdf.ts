import PDFDocument from 'pdfkit';
import { IInvoice } from './invoice.model';

const money = (value: string | number) => Number(value || 0).toFixed(2);
const date = (value: Date | string | undefined) => value ? new Date(value).toLocaleDateString('en-IN') : '-';
const monthName = (month: number) => new Date(Date.UTC(2000, month - 1, 1)).toLocaleString('en-IN', { month: 'long', timeZone: 'UTC' });

const writeLabelValue = (document: PDFKit.PDFDocument, label: string, value: string, x: number, y: number) => {
  document.font('Helvetica-Bold').fontSize(9).text(label, x, y);
  document.font('Helvetica').text(value, x + 78, y);
};

export const renderFinalizedInvoicePdf = (invoice: IInvoice): Promise<Buffer> => new Promise((resolve, reject) => {
  const document = new PDFDocument({ size: 'A4', margin: 40, compress: false });
  const chunks: Buffer[] = [];
  document.on('data', (chunk: Buffer) => chunks.push(chunk));
  document.on('end', () => resolve(Buffer.concat(chunks)));
  document.on('error', reject);

  const company = invoice.companySnapshot;
  const firm = invoice.firmSnapshot;
  const vehicle = invoice.vehicleSnapshot;
  const finalizedDate = invoice.finalizedAt ?? invoice.generatedAt;

  document.fillColor('#17324d').fontSize(22).font('Helvetica-Bold').text(company.name);
  document.fillColor('#333333').fontSize(9).font('Helvetica');
  [company.address, company.phone, company.email, company.taxId ? `Tax ID: ${company.taxId}` : undefined]
    .filter(Boolean).forEach((line) => document.text(line as string));
  document.moveDown(1);
  document.fillColor('#17324d').fontSize(18).font('Helvetica-Bold').text('TAX INVOICE', { align: 'right' });
  document.fillColor('#333333').fontSize(9).font('Helvetica');
  writeLabelValue(document, 'Invoice no.', invoice.invoiceNumber ?? String(invoice._id), 360, 42);
  writeLabelValue(document, 'Invoice date', date(finalizedDate), 360, 57);
  writeLabelValue(document, 'Billing month', `${monthName(invoice.month)} ${invoice.year}`, 360, 72);

  document.moveTo(40, 130).lineTo(555, 130).strokeColor('#17324d').stroke();
  document.fontSize(10).font('Helvetica-Bold').fillColor('#17324d').text('BILL TO', 40, 148);
  document.font('Helvetica').fillColor('#333333').text(firm.billingName ?? firm.name, 40, 164);
  [firm.address, firm.gstNumber ? `GST: ${firm.gstNumber}` : undefined]
    .filter(Boolean).forEach((line) => document.text(line as string));
  document.font('Helvetica-Bold').fillColor('#17324d').text('VEHICLE', 330, 148);
  document.font('Helvetica').fillColor('#333333').text(`${vehicle.registrationNumber} | ${vehicle.vehicleType ?? 'Vehicle'}`, 330, 164);
  document.text(`Capacity: ${vehicle.capacity}`, 330, 179);

  let y = 220;
  const columns = [
    ['Trip details', 40, 150], ['KM', 190, 38], ['Avg.', 228, 45], ['Litres', 273, 48],
    ['Fuel rate', 321, 52], ['Fuel', 373, 45], ['Hiring', 418, 50], ['Toll', 468, 42], ['Total', 510, 45],
  ] as const;
  document.rect(40, y, 515, 22).fill('#17324d');
  document.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7);
  columns.forEach(([label, x, width]) => document.text(label, x + 3, y + 7, { width: width - 6, align: 'left' }));
  y += 22;

  invoice.lineItems.forEach((lineItem, index) => {
    if (y > 720) {
      document.addPage();
      y = 45;
    }
    const trip = lineItem.tripSnapshot;
    const snapshot = lineItem.snapshot;
    const rowHeight = 34;
    if (index % 2 === 0) document.rect(40, y, 515, rowHeight).fill('#f1f5f8');
    document.fillColor('#333333').font('Helvetica').fontSize(6.5);
    document.text(`${date(trip.tripDate)}\n${trip.pickupLocation} -> ${trip.dropLocation}`, 43, y + 5, { width: 144 });
    document.text(trip.distanceKm, 193, y + 12, { width: 32 });
    document.text(snapshot.contractualAverage, 231, y + 12, { width: 39 });
    document.text(snapshot.fuelLitres, 276, y + 12, { width: 42 });
    document.text(money(snapshot.fuelRate), 324, y + 12, { width: 46 });
    document.text(money(snapshot.fuelAmount), 376, y + 12, { width: 39 });
    document.text(money(snapshot.hiringAmount), 421, y + 12, { width: 44 });
    document.text(money(snapshot.tollAmount), 471, y + 12, { width: 36 });
    document.font('Helvetica-Bold').text(money(snapshot.totalAmount), 513, y + 12, { width: 39 });
    y += rowHeight;
  });

  y += 12;
  document.fillColor('#333333').font('Helvetica').fontSize(9);
  writeLabelValue(document, 'Trips', String(invoice.summary.tripCount), 365, y);
  writeLabelValue(document, 'Fuel amount', money(invoice.summary.fuelAmount), 365, y + 16);
  writeLabelValue(document, 'Hiring amount', money(invoice.summary.hiringAmount), 365, y + 32);
  writeLabelValue(document, 'Toll amount', money(invoice.summary.tollAmount), 365, y + 48);
  writeLabelValue(document, 'Other charges', money(invoice.summary.otherBillableAmount), 365, y + 64);
  document.moveTo(365, y + 84).lineTo(555, y + 84).strokeColor('#17324d').stroke();
  document.font('Helvetica-Bold').fontSize(13).fillColor('#17324d').text(`GRAND TOTAL  ${money(invoice.summary.totalAmount)}`, 365, y + 96, { width: 190, align: 'right' });
  document.font('Helvetica').fontSize(8).fillColor('#666666').text('This invoice reproduces the finalized calculation snapshots stored with the invoice.', 40, 780);
  document.end();
});