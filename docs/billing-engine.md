# Billing Engine

## Responsibility

The billing engine is a pure backend domain service. It does not depend on React, Express controllers, MongoDB queries, invoice screens, or company expense records.

Entry point:

```ts
calculateTripBilling(trip, vehicle, contract, contractVersion, billingRules, applicableFuelRate)
```

It receives the trip distance/toll, actual vehicle capacity, contract/version identifiers, configured billing rules, and the applicable fuel rate. It returns a detailed deterministic calculation result containing the rule/version identifiers used.

## Fuel

```text
fuelLitres = distanceKm / contractualAverage
fuelAmount = fuelLitres * applicableFuelRate
```

The contractual average comes from the matching vehicle capacity rule in the supplied contract version. Actual fuel receipts are intentionally not accepted by the engine and cannot affect factory fuel reimbursement. They belong to the separate company expense domain.

## Hiring

**Current implementation:** hiring is configured in the contract version by vehicle capacity, as a rate per round. The engine then determines the number of rounds from the configured KM slab table. **Proposed target:** the owner clarified on 15 October 2026 that the base hiring rate is fixed per vehicle; the threshold multiplier still applies to that fixed per-vehicle base rate.

```text
hiringAmount = capacityHiringRatePerRound * roundsForDistance
```

The four owner-provided KM slabs are:

| Distance covered | Rounds |
|---|---:|
| 0 <= distance < 127 KM | 0.5 |
| 127 <= distance < 500 KM | 1 |
| 500 <= distance <= 700 KM | 1.5 |
| distance > 700 KM | 2 |

The current contract-version configuration supports:

```text
capacity -> hiring rate per round
KM slab  -> rounds/multiplier
```

The current backend rule structure represents this as `capacityRates[].baseHiringRatePerRound` and `kmThresholds[].rounds`. The engine does not hard-code capacity rates or KM slabs; it consumes the selected version's configuration. The proposed vehicle-owned fixed base rate is documented in [`business-rule-revision-2026-10.md`](./business-rule-revision-2026-10.md) §5.3.

The Phase 2 threshold lookup sorts the supplied `billingRules.kmThresholds` by `upToKm`, then selects the first finite threshold where:

```text
distanceKm < upToKm
```

If the distance exactly equals the highest finite `upToKm`, that final finite row applies. This makes
700 KM map to 1.5 rounds while values above 700 use the final unlimited row. An omitted `upToKm` is
the unlimited threshold; its configured `rounds` value applies after the highest finite boundary.
The selected `rounds` value is returned as `hiringMultiplier`, and:

```text
hiringAmount = baseHiringRatePerRound * configuredRounds
```

The engine does not invent a rule when no configured threshold matches; it throws `BillingRuleConfigurationError`.

### Boundary semantics

Implemented in Phase 2: `<127 → 0.5`, `127 through <500 → 1`, `500 through 700 → 1.5`, and `>700 → 2`. Exactly 127 is assigned to the 1-round row, following the prior documented lower-bound assumption. Decimal distances are supported: 700.1 uses 2 rounds. Threshold rows are sorted defensively by the engine; contract API validation continues to require ascending, non-overlapping boundaries and a final unlimited row. Boundary tests now align with these rules.

## Toll and other charges

- `actual`: includes the trip's recorded toll amount.
- `excluded`: contributes zero toll amount.
- `fixed`: currently contributes zero because the existing backend rule model does not provide a fixed toll amount. This is an explicit TODO/confirmation point, not an invented value.
- Active `otherBillableCharges` are summed from the supplied version. Their configured basis is preserved in the rule model, but this engine does not apply per-KM/per-round multiplication yet because the backend contract does not define the charge quantity source. This is an explicit TODO/confirmation point.

## Decimal and rounding policy

The engine uses a small exact decimal implementation backed by `bigint`, not JavaScript floating-point arithmetic.

- Fuel litres remain unrounded at division scale internally.
- Fuel amount is rounded to 2 decimal places using `ROUND_HALF_UP`.
- Hiring amount is rounded to 2 decimal places using `ROUND_HALF_UP`.
- Billable toll and other-charge outputs are rounded to 2 decimal places.
- Total amount is rounded to 2 decimal places after adding the line components.
- Intermediate fuel litres and other calculation inputs are not rounded.
- Results are returned as decimal strings for safe persistence/serialization.

The result includes a `rounding` metadata object documenting this policy.

## Result fields

The result includes:

```text
distanceKm
contractualAverage
fuelLitres
fuelRate
fuelAmount
hiringMultiplier
baseHiringRate
hiringAmount
tollAmount
otherBillableAmount
totalAmount
contractId
contractVersionId
contractVersion
vehicleId
vehicleCapacity
rounding
```

## Historical safety

The engine consumes an already selected `contractVersion` and does not query or mutate contracts. A caller must resolve the effective version for the trip date before calling it and persist the returned identifiers with the calculation/bill snapshot. Changing current contract configuration therefore cannot silently recalculate a finalized historical result.

## Tests

The unit suite covers 100, 310, 500, 501, 550, 700, 701, and 750 KM, multiple vehicle capacities/averages, actual versus excluded tolls, missing capacity rules, and missing KM mappings. Expected values are asserted only where the supplied configuration and confirmed formulas determine them.

---

## Proposed Rate Ownership and Daily Distance (Pending Implementation)

The engine's verified current behavior is described above: it gets average and hiring rate from the
matching contract-version capacity rule, uses an externally supplied global-first fuel rate, and
compares the provided `distanceKm` against the configured thresholds. The proposed business-rule
revision changes the caller's rate sources, not the meaning of the hiring formula:

```text
fuelLitres = dailyDistanceKm / vehicle.averageKmPerLitre
fuelAmount = fuelLitres * applicableFuelRate
hiringAmount = vehicle.hiringChargePerRound * roundsForDailyDistance
```

The hiring charge remains **currency per round**, not currency per kilometre. Contract versions
remain necessary for commercial terms and threshold configuration. Vehicle rates should be resolved
before calling the pure engine, with existing contract capacity rates and global HSD history retained
as a legacy fallback until migration is complete.

When trips span calendar days, the threshold input must be each day's distance, never the full trip or
monthly total. Whether that requires per-day invoice lines and how total trip distance is apportioned
are unresolved business decisions (Q-2); no calculation rule is implied here. The revision request's
threshold wording also conflicts with the previously owner-confirmed 0.5-round short-trip slab and
workbook evidence. Q-1 must be resolved before changing threshold fixtures or production rules.

The detailed verified formulas, threshold fixture mismatch, and phased implementation gates are in
[`business-rule-revision-2026-10.md`](./business-rule-revision-2026-10.md) §§2, 5, 10–11.