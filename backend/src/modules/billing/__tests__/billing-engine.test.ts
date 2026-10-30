import { calculateTripBilling, BillingRuleConfigurationError } from '../billing-engine';
import { IBillingRules } from '../../contracts/billing-rule.model';

const rulesFor = (capacity: number, average: string, hiringRate: string): IBillingRules => ({
  capacityRates: [{ capacity, contractualAverageKmPerLitre: average as never, baseHiringRatePerRound: hiringRate as never }],
  fuelRatePerLitre: '95.81' as never,
  kmThresholds: [{ upToKm: 127, rounds: 0.5 }, { upToKm: 500, rounds: 1 }, { upToKm: 700, rounds: 1.5 }, { rounds: 2 }],
  tollTreatment: 'actual',
  otherBillableCharges: [],
});

const calculate = (distanceKm: number, capacity = 29000, average = '2.5', hiringRate = '4500') => calculateTripBilling({ tripId: `trip-${distanceKm}`, distanceKm, tollAmount: '0' }, { vehicleId: 'vehicle-1', capacity }, { contractId: 'contract-1' }, { contractVersionId: 'version-1', version: 3 }, rulesFor(capacity, average, hiringRate), '95.81');

describe('calculateTripBilling', () => {
  it.each([100, 126, 127, 310, 499, 500, 501, 550, 700, 700.1, 701, 750])('uses configured KM threshold for %s KM', (distanceKm) => {
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

  it.each([[100, '0.5'], [126, '0.5'], [127, '1'], [499, '1'], [500, '1.5'], [501, '1.5'], [550, '1.5'], [700, '1.5'], [700.1, '2'], [701, '2'], [750, '2']])('selects the confirmed multiplier for %s KM', (distanceKm, multiplier) => {
    expect(calculate(distanceKm).hiringMultiplier).toBe(multiplier);
  });

  it('selects the same threshold when configuration rows are unsorted', () => {
    const sortedRules = rulesFor(29000, '2.5', '4500');
    const reversedRules = { ...sortedRules, kmThresholds: [...sortedRules.kmThresholds].reverse() };
    const calculateWithRules = (distanceKm: number) => calculateTripBilling(
      { distanceKm }, { capacity: 29000 }, { contractId: 'c' }, { contractVersionId: 'v' }, reversedRules, '95.81'
    );

    expect(calculateWithRules(100).hiringMultiplier).toBe('0.5');
    expect(calculateWithRules(127).hiringMultiplier).toBe('1');
    expect(calculateWithRules(500).hiringMultiplier).toBe('1.5');
    expect(calculateWithRules(700).hiringMultiplier).toBe('1.5');
    expect(calculateWithRules(700.1).hiringMultiplier).toBe('2');
  });

  it('uses actual toll only when toll treatment is billable', () => {
    const rules = rulesFor(29000, '2.5', '4500');
    const withToll = calculateTripBilling({ distanceKm: 100, tollAmount: '123.45' }, { capacity: 29000 }, { contractId: 'c' }, { contractVersionId: 'v' }, rules, '95.81');
    expect(withToll.tollAmount).toBe('123.45');
    const excluded = calculateTripBilling({ distanceKm: 100, tollAmount: '123.45' }, { capacity: 29000 }, { contractId: 'c' }, { contractVersionId: 'v' }, { ...rules, tollTreatment: 'excluded' }, '95.81');
    expect(excluded.tollAmount).toBe('0');
  });

  it('uses a trip hiring multiplier instead of the KM slab', () => {
    const result = calculateTripBilling(
      { distanceKm: 600, hiringMultiplier: '1', tollAmount: 0 },
      { capacity: 29000, baseHiringRatePerRound: '4000', averageKmPerLitre: '2.5' },
      { contractId: 'c' },
      { contractVersionId: 'v' },
      rulesFor(29000, '2.5', '4500'),
      '95.81',
    );
    expect(result.hiringMultiplier).toBe('1');
    expect(result.hiringMultiplierSource).toBe('trip');
    expect(result.hiringAmount).toBe('4000');
    expect(result.baseHiringRate).toBe('4000');
  });

  it.each([
    ['1', '4500'],
    ['1.5', '6750'],
    ['2', '9000'],
  ])('calculates hiring at %s x the trip rate', (multiplier, hiringAmount) => {
    const result = calculateTripBilling(
      { distanceKm: 100, hiringMultiplier: multiplier },
      { capacity: 29000, baseHiringRatePerRound: '4500', averageKmPerLitre: '2.5' },
      { contractId: 'c' },
      { contractVersionId: 'v' },
      rulesFor(29000, '2.5', '4500'),
      '95.81',
    );
    expect(result.hiringAmount).toBe(hiringAmount);
    expect(result.hiringMultiplierSource).toBe('trip');
  });

  it('adds courier charges once and leaves totals unchanged when courier is absent', () => {
    const withoutCourier = calculate(310);
    expect(withoutCourier.courierAmount).toBe('0');
    expect(withoutCourier.hiringMultiplierSource).toBe('km_threshold');
    expect(withoutCourier.totalAmount).toBe('16380.44');

    const withCourier = calculateTripBilling(
      { distanceKm: 310, courierAmount: '250.75' },
      { capacity: 29000 },
      { contractId: 'c' },
      { contractVersionId: 'v' },
      rulesFor(29000, '2.5', '4500'),
      '95.81',
    );
    expect(withCourier.courierAmount).toBe('250.75');
    expect(withCourier.totalAmount).toBe('16631.19');
    expect(withCourier.fuelAmount).toBe(withoutCourier.fuelAmount);
    expect(withCourier.hiringAmount).toBe(withoutCourier.hiringAmount);
  });

  it('rejects an invalid hiring multiplier or a negative courier amount', () => {
    const rules = rulesFor(29000, '2.5', '4500');
    expect(() => calculateTripBilling({ distanceKm: 100, hiringMultiplier: 0 }, { capacity: 29000 }, { contractId: 'c' }, { contractVersionId: 'v' }, rules, '95.81')).toThrow(/Hiring multiplier/);
    expect(() => calculateTripBilling({ distanceKm: 100, courierAmount: '-1' }, { capacity: 29000 }, { contractId: 'c' }, { contractVersionId: 'v' }, rules, '95.81')).toThrow(/Courier/);
  });

  it('fails explicitly when capacity or KM mapping is not configured', () => {
    expect(() => calculateTripBilling({ distanceKm: 100 }, { capacity: 34000 }, { contractId: 'c' }, { contractVersionId: 'v' }, rulesFor(29000, '2.5', '4500'), '95.81')).toThrow(BillingRuleConfigurationError);
    expect(() => calculateTripBilling({ distanceKm: 100 }, { capacity: 29000 }, { contractId: 'c' }, { contractVersionId: 'v' }, { ...rulesFor(29000, '2.5', '4500'), kmThresholds: [] }, '95.81')).toThrow(/KM threshold/);
  });
});