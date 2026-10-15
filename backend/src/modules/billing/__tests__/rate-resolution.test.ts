import { BillingRuleConfigurationError } from '../billing-engine';
import { RateResolutionService } from '../rate-resolution.service';

const tripDate = new Date('2026-06-15T00:00:00.000Z');

describe('RateResolutionService', () => {
  it('prefers effective vehicle-specific rates and retains their source', () => {
    const result = RateResolutionService.resolve({
      tripDate,
      vehicleRates: {
        hiringChargePerRound: '5200',
        averageKmPerLitre: '2.2',
        fuelRatePerLitre: '98.50',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
      },
      capacityRate: { baseHiringRatePerRound: '4500', contractualAverageKmPerLitre: '2.5' },
      globalFuelRate: '96.25',
      contractFuelRate: '95.81',
    });

    expect(result).toEqual({
      hiringChargePerRound: '5200',
      averageKmPerLitre: '2.2',
      fuelRatePerLitre: '98.50',
      sources: {
        hiringChargePerRound: 'vehicle',
        averageKmPerLitre: 'vehicle',
        fuelRatePerLitre: 'vehicle',
      },
    });
  });

  it('uses global HSD before the legacy contract fuel rate', () => {
    const result = RateResolutionService.resolve({
      tripDate,
      capacityRate: { baseHiringRatePerRound: 4500, contractualAverageKmPerLitre: 2.5 },
      globalFuelRate: 96.25,
      contractFuelRate: 95.81,
    });

    expect(result.fuelRatePerLitre).toBe('96.25');
    expect(result.sources.fuelRatePerLitre).toBe('global_hsd');
    expect(result.hiringChargePerRound).toBe('4500');
    expect(result.averageKmPerLitre).toBe('2.5');
  });

  it('uses the legacy contract fuel rate when neither vehicle nor global fuel rate exists', () => {
    const result = RateResolutionService.resolve({
      tripDate,
      capacityRate: { baseHiringRatePerRound: '4500', contractualAverageKmPerLitre: '2.5' },
      contractFuelRate: '95.81',
    });

    expect(result.fuelRatePerLitre).toBe('95.81');
    expect(result.sources.fuelRatePerLitre).toBe('contract_fallback');
  });

  it('does not apply vehicle rates before their effective date', () => {
    const result = RateResolutionService.resolve({
      tripDate,
      vehicleRates: {
        hiringChargePerRound: '5200',
        averageKmPerLitre: '2.2',
        fuelRatePerLitre: '98.50',
        effectiveFrom: '2026-07-01T00:00:00.000Z',
      },
      capacityRate: { baseHiringRatePerRound: '4500', contractualAverageKmPerLitre: '2.5' },
      globalFuelRate: '96.25',
    });

    expect(result.hiringChargePerRound).toBe('4500');
    expect(result.averageKmPerLitre).toBe('2.5');
    expect(result.fuelRatePerLitre).toBe('96.25');
    expect(result.sources).toEqual({
      hiringChargePerRound: 'contract_capacity',
      averageKmPerLitre: 'contract_capacity',
      fuelRatePerLitre: 'global_hsd',
    });
  });

  it('fails explicitly when a resolved rate is missing or invalid', () => {
    expect(() => RateResolutionService.resolve({ tripDate, globalFuelRate: 95.81 })).toThrow(BillingRuleConfigurationError);
    expect(() => RateResolutionService.resolve({
      tripDate,
      vehicleRates: { hiringChargePerRound: 0, averageKmPerLitre: 2.5, effectiveFrom: tripDate },
      globalFuelRate: 95.81,
    })).toThrow(/Hiring charge per round must be a positive finite number/);
  });
});