import { BillingRuleConfigurationError } from '../billing-engine';
import { RateResolutionService } from '../rate-resolution.service';

const tripDate = new Date('2026-06-15T00:00:00.000Z');

describe('RateResolutionService', () => {
  it('uses the trip hiring charge and ignores a vehicle hiring charge', () => {
    const result = RateResolutionService.resolve({
      tripDate,
      tripHiringChargePerRound: '6100',
      tripHiringMultiplier: '1.5',
      vehicleRates: {
        averageKmPerLitre: '2.2',
        fuelRatePerLitre: '98.50',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
      },
      capacityRate: { contractualAverageKmPerLitre: '2.5' },
      globalFuelRate: '96.25',
      contractFuelRate: '95.81',
    });

    expect(result).toEqual({
      hiringChargePerRound: '6100',
      hiringMultiplier: '1.5',
      averageKmPerLitre: '2.2',
      fuelRatePerLitre: '98.50',
      sources: {
        hiringChargePerRound: 'trip',
        hiringMultiplier: 'trip',
        averageKmPerLitre: 'vehicle',
        fuelRatePerLitre: 'vehicle',
      },
    });
  });

  it('uses global HSD before the legacy contract fuel rate', () => {
    const result = RateResolutionService.resolve({
      tripDate,
      tripHiringChargePerRound: 4500,
      capacityRate: { contractualAverageKmPerLitre: 2.5 },
      globalFuelRate: 96.25,
      contractFuelRate: 95.81,
    });

    expect(result.fuelRatePerLitre).toBe('96.25');
    expect(result.sources.fuelRatePerLitre).toBe('global_hsd');
    expect(result.hiringChargePerRound).toBe('4500');
    expect(result.sources.hiringChargePerRound).toBe('trip');
    expect(result.averageKmPerLitre).toBe('2.5');
    expect(result.hiringMultiplier).toBeUndefined();
  });

  it('uses the legacy contract fuel rate when neither vehicle nor global fuel rate exists', () => {
    const result = RateResolutionService.resolve({
      tripDate,
      tripHiringChargePerRound: '4500',
      capacityRate: { contractualAverageKmPerLitre: '2.5' },
      contractFuelRate: '95.81',
    });

    expect(result.fuelRatePerLitre).toBe('95.81');
    expect(result.sources.fuelRatePerLitre).toBe('contract_fallback');
  });

  it('does not apply vehicle fuel or average rates before their effective date', () => {
    const result = RateResolutionService.resolve({
      tripDate,
      tripHiringChargePerRound: '6100',
      vehicleRates: {
        averageKmPerLitre: '2.2',
        fuelRatePerLitre: '98.50',
        effectiveFrom: '2026-07-01T00:00:00.000Z',
      },
      capacityRate: { contractualAverageKmPerLitre: '2.5' },
      globalFuelRate: '96.25',
    });

    expect(result.hiringChargePerRound).toBe('6100');
    expect(result.averageKmPerLitre).toBe('2.5');
    expect(result.fuelRatePerLitre).toBe('96.25');
    expect(result.sources).toEqual({
      hiringChargePerRound: 'trip',
      averageKmPerLitre: 'contract_capacity',
      fuelRatePerLitre: 'global_hsd',
    });
  });

  it('keeps a legacy snapshot hiring charge when the trip has no new hiring charge', () => {
    const result = RateResolutionService.resolve({
      tripDate,
      preservedHiringChargePerRound: '5200',
      capacityRate: { contractualAverageKmPerLitre: '2.5' },
      globalFuelRate: '96.25',
    });

    expect(result.hiringChargePerRound).toBe('5200');
    expect(result.sources.hiringChargePerRound).toBe('trip_snapshot');
  });

  it('fails explicitly when a resolved rate is missing or invalid', () => {
    expect(() => RateResolutionService.resolve({
      tripDate,
      tripHiringChargePerRound: 4500,
      globalFuelRate: 95.81,
    })).toThrow(BillingRuleConfigurationError);
    const withoutHiringCharge = RateResolutionService.resolve({
      tripDate,
      capacityRate: { contractualAverageKmPerLitre: 2.5 },
      globalFuelRate: 95.81,
    });
    expect(withoutHiringCharge.hiringChargePerRound).toBeUndefined();
    expect(withoutHiringCharge.sources.hiringChargePerRound).toBeUndefined();
    expect(() => RateResolutionService.resolve({
      tripDate,
      tripHiringChargePerRound: 0,
      capacityRate: { contractualAverageKmPerLitre: 2.5 },
      globalFuelRate: 95.81,
    })).toThrow(/Hiring charge per round must be a positive finite number/);
  });
});
