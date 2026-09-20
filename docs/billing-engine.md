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

Hiring is configured by the owner/admin per vehicle capacity. A capacity configuration contains the applicable hiring rate per round. The engine then determines the number of rounds from the configured KM slab table:

```text
hiringAmount = capacityHiringRatePerRound * roundsForDistance
```

The four owner-provided KM slabs are:

| Distance covered | Rounds |
|---|---:|
| Less than 127 KM | 0.5 |
| Greater than 127 KM and less than 500 KM | 1 |
| Greater than 500 KM and less than 700 KM | 1.5 |
| Greater than 700 KM | 2 |

The owner/admin configuration should therefore support, per contract version:

```text
capacity -> hiring rate per round
KM slab  -> rounds/multiplier
```

The current backend rule structure represents this as `capacityRates[].baseHiringRatePerRound` and `kmThresholds[].rounds`. The engine does not hard-code capacity rates or KM slabs; it consumes the selected version's configuration.

The generic threshold lookup uses the supplied `billingRules.kmThresholds` table and selects the first configured threshold where:

```text
distanceKm < upToKm
```

An omitted `upToKm` is the final unlimited threshold. Its configured `rounds` value is returned as `hiringMultiplier`, and:

```text
hiringAmount = baseHiringRatePerRound * configuredRounds
```

The engine does not invent a rule when no configured threshold matches; it throws `BillingRuleConfigurationError`.

### Boundary confirmation required

The supplied wording uses strict comparisons and does not state which slab owns exactly `127`, `500`, or `700` KM. The configuration must explicitly settle those equality cases before production billing. Until then, do not silently assign them in application code. The unit tests use an explicit configuration representation for the confirmed operational interpretation and keep the engine itself generic.

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