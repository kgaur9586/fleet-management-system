# MongoDB Database Design
## Fleet & Transport Operations, Expense and Billing Platform

**Based on:** `docs/requirements-analysis.md` + `docs/technical-architecture.md`
**Status:** Final design — approved requirements, all critical billing questions resolved
**Date:** September 2026

> **Key constraint driving every design decision:**
> Historical finalized bills must remain exactly reproducible even after rates, contracts, or billing rules change.
> Factory billing amounts and actual company expenses must remain in completely separate data stores.

---

## Table of Contents

1. [Collection Inventory and Rationale](#1-collection-inventory-and-rationale)
2. [Decimal Precision Strategy](#2-decimal-precision-strategy)
3. [Collection: `users`](#3-collection-users)
4. [Collection: `companies`](#4-collection-companies)
5. [Collection: `firms`](#5-collection-firms)
6. [Collection: `vehicles`](#6-collection-vehicles)
7. [Collection: `drivers`](#7-collection-drivers)
8. [Collection: `routes`](#8-collection-routes)
9. [Collection: `contracts`](#9-collection-contracts)
10. [Collection: `hsd_rates`](#10-collection-hsd_rates)
11. [Collection: `trips`](#11-collection-trips)
12. [Collection: `bills`](#12-collection-bills)
13. [Collection: `bill_payments`](#13-collection-bill_payments)
14. [Collection: `expenses`](#14-collection-expenses)
15. [Collection: `salary_records`](#15-collection-salary_records)
16. [Collection: `vehicle_documents`](#16-collection-vehicle_documents)
17. [Collection: `audit_logs`](#17-collection-audit_logs)
18. [Index Architecture and Query Optimization](#18-index-architecture-and-query-optimization)
19. [Soft Delete Strategy](#19-soft-delete-strategy)
20. [Design Decisions Summary](#20-design-decisions-summary)

---

## 1. Collection Inventory and Rationale

The user's proposed list was evaluated against requirements. Here is the final collection list and the reasoning for every change:

| Proposed Name | Final Name | Decision | Reasoning |
|---|---|---|---|
| `users` | `users` | ✅ Keep | Authentication and role management |
| `vehicles` | `vehicles` | ✅ Keep | Fleet vehicle master |
| `drivers` | `drivers` | ✅ Keep | Driver profile and wage rate |
| `firms/customers` | `companies` + `firms` | ✅ Split into two | **Companies** = factories (receive bills). **Firms** = billing vendors (submit bills). These are two distinct, independent entities with different lifecycles and data. |
| `routes` | `routes` | ✅ Keep | Pickup/drop master; used on trip entry |
| `contracts` | `contracts` | ✅ Keep, redesigned | Each document = one version of a contract (see below). Embedded capacity rates and KM slabs. |
| `contract_versions` | ❌ Eliminated | **Merged into `contracts`** | In this design, each `contracts` document **is** a version. Creating a new contract (with a new `effectiveFrom`) is how versioning works. No separate versioning table needed. |
| `billing_rules` | ❌ Eliminated | **Embedded in `contracts`** | KM slabs and capacity rates are always versioned with the contract. Embedding is correct here because they have no independent lifecycle. |
| `trips` | `trips` | ✅ Keep | Daily operation records. Also serve as invoice line items when a bill is generated. |
| `invoices` | `bills` | ✅ Renamed | "Bill" matches the domain language used by the owner and reference documents |
| `invoice_items` | ❌ Eliminated | **Trips serve this purpose** | Trip records contain all calculated billing fields. When a bill is finalized, a full snapshot of each trip's calculation is embedded in the bill document. No separate `invoice_items` collection needed. |
| `payments` | `bill_payments` | ✅ Renamed | Clarifies these are payments received against factory bills. Distinguishes from salary or contractor payments which are different entities. |
| `expenses` | `expenses` | ✅ Keep, expanded | Unified actual company expense ledger using a `category` discriminator field. Covers fuel, toll, maintenance, loading/unloading, other. |
| `fuel_expenses` | ❌ Eliminated | **Subcategory of `expenses`** | `category: 'fuel'` + embedded `fuelDetails` sub-document handles this. Keeping separate collections would fragment reports. |
| `toll_expenses` | ❌ Eliminated | **Subcategory of `expenses`** | `category: 'toll'` handles this. Toll on a trip (billing side) vs. toll paid (expense side) are tracked separately by design. |
| `driver_payments` | `salary_records` | ✅ Renamed | Monthly driver wage tracking. Named `salary_records` to reflect that it is a monthly computation record, not just a payment. |
| `contractor_payments` | ❌ Eliminated | **Subcategory of `expenses`** | `category: 'loading_unloading'` in the `expenses` collection handles contractor charges. |
| `vehicle_documents` | `vehicle_documents` | ✅ Keep | Compliance document tracking with expiry dates |
| `audit_logs` | `audit_logs` | ✅ Keep | Immutable history of critical business actions |

### Final collection list (15 collections)

```
1.  users
2.  companies
3.  firms
4.  vehicles
5.  drivers
6.  routes
7.  contracts
8.  hsd_rates
9.  trips
10. bills
11. bill_payments
12. expenses
13. salary_records
14. vehicle_documents
15. audit_logs
```

---

## 2. Decimal Precision Strategy

All monetary values and calculated quantities use **MongoDB Decimal128** via Mongoose.

| Field type | Storage | Rationale |
|---|---|---|
| Currency (₹) | `Decimal128` | Exact decimal arithmetic; no floating-point errors |
| KM | `Decimal128` | May be a decimal (e.g. 589.5 km) |
| HSD Litres | `Decimal128` | KM/Average — must be precise |
| Rounds | `Decimal128` | Values are 0.5, 1.0, 1.5, 2.0 — exact in decimal |
| Averages | `Decimal128` | e.g. 2.5, 3.0 — exact in decimal |
| Counts (days worked, quantity) | `Number` | Integer counts — no precision issue |
| Rates (HSD rate, hiring rate) | `Decimal128` | e.g. ₹95.81 |

**Rounding rule (owner confirmed):** Round to 2 decimal places **at each trip row** (per line), using ROUND_HALF_UP. Do NOT accumulate unrounded values and round only at the total.

**Serialization:** Mongoose serializes Decimal128 to string in JSON responses. The frontend formats these strings for display using `Intl.NumberFormat`.

---

## 3. Collection: `users`

**Purpose:** Authentication and access control for the application.

**Lifecycle:** Created by admin setup script. Updated when password changes.

### Fields

| Field | Type | Required | Unique | Notes |
|---|---|---|---|---|
| `_id` | ObjectId | Auto | Yes | Primary key |
| `email` | String | ✅ | Yes | Login identifier; lowercase |
| `passwordHash` | String | ✅ | No | bcrypt hash; never returned in API responses |
| `name` | String | ✅ | No | Display name |
| `role` | String (enum) | ✅ | No | `admin` \| `operator` |
| `isActive` | Boolean | ✅ | No | Default: `true`. Set to `false` to disable without deleting |
| `lastLoginAt` | Date | ❌ | No | Updated on each successful login |
| `createdAt` | Date | Auto | No | Mongoose timestamp |
| `updatedAt` | Date | Auto | No | Mongoose timestamp |

### Enum values

- `role`: `admin`, `operator` (operator = future data-entry role; not used in V1)

### Indexes

```javascript
{ email: 1 }          // unique — login lookup
{ role: 1 }           // filter by role
```

### Soft delete

Not applicable. Users are deactivated via `isActive: false`. Physical deletion is never performed.

### Design rationale

`passwordHash` is a computed field and never stored as plain text. The `role` field is kept simple — no permission matrix in V1. `isActive` replaces delete so the audit trail always has a valid `userId` reference.

---

## 4. Collection: `companies`

**Purpose:** Factory / customer master — the entities that receive transport services and pay the bills (e.g. Creamy Foods Ltd).

**Lifecycle:** Created once at setup. Updated rarely (address/GSTIN changes).

### Fields

| Field | Type | Required | Unique | Notes |
|---|---|---|---|---|
| `_id` | ObjectId | Auto | Yes | Primary key |
| `name` | String | ✅ | Yes | Short name — e.g. "Creamy Foods Ltd" |
| `legalName` | String | ✅ | No | Full legal name printed on bill header |
| `address` | String | ✅ | No | Full address for bill header |
| `gstin` | String | ❌ | No | GST number (for future GST billing) |
| `isActive` | Boolean | ✅ | No | Default: `true` |
| `notes` | String | ❌ | No | Internal remarks |
| `createdBy` | ObjectId | ✅ | No | Ref → `users` |
| `createdAt` | Date | Auto | No | |
| `updatedAt` | Date | Auto | No | |

### Indexes

```javascript
{ name: 1 }           // unique — prevent duplicate companies
{ isActive: 1 }       // filter active companies
```

### Soft delete

`isActive: false` deactivates without deleting. Historical bills still reference the company record.

### Design rationale

Separating companies from firms allows the system to be extended to multiple factories without structural changes. The owner requested this explicitly for future expansion.

---

## 5. Collection: `firms`

**Purpose:** Billing vendor / transport entity master. These are the businesses that own/operate vehicles and submit bills to the factory. Each firm has its own bill prefix, bank account, and vehicle fleet.

**Lifecycle:** Created at setup. Updated when address, bank details, or prefix changes.

### Fields

| Field | Type | Required | Unique | Notes |
|---|---|---|---|---|
| `_id` | ObjectId | Auto | Yes | |
| `company` | ObjectId | ✅ | No | Ref → `companies` — the factory this firm works for |
| `name` | String | ✅ | No | e.g. "Nirupama Gupta" |
| `displayName` | String | ✅ | No | Printed on bills — e.g. "M/S Nirupama Gupta" |
| `billPrefix` | String | ✅ | No | Short code for bill numbering — e.g. "NIR" |
| `address` | String | ✅ | No | Firm's address on bills |
| `phone` | String | ❌ | No | Contact number |
| `bankDetails` | Object (embedded) | ✅ | No | Bank info for bill footer — see sub-document |
| `isActive` | Boolean | ✅ | No | Default: `true` |
| `notes` | String | ❌ | No | |
| `createdBy` | ObjectId | ✅ | No | Ref → `users` |
| `createdAt` | Date | Auto | No | |
| `updatedAt` | Date | Auto | No | |

### Embedded: `bankDetails`

| Field | Type | Required | Notes |
|---|---|---|---|
| `accountName` | String | ✅ | e.g. "NIRUPAMA GUPTA" |
| `accountNumber` | String | ✅ | e.g. "6198002100003888" |
| `ifscCode` | String | ✅ | e.g. "PUNB0619800" |
| `bankName` | String | ✅ | e.g. "Punjab National Bank" |
| `branchName` | String | ✅ | e.g. "DAV Tiraha, Bulandshahr" |

**Rationale for embedding:** Bank details are always read with the firm (needed for every PDF bill footer). They have no independent lifecycle. They change rarely and only as a group. Embedding is correct.

### Indexes

```javascript
{ company: 1, billPrefix: 1 }    // unique — prefix must be unique within a company
{ company: 1, isActive: 1 }      // list active firms for a company
{ isActive: 1 }
```

### Soft delete

`isActive: false`. Vehicles and historical bills retain the firm reference.

---

## 6. Collection: `vehicles`

**Purpose:** Fleet vehicle master. Each vehicle belongs to one firm, has a capacity that drives billing rate lookup, and a vehicle number used in bill numbering.

**Lifecycle:** Registered once. Status changes frequently. Firm assignment may change if business restructures.

### Fields

| Field | Type | Required | Unique | Notes |
|---|---|---|---|---|
| `_id` | ObjectId | Auto | Yes | |
| `registrationNumber` | String | ✅ | Yes | e.g. "UP13DT0632" — globally unique |
| `vehicleType` | String (enum) | ✅ | No | See enum values |
| `capacity` | Number | ✅ | No | Litres — e.g. 29000. Used for billing rate lookup |
| `firm` | ObjectId | ✅ | No | Ref → `firms` |
| `vehicleNumber` | Number | ✅ | No | Sequential number within the firm (e.g. 11). Used in bill number format: NIR/06/26-27/**11** |
| `status` | String (enum) | ✅ | No | See enum values |
| `notes` | String | ❌ | No | |
| `isDeleted` | Boolean | ✅ | No | Default: `false` — soft delete |
| `deletedAt` | Date | ❌ | No | Set when soft-deleted |
| `createdBy` | ObjectId | ✅ | No | Ref → `users` |
| `createdAt` | Date | Auto | No | |
| `updatedAt` | Date | Auto | No | |

### Enum values

- `vehicleType`: `truck`, `polypack_truck`, `milk_tanker`, `other`
- `status`: `running`, `idle`, `under_maintenance`, `inactive`

### Indexes

```javascript
{ registrationNumber: 1 }                    // unique — primary lookup (Find vehicle by registration number)
{ firm: 1, vehicleNumber: 1 }                // unique — vehicle number is unique per firm
{ firm: 1, isDeleted: 1, status: 1 }         // list active vehicles per firm (Find active vehicles)
{ isDeleted: 1, status: 1 }                  // list active vehicles fleet-wide (Find active vehicles)
{ capacity: 1 }                              // useful for reports by capacity type
```

### Soft delete

`isDeleted: true` + `deletedAt`. Vehicles cannot be physically deleted because they are referenced by historical trips, bills, and expenses.

### Design rationale

`vehicleNumber` is manually assigned (or auto-incremented per firm) at registration time. It is the stable identifier used in the bill number. It must be unique within a firm but not globally.

`capacity` is stored as a plain Number (not a reference to a capacity table) because it is a physical property of the vehicle. The billing rates are looked up from the contract's `capacityRates` array using this value.

---

## 7. Collection: `drivers`

**Purpose:** Driver profile and daily wage rate. Drivers are assigned to trips, not permanently to vehicles.

**Lifecycle:** Created when a driver joins. `dailyWageRate` may be updated when rates change (future rate is updated in place; wage rate at month-end is captured in `salary_records`).

### Fields

| Field | Type | Required | Unique | Notes |
|---|---|---|---|---|
| `_id` | ObjectId | Auto | Yes | |
| `name` | String | ✅ | No | Full name |
| `phone` | String | ❌ | No | Contact number |
| `licenseNumber` | String | ❌ | No | Driving license number |
| `dailyWageRate` | Decimal128 | ✅ | No | Current daily wage in ₹. This is the **current** rate. Historical rate is captured in `salary_records` at month-end. |
| `status` | String (enum) | ✅ | No | `active` \| `inactive` |
| `notes` | String | ❌ | No | |
| `isDeleted` | Boolean | ✅ | No | Default: `false` |
| `deletedAt` | Date | ❌ | No | |
| `createdBy` | ObjectId | ✅ | No | Ref → `users` |
| `createdAt` | Date | Auto | No | |
| `updatedAt` | Date | Auto | No | |

### Indexes

```javascript
{ status: 1, isDeleted: 1 }        // list active drivers
{ name: 1 }                         // search by name
```

### Soft delete

`isDeleted: true`. Drivers cannot be physically deleted — they are referenced by historical trips and salary records.

### Design rationale

`dailyWageRate` is kept on the driver document (not in a separate wage history collection) because the salary calculation at month-end captures the applicable rate in the `salary_records` document. The driver document always holds the **current** rate. A simple update to this field is audited via `audit_logs`.

If a full rate history is ever needed, a `driverWageHistory` collection can be added later without changing the existing schema.

---

## 8. Collection: `routes`

**Purpose:** Reusable pickup-and-drop location pairs. Used in trip entry to auto-fill from/to locations.

**Lifecycle:** Created by admin. Updated rarely.

### Fields

| Field | Type | Required | Unique | Notes |
|---|---|---|---|---|
| `_id` | ObjectId | Auto | Yes | |
| `name` | String | ✅ | No | Human-readable label — e.g. "TIRWAGANJ–CFL" |
| `pickupLocation` | String | ✅ | No | Origin — e.g. "TIRWAGANJ" |
| `dropLocation` | String | ✅ | No | Destination — e.g. "CFL" |
| `company` | ObjectId | ❌ | No | Ref → `companies` — optional association with a factory |
| `fixedKm` | Decimal128 | ❌ | No | If this route always has the same distance, pre-fill it |
| `isActive` | Boolean | ✅ | No | Default: `true` |
| `notes` | String | ❌ | No | |
| `createdBy` | ObjectId | ✅ | No | Ref → `users` |
| `createdAt` | Date | Auto | No | |
| `updatedAt` | Date | Auto | No | |

### Indexes

```javascript
{ company: 1, isActive: 1 }       // list routes for a company
{ isActive: 1 }
{ name: 1 }
```

### Soft delete

`isActive: false`. Trips that used a route retain the route reference; trips store `fromLocation` and `toLocation` as strings so historical data is preserved even if the route is deactivated.

---

## 9. Collection: `contracts`

**Purpose:** Time-bounded commercial agreement between a firm and a company (factory), defining all billing calculation rules. Each document in this collection represents **one version** of the agreement.

**Versioning strategy:** When rates change, a **new document** is inserted with a new `effectiveFrom` date and the previous document's `effectiveTo` is set to one day before. The old document is **never modified**. The billing engine always looks up the contract where `effectiveFrom <= tripDate AND (effectiveTo > tripDate OR effectiveTo == null)`.

**Lifecycle:** Created when a contract starts or rates change. Never updated after trips reference it (to preserve traceability).

### Fields

| Field | Type | Required | Unique | Notes |
|---|---|---|---|---|
| `_id` | ObjectId | Auto | Yes | |
| `firm` | ObjectId | ✅ | No | Ref → `firms` |
| `company` | ObjectId | ✅ | No | Ref → `companies` |
| `name` | String | ✅ | No | e.g. "NIR–CFL Contract 2024–2026" |
| `effectiveFrom` | Date | ✅ | No | Start date of this version |
| `effectiveTo` | Date | ❌ | No | `null` = currently active. Set when superseded. |
| `kmSlabs` | Array (embedded) | ✅ | No | KM-to-rounds slab table — see sub-document |
| `capacityRates` | Array (embedded) | ✅ | No | Per-capacity billing rates — see sub-document |
| `tollBillable` | Boolean | ✅ | No | Whether toll is added to the factory bill. `true` for all 4 current firms. |
| `notes` | String | ❌ | No | |
| `createdBy` | ObjectId | ✅ | No | Ref → `users` |
| `createdAt` | Date | Auto | No | |
| `updatedAt` | Date | Auto | No | |

### Embedded: `kmSlabs` (Array)

Each element defines one slab in the KM-to-rounds lookup.

| Field | Type | Required | Notes |
|---|---|---|---|
| `upToKm` | Number | ✅ | Upper boundary (exclusive). `null` means no upper limit (last slab). |
| `rounds` | Number | ✅ | Rounds assigned when KM is below `upToKm` |

**Current slab configuration (owner-confirmed):**

```json
[
  { "upToKm": 127,  "rounds": 0.5 },
  { "upToKm": 500,  "rounds": 1.0 },
  { "upToKm": 700,  "rounds": 1.5 },
  { "upToKm": null, "rounds": 2.0 }
]
```

**Lookup logic:** Iterate slabs in order. The first slab where `km < upToKm` (or `upToKm === null`) matches.

### Embedded: `capacityRates` (Array)

Each element defines the billing parameters for one vehicle capacity type.

| Field | Type | Required | Notes |
|---|---|---|---|
| `capacity` | Number | ✅ | Vehicle capacity in litres — e.g. 29000 |
| `averageKmPerLitre` | Decimal128 | ✅ | Contractual fuel efficiency — e.g. 2.5 |
| `baseHiringRatePerRound` | Decimal128 | ✅ | ₹ per round — e.g. ₹4,500 |

**Current confirmed data:**

```json
[
  { "capacity": 12000, "averageKmPerLitre": "4.0", "baseHiringRatePerRound": "1400" },
  { "capacity": 23000, "averageKmPerLitre": "3.0", "baseHiringRatePerRound": "3000" },
  { "capacity": 29000, "averageKmPerLitre": "2.5", "baseHiringRatePerRound": "4500" },
  { "capacity": 34000, "averageKmPerLitre": "2.3", "baseHiringRatePerRound": "5000" }
]
```

### Indexes

```javascript
{ firm: 1, company: 1, effectiveFrom: -1 }                 // Find current contract version (billing engine lookup)
{ firm: 1, effectiveTo: 1, effectiveFrom: 1 }              // Find active contracts per firm & temporal overlap validation
{ effectiveTo: 1 }                                         // Find all active contracts fleet-wide (effectiveTo: null)
{ company: 1, firm: 1 }                                    // List contracts per company/firm pair
```

### Soft delete

Not applicable. Contracts are never deleted. They are superseded by newer versions (with `effectiveTo` set). Old contracts must remain queryable for historical bill reproduction.

### Design rationale

**Why embed `kmSlabs` and `capacityRates`?**
Both are always read together with the contract. They have no independent lifecycle — they only make sense in the context of a specific contract version. If a slab boundary changes, a new contract version is created (so the change is timestamped). This approach means that querying the billing rules for a trip on any historical date is a single document lookup — no joins.

**Why not a separate `billing_rules` collection?**
Separating billing rules would require a join on every trip calculation, plus complex temporal matching across two collections. The embedded approach is simpler, faster, and ensures rules are always atomically versioned with the contract.

---

## 10. Collection: `hsd_rates`

**Purpose:** Global HSD (diesel) rate history. The HSD rate is a single global rate that applies to all vehicles and all firms for a given time period. It changes when global fuel prices change.

**Lifecycle:** A new document is inserted whenever the HSD rate changes. Old documents are never modified.

### Fields

| Field | Type | Required | Unique | Notes |
|---|---|---|---|---|
| `_id` | ObjectId | Auto | Yes | |
| `ratePerLitre` | Decimal128 | ✅ | No | ₹ per litre — e.g. ₹95.81 |
| `effectiveFrom` | Date | ✅ | No | Date from which this rate applies |
| `effectiveTo` | Date | ❌ | No | `null` = currently active; set when superseded |
| `notes` | String | ❌ | No | e.g. "Global diesel rate update Jul 2026" |
| `createdBy` | ObjectId | ✅ | No | Ref → `users` |
| `createdAt` | Date | Auto | No | |
| `updatedAt` | Date | Auto | No | |

### Indexes

```javascript
{ effectiveFrom: -1 }           // descending — most efficient for "find rate active on date D"
{ effectiveTo: 1 }              // find currently active rate (effectiveTo: null)
```

### Lookup query

```javascript
// Find HSD rate effective on a given tripDate:
HsdRate.findOne({
  effectiveFrom: { $lte: tripDate }
}).sort({ effectiveFrom: -1 })
// Returns the most recently effective rate as of tripDate
```

### Design rationale

**Why a separate collection rather than on the contract?**
The owner confirmed HSD rate is global — it applies to all firms. Embedding it on each contract would require updating every active contract when the rate changes, creating a consistency risk. A separate collection with effective dates is the correct model. The finalization snapshot in `bills` captures the exact rate used, so historical bills are unaffected by future rate changes.

---

## 11. Collection: `trips`

**Purpose:** The daily operation record — one record per vehicle per day per run. Trips are the source data for factory billing. They are also used to calculate driver wages. They contain both the raw input data (KM, toll) and the billing engine's derived calculations.

**Lifecycle:** Created during daily operations. Editable until included in a finalized bill. Locked after finalization.

### Fields

#### Input fields (entered by operator)

| Field | Type | Required | Unique | Notes |
|---|---|---|---|---|
| `_id` | ObjectId | Auto | Yes | |
| `date` | Date | ✅ | No | Real trip date (not Excel serial) |
| `vehicle` | ObjectId | ✅ | No | Ref → `vehicles` |
| `driver` | ObjectId | ✅ | No | Ref → `drivers` |
| `route` | ObjectId | ❌ | No | Ref → `routes` (optional — for auto-fill) |
| `fromLocation` | String | ✅ | No | Pickup point — stored explicitly, not derived from route |
| `toLocation` | String | ✅ | No | Drop point — stored explicitly |
| `km` | Decimal128 | ✅ | No | Must be > 0 |
| `tollAmount` | Decimal128 | ✅ | No | Actual toll entered — default 0 |
| `notes` | String | ❌ | No | |

#### Denormalized reference fields (stored for fast access)

| Field | Type | Required | Notes |
|---|---|---|---|
| `firm` | ObjectId | ✅ | Ref → `firms` — copied from vehicle's firm at trip creation. Denormalized for efficient querying. |
| `vehicleCapacity` | Number | ✅ | Copied from vehicle at creation. Ensures billing engine uses correct capacity even if vehicle record is later modified. |

#### Rate source traceability fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `contractId` | ObjectId | ✅ | Ref → `contracts` — exact version used for this trip's calculation |
| `hsdRateId` | ObjectId | ✅ | Ref → `hsd_rates` — exact rate record used |

#### Calculated billing fields (computed by billing engine, stored for read performance)

| Field | Type | Required | Notes |
|---|---|---|---|
| `average` | Decimal128 | ✅ | km/L — from capacityRates lookup |
| `hsdLitres` | Decimal128 | ✅ | `km / average` |
| `hsdRate` | Decimal128 | ✅ | ₹/L — from `hsd_rates` |
| `hsdAmount` | Decimal128 | ✅ | `hsdLitres × hsdRate`, rounded to 2 dp |
| `rounds` | Decimal128 | ✅ | From KM slab lookup |
| `baseHiringRate` | Decimal128 | ✅ | ₹/round — from capacityRates lookup |
| `hiringCharge` | Decimal128 | ✅ | `rounds × baseHiringRate`, rounded to 2 dp |
| `tripTotal` | Decimal128 | ✅ | `hsdAmount + hiringCharge + tollAmount`, rounded to 2 dp |

#### Status and audit fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `status` | String (enum) | ✅ | `draft` \| `billed` \| `finalized` |
| `billId` | ObjectId | ❌ | Ref → `bills` — set when trip is included in a bill |
| `isDeleted` | Boolean | ✅ | Default: `false` |
| `deletedAt` | Date | ❌ | |
| `deletedReason` | String | ❌ | Required when soft-deleting |
| `createdBy` | ObjectId | ✅ | Ref → `users` |
| `createdAt` | Date | Auto | |
| `updatedAt` | Date | Auto | |

### Enum values

- `status`: `draft` (editable), `billed` (included in a draft bill), `finalized` (bill finalized — locked)

### Indexes

```javascript
{ vehicle: 1, date: -1 }                    // Find trips for a vehicle (chronological) & duplicate check
{ driver: 1, date: 1 }                     // Find trips for a driver (monthly salary calculation)
{ firm: 1, date: -1 }                       // Find trips for a firm (chronological)
{ date: 1 }                                // Find trips for a date range / fleet-wide monthly summaries
{ firm: 1, vehicle: 1, date: 1 }          // Generate monthly billing: fetch vehicle trips for billing period
{ firm: 1, status: 1, date: 1 }           // Generate monthly billing: find unbilled trips for a firm
{ billId: 1 }                              // Find all trips associated with a bill
```

### Status transitions

```
draft → billed       (when included in a draft bill preview)
billed → draft       (when removed from a draft bill)
billed → finalized   (when bill is finalized)
finalized → billed   (when bill is reopened)
```

### Soft delete

`isDeleted: true` + `deletedAt` + `deletedReason`. Cannot delete a trip with status `finalized` without first reopening the bill.

### Design rationale

**Why store calculated fields on the trip document?**
Three reasons:
1. **Read performance:** The billing preview for a full month (29–31 trips) can be assembled by reading already-computed trip documents, without running calculations on every view.
2. **Preview consistency:** The preview shows exactly what will be finalized. If there's a bug in the engine, it is visible in the preview before finalization.
3. **Traceability at trip level:** Each trip shows its exact inputs and outputs, making the bill auditable line by line.

Recalculation happens only when a trip is edited. Finalization re-runs the engine once more to ensure perfect consistency before locking.

**Why store `firm` and `vehicleCapacity` as denormalized fields?**
- `firm` is needed on nearly every query (billing, reports, expense correlation). Forcing a join through `vehicle → firm` on every query is unnecessary overhead.
- `vehicleCapacity` is needed by the billing engine. If the vehicle's capacity is ever corrected in the master, existing historical trips retain the capacity that was used at the time.

---

## 12. Collection: `bills`

**Purpose:** Monthly factory bill per vehicle per firm. The single most important collection — it represents the financial output of the system. When finalized, it contains a complete, self-contained snapshot of all calculation inputs so the bill is reproducible independent of any future changes.

**Lifecycle:**
1. Created as `draft` when owner generates a billing preview
2. Moves to `reviewed` (optional intermediate state)
3. Finalized → all data is locked and a PDF is generated
4. Payments reduce the outstanding amount
5. If reopened: reverts to `draft` with audit trail preserved

### Fields

#### Identity fields

| Field | Type | Required | Unique | Notes |
|---|---|---|---|---|
| `_id` | ObjectId | Auto | Yes | |
| `billNumber` | String | ✅ | Yes | e.g. "NIR/06/26-27/11" — generated at finalization |
| `bookNumber` | String | ❌ | No | e.g. "01/2026-2027" — purpose TBD; stored as entered |
| `billingMonth` | Number | ✅ | No | 1–12 |
| `billingYear` | Number | ✅ | No | e.g. 2026 |
| `financialYear` | String | ✅ | No | e.g. "26-27" — derived from billingMonth+Year |
| `period` | String | ✅ | No | Human label — e.g. "MONTH JUNE 2026" |
| `billDate` | Date | ❌ | No | The bill generate date — set at finalization |
| `firm` | ObjectId | ✅ | No | Ref → `firms` |
| `company` | ObjectId | ✅ | No | Ref → `companies` |
| `vehicle` | ObjectId | ✅ | No | Ref → `vehicles` |

#### Status field

| Field | Type | Required | Notes |
|---|---|---|---|
| `status` | String (enum) | ✅ | `draft` \| `reviewed` \| `finalized` \| `outstanding` \| `partially_paid` \| `paid` |

#### Aggregated totals (computed from trips, stored for read performance)

| Field | Type | Required | Notes |
|---|---|---|---|
| `totalKm` | Decimal128 | ✅ | Sum of trip KMs |
| `totalRounds` | Decimal128 | ✅ | Sum of trip rounds |
| `totalHsdLitres` | Decimal128 | ✅ | Sum of trip HSD litres |
| `totalHsdAmount` | Decimal128 | ✅ | Sum of trip HSD amounts |
| `totalHiringCharge` | Decimal128 | ✅ | Sum of trip hiring charges |
| `totalToll` | Decimal128 | ✅ | Sum of trip toll amounts |
| `grandTotal` | Decimal128 | ✅ | Sum of all trip totals |

#### Payment tracking (denormalized for fast outstanding calculation)

| Field | Type | Required | Notes |
|---|---|---|---|
| `totalPaid` | Decimal128 | ✅ | Sum of all payments received. Default: 0. Updated on each payment. |
| `outstandingAmount` | Decimal128 | ✅ | `grandTotal - totalPaid`. Updated on each payment. |

#### Finalization snapshot (CRITICAL — immutable after finalization)

This embedded document is written **once** at finalization and **never updated**. It is the definitive record of what rules and rates were used to generate this bill.

| Field | Type | Notes |
|---|---|---|
| `calculationSnapshot` | Object | Written at finalization; never modified after |
| `calculationSnapshot.capturedAt` | Date | Timestamp of snapshot capture |
| `calculationSnapshot.hsdRateId` | ObjectId | Ref → `hsd_rates` |
| `calculationSnapshot.hsdRatePerLitre` | Decimal128 | ₹/L value at finalization |
| `calculationSnapshot.contractId` | ObjectId | Ref → `contracts` |
| `calculationSnapshot.contractName` | String | Contract name at finalization |
| `calculationSnapshot.kmSlabs` | Array | Full copy of slab table used |
| `calculationSnapshot.capacityRate` | Object | Capacity, average, hiring rate used |
| `calculationSnapshot.capacityRate.capacity` | Number | |
| `calculationSnapshot.capacityRate.averageKmPerLitre` | Decimal128 | |
| `calculationSnapshot.capacityRate.baseHiringRatePerRound` | Decimal128 | |
| `calculationSnapshot.tripSnapshots` | Array | One entry per trip in this bill |

**Each `tripSnapshot` object:**

| Field | Type | Notes |
|---|---|---|
| `tripId` | ObjectId | Ref → `trips` |
| `slNo` | Number | Line number on the bill (1, 2, 3...) |
| `date` | Date | Trip date |
| `fromLocation` | String | |
| `toLocation` | String | |
| `km` | Decimal128 | |
| `rounds` | Decimal128 | |
| `average` | Decimal128 | |
| `hsdLitres` | Decimal128 | |
| `hsdRate` | Decimal128 | |
| `hsdAmount` | Decimal128 | |
| `baseHiringRate` | Decimal128 | |
| `hiringCharge` | Decimal128 | |
| `tollAmount` | Decimal128 | |
| `tripTotal` | Decimal128 | |

#### Audit and history fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `pdfUrl` | String | ❌ | Path to generated PDF file |
| `finalizedAt` | Date | ❌ | Timestamp of finalization |
| `finalizedBy` | ObjectId | ❌ | Ref → `users` |
| `reopenHistory` | Array | ❌ | Array of reopen events (see sub-document) |
| `createdBy` | ObjectId | ✅ | Ref → `users` |
| `createdAt` | Date | Auto | |
| `updatedAt` | Date | Auto | |

**Each `reopenHistory` entry:**

| Field | Type | Notes |
|---|---|---|
| `reopenedAt` | Date | |
| `reopenedBy` | ObjectId | Ref → `users` |
| `reason` | String | Required — must explain why it was reopened |
| `previousStatus` | String | Status before reopen |

### Indexes

```javascript
{ billNumber: 1 }                                                // unique — primary lookup
{ firm: 1, vehicle: 1, billingMonth: 1, billingYear: 1 }       // unique — one bill per vehicle per firm per month (billing generation)
{ firm: 1, billingYear: -1, billingMonth: -1 }                  // Find invoices for a firm (chronological)
{ vehicle: 1, billingYear: -1, billingMonth: -1 }               // Find invoices for a vehicle (chronological)
{ firm: 1, status: 1 }                                          // Find unpaid/outstanding invoices per firm
{ status: 1, outstandingAmount: -1 }                            // Find unpaid invoices fleet-wide (aging & receivables dashboard)
{ company: 1, billingYear: 1, billingMonth: 1 }                // Factory billing summary report
{ finalizedAt: -1 }                                             // Recent finalized bills timeline
```

### Status transitions

```
draft        → reviewed    (optional manual review step)
draft        → finalized   (direct finalization allowed)
reviewed     → finalized
finalized    → outstanding (post-finalization: payment tracking begins)
outstanding  → partially_paid
outstanding  → paid
partially_paid → paid
finalized    → draft       (REOPEN — requires reason; audit logged)
```

### Design rationale

**Why embed `tripSnapshots` in the bill rather than querying trips at report time?**

This is the most important design decision in the schema. The requirement is:

> *"Historical finalized bills must remain exactly reproducible even after rates, contracts, or billing rules change."*

If we relied on the `trips` collection to reconstruct a historical bill, the bill would be wrong if the trip was edited, the contract was updated, or the HSD rate changed. By embedding a complete snapshot at finalization, the bill document is entirely self-contained. It can be re-rendered to PDF at any time without accessing any other collection.

**Why denormalize `totalPaid` and `outstandingAmount` on the bill?**

The dashboard shows outstanding bills. Without denormalization, calculating the outstanding amount requires aggregating `bill_payments` for every bill on every dashboard load. Since payments are recorded infrequently (monthly), updating the denormalized fields when a payment is recorded is a low-cost operation with high read benefit.

---

## 13. Collection: `bill_payments`

**Purpose:** Records of actual payments received from the factory against specific bills. Supports partial payments.

**Lifecycle:** Created when the factory makes a payment. Updates the corresponding bill's `totalPaid` and `outstandingAmount` fields.

### Fields

| Field | Type | Required | Unique | Notes |
|---|---|---|---|---|
| `_id` | ObjectId | Auto | Yes | |
| `bill` | ObjectId | ✅ | No | Ref → `bills` |
| `firm` | ObjectId | ✅ | No | Ref → `firms` — denormalized for report queries |
| `company` | ObjectId | ✅ | No | Ref → `companies` — denormalized |
| `amountReceived` | Decimal128 | ✅ | No | Must be > 0 |
| `paymentDate` | Date | ✅ | No | Date payment was received |
| `paymentMode` | String (enum) | ✅ | No | See enum values |
| `referenceNumber` | String | ❌ | No | Cheque number, UTR, NEFT ref etc. |
| `notes` | String | ❌ | No | |
| `isDeleted` | Boolean | ✅ | No | Default: `false` |
| `deletedAt` | Date | ❌ | No | |
| `deletedReason` | String | ❌ | No | Required when deleting a payment |
| `createdBy` | ObjectId | ✅ | No | Ref → `users` |
| `createdAt` | Date | Auto | No | |
| `updatedAt` | Date | Auto | No | |

### Enum values

- `paymentMode`: `cheque`, `neft`, `rtgs`, `cash`, `other`

### Indexes

```javascript
{ bill: 1 }                        // all payments for a bill
{ firm: 1, paymentDate: -1 }       // payments by firm over time
{ company: 1, paymentDate: -1 }    // report: payments to a company
{ paymentDate: -1 }                // recent payments
```

### Design rationale

`firm` and `company` are denormalized from the bill. This avoids a two-hop join (`bill_payments → bills → firms`) when generating the firm-wise receivables report, which is shown on the dashboard.

---

## 14. Collection: `expenses`

**Purpose:** Actual company-side costs — completely separate from factory billing. This is the internal expense ledger tracking what the business **actually paid**, as opposed to what it **billed to the factory**.

This single collection covers all expense categories using a `category` discriminator field and category-specific embedded sub-documents. This design keeps reporting simple (one collection to aggregate) while supporting category-specific fields.

**Lifecycle:** Created when expense is incurred. Editable. Soft-deleted if entered incorrectly.

### Common fields (all categories)

| Field | Type | Required | Unique | Notes |
|---|---|---|---|---|
| `_id` | ObjectId | Auto | Yes | |
| `category` | String (enum) | ✅ | No | See enum values |
| `date` | Date | ✅ | No | Date expense was incurred |
| `amount` | Decimal128 | ✅ | No | Total actual amount paid |
| `vehicle` | ObjectId | ❌ | No | Ref → `vehicles` — the vehicle this expense belongs to |
| `firm` | ObjectId | ❌ | No | Ref → `firms` — denormalized from vehicle for reporting |
| `trip` | ObjectId | ❌ | No | Ref → `trips` — optional link to specific trip |
| `vendor` | String | ❌ | No | Who was paid (petrol pump name, workshop, contractor) |
| `description` | String | ✅ | No | What the expense was for |
| `attachmentUrl` | String | ❌ | No | Path to uploaded receipt/bill file |
| `notes` | String | ❌ | No | |
| `isDeleted` | Boolean | ✅ | No | Default: `false` |
| `deletedAt` | Date | ❌ | No | |
| `deletedReason` | String | ❌ | No | |
| `createdBy` | ObjectId | ✅ | No | Ref → `users` |
| `createdAt` | Date | Auto | No | |
| `updatedAt` | Date | Auto | No | |

### Enum values

- `category`: `fuel`, `toll`, `maintenance`, `loading_unloading`, `other`

(Note: `driver_wages` is tracked in `salary_records`, not here, because it is a monthly computed summary, not a per-transaction expense.)

### Category-specific embedded sub-documents

#### `fuelDetails` (present when `category === 'fuel'`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `litresPurchased` | Decimal128 | ✅ | Actual litres from receipt |
| `ratePerLitre` | Decimal128 | ✅ | Actual pump rate |
| `pumpName` | String | ✅ | Petrol pump / vendor |

#### `tollDetails` (present when `category === 'toll'`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `month` | Number | ✅ | Month this toll applies to (1–12) |
| `year` | Number | ✅ | Year |
| `source` | String | ❌ | e.g. "FASTag statement", "manual" |

#### `maintenanceDetails` (present when `category === 'maintenance'`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `maintenanceType` | String | ✅ | e.g. "Tyre replacement", "Engine oil", "Repair" |
| `workshopName` | String | ❌ | |
| `odometer` | Number | ❌ | Vehicle odometer reading at service |

#### `loadingUnloadingDetails` (present when `category === 'loading_unloading'`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `contractorName` | String | ✅ | Contractor paid |
| `month` | Number | ✅ | Month this charge covers |
| `year` | Number | ✅ | Year |

### Indexes

```javascript
{ vehicle: 1, date: -1 }              // Find expenses for a vehicle/month & vehicle expense history
{ vehicle: 1, category: 1, date: -1 } // Vehicle-specific fuel usage or maintenance history
{ category: 1, date: -1 }             // Category-wise expense breakdown over time
{ firm: 1, date: -1 }                 // Firm-wise expense aggregation
{ date: -1 }                          // Fleet-wide monthly expense summaries
```

### Design rationale

**Why one collection instead of separate `fuel_expenses`, `toll_expenses`, `contractor_payments` collections?**

Reports aggregate across expense categories. A single collection with a `category` discriminator allows:
- `db.expenses.aggregate([{ $group: { _id: "$category", total: { $sum: "$amount" } } }])` — monthly summary by category
- One UI page showing all expenses with a filter-by-category dropdown

Separate collections would require `$lookup` joins or multiple API calls to produce this view.

The category-specific sub-documents (embedded, nullable) provide the extra fields needed per category without breaking the unified collection design.

---

## 15. Collection: `salary_records`

**Purpose:** Monthly driver wage calculation and payment record. One record per driver per calendar month.

**Lifecycle:** Created at month-end when the owner generates the salary calculation. Contains the wage rate at the time (not the current rate) so historical salary records are correct.

### Fields

| Field | Type | Required | Unique | Notes |
|---|---|---|---|---|
| `_id` | ObjectId | Auto | Yes | |
| `driver` | ObjectId | ✅ | No | Ref → `drivers` |
| `month` | Number | ✅ | No | 1–12 |
| `year` | Number | ✅ | No | e.g. 2026 |
| `daysWorked` | Number | ✅ | No | Count of distinct calendar days with ≥1 trip. System-calculated. |
| `dailyWageRate` | Decimal128 | ✅ | No | Rate applicable for this month — captured at record creation, not live from `drivers` |
| `grossWages` | Decimal128 | ✅ | No | `daysWorked × dailyWageRate` |
| `advances` | Decimal128 | ✅ | No | Amount already given as advance. Default: 0. |
| `deductions` | Decimal128 | ✅ | No | Other deductions. Default: 0. |
| `netPayable` | Decimal128 | ✅ | No | `grossWages − advances − deductions` |
| `paidOn` | Date | ❌ | No | Date when net payable was settled |
| `paymentMode` | String | ❌ | No | `cash`, `bank_transfer`, `cheque`, `other` |
| `paymentReference` | String | ❌ | No | Bank transfer / cheque reference |
| `notes` | String | ❌ | No | |
| `createdBy` | ObjectId | ✅ | No | Ref → `users` |
| `createdAt` | Date | Auto | No | |
| `updatedAt` | Date | Auto | No | |

### Indexes

```javascript
{ driver: 1, year: 1, month: 1 }    // unique — one record per driver per month
{ year: 1, month: 1 }               // all drivers' salary for a month
{ paidOn: -1 }                      // recent payments
```

### Design rationale

`dailyWageRate` is captured at record creation (copied from `driver.dailyWageRate`). This ensures the salary record is historically correct even if the driver's wage rate is later updated. The pattern mirrors how bills capture rate snapshots.

**Confirmed wage rule:** `daysWorked` = count of distinct calendar dates on which the driver has at least one trip in that month. 2 trips on the same day = 1 day worked.

---

## 16. Collection: `vehicle_documents`

**Purpose:** Compliance and ownership documents for vehicles, with expiry date tracking and file attachments.

**Lifecycle:** Created when a document is recorded. Updated when renewed. Multiple records of the same type are allowed (represents renewal history).

### Fields

| Field | Type | Required | Unique | Notes |
|---|---|---|---|---|
| `_id` | ObjectId | Auto | Yes | |
| `vehicle` | ObjectId | ✅ | No | Ref → `vehicles` |
| `firm` | ObjectId | ✅ | No | Ref → `firms` — denormalized from vehicle for efficient fleet-wide queries |
| `documentType` | String (enum) | ✅ | No | See enum values |
| `documentNumber` | String | ❌ | No | Certificate/policy number |
| `issueDate` | Date | ✅ | No | Date of issue |
| `expiryDate` | Date | ✅ | No | Date of expiry — used for alerts |
| `fileUrl` | String | ❌ | No | Path to uploaded file |
| `isActive` | Boolean | ✅ | No | `true` for current document; `false` for superseded/expired records |
| `notes` | String | ❌ | No | |
| `createdBy` | ObjectId | ✅ | No | Ref → `users` |
| `createdAt` | Date | Auto | No | |
| `updatedAt` | Date | Auto | No | |

### Enum values

- `documentType`: `rc`, `insurance`, `fitness`, `permit`, `puc`, `other`

### Indexes

```javascript
{ isActive: 1, expiryDate: 1 }                   // Find documents expiring soon (compliance alerts dashboard)
{ vehicle: 1, documentType: 1, isActive: 1 }    // Current active document of each type per vehicle
{ vehicle: 1, expiryDate: 1 }                     // All documents for a vehicle sorted by expiry
{ firm: 1, isActive: 1, expiryDate: 1 }         // Firm-wide compliance and expiry status report
```

### Soft delete

`isActive: false` marks a document as superseded. Old documents are retained as renewal history.

---

## 17. Collection: `audit_logs`

**Purpose:** Immutable, append-only record of critical business actions. Supports regulatory compliance, debugging, and the "reopen with reason" workflow.

**Lifecycle:** Written by the application on every audited action. Never modified or deleted.

### Fields

| Field | Type | Required | Unique | Notes |
|---|---|---|---|---|
| `_id` | ObjectId | Auto | Yes | |
| `action` | String | ✅ | No | See action catalogue |
| `entityType` | String | ✅ | No | Collection name: `bill`, `contract`, `trip`, `user`, etc. |
| `entityId` | ObjectId | ✅ | No | ID of the affected document |
| `userId` | ObjectId | ✅ | No | Ref → `users` — who performed the action |
| `userName` | String | ✅ | No | Denormalized — display name at time of action |
| `reason` | String | ❌ | No | Required for destructive actions (bill reopen, trip delete after billed) |
| `changes` | Object | ❌ | No | `{ before: {...}, after: {...} }` — field-level diff |
| `ipAddress` | String | ❌ | No | Request IP address |
| `userAgent` | String | ❌ | No | Browser/client |
| `timestamp` | Date | ✅ | No | Time of action — NOT `createdAt` (this collection never has updatedAt) |

### Action catalogue

| Action | Entity | Reason required? |
|---|---|---|
| `user.login` | user | No |
| `user.logout` | user | No |
| `user.password_changed` | user | No |
| `contract.created` | contract | No |
| `contract.superseded` | contract | No |
| `hsd_rate.created` | hsd_rate | No |
| `trip.created` | trip | No |
| `trip.updated` | trip | No |
| `trip.deleted` | trip | Yes |
| `bill.draft_created` | bill | No |
| `bill.finalized` | bill | No |
| `bill.reopened` | bill | **Yes** |
| `bill.pdf_generated` | bill | No |
| `payment.recorded` | bill_payment | No |
| `payment.deleted` | bill_payment | Yes |

### Indexes

```javascript
{ entityType: 1, entityId: 1, timestamp: -1 }   // entity history
{ userId: 1, timestamp: -1 }                      // user activity
{ action: 1, timestamp: -1 }                      // action-type queries
{ timestamp: -1 }                                  // recent activity feed
```

### Design rationale

`userName` is denormalized (copied from the user at action time) so audit records remain accurate even if the user's name is later changed. This is a standard audit log pattern.

The collection is **append-only** — no `updatedAt`, no updates. Application code should never issue `update` or `delete` operations against this collection.

---

## 18. Index Architecture and Query Optimization

### 18.1 Index Design Principles & Strategy

The indexing strategy balances high read throughput for daily transport operations, fast dashboard aggregations, and instantaneous billing generation, while strictly minimizing write-amplification and index memory consumption.

1. **The ESR (Equality, Sort, Range) Rule:**
   All compound indexes adhere to the ESR guideline:
   - **Equality (`E`):** Fields queried with exact values (e.g., `vehicle`, `firm`, `status`, `company`, `isActive`, `isDeleted`) appear first in the index key.
   - **Sort (`S`):** Fields driving the requested sort order (e.g., `date: -1`, `billingYear: -1`, `expiryDate: 1`) appear immediately after equality fields to prevent memory-expensive in-memory sorting (`SORT` stage in MongoDB explain plans).
   - **Range (`R`):** Fields queried with inequalities, `$gte`, `$lte`, or `$in` (e.g., date ranges, status sets) appear last.

2. **The Left-Prefix Rule & Index Consolidation:**
   MongoDB can utilize any left-prefix of a compound index. To eliminate redundant indexes:
   - `{ firm: 1, vehicle: 1, date: 1 }` automatically serves queries on `firm` alone or `{ firm, vehicle }`.
   - `{ vehicle: 1, date: -1 }` serves queries on `vehicle` alone as well as vehicle date-range queries.
   - Separate single-field indexes on `firm` or `vehicle` are intentionally omitted when compound left prefixes already satisfy the query planner.

3. **Selectivity & Low-Cardinality Fields:**
   Indexes on standalone boolean or low-cardinality fields (such as `isDeleted` or `status` by themselves) are anti-patterns in MongoDB because the query planner frequently reverts to collection scans (`COLLSCAN`). Therefore, `isDeleted` and `status` are only indexed as part of selective compound indexes (e.g., `{ firm: 1, isDeleted: 1, status: 1 }`).

4. **Zero Indexing on Unbounded & Heavy Fields:**
   Fields containing arbitrary text, receipts, audit diffs, or embedded sub-documents (`changes`, `notes`, `description`, `fileUrl`, `calculationSnapshot.tripSnapshots`) are never indexed.

---

### 18.2 Detailed Index Specifications for Target Application Queries

The following section breaks down every expected query pattern across the platform, specifying the exact collection, key fields, uniqueness, operational rationale, and query syntax.

```
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                              TARGET APPLICATION QUERIES                                   │
├────┬───────────────────────────────────────┬──────────────────────┬───────────────────────┤
│ #  │ Target Query Pattern                  │ Primary Collection   │ Index Name / Strategy │
├────┼───────────────────────────────────────┼──────────────────────┼───────────────────────┤
│ 1  │ Find vehicle by registration number   │ vehicles             │ Unique Point Lookup   │
│ 2  │ Find active vehicles                  │ vehicles             │ Selective Compound    │
│ 3  │ Find trips for a vehicle              │ trips                │ Chronological Range   │
│ 4  │ Find trips for a driver               │ trips                │ Wage/Audit Range      │
│ 5  │ Find trips for a firm                 │ trips                │ Chronological Range   │
│ 6  │ Find trips for a date range           │ trips                │ Fleet-wide Timeline   │
│ 7  │ Find all trips for a month            │ trips                │ Scoped Range Scan     │
│ 8  │ Find invoices for a firm              │ bills                │ Period Sort Compound  │
│ 9  │ Find invoices for a vehicle           │ bills                │ Vehicle Period Sort   │
│ 10 │ Find unpaid invoices                  │ bills                │ Receivables Compound  │
│ 11 │ Find expenses for a vehicle/month     │ expenses             │ Vehicle Cost Range    │
│ 12 │ Find documents expiring soon          │ vehicle_documents    │ Compliance Alert Scan │
│ 13 │ Find active contracts                 │ contracts            │ Version Status Lookup │
│ 14 │ Find current contract version         │ contracts            │ Temporal Sort Lookup  │
│ 15 │ Generate monthly billing              │ bills + trips        │ Multi-index Pipeline  │
└────┴───────────────────────────────────────┴──────────────────────┴───────────────────────┘
```

---

#### Query 1: Find vehicle by registration number

- **Collection:** `vehicles`
- **Fields:** `{ registrationNumber: 1 }`
- **Unique / Non-Unique:** **Unique**
- **Reason:**
  Every commercial vehicle has a legally mandated, globally unique registration mark (e.g., `UP13DT0632`). Indexing this field as unique guarantees data integrity at the database layer (preventing duplicate vehicle registration) and provides $O(\log N)$ point lookups.
- **Expected Query:**
  ```javascript
  db.vehicles.findOne({
    registrationNumber: "UP13DT0632",
    isDeleted: false
  });
  ```

---

#### Query 2: Find active vehicles

- **Collection:** `vehicles`
- **Fields:**
  - **Fleet-wide:** `{ isDeleted: 1, status: 1 }`
  - **Firm-scoped:** `{ firm: 1, isDeleted: 1, status: 1 }`
- **Unique / Non-Unique:** Non-unique
- **Reason:**
  Vehicles use soft delete (`isDeleted: false`) and an operational status (`running`, `idle`, `under_maintenance`, `inactive`). 
  - For fleet-wide lookups (e.g., global dispatch dashboards, maintenance schedules), `{ isDeleted: 1, status: 1 }` skips soft-deleted records and targets `running` or non-`inactive` vehicles.
  - For firm-level trip entry (where an operator selects a firm and then needs a dropdown of available vehicles), `{ firm: 1, isDeleted: 1, status: 1 }` satisfies equality on `firm` and `isDeleted`, retrieving only operational vehicles for that firm.
- **Expected Query:**
  ```javascript
  // Fleet-wide active vehicles
  db.vehicles.find({
    isDeleted: false,
    status: "running"
  }).sort({ registrationNumber: 1 });

  // Firm-scoped active vehicles (dropdown during daily trip entry)
  db.vehicles.find({
    firm: ObjectId("66e..."),
    isDeleted: false,
    status: { $in: ["running", "idle"] }
  }).sort({ vehicleNumber: 1 });
  ```

---

#### Query 3: Find trips for a vehicle

- **Collection:** `trips`
- **Fields:** `{ vehicle: 1, date: -1 }`
- **Unique / Non-Unique:** Non-unique
- **Reason:**
  Vehicle history is queried frequently on the vehicle detail screen, maintenance correlation views, and trip audit logs. Following the ESR rule, equality is applied to `vehicle`, and `date: -1` provides an instant index-ordered chronological feed without an in-memory `SORT` stage. This index also seamlessly satisfies date-bounded vehicle queries (`date: { $gte, $lte }`).
- **Expected Query:**
  ```javascript
  db.trips.find({
    vehicle: ObjectId("66e..."),
    isDeleted: false
  }).sort({ date: -1 });
  ```

---

#### Query 4: Find trips for a driver

- **Collection:** `trips`
- **Fields:** `{ driver: 1, date: 1 }`
- **Unique / Non-Unique:** Non-unique
- **Reason:**
  Essential for two primary workflows:
  1. **Monthly Driver Salary Generation:** The salary engine counts distinct calendar dates on which a driver operated trips in a billing month. The index allows an index-only or covered range scan across the target month.
  2. **Driver Assignment & Performance Tracking:** Reviewing a driver's trip log over any selected date window.
  Ascending sort (`date: 1`) matches chronological monthly salary computations.
- **Expected Query:**
  ```javascript
  // Driver trips for monthly wage calculation (June 2026)
  db.trips.find({
    driver: ObjectId("66e..."),
    date: {
      $gte: ISODate("2026-06-01T00:00:00.000Z"),
      $lte: ISODate("2026-06-30T23:59:59.999Z")
    },
    isDeleted: false
  }).sort({ date: 1 });
  ```

---

#### Query 5: Find trips for a firm

- **Collection:** `trips`
- **Fields:** `{ firm: 1, date: -1 }`
- **Unique / Non-Unique:** Non-unique
- **Reason:**
  Each firm (e.g., Nirupama Gupta, Sweeti Gupta) operates as an independent billing entity. Firm managers monitor all trips logged for their firm in real time. Because `firm` is denormalized directly onto the `trips` collection, this compound index eliminates the need to join through `vehicles`, providing instantaneous chronological trip feeds.
- **Expected Query:**
  ```javascript
  db.trips.find({
    firm: ObjectId("66e..."),
    isDeleted: false
  }).sort({ date: -1 });
  ```

---

#### Query 6: Find trips for a date range

- **Collection:** `trips`
- **Fields:** `{ date: 1 }`
- **Unique / Non-Unique:** Non-unique
- **Reason:**
  Supports fleet-wide operational screens, including:
  - Daily dispatch logs across all firms and vehicles.
  - Cross-fleet daily mileage and toll verification.
  - Date-bounded global aggregations (e.g., total KM run across the entire fleet in the last 7 days).
- **Expected Query:**
  ```javascript
  db.trips.find({
    date: {
      $gte: ISODate("2026-06-01T00:00:00.000Z"),
      $lte: ISODate("2026-06-15T23:59:59.999Z")
    },
    isDeleted: false
  }).sort({ date: 1 });
  ```

---

#### Query 7: Find all trips for a month

- **Collection:** `trips`
- **Fields:**
  - **Fleet-wide Month:** `{ date: 1 }`
  - **Firm-wide Month:** `{ firm: 1, date: 1 }` (satisfied by `{ firm: 1, date: -1 }` via bidirectional B-tree traversal)
  - **Vehicle Month (Billing preview):** `{ firm: 1, vehicle: 1, date: 1 }`
- **Unique / Non-Unique:** Non-unique
- **Reason:**
  Monthly queries in MongoDB are bounded range queries between the start and end of the target month (`$gte: YYYY-MM-01, $lte: YYYY-MM-LastDay`). Depending on the query scope:
  - Fleet-wide monthly reports scan `{ date: 1 }`.
  - Firm-wide monthly audits scan `{ firm: 1, date: -1 }`.
  - Vehicle-specific monthly billing previews utilize `{ firm: 1, vehicle: 1, date: 1 }` to isolate the exact 28–31 trips for that vehicle without scanning other fleet records.
- **Expected Query:**
  ```javascript
  // All trips for Firm X in June 2026
  db.trips.find({
    firm: ObjectId("66e..."),
    date: {
      $gte: ISODate("2026-06-01T00:00:00.000Z"),
      $lte: ISODate("2026-06-30T23:59:59.999Z")
    },
    isDeleted: false
  }).sort({ date: 1 });
  ```

---

#### Query 8: Find invoices for a firm

- **Collection:** `bills`
- **Fields:** `{ firm: 1, billingYear: -1, billingMonth: -1 }`
- **Unique / Non-Unique:** Non-unique
- **Reason:**
  The Firm Invoices UI screen presents a chronological ledger of all monthly bills generated for a particular firm. This index satisfies equality on `firm` and sorts by year and month descending, allowing pagination without an in-memory sort buffer.
- **Expected Query:**
  ```javascript
  db.bills.find({
    firm: ObjectId("66e...")
  }).sort({
    billingYear: -1,
    billingMonth: -1
  });
  ```

---

#### Query 9: Find invoices for a vehicle

- **Collection:** `bills`
- **Fields:** `{ vehicle: 1, billingYear: -1, billingMonth: -1 }`
- **Unique / Non-Unique:** Non-unique
- **Reason:**
  On the Vehicle Profile page, the fleet owner examines the historical revenue contribution and billing records for a specific truck over its entire operating lifetime. A standalone `{ vehicle: 1 }` lookup cannot be served by `{ firm: 1, vehicle: 1, ... }` because `firm` is the leading key. This dedicated compound index directly optimizes vehicle billing history.
- **Expected Query:**
  ```javascript
  db.bills.find({
    vehicle: ObjectId("66e...")
  }).sort({
    billingYear: -1,
    billingMonth: -1
  });
  ```

---

#### Query 10: Find unpaid invoices

- **Collection:** `bills`
- **Fields:**
  - **Firm-scoped Unpaid Bills:** `{ firm: 1, status: 1 }`
  - **Fleet-wide Aging / Receivables:** `{ status: 1, outstandingAmount: -1 }`
- **Unique / Non-Unique:** Non-unique
- **Reason:**
  Unpaid bills have statuses `finalized`, `outstanding`, or `partially_paid` with `outstandingAmount > 0`.
  - When collecting payments for a specific firm, `{ firm: 1, status: 1 }` filters active receivables for that firm.
  - For executive dashboards and aging analysis across all firms, `{ status: 1, outstandingAmount: -1 }` isolates outstanding bills and presents the highest outstanding balances first.
- **Expected Query:**
  ```javascript
  // Firm-specific unpaid bills
  db.bills.find({
    firm: ObjectId("66e..."),
    status: { $in: ["outstanding", "partially_paid"] }
  }).sort({ billingYear: -1, billingMonth: -1 });

  // Fleet-wide receivables prioritized by outstanding balance
  db.bills.find({
    status: { $in: ["outstanding", "partially_paid"] }
  }).sort({ outstandingAmount: -1 });
  ```

---

#### Query 11: Find expenses for a vehicle/month

- **Collection:** `expenses`
- **Fields:** `{ vehicle: 1, date: -1 }`
- **Unique / Non-Unique:** Non-unique
- **Reason:**
  To compute vehicle-level profitability (monthly revenue from `bills` minus actual operational costs), the system aggregates fuel, maintenance, toll, and miscellaneous expenses for a given vehicle within a calendar month. Equality on `vehicle` followed by range scan on `date` satisfies the ESR pattern.
  *(Note: A complementary index `{ vehicle: 1, category: 1, date: -1 }` is maintained for category-filtered logs, such as vehicle tire maintenance or fuel receipts).*
- **Expected Query:**
  ```javascript
  db.expenses.find({
    vehicle: ObjectId("66e..."),
    date: {
      $gte: ISODate("2026-06-01T00:00:00.000Z"),
      $lte: ISODate("2026-06-30T23:59:59.999Z")
    },
    isDeleted: false
  }).sort({ date: -1 });
  ```

---

#### Query 12: Find documents expiring soon

- **Collection:** `vehicle_documents`
- **Fields:**
  - **Global Expiry Alert Dashboard:** `{ isActive: 1, expiryDate: 1 }`
  - **Firm-wide Compliance Audit:** `{ firm: 1, isActive: 1, expiryDate: 1 }`
- **Unique / Non-Unique:** Non-unique
- **Reason:**
  The system tracks regulatory documents (RC, Insurance, Fitness, State Permit, PUC) and triggers alerts 30, 15, and 7 days before expiry.
  Placing `isActive: 1` first restricts the index scan strictly to current, active documents (ignoring superseded historical renewals). The ascending sort `expiryDate: 1` places the most critically urgent expiries at the top of the alert feed.
- **Expected Query:**
  ```javascript
  // Fleet dashboard: Documents expiring within the next 30 days
  const today = new Date();
  const thirtyDaysAhead = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  db.vehicle_documents.find({
    isActive: true,
    expiryDate: { $gte: today, $lte: thirtyDaysAhead }
  }).sort({ expiryDate: 1 });
  ```

---

#### Query 13: Find active contracts

- **Collection:** `contracts`
- **Fields:**
  - **Firm-specific Active Contract:** `{ firm: 1, effectiveTo: 1, effectiveFrom: 1 }`
  - **Fleet-wide Active Contracts:** `{ effectiveTo: 1 }`
- **Unique / Non-Unique:** Non-unique
- **Reason:**
  In this versioned contract model, a contract version is currently active if `effectiveTo === null` or `effectiveTo >= currentDate`.
  - `{ effectiveTo: 1 }` enables instantaneous retrieval of all open-ended active contracts (`{ effectiveTo: null }`).
  - `{ firm: 1, effectiveTo: 1, effectiveFrom: 1 }` isolates active agreements for a given firm and validates that newly added contract versions do not overlap existing date boundaries.
- **Expected Query:**
  ```javascript
  // Find current active contract for a firm
  db.contracts.find({
    firm: ObjectId("66e..."),
    $or: [
      { effectiveTo: null },
      { effectiveTo: { $gte: new Date() } }
    ]
  });
  ```

---

#### Query 14: Find current contract version

- **Collection:** `contracts`
- **Fields:** `{ firm: 1, company: 1, effectiveFrom: -1 }`
- **Unique / Non-Unique:** Non-unique
- **Reason:**
  During trip calculation and billing finalization, the engine must resolve the exact contract terms applicable on a specific `tripDate`. By applying equality on `firm` and `company`, and sorting descending on `effectiveFrom`, the engine finds the latest version where `effectiveFrom <= tripDate` in $O(\log N)$ time with a limit of 1.
- **Expected Query:**
  ```javascript
  db.contracts.findOne({
    firm: ObjectId("66e..."),
    company: ObjectId("66f..."),
    effectiveFrom: { $lte: tripDate },
    $or: [
      { effectiveTo: null },
      { effectiveTo: { $gt: tripDate } }
    ]
  }).sort({ effectiveFrom: -1 });
  ```

---

#### Query 15: Generate monthly billing (Multi-Index Pipeline)

Generating a monthly bill is an atomic financial operation requiring coordination across multiple collections and indexes. The following pipeline details the exact role of each index during bill generation:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        MONTHLY BILLING GENERATION WORKFLOW                             │
├────────────────────────┬───────────────────────────────────────────────────────────────┤
│ Step 1: Pre-check      │ Check if bill exists: { firm, vehicle, month, year } (UNIQUE) │
│ Step 2: Version Lookup │ Find contract: { firm, company, effectiveFrom: -1 }           │
│ Step 3: Fuel Lookup    │ Find HSD rate: { effectiveFrom: -1 }                          │
│ Step 4: Trip Fetch     │ Fetch month trips: { firm, vehicle, date: 1 }                 │
│ Step 5: Draft Unbilled │ Scan pending trips for firm: { firm, status: 1, date: 1 }     │
│ Step 6: Insert Bill    │ Insert bill: { billNumber: 1 } (UNIQUE)                       │
│ Step 7: Trip Lock      │ Update & link trips: { billId: 1 }                            │
└────────────────────────┴───────────────────────────────────────────────────────────────┘
```

1. **Pre-condition Duplicate Guard (Collection: `bills`):**
   - **Index:** `{ firm: 1, vehicle: 1, billingMonth: 1, billingYear: 1 }` (**Unique**)
   - **Reason:** Enforces the strict business rule: *only one monthly bill can exist per vehicle per firm for a calendar month*. Prevents double-billing even under concurrent execution.
   - **Query:** `db.bills.findOne({ firm: fId, vehicle: vId, billingMonth: 6, billingYear: 2026 })`

2. **Retrieve Applicable Billing Rules (Collection: `contracts`):**
   - **Index:** `{ firm: 1, company: 1, effectiveFrom: -1 }`
   - **Reason:** Loads the active contract version (with embedded KM slabs and capacity rates) for that billing period.

3. **Retrieve Global Diesel Rate (Collection: `hsd_rates`):**
   - **Index:** `{ effectiveFrom: -1 }`
   - **Reason:** Retrieves the global HSD rate effective on the trip dates.
   - **Query:** `db.hsd_rates.findOne({ effectiveFrom: { $lte: monthEnd } }).sort({ effectiveFrom: -1 })`

4. **Fetch Vehicle Trips for the Month (Collection: `trips`):**
   - **Index:** `{ firm: 1, vehicle: 1, date: 1 }`
   - **Reason:** Selects all valid trips for this vehicle within the date range `[2026-06-01, 2026-06-30]` sorted in order.
   - **Query:**
     ```javascript
     db.trips.find({
       firm: firmId,
       vehicle: vehicleId,
       date: {
         $gte: ISODate("2026-06-01T00:00:00.000Z"),
         $lte: ISODate("2026-06-30T23:59:59.999Z")
       },
       isDeleted: false
     }).sort({ date: 1 });
     ```

5. **Unbilled Trips Batch Queue (Collection: `trips`):**
   - **Index:** `{ firm: 1, status: 1, date: 1 }`
   - **Reason:** When generating batch bills across all vehicles for a firm, identifies all unbilled trips (`status: 'draft'`).
   - **Query:** `db.trips.find({ firm: firmId, status: "draft", date: { $gte: start, $lte: end }, isDeleted: false })`

6. **Bill Finalization & Trip Attachment (Collections: `bills` and `trips`):**
   - **Index on `bills`:** `{ billNumber: 1 }` (**Unique**) guarantees invoice number uniqueness (e.g., `NIR/06/26-27/11`).
   - **Index on `trips`:** `{ billId: 1 }` allows instant retrieval of all trips attached to this finalized bill when generating the bill breakdown or processing reopen requests.

---

### 18.3 Master Index Inventory (All 15 Collections)

The table below catalogs every index across the entire MongoDB database:

| # | Collection | Index Fields | Unique | Index Type / Rationale | Supported Queries |
|---|---|---|:---:|---|---|
| 1 | `users` | `{ email: 1 }` | **Yes** | B-tree Point Lookup | User authentication / login |
| 2 | `users` | `{ role: 1, isActive: 1 }` | No | Compound Filter | User administration & role filtering |
| 3 | `companies` | `{ name: 1 }` | **Yes** | Unique Constraint | Factory master duplicate prevention |
| 4 | `companies` | `{ isActive: 1 }` | No | Simple Filter | Factory dropdown selectors |
| 5 | `firms` | `{ company: 1, billPrefix: 1 }` | **Yes** | Compound Unique | Bill prefix uniqueness per company |
| 6 | `firms` | `{ company: 1, isActive: 1 }` | No | Compound Filter | Firm dropdown by company |
| 7 | `firms` | `{ isActive: 1 }` | No | Simple Filter | Global active firm selector |
| 8 | `vehicles` | `{ registrationNumber: 1 }` | **Yes** | Unique Identifier | Vehicle lookup by reg number |
| 9 | `vehicles` | `{ firm: 1, vehicleNumber: 1 }` | **Yes** | Compound Unique | Sequential vehicle number per firm |
| 10 | `vehicles` | `{ firm: 1, isDeleted: 1, status: 1 }` | No | Compound Selective | Active vehicles for a firm |
| 11 | `vehicles` | `{ isDeleted: 1, status: 1 }` | No | Compound Selective | Active vehicles fleet-wide |
| 12 | `vehicles` | `{ capacity: 1 }` | No | Filter / Grouping | Vehicle category reports |
| 13 | `drivers` | `{ status: 1, isDeleted: 1 }` | No | Compound Filter | Active driver dispatch dropdown |
| 14 | `drivers` | `{ name: 1 }` | No | Prefix Search | Driver autocomplete / lookup |
| 15 | `routes` | `{ company: 1, isActive: 1 }` | No | Compound Filter | Active routes for factory |
| 16 | `routes` | `{ name: 1 }` | No | Search | Route lookup by name |
| 17 | `routes` | `{ isActive: 1 }` | No | Simple Filter | Global active routes list |
| 18 | `contracts` | `{ firm: 1, company: 1, effectiveFrom: -1 }` | No | Compound Sort | Current contract version lookup |
| 19 | `contracts` | `{ firm: 1, effectiveTo: 1, effectiveFrom: 1 }` | No | Compound Temporal | Active contracts & overlap check |
| 20 | `contracts` | `{ effectiveTo: 1 }` | No | Sparse / Filter | Fleet-wide active contracts |
| 21 | `contracts` | `{ company: 1, firm: 1 }` | No | Compound Lookup | Contracts by company/firm |
| 22 | `hsd_rates` | `{ effectiveFrom: -1 }` | No | Descending Sort | Fuel rate active on trip date |
| 23 | `hsd_rates` | `{ effectiveTo: 1 }` | No | Null / Filter | Currently active global fuel rate |
| 24 | `trips` | `{ vehicle: 1, date: -1 }` | No | ESR Compound | Vehicle trips chronological feed |
| 25 | `trips` | `{ driver: 1, date: 1 }` | No | ESR Compound | Driver trips for monthly wage |
| 26 | `trips` | `{ firm: 1, date: -1 }` | No | ESR Compound | Firm trips chronological feed |
| 27 | `trips` | `{ date: 1 }` | No | Range Scan | Daily operations & monthly summaries |
| 28 | `trips` | `{ firm: 1, vehicle: 1, date: 1 }` | No | Multi-equality Range | Vehicle monthly billing preview |
| 29 | `trips` | `{ firm: 1, status: 1, date: 1 }` | No | Compound Selective | Unbilled trips queue for a firm |
| 30 | `trips` | `{ billId: 1 }` | No | Foreign Key Lookup | Trips attached to a finalized bill |
| 31 | `bills` | `{ billNumber: 1 }` | **Yes** | Unique Identifier | Bill lookup by bill number |
| 32 | `bills` | `{ firm: 1, vehicle: 1, billingMonth: 1, billingYear: 1 }` | **Yes** | Compound Unique | Prevent duplicate vehicle monthly bill |
| 33 | `bills` | `{ firm: 1, billingYear: -1, billingMonth: -1 }` | No | ESR Sort | Invoices for a firm (chronological) |
| 34 | `bills` | `{ vehicle: 1, billingYear: -1, billingMonth: -1 }` | No | ESR Sort | Invoices for a vehicle (chronological) |
| 35 | `bills` | `{ firm: 1, status: 1 }` | No | Compound Filter | Unpaid invoices per firm |
| 36 | `bills` | `{ status: 1, outstandingAmount: -1 }` | No | Compound Sort | Unpaid invoices fleet-wide (aging) |
| 37 | `bills` | `{ company: 1, billingYear: 1, billingMonth: 1 }` | No | Compound Grouping | Factory billing summary report |
| 38 | `bills` | `{ finalizedAt: -1 }` | No | Sort | Recent finalized bills dashboard |
| 39 | `bill_payments` | `{ bill: 1 }` | No | Foreign Key Lookup | Payments recorded against a bill |
| 40 | `bill_payments` | `{ firm: 1, paymentDate: -1 }` | No | Compound Sort | Firm payment ledger over time |
| 41 | `bill_payments` | `{ company: 1, paymentDate: -1 }` | No | Compound Sort | Factory payment reconciliation |
| 42 | `bill_payments` | `{ paymentDate: -1 }` | No | Sort | Recent payments dashboard |
| 43 | `expenses` | `{ vehicle: 1, date: -1 }` | No | ESR Compound | Vehicle monthly expenses & P&L |
| 44 | `expenses` | `{ vehicle: 1, category: 1, date: -1 }` | No | ESR Compound | Vehicle fuel/maintenance history |
| 45 | `expenses` | `{ category: 1, date: -1 }` | No | Compound Sort | Category expense breakdown |
| 46 | `expenses` | `{ firm: 1, date: -1 }` | No | Compound Sort | Firm-wise expense ledger |
| 47 | `expenses` | `{ date: -1 }` | No | Timeline Sort | Fleet-wide expense timeline |
| 48 | `salary_records` | `{ driver: 1, year: 1, month: 1 }` | **Yes** | Compound Unique | One salary record per driver/month |
| 49 | `salary_records` | `{ year: 1, month: 1 }` | No | Compound Lookup | All driver salaries for month |
| 50 | `salary_records` | `{ paidOn: -1 }` | No | Sparse Sort | Salary payment disbursement feed |
| 51 | `vehicle_documents`| `{ isActive: 1, expiryDate: 1 }` | No | Compound Selective | Documents expiring soon dashboard |
| 52 | `vehicle_documents`| `{ vehicle: 1, documentType: 1, isActive: 1 }` | No | Compound Lookup | Current active document per vehicle |
| 53 | `vehicle_documents`| `{ vehicle: 1, expiryDate: 1 }` | No | Compound Sort | Vehicle documents sorted by expiry |
| 54 | `vehicle_documents`| `{ firm: 1, isActive: 1, expiryDate: 1 }` | No | Compound Filter | Firm compliance & expiry report |
| 55 | `audit_logs` | `{ entityType: 1, entityId: 1, timestamp: -1 }` | No | Audit Trail Compound | Complete change history for entity |
| 56 | `audit_logs` | `{ userId: 1, timestamp: -1 }` | No | Audit Trail Compound | User activity history |
| 57 | `audit_logs` | `{ action: 1, timestamp: -1 }` | No | Audit Trail Compound | Specific action history (e.g. reopens) |
| 58 | `audit_logs` | `{ timestamp: -1 }` | No | Timeline Sort | Recent system activity feed |

---

### 18.4 Unnecessary Indexes Explicitly Avoided and Eliminated

To protect write performance, prevent RAM bloat, and maintain lean WiredTiger cache utilization, the following potential indexes were evaluated and deliberately omitted:

1. **Redundant Left-Prefix Indexes:**
   - **`trips: { firm: 1 }`**: Omitted because `{ firm: 1, date: -1 }` and `{ firm: 1, vehicle: 1, date: 1 }` both have `firm` as their leading field and satisfy single-field queries on `firm`.
   - **`trips: { vehicle: 1 }`**: Omitted because `{ vehicle: 1, date: -1 }` satisfies any query filtering on `vehicle` alone.
   - **`trips: { driver: 1 }`**: Omitted because `{ driver: 1, date: 1 }` satisfies driver lookups.
   - **`bills: { firm: 1 }`**: Omitted because `{ firm: 1, billingYear: -1, billingMonth: -1 }` and `{ firm: 1, status: 1 }` already index `firm` as their prefix.
   - **`bills: { vehicle: 1 }`**: Omitted because `{ vehicle: 1, billingYear: -1, billingMonth: -1 }` satisfies vehicle lookups.
   - **`contracts: { firm: 1 }`**: Omitted because `{ firm: 1, company: 1, effectiveFrom: -1 }` provides prefix coverage.

2. **Low-Cardinality Standalone Boolean Indexes:**
   - **`trips: { isDeleted: 1 }`** and **`vehicles: { isDeleted: 1 }`**: Standalone indexes on boolean flags where 99%+ of records are `false` exhibit terrible selectivity. The query planner will almost always skip them in favor of collection scans or other compound fields. `isDeleted` is strictly used within compound indexes (`{ firm: 1, isDeleted: 1, status: 1 }`).
   - **`trips: { status: 1 }`**: With only 3 states (`draft`, `billed`, `finalized`), a standalone status index scans broad swaths of the collection. Replaced with `{ firm: 1, status: 1, date: 1 }` which limits the scan to a specific firm's operational subset.

3. **No Multikey Indexes on Embedded Configuration Arrays:**
   - **`contracts.kmSlabs.upToKm`** and **`contracts.capacityRates.capacity`**: The contract document contains 4 KM slabs and 4–7 capacity rates. Once the contract document is loaded into memory (a single document read), slab matching and rate retrieval are executed in application code via array lookup in negligible CPU microseconds. Database-level array indexing would create unnecessary multikey B-tree entries on every contract insert.
   - **`bills.calculationSnapshot.tripSnapshots`**: This embedded array is an immutable archival snapshot used solely when rendering the bill PDF or displaying the line-item audit table. It is never queried across multiple bills and requires zero indexing.

4. **No Indexes on Large Unstructured Strings and URLs:**
   - Fields such as `notes`, `description`, `address`, `legalName`, `fileUrl`, `pdfUrl`, `changes`, and `userAgent` are never indexed, keeping document write latency minimal.

---

### 18.5 Operational & Production Guidelines

1. **Mongoose Schema Index Declaration:**
   - All indexes must be defined explicitly in Mongoose schema files using `schema.index({ ... })`.
   - In production environments, set `autoIndex: false` in Mongoose connection options to prevent blocking index builds during application boot.
   - Indexes should be deployed via database migration scripts using MongoDB's background index creation (`createIndexes({ ... })`).

2. **Query Plan Verification:**
   - Continuous integration tests for reporting and billing queries must verify query execution plans using `.explain("executionStats")`.
   - Criteria for healthy query execution:
     - `stage`: Must be `IXSCAN` followed by `FETCH`, or covered index scan (`PROJECTION_COVERED`).
     - `SORT` stage: In-memory sorting must be **absent** for all paginated listing queries.
     - Ratio of `totalDocsExamined` to `nReturned`: Must approximate 1:1. Any query where `totalDocsExamined > 2 × nReturned` indicates an unindexed filter or suboptimal ESR field order.

---

## 19. Soft Delete Strategy

| Collection | Strategy | Fields |
|---|---|---|
| `users` | `isActive: false` | `isActive` |
| `companies` | `isActive: false` | `isActive` |
| `firms` | `isActive: false` | `isActive` |
| `vehicles` | `isDeleted: true` | `isDeleted`, `deletedAt` |
| `drivers` | `isDeleted: true` | `isDeleted`, `deletedAt` |
| `routes` | `isActive: false` | `isActive` |
| `contracts` | Not deleted — superseded | `effectiveTo` set on old version |
| `hsd_rates` | Not deleted — superseded | `effectiveTo` set on old rate |
| `trips` | `isDeleted: true` | `isDeleted`, `deletedAt`, `deletedReason` |
| `bills` | Not deleted | Status tracking; reopen workflow |
| `bill_payments` | `isDeleted: true` | `isDeleted`, `deletedAt`, `deletedReason` |
| `expenses` | `isDeleted: true` | `isDeleted`, `deletedAt`, `deletedReason` |
| `salary_records` | Not soft-deleted | Corrections update in place (audited) |
| `vehicle_documents` | `isActive: false` | `isActive` (superseded on renewal) |
| `audit_logs` | Never deleted | Append-only |

**General rule:** Any collection whose documents are referenced by financial records (trips, bills, payments) uses soft delete to preserve referential integrity.

---

## 20. Design Decisions Summary

| Decision | Choice | Alternative | Why |
|---|---|---|---|
| Contract versioning | New document per version | Single document with version history array | Simpler queries; each version is independently queryable; billing lookup is a single find() |
| KM slabs storage | Embedded array in contract | Separate `billing_rules` collection | Always read together; no independent lifecycle; versioned atomically with contract |
| Capacity rates storage | Embedded array in contract | Separate `capacity_rates` collection | Same as above; reduces queries |
| HSD rate | Separate `hsd_rates` collection | Embedded in contract | Owner confirmed: global rate. Separate collection allows one update to apply to all contracts. |
| Bill finalization | Full snapshot in bill document | Re-query from contract + hsd_rate | Historical reproducibility guaranteed even if contracts/rates are modified or deleted |
| Trip calculated fields | Stored on trip document | Recalculated on every read | Read performance; preview consistency; per-trip auditability |
| `firm` on trips | Denormalized from vehicle | Always join through vehicle | Nearly every trip query filters by firm; avoiding the join is significant |
| Expense categories | Single collection + discriminator | Separate per-category collections | Unified reporting; single aggregation query for monthly summary |
| `invoice_items` collection | Eliminated | Separate collection | Trips serve as invoice items; snapshot in bill eliminates the need |
| `contractor_payments` collection | Eliminated | Separate collection | `expenses` with `category: 'loading_unloading'` is sufficient |
| `driver_payments` collection | Renamed to `salary_records` | Keep as payments | Monthly wage = a computed record with rate snapshot, not just a payment entry |
| Decimal precision | Decimal128 + decimal.js | JS Number / mongoose Number | Exact financial arithmetic; no floating point; required for billing |
| Rounding point | Per trip row | Per column total or grand total only | Owner confirmed; matches reference bill behavior |
| Audit log | Separate collection | Change events on entity documents | Clean separation; never pollutes entity documents; can be archived independently |
