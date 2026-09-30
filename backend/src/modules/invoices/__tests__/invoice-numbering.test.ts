import { buildBillNumber, toFinancialYear } from '../invoice.numbering';

describe('Bill numbering', () => {
  it('maps months to the April-March financial year', () => {
    expect(toFinancialYear(6, 2026)).toBe('26-27');
    expect(toFinancialYear(4, 2026)).toBe('26-27');
    expect(toFinancialYear(3, 2027)).toBe('26-27');
    expect(toFinancialYear(12, 2026)).toBe('26-27');
    expect(toFinancialYear(1, 2027)).toBe('26-27');
  });

  it('builds the reference bill number format', () => {
    expect(buildBillNumber({ billPrefix: 'NIR', month: 6, year: 2026, vehicleNumberPerFirm: 11 })).toBe(
      'NIR/06/26-27/11'
    );
    expect(buildBillNumber({ billPrefix: 'nir', month: 5, year: 2026, vehicleNumberPerFirm: 13 })).toBe(
      'NIR/05/26-27/13'
    );
  });
});
