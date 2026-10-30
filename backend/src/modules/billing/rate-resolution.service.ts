import { BillingRuleConfigurationError, DecimalInput } from './billing-engine';

type RateValue = DecimalInput | undefined;

export interface VehicleOperationalRateInput {
  averageKmPerLitre?: RateValue;
  fuelRatePerLitre?: RateValue;
  effectiveFrom?: Date | string;
}

export interface CapacityRateFallback {
  contractualAverageKmPerLitre?: RateValue;
}

export interface OperationalRateResolutionInput {
  tripDate: Date;
  /** Hiring charge entered on the trip. This is the only source for new trips. */
  tripHiringChargePerRound?: RateValue;
  /** Hiring charge already stored on a legacy trip snapshot. Never a vehicle or contract rate. */
  preservedHiringChargePerRound?: RateValue;
  tripHiringMultiplier?: RateValue;
  vehicleRates?: VehicleOperationalRateInput | null;
  capacityRate?: CapacityRateFallback | null;
  globalFuelRate?: RateValue;
  contractFuelRate?: RateValue;
}

export interface ResolvedOperationalRates {
  hiringChargePerRound?: string;
  hiringMultiplier?: string;
  averageKmPerLitre: string;
  fuelRatePerLitre: string;
  sources: {
    hiringChargePerRound?: 'trip' | 'trip_snapshot';
    hiringMultiplier?: 'trip';
    averageKmPerLitre: 'vehicle' | 'contract_capacity';
    fuelRatePerLitre: 'vehicle' | 'global_hsd' | 'contract_fallback';
  };
}

function presentRate(value: RateValue) {
  if (value === undefined || value === null) return undefined;
  const text = value.toString().trim();
  return text === '' ? undefined : value;
}

function isEffective(vehicleRates: VehicleOperationalRateInput | null | undefined, tripDate: Date) {
  if (!vehicleRates) return false;
  if (!vehicleRates.effectiveFrom) return true;
  const effectiveFrom = new Date(vehicleRates.effectiveFrom);
  if (Number.isNaN(effectiveFrom.getTime())) {
    throw new BillingRuleConfigurationError('Vehicle operational-rate effective date is invalid');
  }
  return effectiveFrom.getTime() <= tripDate.getTime();
}

function requirePositiveRate(value: RateValue, name: string) {
  if (value === undefined || value === null) {
    throw new BillingRuleConfigurationError(`No ${name} is configured for this trip`);
  }
  const text = value.toString().trim();
  const numeric = Number(text);
  if (!/^(?:\d+\.\d+|\d+|\.\d+)$/.test(text) || !Number.isFinite(numeric) || numeric <= 0) {
    throw new BillingRuleConfigurationError(`${name} must be a positive finite number`);
  }
  return text;
}

export class RateResolutionService {
  static resolve(input: OperationalRateResolutionInput): ResolvedOperationalRates {
    if (Number.isNaN(input.tripDate.getTime())) {
      throw new BillingRuleConfigurationError('Trip date is invalid for rate resolution');
    }

    const vehicleRates = isEffective(input.vehicleRates, input.tripDate) ? input.vehicleRates : undefined;
    const tripHiringCharge = presentRate(input.tripHiringChargePerRound);
    const preservedHiringCharge = presentRate(input.preservedHiringChargePerRound);
    const hiringChargePerRound = tripHiringCharge ?? preservedHiringCharge;
    const hiringChargeSource = tripHiringCharge !== undefined ? 'trip' as const : preservedHiringCharge !== undefined ? 'trip_snapshot' as const : undefined;
    const resolvedHiringCharge = hiringChargePerRound !== undefined
      ? requirePositiveRate(hiringChargePerRound, 'Hiring charge per round')
      : undefined;
    const tripMultiplier = presentRate(input.tripHiringMultiplier);
    const averageKmPerLitre = vehicleRates?.averageKmPerLitre ?? input.capacityRate?.contractualAverageKmPerLitre;
    const fuelRatePerLitre = vehicleRates?.fuelRatePerLitre ?? input.globalFuelRate ?? input.contractFuelRate;

    return {
      ...(resolvedHiringCharge !== undefined ? { hiringChargePerRound: resolvedHiringCharge } : {}),
      ...(tripMultiplier !== undefined ? { hiringMultiplier: requirePositiveRate(tripMultiplier, 'Hiring multiplier') } : {}),
      averageKmPerLitre: requirePositiveRate(averageKmPerLitre, 'Average fuel consumption'),
      fuelRatePerLitre: requirePositiveRate(fuelRatePerLitre, 'Fuel rate per litre'),
      sources: {
        ...(hiringChargeSource !== undefined ? { hiringChargePerRound: hiringChargeSource } : {}),
        ...(tripMultiplier !== undefined ? { hiringMultiplier: 'trip' as const } : {}),
        averageKmPerLitre: vehicleRates?.averageKmPerLitre !== undefined ? 'vehicle' : 'contract_capacity',
        fuelRatePerLitre: vehicleRates?.fuelRatePerLitre !== undefined
          ? 'vehicle'
          : input.globalFuelRate !== undefined
            ? 'global_hsd'
            : 'contract_fallback',
      },
    };
  }
}