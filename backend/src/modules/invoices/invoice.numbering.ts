/**
 * Indian financial year runs April–March, so a June 2026 bill belongs to FY "26-27".
 */
export const toFinancialYear = (month: number, year: number) => {
  const startYear = month >= 4 ? year : year - 1;
  const endYear = startYear + 1;
  return `${String(startYear % 100).padStart(2, '0')}-${String(endYear % 100).padStart(2, '0')}`;
};

/**
 * Business bill number: [FIRM_PREFIX]/[MM]/[FY]/[VEHICLE_NUMBER] e.g. NIR/06/26-27/11
 */
export const buildBillNumber = (input: {
  billPrefix: string;
  month: number;
  year: number;
  vehicleNumberPerFirm: number;
}) =>
  [
    input.billPrefix.toUpperCase(),
    String(input.month).padStart(2, '0'),
    toFinancialYear(input.month, input.year),
    String(input.vehicleNumberPerFirm),
  ].join('/');
