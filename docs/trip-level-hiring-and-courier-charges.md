# Trip-level hiring charge and courier

Implemented 30 October 2026. The backend remains the only financial calculator. Finalized invoices are never recalculated.

## Rules

```text
Hiring amount = trip hiring charge × multiplier
Courier amount = trip courier charges, or 0 when blank
Bill total = fuel + hiring + toll + other existing charges + courier
```

- **Hiring charge** is required when a trip is created through the API. It is rupees per round, and it must be greater than zero. Billing does not read a hiring charge from the vehicle.
- **Hiring multiplier** is optional and typed on the trip. Any number greater than zero is accepted, for example `1.25` or `3`. A typed multiplier is final for that trip. It is not combined with other trips on the same day. Leave the field blank to use the KM slab.
- **Courier** is optional. The operator decides whether to fill it. It is not limited to a vehicle type. Blank and `0` are stored as absent. There is no courier reference or notes field.
- Courier and loading/unloading are the same commercial charge. The amount is typed on the trip. Expense-module loading/unloading stays a company cost and is never copied onto the bill.

KM slabs are unchanged when the multiplier is left blank:

| Distance | Multiplier |
|---|---:|
| Less than 127 km | 0.5 |
| 127 km up to, but not including, 500 km | 1 |
| 500 km through 700 km | 1.5 |
| More than 700 km | 2 |

## Precedence

Hiring charge, in order:

1. `trip.hiringChargePerRound`
2. The hiring charge already stored on `trip.rateSnapshot`
3. The contract capacity rate, only when both of the above are absent

Step 3 keeps older unbilled trips and existing billing fixtures calculable. A new trip cannot reach it, because create validation requires the trip charge. Editing a legacy trip without sending a new charge keeps the snapshot charge. Editing a legacy trip that has neither a trip charge nor a snapshot charge does not invent one; that trip still bills through the capacity fallback.

Average still comes from the vehicle operational rate, then the contract capacity rate. Fuel still comes from the vehicle rate, then the global HSD rate, then the contract.

Multiplier:

1. `trip.hiringMultiplier` when it is greater than zero (`hiringMultiplierSource = trip`)
2. The KM slab (`hiringMultiplierSource = km_threshold`)

`PATCH` behaviour:

| Field | Omitted | `null` | `0` |
|---|---|---|---|
| `hiringChargePerRound` | Unchanged | Rejected | Rejected |
| `hiringMultiplier` | Unchanged | Cleared; the KM slab applies again | Rejected; the multiplier must be greater than zero |
| `courierCharges` | Unchanged | Cleared | Cleared (treated as absent) |

## Display

- Monthly billing, invoice details, billing overview, and the PDF show courier only when some trip on that bill has a courier amount above zero.
- The PDF inserts a 44-point COURIER column before TOTAL, taking 22 points from FROM and 22 points from TO. Bills with no courier keep the previous columns.
- A manual multiplier is printed with `*` and a footnote. A slab multiplier has no mark.
- The dashboard vehicle row includes `courierAmount`, using zero when the month has no courier.

## Backward compatibility

- Vehicle `operationalRates.hiringChargePerRound` is removed from the schema, validation, and vehicle form. Average and the optional fuel rate remain.
- `npm run remove-vehicle-hiring-charges` (from `backend`) unsets that path with a native collection update. It is idempotent. It does not change trips or invoices. It was tested in memory and has not been run against the live database.
- Contract capacity hiring rates stay stored so old contracts remain valid. They are not copied onto new or edited trip snapshots.
- Legacy trips without a trip hiring charge keep the charge already in `rateSnapshot`. Nothing is backfilled.
- Finalized invoices stay frozen. Approve regenerates drafts. A later save of an old invoice may apply the `summary.courierAmount` default of `0` without changing the total.
- Invoice line `baseHiringRateSource` is `trip` when the trip field is set, otherwise the snapshot source, otherwise `contract_capacity`.

## Worked examples

Fuel, toll, and other charges are omitted here so the new amounts are easy to check. A real bill adds them.

**Trip A.** Hiring charge `3000`, multiplier left blank, distance `600` km, courier `200`.

The 600 km slab is `1`, so hiring is `3000`. Courier is `200`. These two components contribute `3200`.

**Trip B.** Hiring charge `8000`, multiplier `2`, no courier.

Hiring is `16000`. Courier is `0`, so the bill column stays hidden unless another trip on the same bill has courier.

**Same bill.** Summary courier is `200`. The component sum is fuel + hiring + toll + other charges + `200`.

**Legacy trip.** No trip hiring field, snapshot hiring `4500`, multiplier blank, distance `100` km.

Hiring stays `4500 × 0.5 = 2250`. Saving the trip without a new hiring charge does not replace `4500`. Sending `hiringChargePerRound: 5000` on edit replaces it from then on.

## Related documents

- [`billing-engine.md`](./billing-engine.md) — formula and result fields
- [`mongodb-design.md`](./mongodb-design.md) — stored fields and what "absent" means
- [`frontend-api-integration.md`](./frontend-api-integration.md) — trip payload and invoice response
- [`business-rule-revision-2026-10.md`](./business-rule-revision-2026-10.md) — Q-16 remains open; a trip multiplier does not aggregate a day's distance
- [`requirements-analysis.md`](./requirements-analysis.md) — OQ-09, the loading/unloading question
