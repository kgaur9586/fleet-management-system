# Excel Billing Validation

## Reference

The reference workbook is `docs/NIR TANKER BILL.xlsx`. It contains five representative vehicle bill blocks:

| Bill | Vehicle | Capacity | Average | Observed examples |
|---|---|---:|---:|---|
| NIR/06/26-27/11 | UP13DT0632 | 29,000 | 2.5 | 589 KM, 1.5 rounds, ₹4,500/round |
| NIR/06/26-27/12 | UP13BT5953 | 23,000 | 3.0 | 110 KM/0.5, 310 KM/1.0, ₹3,000/round |
| NIR/05/26-27/13 | UP81BT5189 | 23,000 | 3.0 | 652 KM/1.5, ₹3,000/round |
| NIR/06/26-27/14 | UP13ET6255 | 34,000 | 2.3 | 365/450 KM, 1.0 round, ₹5,000/round |
| NIR/06/26-27/15 | UP13ET6256 | 12,000 | 4.0 | 97 KM/0.5 round, ₹1,400/round |

## Observed workbook formulas

For each line, the workbook uses:

```text
fuelLitres = KM / average
fuelAmount = fuelLitres * HSD rate
hiringAmount = rounds * capacity hiring rate
total = fuelAmount + hiringAmount + toll
```

Actual fuel receipts are not present in these factory billing rows and are not used by the application engine. They remain separate company expenses.

## Representative row comparisons

The automated validation suite is `backend/src/modules/billing/__tests__/excel-billing-validation.test.ts`. It covers these inputs and expected workbook values:

| Case | Vehicle | Capacity | Average | KM | Fuel rate | Base rate | Multiplier | Toll | Excel fuel litres | Excel fuel amount | Excel hiring | Excel total |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| NIR/06/26-27/11 row 1 | UP13DT0632 | 29,000 | 2.5 | 589 | 95.81 | 4,500 | 1.5 | 4,680 | 235.6 | 22,572.836 | 6,750 | 34,002.836 |
| NIR/06/26-27/12 row 1 | UP13BT5953 | 23,000 | 3.0 | 110 | 95.81 | 3,000 | 0.5 | 0 | 36.6666666666667 | 3,513.03333333333 | 1,500 | 5,013.03333333333 |
| NIR/06/26-27/12 row 2 | UP13BT5953 | 23,000 | 3.0 | 310 | 95.81 | 3,000 | 1.0 | 0 | 103.333333333333 | 9,900.36666666667 | 3,000 | 12,900.3666666667 |
| NIR/06/26-27/12 row 6 | UP13BT5953 | 23,000 | 3.0 | 310 | 95.81 | 3,000 | 1.0 | 445 | 103.333333333333 | 9,900.36666666667 | 3,000 | 13,345.3666666667 |
| NIR/05/26-27/13 row 1 | UP81BT5189 | 23,000 | 3.0 | 652 | 95.81 | 3,000 | 1.5 | 4,680 | 217.333333333333 | 20,822.7066666667 | 4,500 | 30,002.7066666667 |
| NIR/06/26-27/14 row 1 | UP13ET6255 | 34,000 | 2.3 | 365 | 95.81 | 5,000 | 1.0 | 2,295 | 158.695652173913 | 15,204.6304347826 | 5,000 | 22,499.6304347826 |
| NIR/06/26-27/14 row 3 | UP13ET6255 | 34,000 | 2.3 | 450 | 95.81 | 5,000 | 1.0 | 2,350 | 195.652173913044 | 18,745.4347826087 | 5,000 | 26,095.4347826087 |
| NIR/06/26-27/15 row 1 | UP13ET6256 | 12,000 | 4.0 | 97 | 95.81 | 1,400 | 0.5 | 0 | 24.25 | 2,323.3925 | 700 | 3,023.3925 |

## Comparison policy

The test compares exact configured inputs, capacity averages, hiring rates, multipliers, hiring amounts, and tolls. Repeating fuel litres are compared numerically at the engine's deterministic division precision.

The workbook retains full repeating monetary values. The application engine intentionally rounds fuel amount and total to 2 decimal places using `ROUND_HALF_UP`:

| Workbook value | Application value |
|---:|---:|
| 22,572.836 | 22,572.84 |
| 3,513.03333333333 | 3,513.03 |
| 9,900.36666666667 | 9,900.37 |
| 34,002.836 | 34,002.84 |

This is an intentional application policy documented in `docs/billing-engine.md`, not a silent copy of Excel precision.

## Differences and confirmed-rule conflicts

1. **Rounding:** Excel stores/calculates repeating monetary fractions in the sample rows. The application rounds monetary line outputs and totals to two decimal places for currency-safe results. This is intentional and must be confirmed as the production presentation/accounting policy.
2. **Short-trip threshold:** The workbook demonstrates `97` and `110` KM as `0.5` rounds, but it does not establish the exact upper boundary. The engine consumes the configured slab and does not invent one.
3. **Strict equality boundaries:** The supplied business wording says `<127`, `>127 and <500`, `>500 and <700`, and `>700`; exact `127`, `500`, and `700` behavior is not stated. Tests use explicit fixture thresholds and the engine remains configuration-driven.
4. **Toll source:** The workbook includes actual toll amounts on some rows, including `445` for a 310 KM row and `6,240` for a 652 KM row. The engine uses the supplied trip toll only when the contract's toll treatment is `actual`.
5. **Other charges:** No separate other billable charge is evidenced in the sampled rows. The engine does not infer one.

## Scope boundary

This validation covers line-level calculation behavior. It does not implement invoice generation, monthly bill aggregation, PDF generation, or workbook import.