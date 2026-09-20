import { calculateTripBilling, BillingRuleConfigurationError } from '../billing-engine';
import { IBillingRules } from '../../contracts/billing-rule.model';

const rulesFor = (capacity: number, average: string, hiringRate: string): IBillingRules => ({
  capacityRates: [{ capacity, contractualAverageKmPerLitre: average as never, baseHiringRatePerRound: hiringRate as never }],
  fuelRatePerLitre: '95.81' as never,
  kmThresholds: [{ upToKm: 501, rounds: 1 }, { upToKm: 701, rounds: 1.5 }, { rounds: 2 }],
  tollTreatment: 'actual',
  otherBillableCharges: [],
});

const calculate = (distanceKm: number, capacity = 29000, average = '2.5', hiringRate = '4500') => calculateTripBilling({ tripId: `trip-${distanceKm}`, distanceKm, tollAmount: '0' }, { vehicleId: 'vehicle-1', capacity }, { contractId: 'contract-1' }, { contractVersionId: 'version-1', version: 3 }, rulesFor(capacity, average, hiringRate), '95.81');

describe('calculateTripBilling', () => {
  it.each([100, 310, 500, 501, 550, 700, 701, 750])('uses configured KM threshold for %s KM without inventing lower mappings', (distanceKm) => {
    const result = calculate(distanceKm);
    expect(result.distanceKm).toBe(String(distanceKm));
    expect(result.contractVersionId).toBe('version-1');
    expect(result.fuelRate).toBe('95.81');
    expect(result.totalAmount).toBeTruthy();
  });

  it('applies the configured lower KM mapping and monetary rounding at line outputs', () => {
    const result = calculate(310);
    expect(result.hiringMultiplier).toBe('1');
    expect(result.hiringAmount).toBe('4500');
    expect(result.fuelLitres).toBe('124');
    expect(result.fuelAmount).toBe('11880.44');
    expect(result.totalAmount).toBe('16380.44');
    expect(result.rounding.intermediateValuesRounded).toBe(false);
  });

  it('supports multiple capacities and contractual averages', () => {
    const result = calculate(310, 12000, '4', '1400');
    expect(result.contractualAverage).toBe('4');
    expect(result.fuelLitres).toBe('77.5');
    expect(result.hiringAmount).toBe('1400');
  });

  it.each([[500, '1'], [501, '1.5'], [550, '1.5'], [700, '1.5'], [701, '2'], [750, '2']])('selects the confirmed multiplier for %s KM', (distanceKm, multiplier) => {
    expect(calculate(distanceKm).hiringMultiplier).toBe(multiplier);
  });

  it('uses actual toll only when toll treatment is billable', () => {
    const rules = rulesFor(29000, '2.5', '4500');
    const withToll = calculateTripBilling({ distanceKm: 100, tollAmount: '123.45' }, { capacity: 29000 }, { contractId: 'c' }, { contractVersionId: 'v' }, rules, '95.81');
    expect(withToll.tollAmount).toBe('123.45');
    const excluded = calculateTripBilling({ distanceKm: 100, tollAmount: '123.45' }, { capacity: 29000 }, { contractId: 'c' }, { contractVersionId: 'v' }, { ...rules, tollTreatment: 'excluded' }, '95.81');
    expect(excluded.tollAmount).toBe('0');
  });

  it('fails explicitly when capacity or KM mapping is not configured', () => {
    expect(() => calculateTripBilling({ distanceKm: 100 }, { capacity: 34000 }, { contractId: 'c' }, { contractVersionId: 'v' }, rulesFor(29000, '2.5', '4500'), '95.81')).toThrow(BillingRuleConfigurationError);
    expect(() => calculateTripBilling({ distanceKm: 100 }, { capacity: 29000 }, { contractId: 'c' }, { contractVersionId: 'v' }, { ...rulesFor(29000, '2.5', '4500'), kmThresholds: [] }, '95.81')).toThrow(/KM threshold/);
  });
});