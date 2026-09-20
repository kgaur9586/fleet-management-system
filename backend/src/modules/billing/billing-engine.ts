import { IBillingRules, ICapacityBillingRule } from '../contracts/billing-rule.model';

export type DecimalInput = string | number | { toString(): string };

export interface BillingEngineTrip {
  tripId?: string;
  distanceKm: DecimalInput;
  tollAmount?: DecimalInput;
}

export interface BillingEngineVehicle {
  vehicleId?: string;
  capacity: number;
}

export interface BillingEngineContract {
  contractId: string;
}

export interface BillingEngineVersion {
  contractVersionId: string;
  version?: number;
}

export interface BillingCalculationResult {
  tripId?: string;
  distanceKm: string;
  contractualAverage: string;
  fuelLitres: string;
  fuelRate: string;
  fuelAmount: string;
  hiringMultiplier: string;
  baseHiringRate: string;
  hiringAmount: string;
  tollAmount: string;
  otherBillableAmount: string;
  totalAmount: string;
  contractId: string;
  contractVersionId: string;
  contractVersion?: number;
  vehicleId?: string;
  vehicleCapacity: number;
  rounding: {
    monetaryScale: number;
    monetaryMode: 'ROUND_HALF_UP';
    intermediateValuesRounded: false;
  };
}

export class BillingRuleConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BillingRuleConfigurationError';
  }
}

const MONEY_SCALE = 2;
const DIVISION_SCALE = 12;

class Decimal {
  private constructor(private readonly coefficient: bigint, private readonly scale: number) {}

  static from(value: DecimalInput): Decimal {
    const text = value.toString().trim();
    if (!/^-?\d+(\.\d+)?$/.test(text)) throw new BillingRuleConfigurationError(`Invalid decimal value: ${text}`);
    const negative = text.startsWith('-');
    const unsigned = negative ? text.slice(1) : text;
    const [whole, fraction = ''] = unsigned.split('.');
    const coefficient = BigInt(`${negative ? '-' : ''}${whole}${fraction}`);
    return new Decimal(coefficient, fraction.length).normalize();
  }

  add(other: Decimal) { const scale = Math.max(this.scale, other.scale); return new Decimal(this.coefficient * Decimal.ten(scale - this.scale) + other.coefficient * Decimal.ten(scale - other.scale), scale).normalize(); }
  subtract(other: Decimal) { return this.add(other.negate()); }
  multiply(other: Decimal) { return new Decimal(this.coefficient * other.coefficient, this.scale + other.scale).normalize(); }
  divide(other: Decimal, scale = DIVISION_SCALE) {
    if (other.coefficient === 0n) throw new BillingRuleConfigurationError('Cannot divide by zero');
    const sign = (this.coefficient < 0n) === (other.coefficient < 0n) ? 1n : -1n;
    const numerator = (this.coefficient < 0n ? -this.coefficient : this.coefficient) * Decimal.ten(scale + other.scale);
    const denominator = other.coefficient < 0n ? -other.coefficient : other.coefficient;
    return new Decimal(sign * (numerator / denominator), scale).normalize();
  }
  round(scale: number) {
    if (this.scale <= scale) return this;
    const divisor = Decimal.ten(this.scale - scale);
    const absolute = this.coefficient < 0n ? -this.coefficient : this.coefficient;
    const quotient = absolute / divisor;
    const remainder = absolute % divisor;
    const rounded = remainder * 2n >= divisor ? quotient + 1n : quotient;
    return new Decimal(this.coefficient < 0n ? -rounded : rounded, scale).normalize();
  }
  toString() {
    const negative = this.coefficient < 0n;
    const absolute = negative ? -this.coefficient : this.coefficient;
    const digits = absolute.toString().padStart(this.scale + 1, '0');
    if (this.scale === 0) return `${negative ? '-' : ''}${digits}`;
    const split = digits.length - this.scale;
    return `${negative ? '-' : ''}${digits.slice(0, split)}.${digits.slice(split)}`.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  }
  private negate() { return new Decimal(-this.coefficient, this.scale); }
  private normalize() { if (this.coefficient === 0n) return new Decimal(0n, 0); let coefficient = this.coefficient; let scale = this.scale; while (scale > 0 && coefficient % 10n === 0n) { coefficient /= 10n; scale -= 1; } return new Decimal(coefficient, scale); }
  private static ten(power: number) { return 10n ** BigInt(power); }
}

function findCapacityRule(rules: IBillingRules, capacity: number): ICapacityBillingRule {
  const rule = rules.capacityRates.find((candidate) => candidate.capacity === capacity);
  if (!rule) throw new BillingRuleConfigurationError(`No billing rule exists for vehicle capacity ${capacity}`);
  return rule;
}

function findRounds(rules: IBillingRules, distanceKm: number) {
  const threshold = rules.kmThresholds.find((candidate) => candidate.upToKm === undefined || distanceKm < candidate.upToKm);
  if (!threshold) throw new BillingRuleConfigurationError(`No KM threshold matches distance ${distanceKm}`);
  return Decimal.from(threshold.rounds);
}

export function calculateTripBilling(
  trip: BillingEngineTrip,
  vehicle: BillingEngineVehicle,
  contract: BillingEngineContract,
  contractVersion: BillingEngineVersion,
  billingRules: IBillingRules,
  applicableFuelRate: DecimalInput,
): BillingCalculationResult {
  const distance = Decimal.from(trip.distanceKm);
  const distanceNumber = Number(distance.toString());
  if (!Number.isFinite(distanceNumber) || distanceNumber <= 0) throw new BillingRuleConfigurationError('Distance must be greater than zero');
  const capacityRule = findCapacityRule(billingRules, vehicle.capacity);
  const average = Decimal.from(capacityRule.contractualAverageKmPerLitre);
  const baseHiringRate = Decimal.from(capacityRule.baseHiringRatePerRound);
  const fuelRate = Decimal.from(applicableFuelRate);
  const fuelLitres = distance.divide(average);
  const fuelAmount = fuelLitres.multiply(fuelRate).round(MONEY_SCALE);
  const hiringMultiplier = findRounds(billingRules, distanceNumber);
  const hiringAmount = baseHiringRate.multiply(hiringMultiplier).round(MONEY_SCALE);
  const actualToll = Decimal.from(trip.tollAmount ?? 0);
  const tollAmount = billingRules.tollTreatment === 'actual' ? actualToll.round(MONEY_SCALE) : Decimal.from(0);
  const otherBillableAmount = billingRules.otherBillableCharges.filter((charge) => charge.isActive).reduce((total, charge) => total.add(Decimal.from(charge.amount)), Decimal.from(0)).round(MONEY_SCALE);
  const totalAmount = fuelAmount.add(hiringAmount).add(tollAmount).add(otherBillableAmount).round(MONEY_SCALE);
  return { tripId: trip.tripId, distanceKm: distance.toString(), contractualAverage: average.toString(), fuelLitres: fuelLitres.toString(), fuelRate: fuelRate.toString(), fuelAmount: fuelAmount.toString(), hiringMultiplier: hiringMultiplier.toString(), baseHiringRate: baseHiringRate.toString(), hiringAmount: hiringAmount.toString(), tollAmount: tollAmount.toString(), otherBillableAmount: otherBillableAmount.toString(), totalAmount: totalAmount.toString(), contractId: contract.contractId, contractVersionId: contractVersion.contractVersionId, contractVersion: contractVersion.version, vehicleId: vehicle.vehicleId, vehicleCapacity: vehicle.capacity, rounding: { monetaryScale: MONEY_SCALE, monetaryMode: 'ROUND_HALF_UP', intermediateValuesRounded: false } };
}