import { calculateTripBilling } from '../billing-engine';
import { IBillingRules } from '../../contracts/billing-rule.model';

type ExcelCase = {
  name: string;
  vehicle: string;
  capacity: number;
  average: string;
  km: number;
  fuelRate: string;
  baseHiringRate: string;
  multiplier: string;
  toll: string;
  excel: { fuelLitres: string; fuelAmount: string; hiringAmount: string; toll: string; total: string };
};

const workbookRules = (capacity: number, average: string, baseHiringRate: string): IBillingRules => ({
  capacityRates: [{ capacity, contractualAverageKmPerLitre: average as never, baseHiringRatePerRound: baseHiringRate as never }],
  fuelRatePerLitre: '95.81' as never,
  // The workbook's observed 0.5 slab is below 127 KM. Strict equality at 127/500/700 remains a business confirmation point.
  kmThresholds: [{ upToKm: 127, rounds: 0.5 }, { upToKm: 500, rounds: 1 }, { upToKm: 700, rounds: 1.5 }, { rounds: 2 }],
  tollTreatment: 'actual',
  otherBillableCharges: [],
});

const excelCases: ExcelCase[] = [
  { name: 'NIR/06/26-27/11 row 1', vehicle: 'UP13DT0632', capacity: 29000, average: '2.5', km: 589, fuelRate: '95.81', baseHiringRate: '4500', multiplier: '1.5', toll: '4680', excel: { fuelLitres: '235.6', fuelAmount: '22572.836', hiringAmount: '6750', toll: '4680', total: '34002.836' } },
  { name: 'NIR/06/26-27/12 row 1', vehicle: 'UP13BT5953', capacity: 23000, average: '3', km: 110, fuelRate: '95.81', baseHiringRate: '3000', multiplier: '0.5', toll: '0', excel: { fuelLitres: '36.6666666666667', fuelAmount: '3513.03333333333', hiringAmount: '1500', toll: '0', total: '5013.03333333333' } },
  { name: 'NIR/06/26-27/12 row 2', vehicle: 'UP13BT5953', capacity: 23000, average: '3', km: 310, fuelRate: '95.81', baseHiringRate: '3000', multiplier: '1', toll: '0', excel: { fuelLitres: '103.333333333333', fuelAmount: '9900.36666666667', hiringAmount: '3000', toll: '0', total: '12900.3666666667' } },
  { name: 'NIR/06/26-27/12 row 6 with toll', vehicle: 'UP13BT5953', capacity: 23000, average: '3', km: 310, fuelRate: '95.81', baseHiringRate: '3000', multiplier: '1', toll: '445', excel: { fuelLitres: '103.333333333333', fuelAmount: '9900.36666666667', hiringAmount: '3000', toll: '445', total: '13345.3666666667' } },
  { name: 'NIR/05/26-27/13 row 1', vehicle: 'UP81BT5189', capacity: 23000, average: '3', km: 652, fuelRate: '95.81', baseHiringRate: '3000', multiplier: '1.5', toll: '4680', excel: { fuelLitres: '217.333333333333', fuelAmount: '20822.7066666667', hiringAmount: '4500', toll: '4680', total: '30002.7066666667' } },
  { name: 'NIR/06/26-27/14 row 1', vehicle: 'UP13ET6255', capacity: 34000, average: '2.3', km: 365, fuelRate: '95.81', baseHiringRate: '5000', multiplier: '1', toll: '2295', excel: { fuelLitres: '158.695652173913', fuelAmount: '15204.6304347826', hiringAmount: '5000', toll: '2295', total: '22499.6304347826' } },
  { name: 'NIR/06/26-27/14 row 3', vehicle: 'UP13ET6255', capacity: 34000, average: '2.3', km: 450, fuelRate: '95.81', baseHiringRate: '5000', multiplier: '1', toll: '2350', excel: { fuelLitres: '195.652173913044', fuelAmount: '18745.4347826087', hiringAmount: '5000', toll: '2350', total: '26095.4347826087' } },
  { name: 'NIR/06/26-27/15 row 1', vehicle: 'UP13ET6256', capacity: 12000, average: '4', km: 97, fuelRate: '95.81', baseHiringRate: '1400', multiplier: '0.5', toll: '0', excel: { fuelLitres: '24.25', fuelAmount: '2323.3925', hiringAmount: '700', toll: '0', total: '3023.3925' } },
];

describe('NIR Tanker workbook validation', () => {
  it.each(excelCases)('compares $name against the billing engine', (testCase) => {
    const result = calculateTripBilling(
      { tripId: testCase.name, distanceKm: testCase.km, tollAmount: testCase.toll },
      { vehicleId: testCase.vehicle, capacity: testCase.capacity },
      { contractId: 'workbook-contract' },
      { contractVersionId: 'workbook-version', version: 1 },
      workbookRules(testCase.capacity, testCase.average, testCase.baseHiringRate),
      testCase.fuelRate,
    );

    expect(result.distanceKm).toBe(String(testCase.km));
    expect(result.contractualAverage).toBe(testCase.average);
    expect(result.fuelRate).toBe(testCase.fuelRate);
    expect(result.hiringMultiplier).toBe(testCase.multiplier);
    expect(result.baseHiringRate).toBe(testCase.baseHiringRate);
    expect(Number(result.fuelLitres)).toBeCloseTo(Number(testCase.excel.fuelLitres), 10);
    expect(result.hiringAmount).toBe(testCase.excel.hiringAmount);
    expect(result.tollAmount).toBe(testCase.excel.toll);

    // Excel retains repeating monetary fractions; the application intentionally rounds money to 2dp.
    expect(result.fuelAmount).toBe(Number(testCase.excel.fuelAmount).toFixed(2).replace(/\.00$/, ''));
    expect(result.totalAmount).toBe(Number(testCase.excel.total).toFixed(2).replace(/\.00$/, ''));
  });
});