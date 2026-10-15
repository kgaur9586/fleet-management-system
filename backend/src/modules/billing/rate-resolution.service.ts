import { BillingRuleConfigurationError, DecimalInput } from './billing-engine';

type RateValue = DecimalInput | undefined;

export interface VehicleOperationalRateInput {
  hiringChargePerRound?: RateValue;
  averageKmPerLitre?: RateValue;
  fuelRatePerLitre?: RateValue;
  effectiveFrom?: Date | string;
}

export interface CapacityRateFallback {
  baseHiringRatePerRound?: RateValue;
  contractualAverageKmPerLitre?: RateValue;
}

export interface OperationalRateResolutionInput {
  tripDate: Date;
  vehicleRates?: VehicleOperationalRateInput | null;
  capacityRate?: CapacityRateFallback | null;
  globalFuelRate?: RateValue;
  contractFuelRate?: RateValue;
}

export interface ResolvedOperationalRates {
  hiringChargePerRound: string;
  averageKmPerLitre: string;
  fuelRatePerLitre: string;
  sources: {
    hiringChargePerRound: 'vehicle' | 'contract_capacity';
    averageKmPerLitre: 'vehicle' | 'contract_capacity';
    fuelRatePerLitre: 'vehicle' | 'global_hsd' | 'contract_fallback';
  };
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
    const hiringChargePerRound = vehicleRates?.hiringChargePerRound ?? input.capacityRate?.baseHiringRatePerRound;
    const averageKmPerLitre = vehicleRates?.averageKmPerLitre ?? input.capacityRate?.contractualAverageKmPerLitre;
    const fuelRatePerLitre = vehicleRates?.fuelRatePerLitre ?? input.globalFuelRate ?? input.contractFuelRate;

    return {
      hiringChargePerRound: requirePositiveRate(hiringChargePerRound, 'Hiring charge per round'),
      averageKmPerLitre: requirePositiveRate(averageKmPerLitre, 'Average fuel consumption'),
      fuelRatePerLitre: requirePositiveRate(fuelRatePerLitre, 'Fuel rate per litre'),
      sources: {
        hiringChargePerRound: vehicleRates?.hiringChargePerRound !== undefined ? 'vehicle' : 'contract_capacity',
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