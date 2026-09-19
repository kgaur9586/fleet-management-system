# MongoDB Relationships
## Fleet & Transport Operations, Expense and Billing Platform

**Companion to:** `docs/mongodb-design.md`
**Date:** September 2026

---

## Table of Contents

1. [Entity Relationship Overview](#1-entity-relationship-overview)
2. [Complete Relationship Map](#2-complete-relationship-map)
3. [Relationship Details by Collection](#3-relationship-details-by-collection)
4. [Reference vs Embed Decision Map](#4-reference-vs-embed-decision-map)
5. [Critical Data Flows](#5-critical-data-flows)
6. [Denormalized Fields Map](#6-denormalized-fields-map)
7. [Index Coverage Matrix](#7-index-coverage-matrix)

---

## 1. Entity Relationship Overview

```
                         ┌───────────┐
                         │  companies │
                         │ (factories)│
                         └─────┬──────┘
                               │ 1
                               │ company has many firms
                               │ N
                         ┌─────┴──────┐
                    ┌────│   firms    │────┐
                    │    │(bill vendors│    │
                    │    └─────┬──────┘    │
                    │          │ 1         │
                    │     firm has many    │
                    │     vehicles         │
                    │          │ N         │
                    │    ┌─────┴──────┐    │
                    │    │  vehicles  │    │
                    │    └─────┬──────┘    │
                    │          │           │
                    │    vehicle has many  │
                    │    trips             │
                    │          │           │
              ┌─────┘    ┌─────┴──────┐    └─────┐
              │          │   trips    │          │
              │          └─────┬──────┘          │
              │                │ N               │
              │      N         │         N       │
        ┌─────┴────┐    ┌──────┴──────┐   ┌─────┴────┐
        │contracts │    │   drivers   │   │  routes  │
        └──────────┘    └─────────────┘   └──────────┘

                    Trips → Bills (many trips per bill)
                    Bills → bill_payments (many payments per bill)
```

---

## 2. Complete Relationship Map

### All collection references

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     REFERENCE RELATIONSHIP MAP                          │
│                                                                         │
│  Collection      │  Field               │  References                  │
│──────────────────┼──────────────────────┼──────────────────────────    │
│  firms           │  company             │  → companies                 │
│  vehicles        │  firm                │  → firms                     │
│  routes          │  company             │  → companies (optional)      │
│  contracts       │  firm                │  → firms                     │
│  contracts       │  company             │  → companies                 │
│  contracts       │  createdBy           │  → users                     │
│  hsd_rates       │  createdBy           │  → users                     │
│  trips           │  vehicle             │  → vehicles                  │
│  trips           │  driver              │  → drivers                   │
│  trips           │  firm                │  → firms (denorm)            │
│  trips           │  route               │  → routes (optional)         │
│  trips           │  contractId          │  → contracts                 │
│  trips           │  hsdRateId           │  → hsd_rates                 │
│  trips           │  billId              │  → bills (optional)          │
│  trips           │  createdBy           │  → users                     │
│  bills           │  firm                │  → firms                     │
│  bills           │  company             │  → companies                 │
│  bills           │  vehicle             │  → vehicles                  │
│  bills           │  finalizedBy         │  → users (optional)          │
│  bills           │  createdBy           │  → users                     │
│  bill_payments   │  bill                │  → bills                     │
│  bill_payments   │  firm                │  → firms (denorm)            │
│  bill_payments   │  company             │  → companies (denorm)        │
│  bill_payments   │  createdBy           │  → users                     │
│  expenses        │  vehicle             │  → vehicles (optional)       │
│  expenses        │  firm                │  → firms (denorm, optional)  │
│  expenses        │  trip                │  → trips (optional)          │
│  expenses        │  createdBy           │  → users                     │
│  salary_records  │  driver              │  → drivers                   │
│  salary_records  │  createdBy           │  → users                     │
│  vehicle_docs    │  vehicle             │  → vehicles                  │
│  vehicle_docs    │  firm                │  → firms (denorm)            │
│  vehicle_docs    │  createdBy           │  → users                     │
│  audit_logs      │  entityId            │  → (any collection)          │
│  audit_logs      │  userId              │  → users                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Relationship Details by Collection

### 3.1 `companies` — relationships

| Direction | Related collection | Cardinality | Type | Field |
|---|---|---|---|---|
| Has many | `firms` | 1:N | Reference | `firms.company` |
| Has many | `routes` | 1:N | Reference (optional) | `routes.company` |
| Has many | `contracts` | 1:N | Reference | `contracts.company` |
| Has many | `bills` | 1:N | Reference | `bills.company` |
| Referenced by | `bill_payments` | — | Denormalized | `bill_payments.company` |

---

### 3.2 `firms` — relationships

```
companies ─────(1:N)────▶ firms ─────(1:N)────▶ vehicles
                            │
                            ├──────(1:N)────▶ contracts
                            ├──────(1:N)────▶ bills
                            └──────(1:N)────▶ bill_payments (denorm)
```

| Direction | Related collection | Cardinality | Type | Field |
|---|---|---|---|---|
| Belongs to | `companies` | N:1 | Reference | `firms.company` |
| Has many | `vehicles` | 1:N | Reference | `vehicles.firm` |
| Has many | `contracts` | 1:N | Reference | `contracts.firm` |
| Has many | `trips` | 1:N | Denormalized | `trips.firm` |
| Has many | `bills` | 1:N | Reference | `bills.firm` |
| Has many | `bill_payments` | 1:N | Denormalized | `bill_payments.firm` |
| Has many | `expenses` | 1:N | Denormalized | `expenses.firm` |
| Has many | `vehicle_documents` | 1:N | Denormalized | `vehicle_documents.firm` |

---

### 3.3 `vehicles` — relationships

```
firms ─────(1:N)────▶ vehicles ─────(1:N)────▶ trips
                           │
                           ├──────(1:N)────▶ vehicle_documents
                           ├──────(1:N)────▶ expenses
                           └──────(1:N)────▶ bills
```

| Direction | Related collection | Cardinality | Type | Field |
|---|---|---|---|---|
| Belongs to | `firms` | N:1 | Reference | `vehicles.firm` |
| Has many | `trips` | 1:N | Reference | `trips.vehicle` |
| Has many | `bills` | 1:N | Reference | `bills.vehicle` |
| Has many | `expenses` | 1:N | Reference | `expenses.vehicle` |
| Has many | `vehicle_documents` | 1:N | Reference | `vehicle_documents.vehicle` |

**Note:** A vehicle always belongs to exactly one firm. If a vehicle is transferred to another firm, the `firm` reference is updated and an audit log entry is created. Historical trips retain the firm that was set at trip creation.

---

### 3.4 `drivers` — relationships

```
drivers ─────(1:N)────▶ trips          (assigned per trip, not per vehicle)
        ─────(1:N)────▶ salary_records (one record per month)
```

| Direction | Related collection | Cardinality | Type | Field |
|---|---|---|---|---|
| Assigned to many | `trips` | 1:N | Reference | `trips.driver` |
| Has many | `salary_records` | 1:N | Reference | `salary_records.driver` |

**Important:** Drivers are **not** permanently assigned to a vehicle. Each trip record has its own driver reference. A driver can drive different vehicles on different days.

---

### 3.5 `routes` — relationships

| Direction | Related collection | Cardinality | Type | Field |
|---|---|---|---|---|
| Optional belongs to | `companies` | N:1 (optional) | Reference | `routes.company` |
| Referenced by | `trips` | 1:N | Reference (optional) | `trips.route` |

Routes are optional on trips. When a route is selected, the trip's `fromLocation` and `toLocation` are pre-filled. They are stored as strings on the trip so historical trips are unaffected if the route is later changed.

---

### 3.6 `contracts` — relationships

```
firms ─────(1:N)────▶ contracts (versioned)
companies ─────────▶ contracts

contracts embeds:
  ├── kmSlabs[ ]          (billing rule — no independent lifecycle)
  └── capacityRates[ ]    (per-capacity rates — no independent lifecycle)

trips.contractId ─────────▶ contracts (traceability — not for recalculation)
```

| Direction | Related collection | Cardinality | Type | Field |
|---|---|---|---|---|
| Belongs to | `firms` | N:1 | Reference | `contracts.firm` |
| Belongs to | `companies` | N:1 | Reference | `contracts.company` |
| Referenced by | `trips` | 1:N | Reference | `trips.contractId` |
| Embeds | `kmSlabs` | 1:N | Embedded array | — |
| Embeds | `capacityRates` | 1:N | Embedded array | — |

**Versioning pattern:**

```
contracts collection for firm "NIR":

Document 1:
  { firm: NIR, effectiveFrom: 2024-01-01, effectiveTo: 2025-12-31, ... }

Document 2:
  { firm: NIR, effectiveFrom: 2026-01-01, effectiveTo: null, ... }  ← currently active

When rates change:
  1. Update Document 2: { effectiveTo: 2026-07-31 }
  2. Insert Document 3: { effectiveFrom: 2026-08-01, effectiveTo: null, ... new rates }
```

**Lookup query (find active contract for firm on a given date):**

```javascript
Contract.findOne({
  firm: firmId,
  effectiveFrom: { $lte: tripDate },
  $or: [
    { effectiveTo: null },
    { effectiveTo: { $gt: tripDate } }
  ]
}).sort({ effectiveFrom: -1 })
```

---

### 3.7 `hsd_rates` — relationships

```
hsd_rates (global, not per firm)
  ↑
  trips.hsdRateId  ──────(N:1)──────▶  hsd_rates  (traceability)
  bills.calculationSnapshot.hsdRateId  ──▶  hsd_rates  (traceability)
```

| Direction | Related collection | Cardinality | Type | Field |
|---|---|---|---|---|
| Referenced by | `trips` | 1:N | Reference | `trips.hsdRateId` |
| Referenced by | `bills` (snapshot) | 1:N | Reference (in snapshot) | `calculationSnapshot.hsdRateId` |

The HSD rate is global and not tied to any firm or contract. It has its own effective date timeline, separate from contracts.

---

### 3.8 `trips` — relationships (most connected collection)

```
vehicles ─────(1:N)────▶ trips
drivers ──────(1:N)────▶ trips
firms ─────────────────▶ trips (denorm from vehicle)
routes ───────(1:N)────▶ trips (optional)
contracts ─────────────▶ trips (traceability: contractId)
hsd_rates ─────────────▶ trips (traceability: hsdRateId)
bills ──────────────────▶ trips (billId — set when included in bill)
                 trips ──────(N:1 grouped)────▶ bills
```

| Direction | Related collection | Cardinality | Type | Field |
|---|---|---|---|---|
| Belongs to | `vehicles` | N:1 | Reference | `trips.vehicle` |
| Assigned to | `drivers` | N:1 per trip | Reference | `trips.driver` |
| Belongs to | `firms` | N:1 | Denorm | `trips.firm` |
| Uses (optional) | `routes` | N:1 | Reference | `trips.route` |
| Calculated using | `contracts` | N:1 | Reference (trace) | `trips.contractId` |
| Calculated using | `hsd_rates` | N:1 | Reference (trace) | `trips.hsdRateId` |
| Grouped into | `bills` | N:1 | Reference | `trips.billId` |
| Referenced by | `expenses` | 1:N | Reference (optional) | `expenses.trip` |

**Driver-Vehicle-Trip relationship over time:**

```
Date        | Vehicle    | Driver
─────────────────────────────────
01-Jun-2026 | UP13DT0632 | Driver A
02-Jun-2026 | UP13DT0632 | Driver A
03-Jun-2026 | UP13DT0471 | Driver A   ← same driver, different vehicle
04-Jun-2026 | UP13DT0632 | Driver B   ← same vehicle, different driver
```

Each trip is a unique combination of (date, vehicle, driver). No permanent vehicle-driver assignment exists in the data model.

---

### 3.9 `bills` — relationships

```
firms ──────────(1:N)────▶ bills
companies ──────(1:N)────▶ bills
vehicles ───────(1:N)────▶ bills
trips ─────(N aggregated)─▶ bills  (via trips.billId)
bills ──────────(1:N)────▶ bill_payments
bills embeds: calculationSnapshot
  └── tripSnapshots[ ]  (immutable copies of trip billing data)
```

| Direction | Related collection | Cardinality | Type | Field |
|---|---|---|---|---|
| Belongs to | `firms` | N:1 | Reference | `bills.firm` |
| Belongs to | `companies` | N:1 | Reference | `bills.company` |
| Belongs to | `vehicles` | N:1 | Reference | `bills.vehicle` |
| Aggregates | `trips` | 1:N (via billId) | Reference | `trips.billId` |
| Has many | `bill_payments` | 1:N | Reference | `bill_payments.bill` |
| Embeds (at finalization) | `calculationSnapshot` | 1:1 | Embedded | — |

**Uniqueness constraint:**
```javascript
{ firm: 1, vehicle: 1, billingMonth: 1, billingYear: 1 }   // UNIQUE INDEX
```
One bill per vehicle per firm per month. If a bill already exists for this combination, it cannot be created again (must reopen the existing one).

---

### 3.10 `bill_payments` — relationships

```
bills ─────(1:N)────▶ bill_payments
firms ──────────────▶ bill_payments (denorm)
companies ──────────▶ bill_payments (denorm)
```

| Direction | Related collection | Cardinality | Type | Field |
|---|---|---|---|---|
| Belongs to | `bills` | N:1 | Reference | `bill_payments.bill` |
| Belongs to | `firms` | N:1 | Denorm | `bill_payments.firm` |
| Belongs to | `companies` | N:1 | Denorm | `bill_payments.company` |

On every payment record:
1. Payment is inserted into `bill_payments`
2. `bills.totalPaid` is incremented by `amountReceived`
3. `bills.outstandingAmount` is decremented by `amountReceived`
4. `bills.status` is updated: `outstanding` → `partially_paid` or `paid`

---

### 3.11 `expenses` — relationships

```
vehicles ─────(1:N)────▶ expenses (optional)
firms ──────────────────▶ expenses (denorm from vehicle)
trips ──────────────────▶ expenses (optional trip-level link)
```

| Direction | Related collection | Cardinality | Type | Field |
|---|---|---|---|---|
| Belongs to | `vehicles` | N:1 (optional) | Reference | `expenses.vehicle` |
| Belongs to | `firms` | N:1 (optional) | Denorm | `expenses.firm` |
| Linked to | `trips` | N:1 (optional) | Reference | `expenses.trip` |

Note: Some expenses may not be vehicle-specific (e.g., office expenses entered as `category: 'other'`). Both `vehicle` and `firm` are optional.

---

### 3.12 `salary_records` — relationships

```
drivers ─────(1:N)────▶ salary_records (one per month)
```

| Direction | Related collection | Cardinality | Type | Field |
|---|---|---|---|---|
| Belongs to | `drivers` | N:1 | Reference | `salary_records.driver` |

---

### 3.13 `vehicle_documents` — relationships

```
vehicles ─────(1:N)────▶ vehicle_documents
firms ──────────────────▶ vehicle_documents (denorm)
```

| Direction | Related collection | Cardinality | Type | Field |
|---|---|---|---|---|
| Belongs to | `vehicles` | N:1 | Reference | `vehicle_documents.vehicle` |
| Belongs to | `firms` | N:1 | Denorm | `vehicle_documents.firm` |

---

## 4. Reference vs Embed Decision Map

| Data | Decision | Reason |
|---|---|---|
| `contracts.kmSlabs` | **Embed** | Always read with contract; versioned with contract; no independent lifecycle |
| `contracts.capacityRates` | **Embed** | Same as above |
| `firms.bankDetails` | **Embed** | Always read with firm (needed for every PDF bill footer); single coherent unit; changes as a group |
| `bills.calculationSnapshot` | **Embed** | Immutable at finalization; must be self-contained for historical reproduction; never queried independently |
| `bills.calculationSnapshot.tripSnapshots[]` | **Embed within snapshot** | Part of the self-contained historical bill record; 29–31 entries max (one per day of the month) |
| `bills.reopenHistory[]` | **Embed** | Low volume (rarely reopened); always read with bill; 0–5 entries typically |
| Vehicle → Trips | **Reference** | Trips have an independent lifecycle and need to be queried independently by date, driver, firm |
| Drivers → Trips | **Reference** | Same reason; driver-trip is a many-to-many relationship over time |
| Firms → Bills | **Reference** | Bills are top-level independent documents |
| Contracts → Trips | **Reference (traceability only)** | `trips.contractId` is stored for audit/trace, not for recalculation. The trip stores its own calculated values. |
| HSD Rates → Trips | **Reference (traceability only)** | Same as above |
| Expenses per category | **Single collection + embedded sub-doc** | Reporting aggregates across categories; category-specific fields are optional embedded sub-documents |

---

## 5. Critical Data Flows

### 5.1 Trip creation — rate lookup chain

```
POST /api/trips
  │
  ├─ 1. Load vehicle → get: firm, capacity
  │         vehicle.firm    → firms._id
  │         vehicle.capacity → 29000
  │
  ├─ 2. Find active contract for firm on tripDate
  │         contracts WHERE:
  │           firm = vehicle.firm
  │           effectiveFrom <= tripDate
  │           effectiveTo > tripDate OR effectiveTo = null
  │         ORDER BY effectiveFrom DESC
  │         LIMIT 1
  │         → returns: kmSlabs, capacityRates
  │
  ├─ 3. Find capacity rate from contract
  │         contract.capacityRates.find(r => r.capacity === 29000)
  │         → returns: averageKmPerLitre=2.5, baseHiringRatePerRound=4500
  │
  ├─ 4. Find active HSD rate on tripDate
  │         hsd_rates WHERE:
  │           effectiveFrom <= tripDate
  │         ORDER BY effectiveFrom DESC
  │         LIMIT 1
  │         → returns: ratePerLitre=95.81
  │
  ├─ 5. Run billing engine (pure functions):
  │         rounds = slabLookup(km=589, slabs)  → 1.5
  │         hsdLitres = 589 / 2.5 = 235.6
  │         hsdAmount = round(235.6 × 95.81, 2) = 22,573.00
  │         hiringCharge = round(1.5 × 4500, 2) = 6,750.00
  │         tripTotal = 22573 + 6750 + 4680 = 34,003.00
  │
  └─ 6. Save trip document with:
            all input fields
            all calculated fields
            contractId (reference)
            hsdRateId (reference)
            firm (denormalized from vehicle)
            vehicleCapacity (denormalized from vehicle)
            status: 'draft'
```

### 5.2 Bill finalization — data flow

```
POST /api/bills/:billId/finalize
  │
  ├─ 1. Load bill + all draft trips (via billId)
  │         trips WHERE billId = this bill._id AND status = 'billed'
  │
  ├─ 2. Re-run billing engine for each trip
  │         (ensures consistency; uses same lookup chain as above)
  │
  ├─ 3. Load firm (for bank details + display name)
  │         firms WHERE _id = bill.firm
  │
  ├─ 4. Load company (for billing address)
  │         companies WHERE _id = bill.company
  │
  ├─ 5. Load vehicle (for capacity + vehicle number)
  │         vehicles WHERE _id = bill.vehicle
  │
  ├─ 6. Load contract (for snapshot metadata)
  │         contracts WHERE _id = trips[0].contractId
  │
  ├─ 7. Load HSD rate (for snapshot metadata)
  │         hsd_rates WHERE _id = trips[0].hsdRateId
  │
  ├─ 8. Build calculationSnapshot:
  │         {
  │           capturedAt: now,
  │           hsdRateId: ...,
  │           hsdRatePerLitre: 95.81,
  │           contractId: ...,
  │           contractName: "NIR-CFL Contract 2024-2026",
  │           kmSlabs: [...copy of slabs...],
  │           capacityRate: { capacity: 29000, average: 2.5, hiring: 4500 },
  │           tripSnapshots: [
  │             { slNo: 1, date: 2026-06-01, km: 589, ..., tripTotal: 34003 },
  │             { slNo: 2, date: 2026-06-02, km: 589, ..., tripTotal: 34003 },
  │             ...29 entries...
  │           ]
  │         }
  │
  ├─ 9. Generate bill number:
  │         firm.billPrefix + "/" + "06" + "/" + "26-27" + "/" + vehicle.vehicleNumber
  │         = "NIR/06/26-27/11"
  │
  ├─ 10. Atomic update:
  │         bills: status='finalized', billNumber=..., finalizedAt=now,
  │                grandTotal, calculationSnapshot, all totals
  │         trips: status='finalized' (all trips in this bill)
  │
  ├─ 11. Write audit_log entry:
  │         { action: 'bill.finalized', entityId: bill._id, userId: ... }
  │
  └─ 12. Return finalized bill → trigger PDF generation
```

### 5.3 Historical bill PDF regeneration

```
GET /api/bills/:billId/pdf  (for an old finalized bill)
  │
  ├─ 1. Load bill document
  │         bills WHERE _id = billId AND status IN ['finalized', 'paid', ...]
  │
  ├─ 2. Load firm (for current bank details and display name)
  │         Note: firm bank details may have changed; but the firm name at
  │         time of finalization is NOT stored in snapshot (by design —
  │         firm name is stable; bank details less so)
  │
  ├─ 3. Render PDF from:
  │         bill.billNumber                           → bill header
  │         bill.bookNumber                           → bill header
  │         bill.period                               → bill header
  │         bill.billDate                             → bill header
  │         firm.displayName + firm.address           → "M/S Nirupama Gupta"
  │         company.legalName + company.address        → "TO: Creamy Foods Ltd"
  │         vehicle.registrationNumber                → "VEHICLE NO."
  │         vehicle.capacity                          → "TANKER COP"
  │         bill.calculationSnapshot.tripSnapshots    → line-by-line table
  │         bill.totals (grandTotal etc.)             → GRAND TOTAL row
  │         firm.bankDetails                          → bank footer
  │
  └─ 4. Stream PDF to client
         (no re-calculation; all data is in the snapshot)
```

### 5.4 Monthly salary calculation

```
POST /api/salary/:driverId/:year/:month
  │
  ├─ 1. Query trips for this driver in this month
  │         trips WHERE:
  │           driver = driverId
  │           date >= month start
  │           date <= month end
  │           isDeleted = false
  │
  ├─ 2. Count distinct calendar dates
  │         daysWorked = new Set(trips.map(t => t.date.toDateString())).size
  │
  ├─ 3. Get driver's current wage rate
  │         drivers.findById(driverId) → dailyWageRate
  │
  ├─ 4. Calculate:
  │         grossWages = daysWorked × dailyWageRate
  │
  ├─ 5. Create salary_records document:
  │         {
  │           driver: driverId,
  │           month, year,
  │           daysWorked,
  │           dailyWageRate,    ← snapshot of current rate
  │           grossWages,
  │           advances: 0,
  │           deductions: 0,
  │           netPayable: grossWages
  │         }
  │
  └─ 6. Owner reviews and updates advances/deductions before marking paid
```

---

## 6. Denormalized Fields Map

Denormalized fields are copied from their source at document creation time and not automatically kept in sync. This is intentional — historical records must reflect the state at the time they were created.

| Collection | Denormalized Field | Source | Sync Strategy |
|---|---|---|---|
| `trips.firm` | firm ObjectId | `vehicles.firm` | Copied at trip creation. If vehicle transfers firm, existing trips retain original firm. |
| `trips.vehicleCapacity` | number | `vehicles.capacity` | Copied at trip creation. If capacity is corrected, existing trips retain original. |
| `bill_payments.firm` | firm ObjectId | `bills.firm` | Copied at payment creation. |
| `bill_payments.company` | company ObjectId | `bills.company` | Copied at payment creation. |
| `bills.totalPaid` | Decimal128 | Sum of `bill_payments.amountReceived` | Updated on every payment insert/delete. |
| `bills.outstandingAmount` | Decimal128 | `grandTotal - totalPaid` | Updated on every payment insert/delete. |
| `expenses.firm` | firm ObjectId | `vehicles.firm` | Copied at expense creation. |
| `vehicle_documents.firm` | firm ObjectId | `vehicles.firm` | Copied at document creation. |
| `audit_logs.userName` | string | `users.name` | Copied at log creation. Never updated. |
| `calculationSnapshot.*` | all rate values | multiple sources | Full copy at bill finalization. Immutable after. |

---

## 7. Index Coverage Matrix

This matrix shows which indexes support which common query patterns.

### `trips` — critical query patterns

| Query Pattern | Index Used |
|---|---|
| Get all trips for a vehicle (chronological / date range) | `{ vehicle: 1, date: -1 }` |
| Get all unbilled trips for a firm | `{ firm: 1, status: 1, date: 1 }` |
| Get all trips for driver in a month (salary) | `{ driver: 1, date: 1 }` |
| Get all trips in a specific bill | `{ billId: 1 }` |
| Firm trips over date range | `{ firm: 1, date: -1 }` |
| Firm + vehicle + month (bill generation & preview) | `{ firm: 1, vehicle: 1, date: 1 }` |
| Cross-fleet date range queries | `{ date: 1 }` |

### `bills` — critical query patterns

| Query Pattern | Index Used |
|---|---|
| Look up bill by bill number | `{ billNumber: 1 }` — unique |
| Check if bill exists for vehicle/firm/month (prevent duplicate) | `{ firm: 1, vehicle: 1, billingMonth: 1, billingYear: 1 }` — unique |
| Get all invoices for a firm (chronological) | `{ firm: 1, billingYear: -1, billingMonth: -1 }` |
| Get all invoices for a vehicle (chronological) | `{ vehicle: 1, billingYear: -1, billingMonth: -1 }` |
| Get all outstanding/unpaid bills for a firm | `{ firm: 1, status: 1 }` |
| Fleet-wide unpaid bills prioritized by balance (aging) | `{ status: 1, outstandingAmount: -1 }` |
| Dashboard: recent finalized bills | `{ finalizedAt: -1 }` |
| Report: company billing by month | `{ company: 1, billingYear: 1, billingMonth: 1 }` |

### `contracts` — critical query patterns

| Query Pattern | Index Used |
|---|---|
| Find current contract version on trip date | `{ firm: 1, company: 1, effectiveFrom: -1 }` |
| Find active contracts per firm & check date overlap | `{ firm: 1, effectiveTo: 1, effectiveFrom: 1 }` |
| Find all open-ended active contracts fleet-wide | `{ effectiveTo: 1 }` |
| Find all contracts for firm+company | `{ company: 1, firm: 1 }` |

### `hsd_rates` — critical query patterns

| Query Pattern | Index Used |
|---|---|
| Find HSD rate on a specific date | `{ effectiveFrom: -1 }` |
| Find currently active rate | `{ effectiveTo: 1 }` (effectiveTo: null) |

### `vehicle_documents` — critical query patterns

| Query Pattern | Index Used |
|---|---|
| Dashboard: documents expiring soon (next 30 days) | `{ isActive: 1, expiryDate: 1 }` |
| Current active document of a type for a vehicle | `{ vehicle: 1, documentType: 1, isActive: 1 }` |
| All documents for a vehicle sorted by expiry | `{ vehicle: 1, expiryDate: 1 }` |
| Firm-wide compliance and expiry report | `{ firm: 1, isActive: 1, expiryDate: 1 }` |

### `expenses` — critical query patterns

| Query Pattern | Index Used |
|---|---|
| Vehicle-wise monthly expenses & P&L | `{ vehicle: 1, date: -1 }` |
| Vehicle fuel usage / maintenance history | `{ vehicle: 1, category: 1, date: -1 }` |
| Monthly expense summary by category | `{ category: 1, date: -1 }` |
| Firm-wise expense aggregation | `{ firm: 1, date: -1 }` |
| Fleet-wide expense timeline | `{ date: -1 }` |

### `audit_logs` — critical query patterns

| Query Pattern | Index Used |
|---|---|
| History of a specific entity (bill, contract) | `{ entityType: 1, entityId: 1, timestamp: -1 }` |
| User activity log | `{ userId: 1, timestamp: -1 }` |
| Recent system activity feed | `{ timestamp: -1 }` |

---

## ERD — Entity Relationship Diagram (Simplified)

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│  users   │         │companies │         │  routes  │
│──────────│         │──────────│         │──────────│
│ _id (PK) │         │ _id (PK) │         │ _id (PK) │
│ email    │         │ name     │         │ name     │
│ role     │         │ address  │         │ pickup   │
│ isActive │         │ isActive │         │ drop     │
└──────────┘         └────┬─────┘         │ fixedKm  │
                          │ 1             └──────────┘
                          │
                          │ N
                     ┌────┴─────┐         ┌──────────┐
                     │  firms   │         │ hsd_rates│
                     │──────────│         │──────────│
                     │ _id (PK) │         │ _id (PK) │
                     │ company  │◀───────▶│ rate     │
                     │ name     │         │ effFrom  │
                     │ prefix   │         │ effTo    │
                     │ bank*    │         └──────────┘
                     └────┬─────┘
                          │ 1
                ┌─────────┼─────────┐
                │ N       │ N       │ N
           ┌────┴────┐ ┌──┴─────┐ ┌┴────────────┐
           │vehicles │ │contracts│ │   bills     │
           │─────────│ │─────────│ │─────────────│
           │ _id(PK) │ │ _id(PK) │ │ _id (PK)   │
           │ regNo   │ │ firm    │ │ billNumber  │
           │ capacity│ │ company │ │ firm        │
           │ firm    │ │ effFrom │ │ company     │
           │ vehNo   │ │ effTo   │ │ vehicle     │
           │ status  │ │ kmSlabs*│ │ month/year  │
           └────┬────┘ │ capRts* │ │ grandTotal  │
                │      └─────────┘ │ totalPaid   │
                │ 1                │ snapshot*   │
                │                  └──────┬──────┘
                │ N                       │ 1
           ┌────┴─────────────────┐       │ N
           │        trips         │       │
           │──────────────────────│  ┌────┴──────────┐
           │ _id (PK)             │  │ bill_payments │
           │ date                 │  │───────────────│
           │ vehicle              │  │ _id (PK)      │
           │ driver               │  │ bill          │
           │ firm (denorm)        │  │ amountReceived│
           │ contractId           │  │ paymentDate   │
           │ hsdRateId            │  │ paymentMode   │
           │ km                   │  └───────────────┘
           │ [calculated fields]  │
           │ billId               │
           │ status               │
           └──────────────────────┘
                │ N              │ N
           ┌────┴────┐     ┌─────┴──────┐
           │ drivers │     │  expenses  │
           │─────────│     │────────────│
           │ _id(PK) │     │ _id (PK)   │
           │ name    │     │ category   │
           │ wage    │     │ vehicle    │
           │ status  │     │ firm       │
           └────┬────┘     │ amount     │
                │          │ details*   │
                │ 1        └────────────┘
                │ N
           ┌────┴──────────┐   ┌──────────────────┐
           │salary_records │   │ vehicle_documents │
           │───────────────│   │──────────────────│
           │ _id (PK)      │   │ _id (PK)         │
           │ driver        │   │ vehicle          │
           │ month/year    │   │ documentType     │
           │ daysWorked    │   │ expiryDate       │
           │ wageRate (ss) │   │ isActive         │
           │ grossWages    │   └──────────────────┘
           └───────────────┘

* = embedded sub-document(s)
ss = snapshot value (copied at creation)
```
