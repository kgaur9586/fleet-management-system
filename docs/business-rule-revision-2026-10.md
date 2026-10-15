# Business Rule Revision — October 2026

**Status: Phases 1–4 implemented on 15 October 2026; Phases 5–7 remain pending. No schema migration or production data change has been made.**

| Phase | Status | Verification |
|---|---|---|
| 0 — Decision lock / baseline | Partial | Threshold bands implemented; Q-18 and later-phase decisions remain. No pre-change full-suite baseline was captured. |
| 1 — Invoice trip lock / draft refresh | Implemented | Full backend suite 20/20 suites, 125/125 tests after Phase 4; frontend production build passed |
| 2 — Billing thresholds | Implemented; awaiting manual verification | Full backend suite 19/19 suites, 115/115 tests; focused threshold, Excel parity, and contract validation suites 40/40; frontend build passed |
| 3 — Vehicle operational rates | Implemented; awaiting manual verification | Vehicle API 9/9, resolver 5/5, frontend build passed; billing still uses legacy sources |
| 4 — Route distance and trip snapshots | Implemented; awaiting route-data/manual verification | Full backend suite 20/20 suites, 125/125 tests; frontend build passed |
| 5–7 | Not started | Await user verification of Phases 1–4; later phases depend on open business decisions below |

This document is the single planning artefact for four related business-rule revisions. It records the
**verified current state** of the implementation, the **proposed target behaviour**, the cross-module
impact, the migration strategy, the test plan, and a phased implementation sequence.

Section 2 records the investigation baseline. Phase 1 implementation updates are identified inline;
the remaining behavior described as proposed has not been implemented. Where documentation
contradicts the code, the contradiction is recorded in Section 3 rather than silently resolved.

**Legend**

| Label | Meaning |
|---|---|
| **VERIFIED** | Confirmed by reading the named source file |
| **PROPOSED** | Target design, not implemented |
| **ASSUMPTION** | Inferred, needs owner confirmation |
| **OPEN** | Business decision that cannot be inferred — blocks part of the plan |

---

## Table of Contents

1. [Scope](#1-scope)
2. [Current-State Assessment (verified)](#2-current-state-assessment-verified)
3. [Documentation vs Implementation Discrepancies](#3-documentation-vs-implementation-discrepancies)
4. [BR-1 — Multi-day trips and driver wages](#4-br-1--multi-day-trips-and-driver-wages)
5. [BR-2 — Vehicle as the source of billing rates](#5-br-2--vehicle-as-the-source-of-billing-rates)
6. [BR-3 — Route distance instead of start/end KM](#6-br-3--route-distance-instead-of-startend-km)
7. [BR-4 — Rate snapshots and the authoritative-value model](#7-br-4--rate-snapshots-and-the-authoritative-value-model)
8. [Cross-module impact matrix](#8-cross-module-impact-matrix)
9. [Database, API and migration planning](#9-database-api-and-migration-planning)
10. [Testing and regression strategy](#10-testing-and-regression-strategy)
11. [Phased implementation plan](#11-phased-implementation-plan)
12. [Risk register](#12-risk-register)
13. [Unresolved questions](#13-unresolved-questions)
14. [Readiness assessment](#14-readiness-assessment)

---

## 1. Scope

| # | Requirement | One-line summary |
|---|---|---|
| BR-1 | Multi-day trips and driver wages | A trip may span several calendar days; the driver must be paid for every eligible day |
| BR-2 | Vehicle-sourced billing rates | Hiring charge, average (km/L) and fuel rate come from the vehicle, not the contract version; KM thresholds must be applied correctly to the **daily** distance |
| BR-3 | Route distance replaces manual KM | Trip distance is resolved server-side from the selected route; `startKm`/`endKm` are removed from ordinary trip entry |
| BR-4 | Rate snapshots | Define which rates are authoritative at trip creation, trip completion and invoicing, so historical records never silently change |

Out of scope: removal of the Contracts module, GST, PDF layout changes, Company CRUD, frontend test
infrastructure.

---

## 2. Current-State Assessment (verified)

### 2.1 Trip (`backend/src/modules/trips/`)

**Model — `trip.model.ts`**

| Field | Verified behaviour |
|---|---|
| `tripDate: Date` (required, indexed) | **Single date only.** There is no `tripEndDate`, no start/end timestamp pair, and no duration field. A trip is structurally a one-day record. |
| `startKm?: number`, `endKm?: number` | Optional on the backend, `min: 0` |
| `totalKm: number` (required, `min: 0`) | **Client-supplied.** Nothing derives it from the route. |
| `routeId?: ObjectId` | Optional reference. The route's distance is never read. |
| `contractId`, `contractVersionId` | Both **required**. A trip cannot exist without a contract. |
| `billingInvoiceId?` | Set when the trip is pulled into an invoice |
| `operationalStatus` | `planned \| in_progress \| completed \| cancelled`, default `planned` |
| `toll.amount` | `Decimal128` |
| `operationalInfo` | `Schema.Types.Mixed`, default `{}` |

**There are no stored calculation fields on the trip** — no `average`, `hsdRate`, `hiringCharge`,
`rounds`, or `tripTotal`. All billing maths happens later, at invoice generation.

**Service — `trip.service.ts`**

- `TripService.create` → `requireDate(data.tripDate)` → `validateReferences` → `ContractService.getEffectiveVersion(contractId, tripDate)` → `TripModel.create`.
- `validateReferences` loads vehicle, driver, firm, contract and optional route; all must be `isDeleted: false, isActive: true`. It asserts `vehicle.firmId === firm._id` and `contract.firmId === firm._id`. **It loads the route but ignores `route.expectedDistanceKm` entirely.**
- `validateKilometers` requires `totalKm > 0`, and when both `startKm` and `endKm` are present requires `endKm >= startKm` and `totalKm === endKm - startKm`.
- `TripService.update` re-resolves `contractVersionId` **only** when `contractId` or `tripDate` changes.
- **Baseline gap, fixed in Phase 1:** `update` and `delete` previously ignored `billingInvoiceId`. They now return 409 when the linked invoice is approved/finalized; reopening the invoice removes the link and restores editability. Draft-linked edits remain allowed and refresh the draft snapshot.
- `GET /trips/:id` now includes `billingInvoiceStatus` when a trip has an invoice link. The frontend presents approved/finalized trips read-only and routes direct edit attempts back to the trip detail view.
- There is **no dedicated completion endpoint**. `operationalStatus` is changed by an ordinary `PATCH`, with no transition guard.

**Validation — `trip.validation.ts`** mirrors the service rules in Zod. Note the repo-wide caveat:
`validateResource` parses for throwing only and discards the transformed object.

### 2.2 Route (`backend/src/modules/routes/route.model.ts`)

- `expectedDistanceKm?: number` (`min: 0`) — **optional, and never consumed by any calculation.**
- Verified consumers of `expectedDistanceKm`: route CRUD validation, `RouteFormPage`, `RouteListPage`, `RouteDetailsPage`, `route.test.ts`. **Zero backend calculation usage.**
- Soft delete is `isDeleted`; `isActive` is a separate flag. `TripService` requires `isDeleted: false, isActive: true`.
- No field states whether the distance is one-way or round-trip.

### 2.3 Vehicle (`backend/src/modules/vehicles/vehicle.model.ts`)

- Fields: `registrationNumber`, `vehicleType`, `capacity`, `make`, `vehicleModel`, `isActive`, `isDeleted`, `firmId`, `vehicleNumberPerFirm`, `status`, `metadata: Mixed`.
- **There is no hiring charge, no fuel average, and no fuel rate on the vehicle.** `capacity` is the only billing-relevant attribute, and it is used purely as a *lookup key* into the contract version.
- `metadata` is an untyped `Mixed` bag — it is not validated and must not be used as the new rate home.

### 2.4 Contract / ContractVersion / BillingRules (`backend/src/modules/contracts/`)

- `Contract`: `firmId` (required), `companyId` (optional), `name`, `description`, `isActive`, `isDeleted`. **It carries no rates.** It is purely the firm↔company agreement header.
- `ContractVersion`: `contractId`, `version`, `effectiveFrom`, `effectiveTo?`, embedded `billingRules`. Unique index on `{ contractId, effectiveFrom }`; overlap rejected by `findOverlappingVersion`.
- `billingRules` (`billing-rule.model.ts`) holds **all** rates:
  - `capacityRates[]`: `{ capacity, contractualAverageKmPerLitre, baseHiringRatePerRound, hiringMultiplierRules? }`
  - `fuelRatePerLitre`
  - `kmThresholds[]`: `{ upToKm?, rounds }`
  - `tollTreatment`: `excluded | actual | fixed`
  - `otherBillableCharges[]`: `{ code, name, amount, basis, isActive }`
- `ContractService.getEffectiveVersion(contractId, date)` → `effectiveFrom <= date AND (effectiveTo == null OR effectiveTo > date)`, sorted `effectiveFrom` desc.
- `ContractService.deleteVersion` refuses to delete a version referenced by any trip.

### 2.5 Billing engine (`backend/src/modules/billing/billing-engine.ts`)

Signature: `calculateTripBilling(trip, vehicle, contract, contractVersion, billingRules, applicableFuelRate)`.
Pure, no DB access, exact `bigint`-backed decimal arithmetic.

```
average      = billingRules.capacityRates.find(r => r.capacity === vehicle.capacity).contractualAverageKmPerLitre
baseHiring   = same rule .baseHiringRatePerRound
fuelLitres   = distanceKm / average                       (scale 12, unrounded)
fuelAmount   = fuelLitres * applicableFuelRate            (ROUND_HALF_UP, 2 dp)
rounds       = first kmThresholds entry where upToKm === undefined || distanceKm < upToKm
hiringAmount = baseHiring * rounds                        (ROUND_HALF_UP, 2 dp)
tollAmount   = tollTreatment === 'actual' ? trip.toll : 0
other        = sum of active otherBillableCharges.amount
totalAmount  = fuelAmount + hiringAmount + tollAmount + other
```

**VERIFIED facts that contradict common assumptions:**

1. **The hiring charge is a rate *per round*, not per kilometre.** `hiringAmount = baseHiringRatePerRound × rounds`. The business phrases "1.5× hiring charge" and "2× hiring charge" therefore map onto the `rounds` multiplier, which is exactly what the engine already computes. The engine's `hiringMultiplier` output *is* the rounds value.
2. **`findCapacityRule` uses strict `===` on capacity.** A vehicle whose capacity is 29000.0 vs a rule at 29000 matches, but 28999 does not. Missing capacity throws `BillingRuleConfigurationError` — it never bills at zero.
3. **`findRounds` is `Array.prototype.find`, with no sorting.** The selected slab depends on the **stored order** of `kmThresholds`. An admin who enters thresholds out of order silently gets the wrong multiplier. This is a latent defect today, independent of BR-2.
4. **`distanceKm` fed to the engine is `trip.totalKm` — one trip line at a time.** The backend permits multiple trip records on the same date, so one trip's distance is not necessarily the vehicle's total daily distance even before multi-day trips are introduced. The workbook demonstrates this directly (D-13). Multi-day trips add a separate need to allocate one trip's distance across days (Q-2).
5. **`ICapacityBillingRule.hiringMultiplierRules` is defined in the schema and never read by the engine.** Dead configuration.
6. **`tollTreatment: 'fixed'` yields 0.** Unimplemented.
7. **`otherBillableCharges[].basis` (`flat|perTrip|perKm|perRound`) is ignored** — amounts are summed flat.

**Fuel rate resolution is already global-first.** In `invoice.service.ts`:
`billingRate = (await HsdRateService.resolveRateForDate(trip.tripDate)) ?? version.billingRules.fuelRatePerLitre`.
`HsdRateService.getEffectiveRate` returns the newest `hsd_rates` row with `effectiveFrom <= date`.
So today the contract's `fuelRatePerLitre` is only a **fallback**.

### 2.6 Invoice (`backend/src/modules/invoices/`)

- `InvoiceService.generate({ firmId, vehicleId, month, year })` selects trips with
  `operationalStatus: 'completed'`, `isDeleted: false`, `billingInvoiceId: { $exists: false }`,
  `tripDate` within `[UTC(year, month-1, 1), UTC(year, month, 1))`.
- The workbook bill `NIR/05/26-27/13` is headed `PERIOD:-MONTH JUNE 2026` and dated 30/06/2026. Its bill-number month `05` conflicts with the printed June period. Current application derives the invoice period and bill number month from the same invoice month, so this exact combination cannot be represented without a correction or override.
- `buildLineItemsFromTrips` calls the engine once per trip and stores, per line item:
  - `snapshot` — the full `BillingCalculationResult` (distance, average, litres, fuel rate, fuel amount, hiring multiplier, base hiring rate, hiring amount, toll, other, total, contractId, contractVersionId, vehicleCapacity, rounding policy)
  - `tripSnapshot` — date, vehicle, driver, route, locations, `startKm`, `endKm`, `totalKm`, status, contract + version
  - `vehicleSnapshot` — registration, type, capacity
- Unique index `{ firmId, vehicleId, month, year }`; `duplicateTripGuard` stores a SHA-256 hash of the sorted trip ids.
- Lifecycle `draft → approved → finalized`; `reopen` requires `totalPaid === 0`, unsets `billingInvoiceId` on the trips, and keeps the old number in `reopenHistory`.
- **Phase 1:** draft regeneration now includes trips already linked to that draft as well as newly eligible unbilled trips, and unlinks trips no longer included. Approving a draft regenerates its calculation snapshot first; empty drafts cannot be approved.
- Bill number is issued **only at finalize** via `buildBillNumber`, and requires `firm.billPrefix` and `vehicle.vehicleNumberPerFirm`.

**VERIFIED:** Historical invoices **are** reproducible — each line item holds every input used.
**Current lifecycle:** snapshots are written at generate/regenerate time. Phase 1 makes draft trip
edits regenerate their linked invoice and refreshes again before approval. `finalize()` still does
not recompute an approved snapshot; the approved snapshot is the value finalized.

### 2.7 Driver wages (`backend/src/modules/salary/`)

- `SalaryRecord` is unique on `{ driverId, year, month }`.
- `SalaryService.generate`:
  ```ts
  const tripDates = await TripModel.distinct('tripDate', { driverId, isDeleted: false, tripDate: { $gte, $lt } });
  const distinctDays = new Set(tripDates.map(d => new Date(d).toISOString().slice(0, 10)));
  daysWorked = distinctDays.size;
  grossWages = round2(daysWorked * toNumber(driver.dailyWage));
  ```
- **VERIFIED:** wages are derived from **distinct `tripDate` values only**. A trip spanning Monday→Tuesday produces one date and therefore **one** day of wage.
- **VERIFIED:** dates are normalized for wage counting with `toISOString().slice(0, 10)`, i.e. UTC calendar dates. The policy for the fleet's operational timezone is not documented.
- **VERIFIED:** `generate` throws `ConflictError` if a record already exists. **There is no regeneration path.** Editing a trip's date after salary generation does not update `daysWorked`.
- **VERIFIED:** the `distinct` filter does **not** exclude `operationalStatus: 'cancelled'`. A trip cancelled via `PATCH` (rather than `DELETE`, which also sets `isDeleted`) still counts as a worked day.
- **VERIFIED:** driver wages are **not** `Expense` documents. `ExpenseCategory` includes `driver_wages` with a `driverWageDetails` sub-document, but that path is plain manual CRUD (`ExpenseService.create`) with no link to `SalaryRecord`. The two are completely disconnected.
  - Consequence today: `ReportService.expenseSummary`, `ReportService.vehicleRevenue` (margin) and `DashboardService` `monthlyExpenses` read **only** `ExpenseModel`. Generated salary records are therefore **absent** from margin/expense totals, while any manually entered `driver_wages` expense **is** counted. This duplication/omission risk pre-dates BR-1.

### 2.8 Driver advances (`backend/src/modules/driver-advances/`)

- `DriverAdvance { amount, outstandingAmount }`, `DriverAdvanceRecovery { advanceId, salaryRecordId, amount }`.
- `SalaryService.applyAdvanceDeduction` is **idempotent by replacement**: it reverses prior recoveries for the salary record (`$inc` outstanding back, `deleteMany`) before re-applying.
- `DriverAdvanceService.applyPayrollDeduction` caps at `min(requested, availableWage, totalOutstanding)`, consumes oldest-first, and uses a conditional `findOneAndUpdate({ outstandingAmount: { $gte: chunk } })` guard.
- Deduction depends on `grossWages`. **Any change to `daysWorked` changes `availableWage` and therefore the recoverable amount.**

### 2.9 Reports and dashboard

- `ReportService.tripCountAndKm` / `tollVariance` group trips by `tripDate` month. A multi-day trip is attributed **entirely to its start month**.
- `ReportService.vehicleRevenue` margin = finalized invoice `summary.totalAmount` − `ExpenseModel` sum (wages excluded, see 2.7).
- `ReportService.driverWageSummary` (RPT-11) reads `SalaryRecordModel`.
- `DashboardService` `tripsToday` / `tripsThisMonth` count by `tripDate` only; `vehicleBilling` aggregates `lineItems.snapshot.*` from finalized invoices.

### 2.10 Frontend (`frontend/src/`)

- `TripFormPage.tsx`:
  - **Requires** `startKm` and `endKm`: `if (form.startKm === undefined || form.endKm === undefined || form.endKm < form.startKm || totalKm <= 0) { setError(...) }` — **stricter than the backend, which treats them as optional.**
  - Derives `totalKm = endKm - startKm` client-side and submits it.
  - Selecting a route does **not** populate distance.
  - Fetches the effective contract version and finds `capacityRates.find(r => r.capacity === vehicle.capacity)` purely for display.
  - Derives `firmId` from the selected vehicle.
- `TripListPage.tsx` shows `KM {startKm} to {endKm}`; `TripDetailsPage.tsx` shows Start KM / End KM rows.
- `MonthlyBillingPage.tsx` renders `tripSnapshot.startKm` / `tripSnapshot.endKm` columns.
- `types/resources.ts` — `Trip` and `TripPayload` both carry `startKm?`/`endKm?`.
- `billingApi.ts` line-item type carries `startKm?`/`endKm?`.
- **There are no frontend tests in the repository** (verified: no `frontend/**/*.test.*`).

### 2.11 Test coverage (verified)

| Area | File | Covers | Missing |
|---|---|---|---|
| Trips | `trips/__tests__/trip.test.ts` | create, KM consistency (400), bad reference (404), update, filters, pagination, draft refresh, approved/finalized lock, reopen/edit | multi-day, route distance, status transitions |
| Billing engine | `billing/__tests__/billing-engine.test.ts` | 100/310/500/501/550/700/701/750 against fixture `[{upToKm:501,rounds:1},{upToKm:701,rounds:1.5},{rounds:2}]` | daily-vs-trip distance, unsorted thresholds, vehicle-sourced rates |
| Excel parity | `billing/__tests__/excel-billing-validation.test.ts` | 8 workbook rows against fixture `[{upToKm:127,rounds:0.5},{upToKm:500,rounds:1},{upToKm:700,rounds:1.5},{rounds:2}]` | — |
| Invoices | `invoices/__tests__/invoice.test.ts`, `invoice-numbering.test.ts` | lifecycle, numbering | snapshot immutability across a rate change |
| Salary | `salary/__tests__/salary.test.ts` | generation, deductions | multi-day, regeneration, cancelled trips |
| Advances | `driver-advances/__tests__/driver-advance.test.ts` | recovery, caps | recovery after wage recalculation |
| Reports / Dashboard | `reports/__tests__/report.test.ts`, `dashboard/__tests__/dashboard.test.ts` | aggregate shape | multi-day month attribution |

**The two engine test fixtures disagree with each other on boundary behaviour.** With
`findRounds` implemented as `distanceKm < upToKm`, `billing-engine.test.ts` (`upToKm: 501/701`)
produces **500 → 1, 700 → 1.5**, while `excel-billing-validation.test.ts` (`upToKm: 500/700`)
produces **500 → 1.5, 700 → 2** and also has the `127 → 0.5` short-trip slab. There is no seeded
production configuration anywhere in the repository
(verified: no seed/migration scripts exist), so no canonical answer exists in code.

**Seed/background-job check:** no seed or migration scripts were found under `backend/src`, and no
cron/scheduler/queue/timer-based background-job implementation was found under `backend/src`. The
planned work is therefore synchronous request/service logic plus explicit operator-run migrations;
there is no existing job runner to extend.

---

## 3. Documentation vs Implementation Discrepancies

These are conflicts found against the investigation baseline. D-12 was resolved by Phase 1; the other entries remain applicable unless noted.

| # | Document | Documented | Investigation baseline / current after Phase 1 | Severity |
|---|---|---|---|---|
| D-1 | `requirements-analysis.md` §5.2, `mongodb-design.md` §9, billing test fixtures | Prior documented table says `<127→0.5`, `127–499→1.0`, `500–699→1.5`, `≥700→2.0` | No production default exists; tests encode different exact-boundary behavior. Owner's 15 Oct clarification confirms 0.5 / 1 / 1.5 / 2 bands and explicitly places exactly 700 in the 1.5 band (`>700→2`). The written ranges overlap at 127, and fractional values above 700 require comparator semantics that existing `upToKm` lookup cannot exactly express. | High |
| D-2 | `mongodb-design.md` §11, `technical-architecture.md` §8 | Trips store `average`, `hsdLitres`, `hsdRate`, `hsdAmount`, `rounds`, `baseHiringRate`, `hiringCharge`, `tripTotal`, `vehicleCapacity`, `hsdRateId` | Trips store **none** of these. All calculation happens at invoice generation. | **High** |
| D-3 | `mongodb-design.md` §11 | Trip `status`: `draft \| billed \| finalized`, with locking on finalization | `operationalStatus`: `planned \| in_progress \| completed \| cancelled`. Phase 1 keeps this status model; `billingInvoiceId` now locks edits once the linked invoice is no longer a draft. | **High** |
| D-4 | `mongodb-design.md` §8 | Route field `fixedKm` | Implemented as `expectedDistanceKm`, and unused by any calculation | Medium |
| D-5 | `mongodb-design.md` §6 | Vehicle `vehicleNumber`, `status: running/idle/under_maintenance/inactive` | `vehicleNumberPerFirm`, `status: available/on_trip/maintenance` | Low |
| D-6 | `mongodb-design.md`, `mongodb-relationships.md` | Collection `bills`, field `billId` | Collection `invoices`, field `billingInvoiceId` | Medium |
| D-7 | `technical-architecture.md` §8 | `decimal.js` | Hand-rolled `bigint` `Decimal` class inside `billing-engine.ts` | Low |
| D-8 | `technical-architecture.md` §8 | Rate lookup performed by `trip.service.ts` at save time | Performed by `invoice.service.ts` at invoice generation time | **High** |
| D-9 | `requirements-analysis.md` §2.12 | Salary `advances` / `deductions` | `advanceDeduction` / `otherDeductions`, plus a separate advance/recovery ledger | Low |
| D-10 | `frontend-api-integration.md` §8 item 12 | "The backend has no invoice/billing calculation endpoints yet" | The Invoices module is fully implemented | Medium (stale) |
| D-11 | `billing-engine.md` | Implies contract versions are the rate source and this is correct | True today, but contradicts the BR-2 direction | — |
| D-12 | `requirements-analysis.md` §4.4 | "After bill finalization → trips in the bill are locked" | **Resolved Phase 1:** approved/finalized invoice links now lock edits/deletes; draft edits recalculate draft invoices; reopen clears the link. | Resolved |
| D-13 | Business direction: daily threshold | Existing planning assumed each trip was the vehicle's daily distance | The workbook has multiple lines per vehicle/date. UP13BT5953 has two lines on eight dates (110 + 310 = 420 km); each line is billed at 0.5 + 1.0 = 1.5 rounds, whereas one threshold on 420 daily km gives 1.0 round under the existing slab table. The target changes billed amounts unless aggregation/charge allocation is defined. | **Critical** |
| D-14 | Workbook bill numbering and period | `NIR/05/26-27/13` was treated as a May bill | Its header says `PERIOD:-MONTH JUNE 2026` and `BILL GENERATE DATE:-30/06/2026`. The month segment and printed period conflict. | High |
| D-15 | `requirements-analysis.md` §5.1 / `excel-billing-validation.md` | Application's two-decimal per-line rounding is described as the confirmed policy | Workbook formulas do not use `ROUND`; line and grand totals retain full formula precision, while amount cells use a zero-decimal number format. The app engine rounds line amounts to 2 dp and its PDF prints 2 dp. These are different financial outputs and display policies. | **High** |

---

## 4. BR-1 — Multi-day trips and driver wages

### 4.1 Current behaviour (verified)

- A trip is a single `tripDate`. There is no representation of an overnight or multi-day run.
- Wages = count of distinct `tripDate` values in the month × `driver.dailyWage`, snapshotted once into `SalaryRecord`.
- A Monday→Tuesday run entered as one trip yields **one** day of wage.
- The workbook contains multiple separate trip lines for the same vehicle/date. These are distinct runs and salary generation correctly deduplicates the shared date; they are not evidence that one multi-day run is represented by multiple wage days.

### 4.2 Proposed behaviour

Add an explicit end date to the trip and derive wage days from the inclusive date span.

```
tripDate            — existing; becomes the trip START date (unchanged name, unchanged semantics for 1-day trips)
tripEndDate         — NEW, optional; defaults to tripDate
wageDayCount        — DERIVED, not stored on the trip:
                      inclusive whole-day difference between tripDate and tripEndDate in UTC
```

Wage-day derivation (**PROPOSED**, aligned with the existing confirmed rule BR-C-22/BR-C-23
"one full day's wage per calendar day on which the driver is assigned"):

```
days(trip) = { UTC date of tripDate, ..., UTC date of tripEndDate }   // inclusive on both ends
daysWorked(driver, month) = | union over all that driver's non-cancelled, non-deleted trips
                              of days(trip), intersected with the month |
```

This is a **generalisation** of the current rule, not a new policy: today `days(trip)` is a singleton
and the union-of-dates behaviour is exactly what `Set(tripDates)` already implements. Two trips on the
same day still count once. A trip spanning two days contributes two dates.

**Month-boundary handling (PROPOSED):** a trip spanning 31 Jan → 1 Feb contributes one day to January
and one day to February. Wages follow the **day**, not the trip. This keeps monthly salary records
additive and avoids a trip being paid twice.

### 4.3 Why duplicate wages cannot occur under this model

Wages are **set-derived, not event-derived**. `daysWorked` is recomputed from the current trip data
every time it is computed; it is never incremented. Therefore:

- repeated trip updates → recompute, same set, same result;
- repeated completion → `operationalStatus` is not an input to the day set (see Q-4);
- repeated salary generation → currently blocked by `ConflictError`.

The real risk is the **opposite**: staleness. `SalaryRecord` is a one-shot snapshot with no
regeneration path. Changing a trip's dates after salary generation leaves `daysWorked` wrong forever.

### 4.4 Required additions

1. `tripEndDate` on the trip model + validation `tripEndDate >= tripDate`.
2. A shared, pure `wageDaysForTrip(trip)` / `wageDaysInMonth(trips, year, month)` helper so salary, reports and any future job share one implementation.
3. `SalaryService.regenerate(id)` — recompute `daysWorked`, `grossWages`, `netPayable` for a **pending** record; must **reverse and re-apply** advance recoveries using the existing `applyAdvanceDeduction` replacement logic, and must refuse when `paymentStatus === 'paid'`.
4. Exclude `operationalStatus: 'cancelled'` from the wage day query (fixes the existing defect in 2.7).

### 4.5 Acceptance criteria

- A trip with `tripDate = D`, `tripEndDate = D+1` yields 2 wage days.
- A same-day trip (`tripEndDate` absent or `= tripDate`) yields 1 wage day — unchanged from today.
- Two trips on the same day still yield 1 wage day.
- Two overlapping multi-day trips for the same driver never double-count a shared date.
- Re-running wage generation/regeneration produces an identical `daysWorked`.
- Advance recovery after regeneration leaves `sum(DriverAdvanceRecovery.amount) == SalaryRecord.advanceDeduction` and the advance's `outstandingAmount` consistent.

---

## 5. BR-2 — Vehicle as the source of billing rates

### 5.1 Current behaviour (verified)

| Value | Current source |
|---|---|
| Average (km/L) | `contractVersion.billingRules.capacityRates[capacity === vehicle.capacity].contractualAverageKmPerLitre` |
| Hiring rate per round | same rule, `.baseHiringRatePerRound` |
| Fuel rate (₹/L) | `hsd_rates` global table by date, **falling back** to `contractVersion.billingRules.fuelRatePerLitre` |
| KM thresholds → rounds | `contractVersion.billingRules.kmThresholds` |
| Toll treatment | `contractVersion.billingRules.tollTreatment` |
| Other billable charges | `contractVersion.billingRules.otherBillableCharges` |

So rates are keyed by **capacity**, not by vehicle. Two 29,000-litre vehicles **cannot** currently have
different hiring charges or averages.

### 5.2 Are contracts still needed? (verified analysis)

| Responsibility | Today held by | Still needed after BR-2? |
|---|---|---|
| Firm ↔ Company agreement identity, name, active flag | `Contract` | **Yes** — nothing else models it |
| Rate effective-dating / versioning | `ContractVersion.effectiveFrom/To` | **Yes** — needed for *any* dated rate, including vehicle rates |
| Per-capacity average and hiring rate | `billingRules.capacityRates` | **Superseded** by vehicle rates for billing; retain for back-compat/fallback |
| Global fuel rate | already `hsd_rates`; contract value is only a fallback | Fallback only |
| KM thresholds → rounds | `billingRules.kmThresholds` | **Yes, and it should stay contractual.** Thresholds are a commercial term of the factory agreement, not a property of a vehicle. |
| Toll treatment, other billable charges | `billingRules` | **Yes** — commercial terms |
| Historical reproducibility | `Trip.contractVersionId`, `Invoice.lineItems[].contractVersionId` | **Yes** — referenced by existing data |

**Hard dependencies that prevent removing contracts (verified):**

- `Trip.contractId` and `Trip.contractVersionId` are **`required: true`**.
- `TripService.create` throws `NotFoundError('Active contract not found')` without a contract and `NotFoundError('No contract version is effective for the requested date')` without a version.
- `InvoiceService.buildLineItemsFromTrips` throws `NotFoundError('Trip references are incomplete or deleted')` if the contract or version is missing, and passes `version.billingRules` straight into the engine.
- `IInvoiceLineItem` requires `contractId` and `contractVersionId`.
- `ContractService.deleteVersion` refuses to delete versions referenced by trips.
- Frontend `TripFormPage` requires a contract selection and resolves the effective version.
- `contract.test.ts`, `trip.test.ts`, `invoice.test.ts`, `salary.test.ts`, `report.test.ts` all build contracts as fixtures.

**Conclusion (PROPOSED): keep the Contracts module. Narrow its responsibility.**
Contracts remain the home of *commercial* terms (thresholds, toll treatment, other charges, validity,
firm/company linkage). The *operational* per-vehicle economics (hiring charge, average, fuel rate) move
to the vehicle. This is the smallest change that satisfies the requirement while keeping every existing
reference valid.

### 5.3 Proposed vehicle rate configuration

```
Vehicle.operationalRates (NEW, optional sub-document)
  hiringChargePerRound : Decimal128   fixed per-vehicle ₹ per round (NOT per km)
  averageKmPerLitre    : Decimal128   km/L
  fuelRatePerLitre     : Decimal128   ₹/L, optional — overrides the global hsd_rates value
  effectiveFrom        : Date         when this configuration took effect
  updatedAt / updatedBy
```

**Resolution order (PROPOSED), applied by a single new `RateResolutionService`:**

```
hiringChargePerRound = vehicle.operationalRates.hiringChargePerRound
                    ?? contractVersion.capacityRates[capacity].baseHiringRatePerRound
                    ?? ERROR
averageKmPerLitre    = vehicle.operationalRates.averageKmPerLitre
                    ?? contractVersion.capacityRates[capacity].contractualAverageKmPerLitre
                    ?? ERROR
fuelRatePerLitre     = vehicle.operationalRates.fuelRatePerLitre
                    ?? hsdRates.effectiveRateFor(date)
                    ?? contractVersion.billingRules.fuelRatePerLitre
                    ?? ERROR
kmThresholds         = contractVersion.billingRules.kmThresholds          (unchanged)
tollTreatment        = contractVersion.billingRules.tollTreatment          (unchanged)
```

The owner confirmed on 15 October 2026 that the hiring charge is fixed for each vehicle. This plan
interprets that as a vehicle-specific fixed **base rate per round**, with the configured daily
distance threshold still selecting the multiplier. Existing code and workbook examples use
capacity-based base rates and do not prove vehicle-level variation; the proposed vehicle master is
therefore a deliberate ownership change. The fallback to capacity rates applies only during rollout.

The fallback chain is what makes the change **backward compatible**: vehicles without
`operationalRates` keep billing exactly as they do today. The engine must continue to **throw** rather
than default to zero when nothing resolves (preserving BR-C-15).

### 5.4 KM thresholds and "daily distance"

**Requested target:** the threshold input is the distance covered by the vehicle on a single day.
The workbook currently applies rounds to each trip line/run, and there may be more than one such run
for the same vehicle/date. Three distinct quantities must be distinguished:

| Quantity | Definition |
|---|---|
| Trip distance | `totalKm` for the whole trip, possibly spanning several days |
| **Daily vehicle distance** | sum of the vehicle's relevant trip distances on one calendar day, including approved allocations from multi-day trips |
| Monthly distance | sum over an invoice period — **must never** be used for thresholds |

**PROPOSED:** aggregate daily vehicle distance before selecting the threshold. For a spanning trip,
how its distance is assigned to each date is **OPEN** (Q-2). For multiple runs on one date, how the
single daily hiring calculation is represented across invoice lines is also **OPEN** (Q-16). Do not
apply the daily multiplier independently to every same-day trip line; that can charge the daily
hiring component more than once.

Keep calculation units distinct: fuel litres/amount remain based on each trip's distance (or its
approved per-day allocation if the trip spans dates); actual toll remains attached to its trip; the
fixed vehicle hiring base is multiplied **once** by the rounds selected from the sum of that
vehicle's distance for the date. The invoice may retain individual trip lines, but must allocate the
single daily hiring amount without duplicating it. Summary rounds and hiring totals must reconcile
to the daily calculation.

> **Unresolved and blocking:** whether a 2-day, 900 km trip should bill as
> 2 × (450 km → 1 round) = 2 rounds, or as 1 × (900 km → 2 rounds). These produce materially
> different invoice totals. See Q-2.

### 5.5 Threshold definition conflict

The owner confirmed the intended bands on 15 October 2026:

```
0–127 km   : 0.5 round
127–500 km : 1.0 round
500–700 km : 1.5 rounds
>700 km    : 2.0 rounds
```

For a non-overlapping interpretation, this plan provisionally reads the bands as
`0 <= km < 127 → 0.5`, `127 <= km < 500 → 1.0`, `500 <= km <= 700 → 1.5`, and `km > 700 → 2.0`.
That makes 127 belong to the second band. The wording `0–127` and `127–500` overlaps at 127, so this
precedence remains to be confirmed (Q-1). Also confirm whether route/trip distances are whole-number
KM only: the current schemas accept decimals, but the existing strict `< upToKm` threshold lookup
cannot represent `<=700` followed by `>700` exactly for arbitrary fractional distances without a
comparator/schema change. In particular, 700 is 1.5 and 700.1 must be 2 if fractional distances are
valid.

The 0.5 tier is confirmed. Phase 2 implements exactly 127 as 1 round using the pre-existing A-01
assumption, exactly 700 as 1.5, and decimal values above 700 using the unlimited 2-round row. If the
owner intended exactly 127 to remain in the 0.5 band, revise that choice before Phase 3. Separately,
Q-16 must decide whether the line/run
multiplier or one multiplier on aggregate daily vehicle distance is authoritative. The workbook's
UP13BT5953 rows demonstrate a material difference for 420 km/day.

### 5.6 Engine defects to fix alongside BR-2

- Sort `kmThresholds` ascending by `upToKm` (unbounded entry last) before `find`, or validate ordering on save. Currently order-dependent.
- Decide and document `hiringMultiplierRules` — implement it or remove it (currently dead).
- Decide and document `tollTreatment: 'fixed'` — currently silently 0.
- Decide and document `otherBillableCharges[].basis` — currently ignored.

These are **not** in scope of the four requirements but are adjacent correctness issues; each is listed
as an explicit decision point rather than an implicit change.

### 5.7 Acceptance criteria

- Two vehicles of identical capacity, configured with different `hiringChargePerRound` / `averageKmPerLitre` / `fuelRatePerLitre`, produce different invoice line amounts.
- A vehicle with no `operationalRates` bills identically to before the change (regression-tested against existing fixtures).
- The multiplier is selected from the **daily** distance.
- `kmThresholds` entered in arbitrary order select the same slab as sorted order.
- Missing/invalid vehicle rate configuration raises an explicit error, never a zero amount.
- Existing finalized invoices are byte-identical after the change (snapshots are read, never recomputed).

---

## 6. BR-3 — Route distance instead of start/end KM

### 6.1 Current behaviour (verified)

- Backend: `startKm`/`endKm` optional; `totalKm` required and **client-supplied**; the route's `expectedDistanceKm` is never read.
- Frontend: `startKm`/`endKm` **mandatory**; `totalKm` computed in the browser as `endKm - startKm`.
- Net effect: **the browser decides the billed distance.** A manipulated request can set any `totalKm`. This is the most significant integrity gap of the four requirements.

### 6.2 What `startKm` / `endKm` actually do (verified)

Full usage census:

| Location | Usage |
|---|---|
| `trips/trip.model.ts` | storage |
| `trips/trip.service.ts` | consistency validation only |
| `trips/trip.validation.ts` | consistency validation only |
| `invoices/invoice.model.ts`, `invoice.service.ts` | copied verbatim into `tripSnapshot` (display/audit only — **never used in a calculation**) |
| `frontend/.../TripFormPage.tsx` | source of `totalKm` |
| `frontend/.../TripListPage.tsx`, `TripDetailsPage.tsx`, `MonthlyBillingPage.tsx` | display |
| `frontend/src/types/resources.ts`, `services/billingApi.ts` | types |
| `trips/__tests__/trip.test.ts` | fixtures + 400 assertion |

**Finding:** they are **odometer readings used only to derive `totalKm`**. No odometer report, no
service-interval logic, and no fuel-efficiency reconciliation reads them. (`maintenanceDetails.odometer`
and `serviceDetails.odometer` on `Expense` are separate, independently entered fields.)

**Therefore they can be made optional-and-non-authoritative without breaking any verified business
function.** They should be **retained as nullable fields**, not dropped, so historical trips and
historical invoice `tripSnapshot`s remain readable (BR-C-21 / audit requirements).

### 6.3 Proposed behaviour

1. `routeId` becomes **required** for ordinary trips.
2. `Route.expectedDistanceKm` becomes **required** for any route usable on a trip (existing routes without it must be backfilled or blocked — see Q-5).
3. The backend **resolves** `totalKm` from the route and **ignores** any client-supplied `totalKm`.
4. The trip stores a **distance snapshot** so a later route edit cannot rewrite history:
   ```
   routeDistanceSnapshot {
     routeId, routeName, expectedDistanceKm, capturedAt
   }
   totalKm  — populated from routeDistanceSnapshot.expectedDistanceKm
   ```
5. `startKm` / `endKm` become **optional, display-only** odometer fields. The
   `totalKm === endKm - startKm` cross-validation is **removed** (it would otherwise conflict with the
   route distance) and replaced with a non-blocking variance warning.
6. Changing a trip's route re-resolves the distance **and** rewrites the snapshot — but only while the
   trip is not attached to an invoice (see Phase 1 lock, §11).

### 6.4 One-way vs round-trip

**OPEN (Q-3).** `Route.expectedDistanceKm` has no directionality flag, and nothing in the trip workflow
models a return journey. The reference bill shows TIRWAGANJ → CFL at 589 km per day, which is a single
directed leg — consistent with a one-way interpretation, but not proof. If routes are one-way and
operations are round trips, every bill would be understated by half.

### 6.5 Acceptance criteria

- Creating a trip requires only route selection; no KM entry is needed.
- `POST /trips` with a `totalKm` that disagrees with the route is accepted but the **route value wins** (or is rejected — see Q-6), and the stored value is always the route's.
- Editing a route's `expectedDistanceKm` does not change any existing trip's `totalKm` or any invoice.
- Changing a trip's route updates the trip distance and snapshot.
- A deleted/inactive route cannot be selected for a new trip; existing trips referencing it remain readable.
- Fuel litres, fuel amount and hiring rounds all derive from the resolved distance.

---

## 7. BR-4 — Rate snapshots and the authoritative-value model

### 7.1 Current state (verified)

| Layer | Snapshot today |
|---|---|
| Vehicle master | `capacity` only; no rates |
| Trip | **No rate snapshot at all.** Only `contractId` + `contractVersionId` (an indirect, dated pointer). |
| Invoice line item | **Full snapshot** — every input and output, plus `vehicleSnapshot.capacity` and `tripSnapshot` |

So history is protected **only at the invoice layer**, and only from the moment the invoice draft is
generated. Between trip creation and invoice generation, the effective rate can change and the trip
will be billed at the newer rate. This is correct-by-accident today because the contract version is
pinned by `tripDate`, but it will **not** hold once rates live on the mutable vehicle document.

### 7.2 Proposed three-layer model

| Layer | Authoritative for | Mutable? | Proposed content |
|---|---|---|---|
| **1. Vehicle master** (`Vehicle.operationalRates`) | *Future* trips | Yes | current hiring charge, average, optional fuel rate |
| **2. Trip calculation snapshot** (`Trip.rateSnapshot`) | That trip's billing | No, once captured | `hiringChargePerRound`, `averageKmPerLitre`, `fuelRatePerLitre`, `distanceKm`, `routeId`, `capturedAt`, `capturedFrom: 'vehicle' \| 'contract' \| 'hsd_rate'`, `contractVersionId` |
| **3. Invoice calculation snapshot** (existing `lineItems[].snapshot`) | The issued bill | No, once finalized | unchanged — already complete |

### 7.3 Recommended capture timing

**PROPOSED: capture at trip creation; re-capture on edit only while the trip is unbilled; freeze at
completion.**

Rationale, grounded in the verified lifecycle:

- There is **no distinct confirmation step** — `operationalStatus` goes from `planned` to whatever a `PATCH` sets. Capturing at "confirmation" is therefore not implementable without inventing a lifecycle step.
- Capturing at **completion** would leave `planned`/`in_progress` trips unpriced, so the billing preview for the current month could not be shown — a regression against BIL-07.
- Capturing at **billing** reproduces today's behaviour and gives no protection against a mid-month vehicle rate change, which is exactly what BR-4 asks for.
- Capturing at **creation** gives a stable, inspectable price from day one and matches how `contractVersionId` is already pinned.

Lifecycle rules (**PROPOSED**):

```
create              -> capture rateSnapshot from the resolution chain (§5.3)
update while        -> re-capture ONLY if vehicle, route, or tripDate/tripEndDate changed,
  operationalStatus    AND the trip has no billingInvoiceId
  != 'completed'
transition to       -> freeze: rateSnapshot becomes immutable
  'completed'
invoice generate    -> read Trip.rateSnapshot; do NOT re-resolve from the vehicle
invoice regenerate  -> read Trip.rateSnapshot; do NOT re-resolve (changes today's behaviour — see Q-7)
invoice finalize    -> copy into lineItems[].snapshot (already happens)
```

**Trips in progress when a vehicle's configuration changes** keep their captured snapshot. If the
business wants them re-priced, that must be an **explicit, audited re-price action** on the trip, never
an implicit side effect of editing the vehicle. Vehicle rate edits must therefore be audited
(`AuditService.record`) with before/after values.

### 7.4 Acceptance criteria

- A new trip stores a `rateSnapshot` sourced from the assigned vehicle.
- A vehicle with no/zero/negative rate configuration is rejected at trip creation with a clear message.
- Changing `Vehicle.operationalRates` does not alter any existing trip's `rateSnapshot`, any draft invoice line, or any finalized invoice.
- An invoice generated before and after a vehicle rate change, from the same trips, produces identical amounts.
- Legacy trips with no `rateSnapshot` still bill correctly via the contract fallback (§5.3) and are flagged in the preview.

---

## 8. Cross-module impact matrix

| Module | Files | Current behaviour | Required change | Depends on | Regression risk |
|---|---|---|---|---|---|
| Vehicles | `vehicle.model.ts`, `vehicle.validation.ts`, `vehicle.service.ts`, `vehicle.controller.ts` | capacity only | add `operationalRates` sub-doc + validation + audit on change | — | Low. Additive, optional. |
| Routes | `route.model.ts`, `route.validation.ts` | `expectedDistanceKm` optional, unused | make required for billable routes; add directionality (Q-3) | — | **Medium** — existing routes lack the value |
| Trips — model | `trip.model.ts` | single date; client `totalKm`; no snapshot | add `tripEndDate`, `rateSnapshot`, `routeDistanceSnapshot`; retain `startKm`/`endKm` as optional | Vehicles, Routes | **High** |
| Trips — service | `trip.service.ts`, `trip.controller.ts` | trusts client KM; invoice lock absent at investigation baseline | **Phase 1 implemented:** approved/finalized invoice links lock edits/deletes; draft-linked edits refresh snapshots; GET exposes invoice status. Route distance/rate snapshots remain pending. | Vehicles, Routes, Invoices | **High** |
| Trips — validation | `trip.validation.ts` | enforces `totalKm = endKm - startKm` | drop that rule; add `tripEndDate >= tripDate`; make `routeId` required | — | **High** — contract change |
| Contracts | `contract.model.ts`, `contract-version.model.ts`, `billing-rule.model.ts`, `contract.service.ts` | sole rate source | **retain**; demote `capacityRates` to fallback; keep thresholds/toll/other charges | — | Medium — must not break existing versions |
| Billing engine | `billing-engine.ts` | capacity-keyed rates; trip-level distance; order-dependent threshold `find` | accept resolved rates + **daily** distance; sort thresholds; keep throw-on-missing | Trips, Vehicles | **Critical** — every rupee flows through here |
| Rate resolution | *new* `rate-resolution.service.ts` | n/a (inline in `invoice.service.ts`) | centralise the §5.3 chain; used by trips **and** invoices | Vehicles, Contracts, HSD | Medium |
| HSD rates | `hsd-rate.service.ts` | global by date | unchanged; becomes a fallback tier | — | Low |
| Invoices | `invoice.service.ts`, `invoice.model.ts`, `invoice.pdf.ts` | one line per trip; draft regeneration originally selected only unlinked trips | **Phase 1 implemented:** draft regeneration includes linked trips; approval refreshes draft calculations. Daily threshold/rate snapshots remain pending. | Trips, Billing engine | **Critical** — must not alter finalized invoices |
| Salary | `salary.service.ts`, `salary-record.model.ts` | distinct `tripDate` only | union of inclusive day spans; exclude cancelled; add `regenerate` | Trips | **High** — wage totals |
| Driver advances | `driver-advance.service.ts` | recovery capped by `availableWage` | unchanged logic; must be re-run by `SalaryService.regenerate` | Salary | **High** — financial ledger |
| Expenses | `expense.model.ts`, `expense.service.ts` | manual `driver_wages` category, disconnected from Salary | **decide** whether salary posts to expenses (Q-8). Changing this affects every margin figure. | Salary | **High** |
| Reports | `report.service.ts` | groups trips by `tripDate` month | decide month attribution for spanning trips; RPT-06/RPT-08 | Trips | Medium |
| Dashboard | `dashboard.service.ts` | counts by `tripDate`; aggregates invoice snapshots | multi-day trips counted once or per day (Q-9) | Trips, Invoices | Medium |
| Frontend — trips | `pages/trips/TripFormPage.tsx`, `TripListPage.tsx`, `TripDetailsPage.tsx`; `services/tripsApi.ts` | mandatory start/end KM; browser-computed `totalKm`; route is optional | route-driven distance display, end-date field, remove mandatory KM; handle invoice-lock 409 | Backend trips | **High** |
| Frontend — vehicles | `pages/vehicles/VehicleFormPage.tsx`, `VehicleDetailsPage.tsx`, `VehicleListPage.tsx`; `services/vehiclesApi.ts` | no rate fields | add rate configuration form and display; validation | Backend vehicles | Medium |
| Frontend — routes | `pages/routes/RouteFormPage.tsx`, `RouteListPage.tsx`, `RouteDetailsPage.tsx`; `services/routesApi.ts` | expected distance is optional and displayed as “Not set” | require distance for selectable routes; present directionality only after Q-3 | Backend routes | Medium |
| Frontend — billing | `pages/billing/MonthlyBillingPage.tsx`, `services/billingApi.ts` | shows start/end KM columns | show daily distance + applied multiplier; tolerate legacy missing KM | Backend invoices | Medium |
| Frontend types | `types/resources.ts` | `Trip`, `TripPayload`, `Vehicle`, `Route` | add `tripEndDate`, snapshots, vehicle rates; relax KM; align route requirement | — | Medium |
| Tests | all `__tests__` | fixtures use `startKm/endKm`, single-date trips, contract-sourced rates | update fixtures; add the §10 suites | all | **High** — fixture churn can mask real regressions |

---

## 9. Database, API and migration planning

> **Nothing in this section has been executed.** No migration has been run, no schema modified, no
> document updated.

### 9.1 Field changes

| Collection | Field | Action | Backfill needed? |
|---|---|---|---|
| `vehicles` | `operationalRates` | **Add** (optional sub-document) | No for schema; **yes operationally** — every billable vehicle needs values before BR-2 can take effect for it. Until then the contract fallback applies. |
| `routes` | `expectedDistanceKm` | **Tighten** optional → required for billable routes | **Yes** — existing routes may be null |
| `routes` | `distanceBasis` (`one_way` \| `round_trip`) | **Add** — blocked by Q-3 | Yes, defaulted once Q-3 is answered |
| `trips` | `tripEndDate` | **Add** (optional) | **No** — absent means same-day, which is exactly today's semantics |
| `trips` | `rateSnapshot` | **Add** (optional) | **No** — absence triggers the contract fallback. Backfilling historical trips would *change* their price and is **not recommended**. |
| `trips` | `routeDistanceSnapshot` | **Add** (optional) | No |
| `trips` | `startKm`, `endKm` | **Retain**, relax validation | No |
| `trips` | `contractId`, `contractVersionId` | **Retain as required** | No |
| `invoices` | `lineItems[].snapshot.dailyDistanceKm`, `.wageDays`, `.rateSource` | **Add** to *new* snapshots only | **No — and must not be backfilled.** Finalized invoices are immutable by rule BR-C-11. |
| `salary_records` | `daysWorked` | semantics widen | No schema change; **no retro-recalculation** of existing records |

### 9.2 Migration principles

1. **Additive and optional first.** Every new field is nullable; absence means "legacy behaviour".
2. **Never backfill a financial snapshot.** Writing `rateSnapshot` onto historical trips would re-price them.
3. **Never recompute a finalized invoice.** The read path must branch on snapshot shape, not migrate the data.
4. **Route distance backfill is a data-quality task, not a code migration.** Produce a report of routes missing `expectedDistanceKm` and have the owner fill them before enforcing the requirement.
5. **Salary records are not retro-recalculated.** Multi-day wage rules apply from the go-live month forward; earlier months stay as issued.
6. **Idempotency:** any backfill script must be re-runnable, must filter on `{ field: { $exists: false } }`, and must not touch documents with `billingInvoiceId` set or invoices with `status: 'finalized'`.

### 9.3 API contract changes

| Endpoint | Change | Breaking? |
|---|---|---|
| `POST /api/v1/trips` | `tripEndDate` added (optional); `routeId` becomes required; `totalKm` becomes **server-derived and ignored on input**; `startKm`/`endKm` stay optional | **Yes** — `routeId` requirement and ignored `totalKm` |
| `PATCH /api/v1/trips/:id` | same; plus **409 when the trip is attached to an invoice** | **Yes** — new 409 |
| `GET /api/v1/trips/:id` | response gains `tripEndDate`, `rateSnapshot`, `routeDistanceSnapshot` | No (additive) |
| `POST /api/v1/vehicles`, `PATCH /api/v1/vehicles/:id` | accept `operationalRates` | No (additive) |
| `POST /api/v1/routes`, `PATCH /api/v1/routes/:id` | `expectedDistanceKm` required | **Yes** |
| `POST /api/v1/invoices/generate` | line items gain daily granularity | **Yes** — line count per trip changes |

**Release coupling:** the frontend currently *requires* `startKm`/`endKm` and computes `totalKm`
locally. If the backend starts ignoring `totalKm` while the old frontend is live, users will enter KM
values that are silently discarded — confusing but not corrupting. If the backend makes `routeId`
required while the old frontend still allows a null route, **trip creation breaks**. Therefore
**Phase 4 (route-required) and the trip-form frontend change must ship together.**

### 9.4 Preventing duplicate wage/expense records during migration

- Wages are set-derived (§4.3), so recomputation is inherently idempotent.
- `SalaryRecord` keeps its unique `{ driverId, year, month }` index — this is the real duplicate guard and must not be relaxed.
- `SalaryService.regenerate` must reuse the existing reverse-then-reapply advance logic; it must never `$inc`.
- If Q-8 is answered "yes, salary posts to expenses", the posting **must** be keyed by `salaryRecordId` with a unique index, and must `upsert`, never `create`.

---

## 10. Testing and regression strategy

All suites below are **planned**. None has been written or executed. Backend tests use
`mongodb-memory-server`; there are no frontend tests today, so frontend verification is manual unless
Phase 0 adds Vitest.

**Run command (verified working in this repo):**
`cd backend; npx jest <filter>`

### 10.1 Multi-day trips and wages

| # | Scenario | Expected |
|---|---|---|
| MD-1 | Same-day trip (`tripEndDate` absent) | 1 wage day — identical to pre-change |
| MD-2 | Same-day trip with `tripEndDate === tripDate` | 1 wage day |
| MD-3 | Two-day trip | 2 wage days |
| MD-4 | Four-day trip | 4 wage days |
| MD-5 | Two trips, same driver, same single day | 1 wage day |
| MD-6 | Two multi-day trips sharing one date | shared date counted once |
| MD-7 | `tripEndDate < tripDate` | 400 |
| MD-8 | Trip dates edited after salary generation, then `regenerate` | `daysWorked` updated; exactly one `SalaryRecord` |
| MD-9 | `regenerate` called 3× | identical result; no duplicate recoveries |
| MD-10 | Trip completed (PATCH) repeatedly | wage days unchanged |
| MD-11 | Trip cancelled via PATCH | excluded from wage days |
| MD-12 | Trip spanning 31 Jan → 1 Feb | 1 day in January, 1 in February |
| MD-13 | Advance recovery, then `regenerate` lowers `daysWorked` | `advanceDeduction` ≤ new available wage; advance `outstandingAmount` reconciles exactly |
| MD-14 | `regenerate` on a `paid` record | 409 |

### 10.2 Hiring-charge thresholds

Run against the confirmed four bands with exactly 127 assigned to the 1-round row under A-01.

| # | Daily distance | Expected multiplier |
|---|---|---|
| TH-1 | 100 km | 0.5 |
| TH-2 | 126 km | 0.5 |
| TH-3 | **exactly 127 km** | 1.0 under the existing A-01 assumption |
| TH-4 | 499 km | 1.0 |
| TH-5 | **exactly 500 km** | 1.5 |
| TH-6 | 699 km | 1.5 |
| TH-7 | **exactly 700 km** | 1.5 |
| TH-8 | 700.1 km (if fractional KM are valid) | 2.0; requires comparator behavior that current `upToKm` lookup cannot exactly represent |
| TH-9 | 2-day trip, 900 km total, 450 km/day | per-day multiplier, **not** the 900 km multiplier |
| TH-10 | Same vehicle/date has 110 km + 310 km | Target daily-distance multiplier is 1.0 on 420 km; record the historical 1.5 per-line rounds as an intentional variance pending Q-16 |
| TH-11 | Two vehicles, same capacity, different fixed `hiringChargePerRound` | different hiring amounts |
| TH-12 | `kmThresholds` stored in reverse order | same result as sorted order |
| TH-13 | No matching threshold | `BillingRuleConfigurationError` |
| TH-14 | Existing `excel-billing-validation.test.ts` rows | preserve the per-run formula examples where applicable; document approved differences from daily aggregation and rounding instead of claiming full-invoice parity |

### 10.3 Route distance

| # | Scenario | Expected |
|---|---|---|
| RD-1 | Trip created with a valid route | `totalKm === route.expectedDistanceKm`; `routeDistanceSnapshot` written |
| RD-2 | Client sends a conflicting `totalKm` | stored distance is the route's (or 400 — see Q-6); never the client's |
| RD-3 | Route's `expectedDistanceKm` edited afterwards | existing trip `totalKm` unchanged; invoice unchanged |
| RD-4 | Trip's route changed while unbilled | distance and snapshot both updated |
| RD-5 | Trip's route changed while attached to an invoice | 409 |
| RD-6 | Route soft-deleted / inactive | cannot be selected for a new trip; existing trips still readable |
| RD-7 | Route with null `expectedDistanceKm` | rejected at trip creation with a clear message |
| RD-8 | `routeId` omitted | 400 |
| RD-9 | Fuel litres and hiring rounds | both derive from the resolved distance |
| RD-10 | Legacy trip with `startKm`/`endKm` and no route snapshot | reads back unchanged; invoice `tripSnapshot` still renders |

### 10.4 Vehicle rates and historical calculations

| # | Scenario | Expected |
|---|---|---|
| VR-1 | Three vehicles, different rates | three different line amounts |
| VR-2 | Vehicle rates changed after trip creation | trip `rateSnapshot` unchanged |
| VR-3 | Vehicle rates changed after trip completion | unchanged |
| VR-4 | Invoice generated before and after a rate change | identical totals |
| VR-5 | Finalized invoice, then rates changed, then PDF re-rendered | identical PDF values |
| VR-6 | Legacy trip with no `rateSnapshot` | falls back to the contract version; result matches pre-change behaviour |
| VR-7 | Vehicle with `averageKmPerLitre = 0` | explicit validation error, **never** a divide-by-zero or zero bill |
| VR-8 | Vehicle with no rates and no matching `capacityRates` entry | `BillingRuleConfigurationError` |
| VR-9 | Vehicle rate edit | `audit_logs` entry with before/after |

### 10.5 Financial consistency

| # | Scenario | Expected |
|---|---|---|
| FC-1 | `generate` called twice for the same firm/vehicle/month | 409 (existing unique index) |
| FC-2 | `regenerate` on a draft | no duplicate line items; `duplicateTripGuard.hash` updated |
| FC-3 | reopen → regenerate → finalize | one invoice; `reopenHistory` has one entry; bill number per Q-10 |
| FC-4 | Dashboard and RPT-03 expense totals | wages counted exactly once across both paths (depends on Q-8) |
| FC-5 | Sum of `lineItems[].snapshot.totalAmount` | equals `summary.totalAmount` |
| FC-6 | Sum of `lineItems[].snapshot.distanceKm` for a multi-day trip | equals the trip's `totalKm` (apportionment must not create or destroy distance) |
| FC-7 | Records created before the change | all list/detail/report endpoints return 200 and render |
| FC-8 | Advance ledger | `sum(recoveries) === SalaryRecord.advanceDeduction` after every operation |

### 10.6 Regression gate

Before each phase is accepted, the **entire existing backend suite must pass unmodified** except for
fixtures explicitly listed in that phase. A fixture change outside the listed set is treated as a
regression signal, not a test-maintenance task.

---

## 11. Phased implementation plan

Ordered by **dependency and risk**, not by requirement number. Phases 0–2 are safety and groundwork;
the behaviour-changing phases follow.

---

### Phase 0 — Decision lock and safety net

**Objective:** remove ambiguity and establish a regression baseline before touching behaviour.

- **Q-1 threshold policy implemented** using the existing A-01 precedence: exactly 127 km is 1 round; 700 km is 1.5; decimal values above 700 use the 2-round row. Q-2 (multi-day distance allocation), Q-3 (route directionality), Q-16 (same-day aggregation), and Q-18 (rounding/precision) remain gates for later phases.
- Resolve **Q-17** against the source bill: `NIR/05` says May while its printed period/date say June.
- Record the confirmed slab table in `requirements-analysis.md` §5.2 and reconcile the two conflicting engine test fixtures. **Completed in Phase 2.**
- Full backend suite was run after Phase 2: 19/19 suites and 115/115 tests passed. A pre-change baseline was not captured.
- Decide **Q-8** (whether salary posts to expenses).

**Backend/frontend files:** none. **DB:** none. **Tests:** run existing suite only.
**Acceptance:** Q-1 implementation precedence recorded; Q-2, Q-3, Q-8, Q-16 through Q-18 remain open for their dependent phases. Full suite passed after Phase 2; no pre-change baseline was captured.
**Rollback:** n/a.

---

### Phase 1 — Close the invoice-lock gap (implemented)

**Objective:** prevent approved/finalized invoices from being desynchronized while retaining editable
drafts and an accurate draft calculation snapshot.

**Business rules:** BR-C-10, BR-C-18, D-12.
**Backend:** `trips/trip.service.ts` (`update`, `delete`, `getById`), `trip.controller.ts`, `invoices/invoice.service.ts` (draft regeneration and approval refresh).
**Frontend:** `TripDetailsPage.tsx` displays a read-only lock view; `TripFormPage.tsx` redirects direct edit attempts for locked trips; `InvoiceDetailsPage.tsx` retains regeneration for empty drafts.
**DB:** none. **API:** `GET /trips/:id` adds `billingInvoiceStatus`; PATCH/DELETE return 409 for a linked invoice not in `draft` status. Edits to draft-linked trips regenerate the draft snapshot.
**Depends on:** independent of the unresolved billing decisions in Phase 0. Focused trip/invoice suites and the full backend suite passed after implementation; a pre-change baseline was not captured.
**Risk:** draft edits refresh snapshots; approved/finalized trips require the existing reopen workflow. Draft regeneration remains non-transactional with the trip edit on standalone MongoDB deployments.
**Tests:** `trip.test.ts` 6/6 and `invoice.test.ts` 6/6; coverage includes draft refresh, lock after finalization, blocked delete, and edit after reopen. Full backend suite: 19/19 suites, 105/105 tests passed. Frontend production build passes.
**Acceptance:** approved/finalized invoice trips cannot be changed; draft edits keep line snapshots current; reopen unlinks trips and restores editability.
**Rollback:** revert code. If deployed, draft invoices regenerated under this phase can be regenerated again after rollback; finalized snapshots were not rewritten.

---

### Phase 2 — Billing threshold correction and hardening (implemented)

**Objective:** implement the confirmed four-band rule with deterministic inclusive/exclusive boundaries and make selection independent of configuration order.

**Business rules:** BR-2 (partial), §5.6.
**Backend:** `billing/billing-engine.ts` sorts a copy of `kmThresholds`, handles the highest finite boundary inclusively, then falls through to the unlimited row. Contract validation already requires ascending rows and a final unlimited row; it was unchanged.
**Frontend:** no source/API change required; the existing contract-version editor already accepts the same numeric thresholds. **DB:** none. **API:** unchanged.
**Depends on:** owner-confirmed threshold bands; monetary rounding was preserved unchanged, so Q-18 does not block Phase 2.
**Risk:** exact 127 is assigned to the 1-round band under the prior documented assumption; values above 700 use the 2-round unlimited row.
**Tests:** `billing-engine.test.ts` covers the boundaries and reversed-order rows. TH-9/10 belong to Phase 5; TH-11 belongs to Phase 3.
**Acceptance:** 100/126 km → 0.5, 127/499 km → 1, 500/700 km → 1.5, >700 km → 2; threshold order cannot affect results.
**Verify:** billing engine 28/28 tests; engine + Excel parity + contract validation 40/40 tests; full backend 19/19 suites and 115/115 tests. Frontend production build passed. No rounding or daily aggregation behavior changed.
**Rollback:** revert code/tests; no data or schema changed.

---

### Phase 3 — Vehicle operational rates (implemented, additive/inert)

**Objective:** give vehicles their own rates and centralise resolution — **without** changing any
calculation yet.

**Business rules:** BR-2, BR-4 layer 1.
**Backend:** `vehicles/vehicle.model.ts`, `vehicle.validation.ts`, `vehicle.service.ts`, `vehicle.controller.ts`, audit action `vehicle.operational_rates_updated`; new `billing/rate-resolution.service.ts` implementing §5.3.
**Frontend:** `pages/vehicles/VehicleFormPage.tsx`, `VehicleDetailsPage.tsx`, `types/resources.ts` — rate entry, clearing, validation, and display. `vehiclesApi.ts` required no shape change.
**DB:** optional `vehicles.operationalRates`; no backfill or migration.
**API:** additive only. Existing vehicles with no rates remain valid.
**Depends on:** Phase 2.
**Risk:** low. The resolver is intentionally not consumed by invoice billing until Phase 4 captures trip-level snapshots.
**Tests:** vehicle API 9/9; rate resolver 5/5; full backend regression 20/20 suites, 123/123 tests; existing Phase 1/2 behavior remains green.
**Acceptance:** rates can be configured, cleared, and audited; effective-date and legacy fallback resolution is explicit; current billing behavior is unchanged.
**Verify:** frontend production build passed; focused backend suites passed. Direct backend `tsc --noEmit` is blocked by the repository's existing missing `cookiejar` type-definition error; Jest/ts-jest compilation passed for touched backend paths.
**Rollback:** revert code; optional operational-rate fields can remain unused without changing legacy billing.

---

### Phase 4 — Route-sourced distance + trip rate snapshot **(implemented)**

**Objective:** make the server authoritative for distance and pin each trip's rates.

**Business rules:** BR-3, BR-4 layers 1–2.
**Backend:** `routes/route.validation.ts`; `trips/trip.model.ts` (`routeDistanceSnapshot`, `rateSnapshot`), `trip.service.ts` (resolve distance, capture snapshots, ignore client distance for route trips), `trip.validation.ts` (`routeId` required on create, `totalKm` optional/non-authoritative).
**Frontend:** `pages/trips/TripFormPage.tsx` now requires a route and displays its configured distance instead of requiring start/end KM; `types/resources.ts` exposes both snapshots. Existing route pages continue to display configured distance; backend route creation now requires it.
**DB:** optional trip fields; no migration or historical backfill. Active routes created before this phase must be audited for missing distance before new trip entry relies on them.
**API:** breaking for new trip clients — `routeId` required and `totalKm` is server-derived; legacy trip documents remain readable.
**Depends on:** Phases 1 and 3 (the lock prevents snapshot drift on billed trips; the resolution service supplies the rates).
**Risk:** **high.** Breaking request contract; frontend and backend must deploy atomically.
**Tests:** trip integration 8/8, route integration 5/5, invoice lifecycle 6/6; full backend 20/20 suites, 125/125 tests; frontend production build passed. Coverage includes route distance overriding client input, missing route rejection, snapshot capture, legacy invoice fallback, and draft refresh.
**Acceptance:** new API trips use route distance and capture route/rate snapshots; invoice calculations consume trip rate snapshots when present; legacy trips/invoices remain readable and billable through fallback.
**Verify:** produce a pre-deploy report showing zero active routes with null/non-positive `expectedDistanceKm`; manually create/edit a route-backed trip and verify stored distance/rate snapshots and invoice totals.
**Rollback:** revert code. New trip fields remain but are ignored by the reverted code; **no finalized financial data is touched**, so rollback is safe.

---

### Phase 5 — Multi-day trips and daily distance **(ship as one unit)**

**Objective:** the single highest-risk change. Trips gain a span, billing switches to per-day line
items, wages switch to day-span union.

**Business rules:** BR-1, BR-2 (daily distance).
**Backend:** `trips/trip.model.ts` (`tripEndDate`), `trip.validation.ts`, `trip.service.ts`; new shared `wageDays` helper; `salary/salary.service.ts` (`generate` + new `regenerate`, exclude cancelled); `invoices/invoice.service.ts` (`buildLineItemsFromTrips` → per-(trip, day) lines with apportioned distance); `invoices/invoice.model.ts` (snapshot gains `dailyDistanceKm`, `wageDays`); `invoices/invoice.pdf.ts`.
**Frontend:** `pages/trips/TripFormPage.tsx` (end-date field), `TripListPage.tsx`, `TripDetailsPage.tsx`, `pages/billing/MonthlyBillingPage.tsx`, `services/billingApi.ts`, `services/salaryApi.ts`, `types/resources.ts`.
**DB:** add optional `trips.tripEndDate`. **No backfill. No retro salary recalculation.**
**API:** breaking for invoice consumers — line-item count per trip changes.
**Depends on:** Phase 4 (distance must already be server-resolved) and Q-2 (apportionment rule).
**Risk:** **critical.** Touches wages, advances, billing and reports simultaneously. Splitting it would leave an inconsistent state where trips span days but wages and bills do not.
**Tests:** MD-1…MD-14, TH-9, TH-10, FC-5, FC-6.
**Acceptance:** §4.5 criteria plus "single-day trips produce exactly the same invoice as before".
**Verify:** replay a historical month's trips through the new path and diff totals against the issued invoice — any difference on single-day trips is a defect.
**Rollback:** revert code. `tripEndDate` values become inert (treated as same-day). Salary records already regenerated under the new rule would **not** auto-revert — document this and hold Phase 5 until Phase 6 reporting is ready.

---

### Phase 6 — Reports, dashboard and expense reconciliation

**Objective:** make every aggregate agree with the new trip model.

**Business rules:** RPT-01, RPT-03, RPT-06, RPT-08, RPT-11; Q-8, Q-9.
**Backend:** `reports/report.service.ts` (`tripCountAndKm`, `tollVariance`, `vehicleRevenue`), `dashboard/dashboard.service.ts`; expense/salary reconciliation per Q-8.
**Frontend:** report and dashboard pages.
**DB:** none, unless Q-8 introduces a salary→expense posting (then: unique index on `salaryRecordId`).
**Depends on:** Phase 5.
**Risk:** medium — wrong totals are highly visible but not data-corrupting.
**Tests:** FC-4, FC-7, MD-12 month attribution.
**Acceptance:** trip counts, KM, margins and wage figures reconcile with the underlying collections for a known month.
**Rollback:** read-path only; safe to revert.

---

### Phase 7 — Full-workflow regression

**Objective:** prove the end-to-end chain.

```
Vehicle configuration → Route selection → Trip creation (multi-day) → Trip completion
→ Driver wage generation → Advance recovery → Billing calculation → Invoice generation
→ Approval → Finalization → PDF → Payment → Expense and financial reports
```

**Scope:** one integration test covering the whole chain, plus:
- a legacy-data pass (pre-change trips, invoices and salary records all still readable and correct);
- a frozen-history pass (change vehicle rates and route distances, then re-read every historical invoice and confirm zero drift).

**Acceptance:** all §10 suites green; no finalized invoice total changed anywhere in the database.

---

## 12. Risk register

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-1 | Daily-distance apportionment changes billed amounts for multi-day trips | High | **Critical** | Blocked on Q-2; validate against a real multi-day example before coding |
| R-2 | Misassigning exact 127 or treating fractional 700.x KM as 1.5 instead of 2 changes the hiring charge | Low after Phase 2 | High | Implemented A-01 precedence and inclusive highest finite boundary; covered by boundary tests |
| R-3 | Finalized invoices silently recalculated | Low | **Critical** | Never recompute finalized snapshots; Phase 7 frozen-history pass |
| R-4 | Trips edited while attached to an approved/finalized invoice (baseline defect; **Phase 1 guard implemented**) | Low after fix | **Critical** | `trip.test.ts` lock/reopen coverage; verify in full suite |
| R-5 | Double-counted wages between `SalaryRecord` and `driver_wages` expenses (**exists today**) | Medium | High | Q-8; if posting is added, key it by `salaryRecordId` with a unique index |
| R-6 | Advance recovery desynchronised by wage regeneration | Medium | High | Reuse the existing reverse-then-reapply path; FC-8 assertion |
| R-7 | `routeId` becomes required while the old frontend allows null | Medium | High | Atomic Phase 4 deploy |
| R-8 | Routes lacking `expectedDistanceKm` block trip creation | High | Medium | Pre-deploy data-quality report; owner backfill |
| R-9 | Unsorted `kmThresholds` select the wrong multiplier (**resolved Phase 2**) | Low after fix | High | Engine sorts a copy; reversed-order test covers selection |
| R-10 | Vehicle rate edits retro-price in-progress trips | Medium | High | Snapshot at creation (§7.3); explicit audited re-price only |
| R-11 | Divide-by-zero / zero bill from a misconfigured average | Medium | High | Validation + VR-7; engine must throw, never default |
| R-12 | Month-boundary trips double-paid across two salary records | Medium | High | Day-level attribution + MD-12 |
| R-13 | Reports attribute a spanning trip's whole KM to the start month | High | Medium | Phase 6 + Q-9 |
| R-14 | Fixture churn hides a real regression | High | Medium | §10.6 gate: only explicitly listed fixtures may change per phase |
| R-15 | `hiringMultiplierRules`, `tollTreatment: 'fixed'`, `charge.basis` remain dead/silent | Certain | Medium | Explicit decisions, not implicit defaults (§5.6) |
| R-16 | No frontend tests → UI regressions undetected | Certain | Medium | Manual scripted walkthrough per phase, or add Vitest in Phase 0 |
| R-17 | Applying one daily threshold vs one threshold per run changes hiring totals; workbook already has 420 km days billed at 1.5 line-rounds | High | **Critical** | Q-16; test against the actual same-date rows before changing the billing engine |
| R-18 | Invoice month encoded in bill number disagrees with printed period/date | Medium | High | Q-17; confirm intended month and ensure generation, numbering, PDF and reports use one canonical period |
| R-19 | Excel raw-precision totals differ from app's rounded-line, 2dp PDF totals | High | High | Q-18; compare line and grand totals using the source formulas and visible number formats |

---

## 13. Unresolved questions and resolved threshold choice

Q-1 is resolved for implementation using the prior documented A-01 assumption. Other rows remain
business decisions that cannot be inferred from the code, documentation, or workbook; they block
only their dependent phases.

| # | Question | Impact if unanswered | Blocks |
|---|---|---|---|
| **Q-1 (resolved for implementation)** | Implemented bands: `<127 = 0.5`, `127 through <500 = 1`, `500 through 700 inclusive = 1.5`, `>700 = 2`. Exactly 127 follows existing A-01 assumption; decimal KM are supported. Reopen only if the owner intended exactly 127 to stay in the 0.5 band. | Owner may request a different 127-km precedence | None unless revised |
| **Q-2** | For a multi-day trip, how is distance attributed per day for threshold purposes — even split, operator-entered per-day distances, or route distance × days? | Directly changes invoice totals for every multi-day trip | Phase 5 |
| **Q-3** | Is `Route.expectedDistanceKm` one-way or round-trip, and does a trip represent one leg or a return journey? | Every bill could be out by 2× | Phase 4 |
| **Q-4** | Do wage days depend on `operationalStatus`? Should a `planned` or `in_progress` trip accrue wages, or only a `completed` one? | Changes `daysWorked` and therefore every wage figure | Phase 5 |
| **Q-5** | For routes with no `expectedDistanceKm`: block trip creation, or allow a one-off manual override with a reason? | Determines whether Phase 4 can ship before the data backfill | Phase 4 |
| **Q-6** | If a client submits a `totalKm` that disagrees with the route, should the API silently use the route value or return 400? | Affects API contract and error handling | Phase 4 |
| **Q-7** | Should `invoice.regenerate` re-price from current rates (today's behaviour) or from the frozen `Trip.rateSnapshot` (proposed)? | Determines whether reopening a bill can change its amount | Phase 5 |
| **Q-8** | Should generated `SalaryRecord` wages post into the `expenses` collection? Today they do not, so margins exclude driver wages, while manually entered `driver_wages` expenses are counted — a live inconsistency. | Every margin, dashboard expense total and RPT-01/RPT-03 figure | Phase 6 |
| **Q-9** | For a multi-day trip, should dashboard/report trip counts and KM be attributed to the start date, split per day, or counted once per day? | Report totals | Phase 6 |
| **Q-10** | On reopen and re-finalize, does the invoice keep its original bill number? (Already open as AMB-06 / Q-09 in `requirements-analysis.md`.) | Bill numbering continuity | Phase 5 |
| **Q-11** | Should `hiringMultiplierRules`, `tollTreatment: 'fixed'`, and `otherBillableCharges[].basis` be implemented or removed? All three are currently dead or silently zero. | Latent misconfiguration risk outside this threshold change | Separate follow-up; does not block Phase 2 |
| **Q-12** | Should historical salary records be recalculated under the new multi-day rule, or does it apply from go-live forward only? | Retro wage liability | Phase 5 |
| **Q-13** | Which calendar timezone defines a wage day and the inclusive start/end dates? Current salary generation groups UTC dates, but the operating business is in India and no timezone policy is documented. | A trip around midnight can count toward different wage days/months depending on timezone | Phase 5 |
| **Q-14** | If a trip spans a billing-month boundary, should its distance/charges be split across each month's invoice, or should the whole trip remain in the start-date month as current invoice selection does? | Revenue, threshold application and invoice totals can move between periods | Phase 5 and Phase 6 |
| **Q-15** | If a global HSD rate becomes effective during a multi-day trip, should fuel reimbursement use the trip-start rate snapshot or the applicable rate per day? How does that interact with a vehicle-specific override? | Fuel amounts differ for cross-effective-date trips; affects snapshot granularity | Phase 5 |
| **Q-16** | The stated target is one threshold on combined vehicle distance per day. Confirm that the resulting intentional variance from the reference workbook is accepted, and decide how the one daily hiring calculation is allocated/displayed across multiple invoice trip lines. | For UP13BT5953, 110 + 310 km on each of eight dates is currently billed as 1.5 line-rounds, while the specified daily basis gives 1.0 on 420 km. | Phase 5 |
| **Q-17** | Is `NIR/05/26-27/13` a May bill with an incorrect June period/date, or a June bill with an incorrect `05` number segment? | Current invoice month, bill number, PDF period and report month cannot all match this example | Invoice acceptance |
| **Q-18** | Is the production accounting policy the workbook's raw-precision formulas summed before display (amount cells formatted to whole rupees), or the application's 2dp per-line rounding and 2dp PDF output? | Correct rates can still produce different line totals and grand totals | Phase 5 invoice calculation acceptance |

---

## 14. Readiness assessment

**Phases 1–2 are implemented and ready for manual verification. Phase 3 is next after that checkpoint. Phases 4–6 remain gated by multi-day distance, route-direction, same-day aggregation, invoice-period, and rounding decisions.**

**What is in good shape**

- The billing engine is genuinely pure, deterministic and exact-decimal. It is a sound foundation.
- Invoice line items already carry a complete calculation snapshot, so historical reproducibility is real, not aspirational.
- The advance-recovery ledger is already idempotent by replacement — the hardest financial-correctness problem in BR-1 is already solved.
- Contract versioning with non-overlapping effective dates already exists and is enforced.

**What must be resolved first**

1. **Q-2, Q-3, Q-16 and Q-18.** These determine multi-day distance allocation, route meaning, same-day aggregation, and invoice totals. Q-1 is implemented using A-01 and can be revised if the owner specifies different 127-km precedence.
2. **The trip-edit-after-billing gap (R-4, D-12) is fixed in Phase 1.** Focused tests passed; the complete backend suite and manual workflow verification remain outstanding.
3. **Route distance data quality.** `expectedDistanceKm` is optional today and probably sparsely populated.
4. **The wage/expense duplication question (Q-8).** It is already producing inconsistent margins.

**Phases 1 and 2 are implemented and ready for manual verification.** Phase 2 required no schema or
API change; it keeps existing 2dp monetary rounding and only changes threshold selection.

**Next after verifying Phases 1–2: Phase 3 (vehicle operational rates, additive/inert).** It can
proceed while Q-2, Q-3, Q-16, and Q-18 are resolved for their dependent calculation phases.

**Do not start Phase 5 (multi-day) until Phase 4 is deployed and stable in production for at least one
full billing cycle.** Phase 5 changes wages, billing and reports at the same time; it needs a clean,
server-authoritative distance baseline underneath it.
