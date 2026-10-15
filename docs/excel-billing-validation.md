# Excel Billing Validation

## Reference

The reference workbook is `docs/NIR TANKER BILL.xlsx`. It contains five representative vehicle bill blocks:

| Bill | Vehicle | Capacity | Average | Observed examples |
|---|---|---:|---:|---|
| NIR/06/26-27/11 | UP13DT0632 | 29,000 | 2.5 | 589 KM, 1.5 rounds, ₹4,500/round |
| NIR/06/26-27/12 | UP13BT5953 | 23,000 | 3.0 | 110 KM/0.5, 310 KM/1.0, ₹3,000/round |
| NIR/05/26-27/13 | UP81BT5189 | 23,000 | 3.0 | 652 KM/1.5, ₹3,000/round; bill number says 05, but header period/date say June 2026 / 30-Jun |
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

The workbook formulas retain full repeating monetary values and grand totals sum those raw formulas. The amount cells use a zero-decimal display format. The application engine instead rounds each line amount to 2 decimal places using `ROUND_HALF_UP`, sums those rounded outputs, and its PDF prints two decimals:

| Workbook value | Application value |
|---:|---:|
| 22,572.836 | 22,572.84 |
| 3,513.03333333333 | 3,513.03 |
| 9,900.36666666667 | 9,900.37 |
| 34,002.836 | 34,002.84 |

The backend test currently asserts the application's 2dp policy; it does not assert parity with the workbook's raw-precision grand total. Whether the intended production rule is raw calculation then whole-rupee display, or 2dp calculation and display, remains open in Q-18.

## Differences and confirmed-rule conflicts

1. **Rounding:** Excel formulas do not apply `ROUND`; e.g. line J7 stores 22572.836, line M7 stores 34002.836, and grand total M36 stores 986082.244. The cells display zero decimal places. The application rounds at 2dp and the PDF shows 2dp, so saved totals and displayed amounts differ by policy (Q-18).
2. **Short-trip and threshold bands:** The workbook demonstrates 97 and 110 km at 0.5 rounds, 310 km at 1 round, and 589/652 km at 1.5 rounds. The owner confirms 0–127 → 0.5, 127–500 → 1, 500–700 → 1.5, and >700 → 2. Phase 2 implements exactly 127 as 1 round, following existing assumption A-01; exactly 700 is 1.5. Revisit only if the owner intended 127 to stay in the 0.5 band.
3. **Same-day trip aggregation:** UP13BT5953 has two runs on each of eight dates, 110 km + 310 km = 420 km/day. The workbook applies 0.5 + 1.0 = 1.5 rounds per line. One threshold on the combined daily distance would be 1.0 round under the confirmed bands. This is a confirmed difference between historical billing and requested daily aggregation, not a mere test-fixture issue (Q-16).
4. **Invoice month mismatch:** `NIR/05/26-27/13` is labeled `PERIOD:-MONTH JUNE 2026` and generated 30/06/2026. Bill number month and printed period disagree (Q-17).
5. **Vehicle rate ownership:** The workbook demonstrates one base rate per capacity in the sampled bills; it does not demonstrate two same-capacity vehicles with different rates. The owner has clarified that future base hiring rates are fixed per vehicle, with the threshold multiplier applied to that vehicle's base rate.
6. **Toll source:** The workbook includes actual toll amounts on some rows, including `445` for a 310 KM row and `6,240` for a 652 KM row. The engine uses the supplied trip toll only when the contract's toll treatment is `actual`.
7. **Other charges:** No separate other billable charge is evidenced in the sampled rows. The engine does not infer one.

## Scope boundary

This validation covers line-level calculation behavior. It does not implement invoice generation, monthly bill aggregation, PDF generation, or workbook import.

## October 2026 Revision Impact (Pending Implementation)

The owner has confirmed the four threshold bands, including the short-trip 0.5 round. Do not change
the historical workbook inputs. Phase 2 implements the exact 127 precedence from A-01 and handles
decimal distances above 700 with the unlimited 2-round row. See
[`business-rule-revision-2026-10.md`](./business-rule-revision-2026-10.md) for the full rule mapping.

The confirmed formula `hiringAmount = rounds × baseHiringRatePerRound` means hiring charge is a
per-round base rate, not a per-kilometre rate. The owner clarifies that the base rate is fixed per
vehicle; current workbook examples are capacity-based and do not prove that vehicle-level distinction.
Daily aggregation changes the eight 420-km days noted above. Multi-day trip distance allocation
remains open (Q-2), while same-day multi-run aggregation and invoice-line representation are open
(Q-16).