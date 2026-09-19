# Requirements Analysis
## Fleet & Transport Operations, Expense and Billing Platform

**Synthesized from:**
- `01_Business_Requirements_Document.docx` (BRD v0.1)
- `02_Billing_Rules_and_Calculation_Specification.docx` (Discovery v0.1)
- `03_Implementation_Roadmap_and_Project_Plan.docx`
- `04_Requirements_Tracker.xlsx` (sheets: Requirements, Open Questions, Billing Rules, Data Dictionary, Excel Evidence)
- **Owner clarifications received on 19 September 2026** (answers to OQ-01 through OQ-10)
- **Reference bill image: NIR/06/26-27/11** (UP13DT0632, June 2026)

**Analysis date:** September 2026
**Status:** Updated with owner-confirmed answers — ready for architecture and implementation planning

---

## Table of Contents

1. [Business Context](#1-business-context)
2. [Business Entities](#2-business-entities)
3. [Actors and Users](#3-actors-and-users)
4. [Business Workflows](#4-business-workflows)
5. [Billing Business Rules](#5-billing-business-rules)
6. [Expense Model](#6-expense-model)
7. [Reporting Requirements](#7-reporting-requirements)
8. [Dashboard Requirements](#8-dashboard-requirements)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [Confirmed Requirements](#10-confirmed-requirements)
11. [Assumptions](#11-assumptions)
12. [Ambiguous / Partially Confirmed Requirements](#12-ambiguous--partially-confirmed-requirements)
13. [Remaining Open Questions](#13-remaining-open-questions)

---

## 1. Business Context

### What the business does

A transport business owns approximately **50 vehicles** (trucks, polypack trucks, milk tankers). The vehicles deliver goods for **Creamy Foods Ltd** (the factory — which operates under the Madhusudan Milk Factory brand). The business owner runs vehicles through multiple **billing firms** — each firm is a separate legal/trading entity that submits monthly bills to the factory.

### Critical structural clarification (confirmed by owner)

> **Creamy Foods Ltd** is the factory — the entity that *receives* the services and *pays* the bills.
>
> The billing entities that *submit* bills to Creamy Foods Ltd are called **firms** in this system. Current firms are:
> - **Neeraj Kumar Gupta**
> - **Sweeti Gupta**
> - **Nirupama Gupta** (bill prefix: NIR)
> - **Azad Road Line**
>
> The owner wants the system to support adding new companies (factories) and new firms under them in the future, through configuration — not through code changes.

### System configuration model (owner-requested)

The system must allow the owner to:
1. Register one or more **companies** (factories/customers — e.g. Creamy Foods Ltd)
2. Register one or more **firms** under each company (the billing vendor entities)
3. Register **vehicles** on the platform and associate each vehicle with a firm
4. Configure **billing rates** per firm (KM slabs, average by capacity, hiring rate by capacity, HSD rate)

This makes the system reusable if the business expands to other factories or the firm structure changes.

### How a bill flows (confirmed from reference bill image)

```
[Firm: M/S Nirupama Gupta]  ──submits bill──▶  [Factory: Creamy Foods Ltd]

Bill header shows:
  TO: Creamy Foods Ltd, Bartauli, Khurja
  FROM: M/S Nirupama Gupta, Radha Nagar, Bulandshahr

Each vehicle under Nirupama Gupta gets its own monthly bill.
Bill number format: NIR/06/26-27/11
  NIR  = Nirupama's firm code
  06   = billing month (June)
  26-27 = financial year
  11   = this vehicle's number within Nirupama's fleet
```

### Current pain points

| Current tool | Purpose | Problem |
|---|---|---|
| Paper registers | Daily vehicle assignment and trip records | Data re-entered into Excel later; error-prone |
| WhatsApp group | Fuel receipt/bill sharing | Receipts disconnected from monthly records |
| FASTag records | Toll tracking | Month-end vehicle-wise calculations are manual |
| Petrol-pump bills | Actual fuel expense | Monthly reconciliation is manual |
| Physical files | RC, insurance, permit, fitness, pollution | No central expiry/status view |
| Excel bills | Factory billing and calculation | High manual effort; calculation risk; difficult to search history |

### Primary goal

**Eliminate manual Excel billing.** Automate factory bill generation. Capture daily operations once and derive all billing amounts from configured rules.

### Out of scope for V1

- Driver mobile application
- Live GPS tracking
- Customer portal
- Full accounting/ERP replacement
- AI/OCR receipt automation
- Automatic WhatsApp ingestion
- Automatic FASTag API integration
- Complex multi-company permission architecture

---

## 2. Business Entities

### 2.1 Company (Factory / Customer)

The entity that receives transport services and pays the bills.

| Field | Type | Notes |
|---|---|---|
| Name | String | e.g. "Creamy Foods Ltd" |
| Legal / Billing Name | String | Full legal name for bill header |
| Address | String | Address printed on bill |
| GSTIN | String | Optional |
| Notes | String | Optional |

**Current data:** Only one company — **Creamy Foods Ltd, Bartauli, Khurja**

**Design principle:** The system is multi-company by configuration, not by code. The owner can add new companies without developer involvement.

---

### 2.2 Firm (Billing Vendor / Transport Entity)

The entity that owns and operates vehicles, submits bills to the factory, and receives payments.

| Field | Type | Notes |
|---|---|---|
| Company | Reference | Factory this firm works for |
| Name | String | e.g. "Nirupama Gupta" |
| Display Name | String | e.g. "M/S Nirupama Gupta" (printed on bills) |
| Bill Prefix / Code | String | Short code for bill numbering (e.g. "NIR") |
| Address | String | Firm's address printed on bills |
| Phone / Mobile | String | Optional |
| Bank Account Name | String | For bill footer — e.g. "NIRUPAMA GUPTA" |
| Bank Account Number | String | e.g. "6198002100003888" |
| Bank IFSC Code | String | e.g. "PUNB0619800" |
| Bank Name | String | e.g. "Punjab National Bank" |
| Bank Branch | String | e.g. "DAV Tiraha, Bulandshahr" |
| Notes | String | Optional |

**Confirmed firms:**
- Neeraj Kumar Gupta
- Sweeti Gupta
- Nirupama Gupta (prefix: NIR)
- Azad Road Line

**Key relationships:** Firm → Vehicles, Bills, Payments received

---

### 2.3 Vehicle

A company-owned vehicle used for transport operations. Every vehicle belongs to one firm and is registered on the platform by the owner.

| Field | Type | Notes |
|---|---|---|
| Registration Number | String | Unique identifier (e.g. UP13DT0632) |
| Vehicle Type | Enum | Truck / Polypack Truck / Milk Tanker / Other |
| Capacity | Number | Tanker/vehicle capacity in litres (e.g. 29,000) — drives billing profile |
| Firm | Reference | Which billing firm this vehicle belongs to |
| Vehicle Number (per firm) | Integer | The sequential number used in bill numbering (e.g. 11 for UP13DT0632 under NIR) |
| Status | Enum | Running / Idle / Under Maintenance / Inactive |
| Notes | String | Optional remarks |

**Capacity types observed / confirmed:** ~6–7 distinct capacity types across the fleet. Owner adds capacity when registering a vehicle. The system derives the billing average and hiring rate from the capacity via the contract configuration.

**Key relationships:** Vehicle → Firm, Trips, Expenses, Documents

---

### 2.4 Driver

A person who drives vehicles on trip assignments.

| Field | Type | Notes |
|---|---|---|
| Name | String | Required |
| Phone / Contact | String | Optional in V1 |
| License Number | String | Optional in V1 |
| Daily Wage Rate (₹) | Currency | Required for salary tracking |
| Status | Enum | Active / Inactive |
| Notes | String | Optional |

**Confirmed wage rule:** A driver receives **one full day's wage** for any day they are assigned to a trip, regardless of how many KMs they cover or how many rounds they complete. (1 trip = 1 day = 1 day's wage. 2 trips in same day = still 1 day's wage.)

**Key relationships:** Driver → Trip assignments, Wage/salary records

---

### 2.5 Route

A reusable pickup-and-drop definition for trip operations.

| Field | Type | Notes |
|---|---|---|
| Name / Code | String | e.g. "TIRWAGANJ–CFL" |
| Pickup Location | String | e.g. "TIRWAGANJ" |
| Drop Location | String | e.g. "CFL" (Creamy Foods Ltd) |
| Company | Reference | Optional — factory this route serves |
| Fixed KM | Number | Optional — for standard/fixed-distance routes |
| Notes | String | Optional |

**Evidence from bill:** All 29 trips in June for UP13DT0632 ran TIRWAGANJ → CFL at 589 km each day.

---

### 2.6 Contract

A time-bounded commercial agreement between a **firm** and the **company (factory)**, defining all billing rules.

| Field | Type | Notes |
|---|---|---|
| Firm | Reference | The billing entity |
| Company | Reference | The factory |
| Name / Description | String | e.g. "NIR–CFL Contract 2024–2026" |
| Effective From | Date | Start of this rate version |
| Effective To | Date | End of this rate version (null = currently active) |
| HSD Rate Per Litre (₹) | Currency | Contractual fuel rate for billing — see OQ-05 |
| KM-to-Rounds Slab Table | Array | Configurable (see Section 5.2) |
| Toll Billable | Boolean | Whether toll is included in the factory bill |
| Notes | String | Optional |

**Key design principle:** When rates change, a new contract version is created with a new `effectiveFrom`. The old version is NOT modified. All finalized historical bills retain a reference to the contract version used at the time of finalization.

---

### 2.7 Contract Capacity Rate

The billing parameters for each vehicle capacity within a contract. This is what allows the billing engine to look up the correct average and hiring rate for any vehicle.

| Field | Type | Notes |
|---|---|---|
| Contract | Reference | Parent contract |
| Capacity | Number | Vehicle capacity in litres (e.g. 29,000) |
| Average (km/L) | Number | Contractual fuel efficiency used in billing |
| Base Hiring Rate Per Round (₹) | Currency | Used to compute hiring charge |

**Confirmed capacity profiles from workbook:**

| Capacity | Average (km/L) | Hiring Rate/Round |
|---|---|---|
| 12,000 | 4.0 | ₹1,400 |
| 23,000 | 3.0 | ₹3,000 |
| 29,000 | 2.5 | ₹4,500 |
| 34,000 | 2.3 | ₹5,000 |

**Gap:** 2–3 additional capacity profiles for the remaining vehicle types are not yet provided. The owner confirms ~6–7 capacity types total.

---

### 2.8 Trip (Daily Operation Record)

A single operational record of one vehicle making one run on one date for one firm.

| Field | Type | Source | Notes |
|---|---|---|---|
| Date | Date | Operator entry | Real date |
| Vehicle | Reference | Operator entry | Required |
| Driver | Reference | Operator entry | Required |
| Route | Reference | Operator entry | Optional — auto-fills from/to |
| From Location | String | Operator entry | e.g. TIRWAGANJ |
| To Location | String | Operator entry | e.g. CFL |
| KM | Number | Operator entry | Must be > 0 |
| Toll Amount (₹) | Currency | Operator entry | Actual toll; may be 0 |
| Notes | String | Operator entry | Optional |
| **Derived (system-calculated):** | | | |
| Average (km/L) | Number | From contract capacity rate | Looked up from vehicle capacity |
| HSD Litres | Number | System | KM / Average |
| HSD Rate (₹/L) | Currency | From contract | Effective rate for trip date |
| HSD Amount (₹) | Currency | System | HSD Litres × HSD Rate |
| Rounds | Number | System | From KM slab lookup |
| Base Hiring Rate (₹) | Currency | From contract capacity rate | Looked up from vehicle capacity |
| Hiring Charge (₹) | Currency | System | Rounds × Base Hiring Rate |
| Trip Total (₹) | Currency | System | HSD Amount + Hiring Charge + Toll |

---

### 2.9 Bill (Monthly Factory Bill)

One bill per vehicle per firm per month. Confirmed by owner.

| Field | Type | Notes |
|---|---|---|
| Bill Number | String | System-generated. Format: `[PREFIX]/[MM]/[YY-YY]/[VEHICLE_NO]` — e.g. NIR/06/26-27/11 |
| Book Number | String | Separate book reference — e.g. "01/2026-2027" (purpose TBD — see remaining questions) |
| Billing Month | Year-Month | e.g. "2026-06" |
| Firm | Reference | Billing vendor |
| Company | Reference | Factory customer |
| Vehicle | Reference | The specific vehicle |
| Status | Enum | Draft → Reviewed → Finalized → Paid / Part-Paid / Outstanding |
| Trips | Array | Trip records included in this bill |
| Calculation Snapshot | Object | Stored at finalization: all rates, averages, slabs used |
| Bill Generate Date | Date | Date bill is issued — e.g. 30/06/2026 |
| Grand Total KM | Number | Sum of trip KMs |
| Grand Total Rounds | Number | Sum of trip rounds |
| Grand Total HSD Litres | Number | Sum of trip HSD litres |
| Grand Total HSD Amount (₹) | Currency | Sum of trip HSD amounts |
| Grand Total Hiring Charge (₹) | Currency | Sum of trip hiring charges |
| Grand Total Toll (₹) | Currency | Sum of trip tolls |
| Grand Total Amount (₹) | Currency | Sum of all trip totals |
| Finalized At | DateTime | Finalization timestamp |
| Notes | String | Optional |

**From the reference bill image — confirmed bill layout:**

| Column | Value (Example Row 1) |
|---|---|
| SL No | 1 |
| Date | 01-Jun |
| From | TIRWAGANJ |
| To | CFL |
| KM | 589 |
| Rounds (By KMS) | 1.5 |
| AVG | 2.5 |
| HSD (LTR) | 235.6 |
| HSD Rate | 95.81 |
| HSD Amount | 22,573 |
| Hiring Charge | 6,750 |
| Toll Amount | 4,680 |
| Total Amount | 34,003 |

**Grand Total Row from reference bill:**

| KM | Rounds | HSD Litres | HSD Amount | Hiring Charge | Toll | Grand Total |
|---|---|---|---|---|---|---|
| 17,081 | 43.5 | 6,832.4 | 654,612 | 195,750 | 135,720 | 986,082 |

**Bill footer (from reference image) includes:**
- Bank Details: Account Name, Account Number, IFSC, Bank Name, Branch
- Authorized Signature line

---

### 2.10 Payment

Money received from the factory against a specific bill.

| Field | Type | Notes |
|---|---|---|
| Bill | Reference | Bill being paid |
| Firm | Reference | Firm receiving payment |
| Amount Received (₹) | Currency | Actual payment |
| Payment Date | Date | When received |
| Payment Mode | String | Cheque / NEFT / RTGS / Cash / Other |
| Reference / Cheque Number | String | Optional |
| Notes | String | Optional |

---

### 2.11 Expense (Actual Company-Side Cost)

Real costs incurred by the business — completely separate from factory billing.

| Field | Type | Notes |
|---|---|---|
| Category | Enum | Fuel / Toll / Maintenance / Loading-Unloading / Driver Wages / Other |
| Vehicle | Reference | Vehicle this expense is attributed to |
| Firm | Reference | Which firm's vehicle |
| Trip | Reference | Optional — linked to a specific trip |
| Date | Date | Expense date |
| Amount (₹) | Currency | Actual cost paid |
| Vendor / Payee | String | Optional |
| Description | String | Narration |
| Attachment URL | String | Receipt scan/photo |
| Notes | String | Optional |

---

### 2.12 Driver Salary Record

Monthly wage tracking per driver.

| Field | Type | Notes |
|---|---|---|
| Driver | Reference | |
| Month | Year-Month | |
| Days Worked | Number | Count of distinct calendar days where the driver had at least one trip |
| Daily Wage Rate (₹) | Currency | Rate applicable for that month |
| Total Wages (₹) | Currency | Days Worked × Daily Wage Rate |
| Advance / Deductions (₹) | Currency | Optional |
| Net Payable (₹) | Currency | Total Wages − Deductions |
| Paid On | Date | Optional |
| Notes | String | Optional |

**Confirmed wage rule:** Days worked = count of distinct calendar days with at least one trip assignment. If a driver does 2 trips on the same day, it counts as 1 working day.

---

### 2.13 Vehicle Document

Compliance/ownership documents with expiry tracking.

| Field | Type | Notes |
|---|---|---|
| Vehicle | Reference | |
| Document Type | Enum | RC / Insurance / Fitness Certificate / Permit / PUC / Other |
| Document Number | String | Optional |
| Issue Date | Date | |
| Expiry Date | Date | Required for alerts |
| File / Attachment URL | String | Optional |
| Notes | String | Optional |

---

## 3. Actors and Users

| Role | V1 Access | Primary Actions |
|---|---|---|
| **Owner / Admin** | Full access | Configure companies, firms, contracts, vehicles, drivers; review operations; generate/finalize bills; track expenses and payments; view all reports and dashboard |
| **Operations Data Entry** | Optional future role — not in V1 | Daily vehicle/route/trip entry only |
| **Driver** | No access in V1 | Continue current paper/WhatsApp process |

---

## 4. Business Workflows

### 4.1 Company / Firm Configuration Workflow

```
Owner opens Company settings →
  Add new company (factory):
    Name, billing name, address, GSTIN
  Add firm(s) under that company:
    Firm name, display name, bill prefix code
    Address, phone
    Bank account details (for bill footer)

Owner registers vehicle under a firm →
  Enter: registration number, vehicle type, capacity
  Select: which firm this vehicle belongs to
  System assigns: sequential vehicle number within that firm
  (Vehicle 11 = 11th vehicle registered under Nirupama Gupta)

Owner links vehicle to contract/rate →
  System looks up: which contract is active for this firm
  System looks up: vehicle's capacity → billing average and hiring rate

Owner creates/updates contract rates →
  New rate version with effective date
  Old version preserved for historical bill reproduction
```

---

### 4.2 Vehicle Workflow

```
Owner registers vehicle on platform →
  Enter: registration number, type, capacity, firm
  System: assigns vehicle number (per-firm sequential)
  System: validates unique registration

Owner updates vehicle status →
  Running / Idle / Under Maintenance / Inactive
  Inactive vehicles excluded from new trip entry dropdowns

Owner adds vehicle documents →
  Document type, issue date, expiry date, optional file
  System: tracks expiry; shows alerts

Owner deactivates vehicle →
  Status = Inactive
  All historical trips and bills remain intact
```

---

### 4.3 Driver Workflow

```
Owner adds driver →
  Name, daily wage rate, status

Owner changes wage rate →
  New rate applies going forward
  Historical salary records retain original rate

Trip entry assigns driver per trip →
  Not permanently tied to a vehicle

Monthly salary calculation →
  System counts distinct days the driver had trip assignments
  Days Worked × Daily Wage Rate = Gross Wages
  Owner records advances/deductions
  Net payable calculated
```

---

### 4.4 Daily Trip Workflow

```
Owner / Operator opens "New Trip" screen →
  Select: date, vehicle (auto-fills: firm, capacity)
  Select: driver
  Select or enter: route / from / to
  Enter: KM (must be positive integer or decimal)
  Enter: toll amount (default 0)

System auto-calculates on entry →
  Looks up: active contract for this vehicle's firm
  Looks up: capacity → average from ContractCapacityRate
  Looks up: HSD rate from contract (effective on trip date)
  Calculates: HSD Litres = KM / Average
  Determines: Rounds from KM slab (see Section 5.2)
  Looks up: capacity → base hiring rate from ContractCapacityRate
  Calculates: Hiring Charge = Rounds × Base Hiring Rate
  Calculates: HSD Amount = HSD Litres × HSD Rate
  Calculates: Trip Total = HSD Amount + Hiring Charge + Toll
  Displays all values for review before save

System validates →
  KM must be > 0
  Vehicle must have an active contract with a rate for its capacity
  Warns if same vehicle already has a trip on this date

Owner saves trip →
  Trip is stored with status: Unfinalized (editable)

Owner edits or corrects trip →
  Allowed as long as trip is not in a Finalized bill
  All derived values recalculate on edit

After bill finalization →
  Trips in the bill are locked
  Editing locked trips requires reopening the bill
```

---

### 4.5 Monthly Billing Workflow

```
Step 1 — Generate Preview (Draft)
  Owner selects: billing month + firm + vehicle
  System collects: all saved trips for that vehicle + firm in that month
  System renders: line-by-line billing preview
    Columns: SL | Date | From | To | KM | Rounds | AVG | HSD Litres | HSD Rate | HSD Amount | Hiring Charge | Toll | Total
    Grand total row: totals for each numeric column
  Status = Draft

Step 2 — Review
  Owner checks each line
  Owner can edit any trip (goes back to Trip Workflow)
  Preview refreshes after corrections
  Status = Reviewed (optional)

Step 3 — Finalize
  Owner clicks Finalize
  System:
    Stores calculation snapshot for each trip line (KM, average, HSD rate, hiring rate, rounds, toll — all at the current values)
    Sets finalization timestamp
    Assigns bill number: [PREFIX]/[MM]/[YY-YY]/[VEHICLE_NO]
    Sets bill generate date
    Locks all trips included in this bill
    Status = Finalized

Step 4 — Generate PDF
  Owner clicks Generate PDF
  System generates PDF matching the reference bill layout:
    Header: Bill No | Book No | Firm name (M/S ...) | Factory name (TO: ...) | Addresses | Vehicle No | Tanker Capacity | Period | Bill Date
    Table: line-by-line trips with all columns
    Grand total row
    Bank details footer
    Authorized signature line

Step 5 — Record Payment
  Factory pays (partial or full)
  Owner records: amount, date, mode, reference
  System updates outstanding balance
  Status: Part-Paid → Paid

Step 6 — Reopen (if correction needed after finalization)
  Owner initiates Reopen
  Must provide reason (stored in audit log)
  Status = Draft (reopen flagged)
  Owner corrects → re-finalizes → generates new PDF
  Original finalization record preserved in audit trail
```

---

### 4.6 Payment Tracking Workflow

```
Owner views outstanding bills →
  Filter: firm, month, status
  See: bill number, grand total, paid, outstanding

Owner records payment →
  Select bill, enter amount received, date, mode, reference
  System updates outstanding = Grand Total − Total Paid

Owner views firm-wise receivables →
  Total billed vs received vs outstanding per firm
  Drill down by month and bill
```

---

### 4.7 Fuel Expense Workflow (Actual Cost)

```
Owner enters fuel purchase from petrol-pump receipt →
  Vehicle, date, vendor/pump name
  Actual litres purchased, actual rate, actual amount paid
  Optional receipt attachment

Monthly view →
  Actual fuel spend vs contractual HSD billed to factory
  Difference = fuel margin
```

---

### 4.8 Toll Expense Workflow

```
Trip-level toll (Factory billing) →
  Entered manually per trip at time of trip entry
  This amount appears on the factory bill

Actual toll expense (Company books) →
  Recorded separately in expense ledger
  Vehicle + month + actual FASTag charges

These two may differ — both are tracked independently.
```

---

### 4.9 Driver Salary Workflow

```
Month end →
  System shows: all trips per driver this month
  Counts: distinct calendar days with at least one trip
  Calculates: Days × Daily Wage Rate = Gross Wages
  Owner enters: advance paid / deductions
  Net payable = Gross − Deductions
  Owner marks: payment date
```

---

### 4.10 Loading / Unloading Contractor Workflow

```
Applies to polypack trucks only.

Owner enters contractor charge →
  Contractor name, vehicle, month, amount
  Category = Loading / Unloading
  Stored as actual company expense

NOTE: Whether this appears on factory bills is UNCONFIRMED (see remaining questions).
```

---

### 4.11 Vehicle Document Workflow

```
Owner adds document →
  Vehicle, document type, issue date, expiry date, optional file

System alerts →
  Documents expiring within 30 days: warning
  Documents already expired: alert
  Dashboard shows count

Owner renews →
  Update expiry or add new record for same document type
```

---

## 5. Billing Business Rules

### 5.1 Confirmed Billing Rules

| Rule ID | Rule | Evidence / Source |
|---|---|---|
| BR-C-01 | HSD Litres = KM / Average (km/L) | Workbook formulas + bill image |
| BR-C-02 | HSD Amount = HSD Litres × HSD Rate | Workbook formulas + bill image |
| BR-C-03 | Hiring Charge = Rounds × Base Hiring Rate | Workbook formulas + bill image |
| BR-C-04 | Trip Total = HSD Amount + Hiring Charge + Toll | Workbook line totals + bill image |
| BR-C-05 | Monthly Bill = SUM of all Trip Totals | Workbook grand totals + bill image |
| BR-C-06 | Average (km/L) is determined by vehicle capacity | Workbook + owner confirmed |
| BR-C-07 | Base Hiring Rate is determined by vehicle capacity | Workbook + owner confirmed |
| BR-C-08 | All firms use the same billing formula | Owner confirmed |
| BR-C-09 | One bill per vehicle per firm per month | Owner confirmed |
| BR-C-10 | Toll is a real billing component — included in trip total | Workbook + bill image |
| BR-C-11 | Finalized historical bills must not change when rates change | Owner + BRD |
| BR-C-12 | Billing rule versions must be stored with each finalized bill | BRD Section 12 + Billing spec |
| BR-C-13 | A trip cannot be billed without: vehicle, date, and KM | Billing spec validation |
| BR-C-14 | Negative KM values must be rejected | Billing spec validation |
| BR-C-15 | A trip missing its rate profile must be flagged, not silently billed at zero | Billing spec validation |
| BR-C-16 | Factory billing amounts and actual company expenses are completely separate | Explicitly stated throughout |
| BR-C-17 | Owner must review a billing preview before finalization | BRD Section 12 |
| BR-C-18 | Editing after finalization requires explicit reopen with audit trail | BRD Section 12 |
| BR-C-19 | Decimal arithmetic (not binary float) must be used for billing | Billing spec Section 9 |
| BR-C-20 | Monetary values stored to paisa precision; displayed to 2 decimal places | Billing spec Section 9 |
| BR-C-21 | HSD litres stored at sufficient precision to reproduce monthly totals | Billing spec Section 9 |
| BR-C-22 | Driver receives 1 day's wage per calendar day regardless of KMs or rounds | Owner confirmed |
| BR-C-23 | If driver makes 2 trips on same day, it counts as 1 day worked | Owner confirmed |

---

### 5.2 KM-to-Rounds Slab Table (CONFIRMED by owner)

| Condition | Rounds | Evidence |
|---|---|---|
| KM < 127 | 0.5 | Owner-confirmed; consistent with workbook (97, 100, 110 km → 0.5) |
| 127 ≤ KM < 500 | 1.0 | Owner-confirmed; consistent with workbook (310, 365, 450 km → 1.0) |
| 500 ≤ KM < 700 | 1.5 | Owner-confirmed; consistent with workbook (589, 652 km → 1.5) |
| KM ≥ 700 | 2.0 | Owner-confirmed; no workbook example available |

> **Design requirement:** This slab table must be configurable per contract in the admin UI. The owner should be able to change boundaries without a developer. These are the current values; they may change in future contracts.

**Lookup logic (unambiguous — no overlaps):**
```
if km < 127:   rounds = 0.5
elif km < 500: rounds = 1.0
elif km < 700: rounds = 1.5
else:          rounds = 2.0
```

---

### 5.3 Confirmed Capacity → Rate Mapping (Partial)

The following is confirmed from the reference workbook. The complete table for all 6–7 capacity types must be provided by the owner before seeding master data.

| Capacity (litres) | Average (km/L) | Hiring Rate/Round (₹) |
|---|---|---|
| 12,000 | 4.0 | 1,400 |
| 23,000 | 3.0 | 3,000 |
| 29,000 | 2.5 | 4,500 |
| 34,000 | 2.3 | 5,000 |
| _Unknown_ | — | — |
| _Unknown_ | — | — |

> **Gap:** 2–3 additional capacity profiles are missing. The system design supports any number of capacity entries — they are configurable, not hard-coded.

---

### 5.4 Bill Numbering (CONFIRMED by owner)

Format: **`[FIRM_PREFIX]/[MM]/[FY]/[VEHICLE_NUMBER]`**

| Part | Meaning | Example |
|---|---|---|
| FIRM_PREFIX | Firm's short code | NIR (= Nirupama Gupta) |
| MM | 2-digit billing month | 06 (= June) |
| FY | Financial year (YY-YY) | 26-27 (= FY 2026–27) |
| VEHICLE_NUMBER | Vehicle's assigned number within this firm | 11 |

**Examples from reference bills:**
- `NIR/06/26-27/11` — Vehicle 11 under NIR, June 2026–27
- `NIR/06/26-27/12` — Vehicle 12 under NIR, June 2026–27
- `NIR/05/26-27/13` — Vehicle 13 under NIR, **May** 2026–27 (note month 05)

> **Vehicle number** is a stable identifier assigned when registering a vehicle under a firm. It does **not** increment with each new bill. It is part of the vehicle's master record.

**Separate from bill number:** The bill image also shows a **Book Number** (`01/2026-2027`). The purpose of this is not yet confirmed — it may be an internal register number separate from the vehicle bill number.

---

### 5.5 Configuration Model — What Must Be Configurable (Not Hard-coded)

1. ✅ KM-to-Rounds slab table (boundaries and round values) — per contract
2. ✅ Capacity → Average (km/L) mapping — per contract
3. ✅ Capacity → Base Hiring Rate — per contract
4. ✅ HSD Rate per litre — per contract (with effective date)
5. ✅ Whether toll is billable — per contract
6. ✅ Contract effective dates and rate versions
7. ✅ Bill number prefix — per firm
8. ✅ Vehicle number within firm — per vehicle
9. ✅ Company and firm details — admin UI, no code change

---

## 6. Expense Model

### 6.1 Factory Billing Side (Contractual — What Gets Billed to the Factory)

| Component | Calculation | Included? |
|---|---|---|
| HSD / Fuel | KM / Average × HSD Rate | Always |
| Hiring Charge | Rounds × Base Hiring Rate | Always |
| Toll | Actual toll entered per trip | Yes (when contract says billable) |
| Maintenance | Not included | Never (unless contract explicitly states — not current case) |
| Driver wages | Not included | Never |
| Loading / Unloading | Unknown | Pending confirmation |

### 6.2 Actual Company Expense Side (Internal Books)

| Category | Description |
|---|---|
| Fuel | Actual petrol-pump purchase — litres, actual rate, actual amount |
| Toll | Actual FASTag/toll charges per vehicle per month |
| Maintenance | Repair, service, parts — by vehicle and date |
| Loading / Unloading | Polypack contractor monthly charges |
| Driver Wages | Monthly: days worked × daily wage rate |
| Other | Parking, permit fees, miscellaneous |

### 6.3 Contribution / Margin View

```
Revenue   = Total billed to factory (finalized bills for the period)
Expenses  = Sum of actual company expenses for the same period
Margin    = Revenue − Expenses
```

This is available per vehicle, per firm, and per month.

---

## 7. Reporting Requirements

### Must-have Reports

| Report | Dimensions | Key Data |
|---|---|---|
| RPT-01: Vehicle-wise Revenue, Expense, Contribution | Vehicle, Month | Billed, actual costs, margin |
| RPT-02: Firm-wise Monthly Billing and Payment | Firm, Month | Total billed, received, outstanding |
| RPT-03: Monthly Expense Summary by Category | Month, Category | Total per expense category |
| RPT-04: Bill Register | Month, Firm, Status | Bill number, status, total, paid, outstanding |
| RPT-05: Firm-wise Receivables and Payment History | Firm | All bills, payments, outstanding |

### Should-have Reports

| Report | Dimensions | Key Data |
|---|---|---|
| RPT-06: Trip Count and KM Report | Vehicle, Firm, Month | Trip count, total KM |
| RPT-07: Fuel Expense vs Contractual HSD | Vehicle, Month | Actual fuel spend vs billed HSD |
| RPT-08: Toll Expense by Vehicle and Month | Vehicle, Month | Actual toll paid vs billed toll |
| RPT-09: Maintenance / Repair History | Vehicle, Date range | Cost, vendor, type |
| RPT-10: Vehicle Document Expiry Report | Vehicle, Document type | Days to expiry, expired flag |
| RPT-11: Driver Wage Summary | Driver, Month | Days worked, gross, deductions, net paid |

---

## 8. Dashboard Requirements

The owner must be able to answer these questions from the dashboard without opening a separate report:

1. **How much was billed this month?** — By firm, by vehicle
2. **How much was received?** — Total payments received
3. **What is outstanding?** — Per firm and overall
4. **What did we spend?** — Actual expenses by category
5. **Which vehicles generated revenue?** — Vehicle-wise summary
6. **What needs attention?** — Expiring documents, trips with missing rate profiles, long-unpaid bills

### Dashboard Panels

| Panel | Data Shown |
|---|---|
| Monthly Summary | Total billed / received / outstanding (current month) |
| Fleet Status | Active / idle / maintenance / inactive vehicle count |
| Document Expiry Alerts | Expiring ≤30 days + already expired count |
| Outstanding Bills | Oldest unpaid/part-paid bills |
| Recent Trips | Last 5–10 trips entered |
| Expense Overview | Expense totals by category (current month) |

---

## 9. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Usability | Simple owner-first interface; usable without software expertise |
| Search | Searchable by month, vehicle, firm, bill number, route |
| Auditability | Created/updated timestamps and user on all changes |
| Data integrity | Backup/restore; protection against accidental deletion |
| Security | JWT authentication; appropriate access control |
| PDF output | Layout matching reference bill; printable/shareable |
| Performance | Fast trip entry; fast monthly billing preview |
| Calculation | Decimal arithmetic; all formula inputs visible on preview |
| Import | Controlled Excel/CSV import for initial master data load |
| Extensibility | New companies, firms, capacity types added via configuration |

---

## 10. Confirmed Requirements

### Master Data

- [MUST] VEH-01: Register vehicles with registration, type, capacity, firm, vehicle number, status
- [MUST] VEH-02: Link vehicle to contract/billing profile via capacity
- [MUST] VEH-03: Track vehicle status (Running / Idle / Maintenance / Inactive)
- [MUST] DRV-01: Maintain driver profile and daily wage rate
- [MUST] DRV-02: Assign driver to trips, not permanently to a vehicle
- [MUST] FIR-01: Maintain company (factory) records
- [MUST] FIR-02: Maintain firm (billing vendor) records with bank details and bill prefix
- [MUST] FIR-03: Maintain route reference data (pickup/drop locations)
- [MUST] CON-01: Store contract with billing rules per firm (KM slabs, HSD rate, toll billability)
- [MUST] CON-02: Store per-capacity rates (average, hiring rate) within each contract
- [MUST] CON-03: Support effective dates — rate changes create new contract versions; old versions preserved

### Operations

- [MUST] TRP-01: Create daily trips with date, vehicle, driver, from, to, KM, toll
- [MUST] TRP-02: Auto-calculate rounds, HSD, hiring, trip total from configured rules
- [SHOULD] TRP-03: Warn (not block) on duplicate vehicle/date trips

### Billing

- [MUST] BIL-01: HSD Litres = KM / average (from contract capacity rate)
- [MUST] BIL-02: HSD Amount = HSD Litres × HSD Rate (from contract)
- [MUST] BIL-03: Rounds determined by KM slab table (from contract)
- [MUST] BIL-04: Hiring = Rounds × Base Hiring Rate (from contract capacity rate)
- [MUST] BIL-05: Toll included in trip total when contract says billable
- [MUST] BIL-06: Trip Total = HSD Amount + Hiring + Toll
- [MUST] BIL-07: Generate firm/vehicle/month billing preview before finalization
- [MUST] BIL-08: Generate PDF bill matching reference bill layout
- [MUST] BIL-09: Finalize bill — lock trips, store calculation snapshot, assign bill number
- [MUST] BIL-10: Finalized bills cannot be silently changed; explicit reopen with audit required

### Expenses

- [MUST] EXP-01: Record actual fuel expense from petrol-pump receipts
- [MUST] EXP-02: Record actual toll expense by vehicle and month
- [MUST] EXP-03: Record maintenance/repair costs by vehicle
- [MUST] EXP-04: Record polypack loading/unloading contractor charges
- [SHOULD] EXP-05: Generic other expense category with optional file attachment

### Driver Salary

- [SHOULD] SAL-01: Track monthly driver wages from trip assignments (days worked × daily rate)

### Payments

- [MUST] PAY-01: Record factory payments against bills
- [MUST] PAY-02: Show outstanding amount per bill and per firm

### Documents

- [MUST] DOC-01: Store RC, insurance, permit, fitness, PUC documents with issue and expiry dates
- [SHOULD] DOC-02: Alert on upcoming/expired documents

### Reporting

- [MUST] RPT-01 through RPT-05 (see Section 7)
- [SHOULD] RPT-06 through RPT-11

### Audit

- [MUST] AUD-01: Timestamps and user identity on all important changes
- [MUST] AUD-02: Preserve finalized bill calculation inputs

---

## 11. Assumptions

| ID | Assumption | Basis |
|---|---|---|
| A-01 | KM boundary for slab is inclusive on the lower end: KM = 127 → rounds = 1.0 (not 0.5) | Derived from owner's statement "less than 127 → 0.5" |
| A-02 | KM = 500 exactly → rounds = 1.5 (500 ≤ KM < 700) | Derived from owner's statement |
| A-03 | KM = 700 exactly → rounds = 2.0 | Derived from owner's statement |
| A-04 | ~~HSD rate scope unknown~~ → **CONFIRMED: HSD rate is a single global rate that changes as per global fuel rates. It is not per-firm or per-contract.** | Owner confirmed 19 Sep 2026 |
| A-05 | The "Book Number" on the bill (01/2026-2027) is a separate sequential register number, per firm per FY | Observed on reference bill; purpose not confirmed |
| A-06 | Toll entered per trip equals the factory-billed toll amount (no adjustment needed) | Workbook uses per-trip toll in total calculation |
| A-07 | Maintenance costs are never on the factory bill (internal only) | BRD states "normally internal" |
| A-08 | Vehicle number (e.g. 11) is a stable, manually-assigned identifier per firm — not auto-generated | Derived from bill numbering; may be assigned when registering vehicle |
| A-09 | The bill generate date is the last day of the billing month | Reference bill: Period = June 2026, Date = 30/06/2026 |
| A-10 | All 4 current firms bill using the same formula (confirmed by owner) | Owner confirmed |

---

## 12. Ambiguous / Partially Confirmed Requirements

| ID | Area | Ambiguity | Status |
|---|---|---|---|
| AMB-01 | HSD Rate scope | ~~Is HSD rate global or per-contract?~~ | ✅ **RESOLVED** — Global rate; changes with global fuel prices |
| AMB-02 | Toll billability | ~~Is toll always billable?~~ | ✅ **RESOLVED** — Toll is always billed for all 4 firms, whenever toll is incurred |
| AMB-03 | Loading/unloading on factory bill | Does any firm currently include loading/unloading charges on the factory bill? If yes, how is it calculated? | ⚠️ **OPEN** — Owner must confirm |
| AMB-04 | Rounding point | ~~Where does rounding happen?~~ | ✅ **RESOLVED** — Rounding happens per trip row (each trip line is rounded individually) |
| AMB-05 | Book number purpose | The reference bill shows "Book No: 01/2026-2027" separate from the Bill Number. Is this a physical register book number? Auto-generated? | ⚠️ **OPEN** — Needs clarification before PDF generation |
| AMB-06 | Bill reopen numbering | When a finalized bill is reopened and re-finalized, does the bill number stay the same? | ⚠️ **OPEN** — Not yet defined |
| AMB-07 | Complete capacity list | Only 4 of 6–7 capacity profiles are known. The remaining 2–3 are needed before seeding. | ⚠️ **DEFERRED** — Owner says to seed placeholder values and update later |
| AMB-08 | GST on factory bills | Are factory bills subject to GST? If yes, at what rate and is it shown separately? | ⚠️ **OPEN** — Not mentioned in any document |

---

## 13. Remaining Open Questions

### Reduced list after owner's 19 Sep 2026 confirmations

| Q# | Question | Priority |
|---|---|---|
| Q-05 | **What is the "Book Number"** on the bill (01/2026-2027)? Physical register? Auto-generated? | Medium — blocks PDF generation |
| Q-06 | **Are factory bills subject to GST?** If yes, rate and display format? | Medium — blocks PDF generation |
| Q-07 | **Can you provide a second reference bill from a different firm** to verify the format is consistent? | Low — useful for validation |
| Q-08 | **Does any firm include loading/unloading charges on the factory bill?** | Medium — blocks expense module |
| Q-09 | When a finalized bill is reopened and re-finalized, does the bill number stay the same? | Low — can be deferred |
| Q-10 | What happens if a vehicle moves from one firm to another — does it get a new vehicle number? | Low — can be deferred |

---

## Summary — Status of All Original Open Questions

| Original ID | Question | Status |
|---|---|---|
| OQ-01 | Firm structure and legal entities | ✅ **RESOLVED** — Creamy Foods Ltd is the factory; Neeraj Kumar Gupta, Sweeti Gupta, Nirupama Gupta, Azad Road Line are the billing firms |
| OQ-02 | Complete average table | ✅ **RESOLVED** — 4 confirmed capacities; remaining to be seeded with placeholders and updated later |
| OQ-03 | Hiring rate dimension | ✅ **RESOLVED** — Determined by vehicle capacity (configurable per contract) |
| OQ-04 | KM slab boundaries | ✅ **RESOLVED** — <127=0.5, 127–499=1.0, 500–699=1.5, ≥700=2.0 |
| OQ-05 | HSD rate scope | ✅ **RESOLVED** — Single global rate; changes with global fuel prices |
| OQ-06 | Toll source / entry method | ✅ **RESOLVED** — Entered manually per trip; toll always billable for all 4 firms |
| OQ-07 | Bill granularity | ✅ **RESOLVED** — One bill per vehicle per firm per month |
| OQ-08 | Contract changes / effective dates | ✅ **RESOLVED** — New contract version created; effective dates mandatory |
| OQ-09 | Loading/unloading on factory bill | ⚠️ **OPEN** — Internal expense confirmed; factory billability not confirmed |
| OQ-10 | Driver wage counting | ✅ **RESOLVED** — 1 calendar day = 1 day's wage; 2 trips same day = still 1 day |
