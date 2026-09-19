# Technical Architecture
## Fleet & Transport Operations, Expense and Billing Platform

**Based on:** `docs/requirements-analysis.md` (approved with all critical billing questions resolved)
**Date:** September 2026

---

## Table of Contents

1. [Overall System Architecture](#1-overall-system-architecture)
2. [Backend Architecture](#2-backend-architecture)
3. [Frontend Architecture](#3-frontend-architecture)
4. [MongoDB Data Architecture](#4-mongodb-data-architecture)
5. [Authentication Architecture](#5-authentication-architecture)
6. [File / Document Storage Architecture](#6-file--document-storage-architecture)
7. [PDF Invoice Generation Architecture](#7-pdf-invoice-generation-architecture)
8. [Billing Engine Architecture](#8-billing-engine-architecture)
9. [Validation Architecture](#9-validation-architecture)
10. [Error Handling Architecture](#10-error-handling-architecture)
11. [Logging Architecture](#11-logging-architecture)
12. [Audit / History Architecture](#12-audit--history-architecture)
13. [Configuration Architecture](#13-configuration-architecture)
14. [Environment Configuration](#14-environment-configuration)
15. [Development Environment](#15-development-environment)
16. [Production Environment](#16-production-environment)
17. [Communication Flow](#17-communication-flow)

---

## 1. Overall System Architecture

### Architecture style: Modular Monolith

A single backend process serving REST APIs, with a separate frontend SPA. The backend is internally organized into well-defined domain modules, but deployed as a single application. No microservices, no message queues, no Redis.

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT BROWSER                             │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                     FRONTEND (React SPA)                      │  │
│  │  Vite + TypeScript + Tailwind CSS                             │  │
│  │  Served as static files                                       │  │
│  └─────────────────────────┬─────────────────────────────────────┘  │
│                            │ HTTP/REST (JSON)                       │
│                            │ JWT in HTTP-only cookie                │
└────────────────────────────┼────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     BACKEND (Node.js + Express)                     │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │   Auth   │  │  Master  │  │  Trips   │  │ Billing  │           │
│  │  Module  │  │  Data    │  │  Module  │  │  Engine  │           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Expenses │  │ Payments │  │ Reports  │  │   PDF    │           │
│  │  Module  │  │  Module  │  │  Module  │  │ Generator│           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
│                                                                     │
│  Shared: Middleware │ Validators │ Utils │ Config │ Logger          │
│                                                                     │
│                            │                                        │
│                            │ Mongoose ODM                           │
│                            ▼                                        │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                        MongoDB                                │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                   Local File Storage                           │  │
│  │              /uploads (documents, receipts)                    │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Why modular monolith?

| Decision | Rationale |
|---|---|
| Single process | ~1 user, ~50 vehicles, simple deployment, no scale concern |
| Internal modules | Clear domain boundaries (billing ≠ expenses ≠ payments) enable future extraction if ever needed |
| No Redis/Kafka | No caching tier or async processing needed; direct DB reads and synchronous billing |
| MongoDB | Document-oriented model suits the nested bill/trip structure; owner requirement for simple deployment |
| Separate frontend | React SPA communicates via REST; can be hosted independently or served by Express as static files |

---

## 2. Backend Architecture

### Directory structure

```
backend/
├── src/
│   ├── config/                    # Application configuration
│   │   ├── index.ts               # Central config loader (env vars → typed config)
│   │   ├── database.ts            # MongoDB connection setup
│   │   └── constants.ts           # Application-wide constants
│   │
│   ├── modules/                   # Domain modules (the core of the monolith)
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.validator.ts
│   │   │
│   │   ├── company/
│   │   │   ├── company.model.ts
│   │   │   ├── company.routes.ts
│   │   │   ├── company.controller.ts
│   │   │   ├── company.service.ts
│   │   │   └── company.validator.ts
│   │   │
│   │   ├── firm/
│   │   │   ├── firm.model.ts
│   │   │   ├── firm.routes.ts
│   │   │   ├── firm.controller.ts
│   │   │   ├── firm.service.ts
│   │   │   └── firm.validator.ts
│   │   │
│   │   ├── vehicle/
│   │   │   ├── vehicle.model.ts
│   │   │   ├── vehicle.routes.ts
│   │   │   ├── vehicle.controller.ts
│   │   │   ├── vehicle.service.ts
│   │   │   └── vehicle.validator.ts
│   │   │
│   │   ├── driver/
│   │   │   ├── driver.model.ts
│   │   │   ├── driver.routes.ts
│   │   │   ├── driver.controller.ts
│   │   │   ├── driver.service.ts
│   │   │   └── driver.validator.ts
│   │   │
│   │   ├── route/
│   │   │   ├── route.model.ts
│   │   │   ├── route.routes.ts
│   │   │   ├── route.controller.ts
│   │   │   ├── route.service.ts
│   │   │   └── route.validator.ts
│   │   │
│   │   ├── contract/
│   │   │   ├── contract.model.ts          # Contract + embedded capacity rates
│   │   │   ├── contract.routes.ts
│   │   │   ├── contract.controller.ts
│   │   │   ├── contract.service.ts
│   │   │   └── contract.validator.ts
│   │   │
│   │   ├── hsd-rate/
│   │   │   ├── hsd-rate.model.ts          # Global HSD rate with effective dates
│   │   │   ├── hsd-rate.routes.ts
│   │   │   ├── hsd-rate.controller.ts
│   │   │   ├── hsd-rate.service.ts
│   │   │   └── hsd-rate.validator.ts
│   │   │
│   │   ├── trip/
│   │   │   ├── trip.model.ts
│   │   │   ├── trip.routes.ts
│   │   │   ├── trip.controller.ts
│   │   │   ├── trip.service.ts
│   │   │   └── trip.validator.ts
│   │   │
│   │   ├── billing/
│   │   │   ├── bill.model.ts
│   │   │   ├── billing.routes.ts
│   │   │   ├── billing.controller.ts
│   │   │   ├── billing.service.ts         # Bill preview, finalization, reopen
│   │   │   ├── billing-engine.ts          # Pure calculation functions (HSD, hiring, rounds)
│   │   │   ├── billing.validator.ts
│   │   │   └── pdf-generator.ts           # PDF bill generation
│   │   │
│   │   ├── expense/
│   │   │   ├── expense.model.ts
│   │   │   ├── expense.routes.ts
│   │   │   ├── expense.controller.ts
│   │   │   ├── expense.service.ts
│   │   │   └── expense.validator.ts
│   │   │
│   │   ├── payment/
│   │   │   ├── payment.model.ts
│   │   │   ├── payment.routes.ts
│   │   │   ├── payment.controller.ts
│   │   │   ├── payment.service.ts
│   │   │   └── payment.validator.ts
│   │   │
│   │   ├── document/
│   │   │   ├── vehicle-document.model.ts
│   │   │   ├── document.routes.ts
│   │   │   ├── document.controller.ts
│   │   │   ├── document.service.ts
│   │   │   └── document.validator.ts
│   │   │
│   │   ├── salary/
│   │   │   ├── salary.model.ts
│   │   │   ├── salary.routes.ts
│   │   │   ├── salary.controller.ts
│   │   │   ├── salary.service.ts
│   │   │   └── salary.validator.ts
│   │   │
│   │   └── report/
│   │       ├── report.routes.ts
│   │       ├── report.controller.ts
│   │       └── report.service.ts          # Aggregation queries for reports
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts             # JWT verification
│   │   ├── error-handler.middleware.ts    # Global error handler
│   │   ├── request-logger.middleware.ts   # HTTP request logging
│   │   ├── validate.middleware.ts         # Zod validation middleware
│   │   └── upload.middleware.ts           # Multer file upload
│   │
│   ├── shared/
│   │   ├── types/                         # Shared TypeScript types
│   │   │   ├── index.ts
│   │   │   └── api.types.ts              # API response envelope types
│   │   ├── errors/
│   │   │   └── app-error.ts              # Custom error classes
│   │   ├── utils/
│   │   │   ├── decimal.ts                # Decimal arithmetic utilities (for billing)
│   │   │   ├── date.ts                   # Date and financial year helpers
│   │   │   └── pagination.ts             # Pagination helpers
│   │   └── logger.ts                     # Structured logger (Winston or Pino)
│   │
│   ├── app.ts                            # Express app setup (middleware, routes)
│   └── server.ts                         # Server entry point (listen)
│
├── tests/
│   ├── unit/
│   │   ├── billing-engine.test.ts        # Billing formula tests
│   │   └── ...
│   ├── integration/
│   │   └── ...
│   └── fixtures/                         # Reference bill data for regression tests
│
├── uploads/                              # Document/receipt file storage (gitignored)
├── package.json
├── tsconfig.json
├── .env.example
└── .eslintrc.js
```

### Module responsibility map

| Module | Responsibility | Contains Business Logic? |
|---|---|---|
| `auth` | Login, logout, session management | No — thin auth layer |
| `company` | Factory/customer CRUD | No — simple CRUD |
| `firm` | Billing firm CRUD (with bank details) | No — simple CRUD |
| `vehicle` | Vehicle registration, status, firm assignment | No — simple CRUD |
| `driver` | Driver profile, wage rate management | No — simple CRUD |
| `route` | Route master data | No — simple CRUD |
| `contract` | Contract versions, capacity rates, KM slab configuration | Moderate — rate versioning logic |
| `hsd-rate` | Global HSD rate with effective dates | Moderate — effective-date lookup |
| `trip` | Daily trip entry, auto-calculation, duplicate warnings | **Yes** — calls billing engine for calculation |
| `billing` | Bill preview, finalization, reopen, PDF | **Yes** — the core billing engine |
| `expense` | Actual company expense CRUD | No — simple CRUD |
| `payment` | Payment recording, outstanding tracking | Moderate — balance calculation |
| `document` | Vehicle document CRUD, expiry alerts | No — simple CRUD with date queries |
| `salary` | Monthly driver wage calculation | Moderate — day counting logic |
| `report` | Aggregation queries across modules | No — read-only queries |

### Key design rules

1. **Controllers are thin.** They parse requests, call services, format responses. Zero business logic.
2. **Services contain business logic.** They orchestrate between models, call the billing engine, enforce rules.
3. **The billing engine is a pure function module.** `billing-engine.ts` contains only pure calculation functions — no database access, no side effects. It takes inputs (KM, average, HSD rate, hiring rate, slab table) and returns computed results. This makes it testable in isolation.
4. **Models define schema only.** No business logic in Mongoose models — just schema, indexes, and basic virtuals.
5. **Validators define the API contract.** Every request is validated by Zod before reaching the controller.

---

## 3. Frontend Architecture

### Directory structure

```
frontend/
├── src/
│   ├── api/                          # API client layer
│   │   ├── client.ts                 # Axios instance with interceptors
│   │   ├── auth.api.ts
│   │   ├── company.api.ts
│   │   ├── firm.api.ts
│   │   ├── vehicle.api.ts
│   │   ├── driver.api.ts
│   │   ├── route.api.ts
│   │   ├── contract.api.ts
│   │   ├── hsd-rate.api.ts
│   │   ├── trip.api.ts
│   │   ├── billing.api.ts
│   │   ├── expense.api.ts
│   │   ├── payment.api.ts
│   │   ├── document.api.ts
│   │   ├── salary.api.ts
│   │   └── report.api.ts
│   │
│   ├── components/                   # Reusable UI components
│   │   ├── ui/                       # Design system primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Alert.tsx
│   │   │   ├── Spinner.tsx
│   │   │   ├── Pagination.tsx
│   │   │   └── ...
│   │   ├── layout/                   # Layout components
│   │   │   ├── AppLayout.tsx         # Sidebar + header + content area
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   └── shared/                   # Domain-specific shared components
│   │       ├── VehicleSelect.tsx
│   │       ├── FirmSelect.tsx
│   │       ├── DriverSelect.tsx
│   │       ├── MonthPicker.tsx
│   │       └── CurrencyDisplay.tsx
│   │
│   ├── pages/                        # Route-level page components
│   │   ├── auth/
│   │   │   └── LoginPage.tsx
│   │   ├── dashboard/
│   │   │   └── DashboardPage.tsx
│   │   ├── vehicles/
│   │   │   ├── VehicleListPage.tsx
│   │   │   └── VehicleFormPage.tsx
│   │   ├── drivers/
│   │   │   ├── DriverListPage.tsx
│   │   │   └── DriverFormPage.tsx
│   │   ├── firms/
│   │   │   ├── FirmListPage.tsx
│   │   │   └── FirmFormPage.tsx
│   │   ├── companies/
│   │   │   ├── CompanyListPage.tsx
│   │   │   └── CompanyFormPage.tsx
│   │   ├── routes/
│   │   │   ├── RouteListPage.tsx
│   │   │   └── RouteFormPage.tsx
│   │   ├── contracts/
│   │   │   ├── ContractListPage.tsx
│   │   │   └── ContractFormPage.tsx   # Includes capacity rates + KM slab config
│   │   ├── hsd-rates/
│   │   │   └── HsdRatePage.tsx        # Global HSD rate management
│   │   ├── trips/
│   │   │   ├── TripListPage.tsx
│   │   │   └── TripFormPage.tsx       # Shows live billing preview on entry
│   │   ├── billing/
│   │   │   ├── BillListPage.tsx
│   │   │   ├── BillPreviewPage.tsx    # Full line-by-line preview
│   │   │   └── BillPdfPage.tsx        # PDF download/print view
│   │   ├── expenses/
│   │   │   ├── ExpenseListPage.tsx
│   │   │   └── ExpenseFormPage.tsx
│   │   ├── payments/
│   │   │   ├── PaymentListPage.tsx
│   │   │   └── PaymentFormPage.tsx
│   │   ├── documents/
│   │   │   ├── DocumentListPage.tsx
│   │   │   └── DocumentFormPage.tsx
│   │   ├── salary/
│   │   │   └── SalaryPage.tsx
│   │   ├── reports/
│   │   │   └── ReportsPage.tsx
│   │   └── settings/
│   │       └── SettingsPage.tsx       # Company, firm, and billing config
│   │
│   ├── hooks/                        # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useApi.ts                 # Generic API call hook with loading/error state
│   │   └── useDebounce.ts
│   │
│   ├── context/                      # React context providers
│   │   └── AuthContext.tsx
│   │
│   ├── types/                        # TypeScript types (mirroring backend)
│   │   ├── index.ts
│   │   ├── vehicle.types.ts
│   │   ├── trip.types.ts
│   │   ├── billing.types.ts
│   │   └── ...
│   │
│   ├── utils/                        # Frontend utilities
│   │   ├── format.ts                 # Currency, date, number formatting
│   │   └── constants.ts
│   │
│   ├── router.tsx                    # React Router configuration
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css                     # Tailwind base + custom styles
│
├── public/
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── .eslintrc.js
```

### Key frontend design rules

1. **Pages are smart; components are dumb.** Pages fetch data and manage state. UI components receive props and render.
2. **No business logic in React components.** All calculations (billing preview) happen on the backend. The frontend displays results returned by the API.
3. **API layer is a single abstraction.** All HTTP calls go through `api/client.ts` (Axios instance). Individual `*.api.ts` files define typed request/response contracts.
4. **Forms use controlled components** with local state + Zod for client-side validation (same schemas shared via types).
5. **Tailwind CSS** for all styling. No CSS-in-JS, no separate CSS files per component.

### Routing structure

```
/login                                → LoginPage
/dashboard                            → DashboardPage
/vehicles                             → VehicleListPage
/vehicles/new                         → VehicleFormPage (create)
/vehicles/:id/edit                    → VehicleFormPage (edit)
/drivers                              → DriverListPage
/drivers/new                          → DriverFormPage
/drivers/:id/edit                     → DriverFormPage
/companies                            → CompanyListPage
/companies/new                        → CompanyFormPage
/firms                                → FirmListPage
/firms/new                            → FirmFormPage
/firms/:id/edit                       → FirmFormPage
/routes                               → RouteListPage
/routes/new                           → RouteFormPage
/contracts                            → ContractListPage
/contracts/new                        → ContractFormPage
/contracts/:id/edit                   → ContractFormPage
/hsd-rates                            → HsdRatePage
/trips                                → TripListPage
/trips/new                            → TripFormPage
/trips/:id/edit                       → TripFormPage
/billing                              → BillListPage
/billing/preview?firm=X&month=Y&vehicle=Z → BillPreviewPage
/billing/:id                          → BillPdfPage
/expenses                             → ExpenseListPage
/expenses/new                         → ExpenseFormPage
/payments                             → PaymentListPage
/payments/new                         → PaymentFormPage
/documents                            → DocumentListPage
/salary                               → SalaryPage
/reports                              → ReportsPage
/settings                             → SettingsPage
```

---

## 4. MongoDB Data Architecture

### Design principles

1. **Embed when data is read together and owned by the parent.** Example: capacity rates are embedded in the contract document because they are always read and versioned with the contract.
2. **Reference when data is shared across entities.** Example: a trip references vehicle, driver, and firm by ObjectId.
3. **Snapshot on finalization.** When a bill is finalized, the effective rates, averages, and slabs are copied into the bill document. This guarantees historical reproducibility even if the contract is later modified.
4. **Decimal128 for money.** All monetary values and precise decimals (HSD litres) use Mongoose Decimal128 to avoid floating-point errors.

### Collections overview

```
┌──────────────────────────────────────────────────────────────────┐
│ users                    │ Auth credentials                      │
│ companies                │ Factories (Creamy Foods Ltd)          │
│ firms                    │ Billing vendors (Nirupama Gupta etc.) │
│ vehicles                 │ Fleet vehicles                        │
│ drivers                  │ Driver profiles                       │
│ routes                   │ Pickup/drop definitions               │
│ contracts                │ Billing rules + embedded capacity     │
│                          │ rates + KM slab config                │
│ hsd_rates                │ Global HSD rate with effective dates  │
│ trips                    │ Daily operation records                │
│ bills                    │ Monthly firm/vehicle invoices          │
│ payments                 │ Payments received against bills       │
│ expenses                 │ Actual company-side costs             │
│ salary_records           │ Monthly driver wage records           │
│ vehicle_documents        │ Compliance documents with expiry      │
│ audit_logs               │ Change history for important actions  │
└──────────────────────────────────────────────────────────────────┘
```

### Schema designs

#### `users`
```typescript
{
  _id: ObjectId,
  email: string,                    // unique
  passwordHash: string,
  name: string,
  role: 'admin' | 'operator',      // operator = future data-entry role
  isActive: boolean,
  createdAt: Date,
  updatedAt: Date
}
// Indexes: { email: 1 } unique
```

#### `companies`
```typescript
{
  _id: ObjectId,
  name: string,                     // "Creamy Foods Ltd"
  legalName: string,                // Full legal name for bill header
  address: string,
  gstin: string | null,
  isActive: boolean,
  createdAt: Date,
  updatedAt: Date
}
```

#### `firms`
```typescript
{
  _id: ObjectId,
  company: ObjectId,                // → companies
  name: string,                     // "Nirupama Gupta"
  displayName: string,              // "M/S Nirupama Gupta"
  billPrefix: string,               // "NIR" — unique per company
  address: string,
  phone: string | null,
  bankDetails: {
    accountName: string,
    accountNumber: string,
    ifscCode: string,
    bankName: string,
    branchName: string
  },
  isActive: boolean,
  createdAt: Date,
  updatedAt: Date
}
// Indexes: { company: 1, billPrefix: 1 } unique
```

#### `vehicles`
```typescript
{
  _id: ObjectId,
  registrationNumber: string,       // unique — "UP13DT0632"
  vehicleType: 'truck' | 'polypack_truck' | 'milk_tanker' | 'other',
  capacity: number,                 // 29000 (litres)
  firm: ObjectId,                   // → firms
  vehicleNumber: number,            // 11 (sequential per firm, used in bill numbering)
  status: 'running' | 'idle' | 'under_maintenance' | 'inactive',
  notes: string | null,
  createdAt: Date,
  updatedAt: Date
}
// Indexes: { registrationNumber: 1 } unique
//          { firm: 1, vehicleNumber: 1 } unique
//          { firm: 1, status: 1 }
```

#### `drivers`
```typescript
{
  _id: ObjectId,
  name: string,
  phone: string | null,
  licenseNumber: string | null,
  dailyWageRate: Decimal128,        // ₹ per day
  status: 'active' | 'inactive',
  notes: string | null,
  createdAt: Date,
  updatedAt: Date
}
```

#### `routes`
```typescript
{
  _id: ObjectId,
  name: string,                     // "TIRWAGANJ–CFL"
  pickupLocation: string,           // "TIRWAGANJ"
  dropLocation: string,             // "CFL"
  company: ObjectId | null,         // → companies (optional)
  fixedKm: number | null,           // Fixed KM for standard routes
  isActive: boolean,
  notes: string | null,
  createdAt: Date,
  updatedAt: Date
}
```

#### `contracts`
```typescript
{
  _id: ObjectId,
  firm: ObjectId,                   // → firms
  company: ObjectId,                // → companies
  name: string,                     // "NIR–CFL Contract 2024–2026"
  effectiveFrom: Date,
  effectiveTo: Date | null,         // null = currently active
  
  // KM slab configuration — configurable, not hard-coded
  kmSlabs: [
    { upToKm: 127,   rounds: 0.5 },    // KM < 127
    { upToKm: 500,   rounds: 1.0 },    // 127 ≤ KM < 500
    { upToKm: 700,   rounds: 1.5 },    // 500 ≤ KM < 700
    { upToKm: null,  rounds: 2.0 }     // KM ≥ 700 (null = no upper limit)
  ],

  // Per-capacity billing rates (embedded array)
  capacityRates: [
    {
      capacity: 29000,
      averageKmPerLitre: 2.5,           // Decimal128
      baseHiringRatePerRound: 4500      // Decimal128
    },
    {
      capacity: 23000,
      averageKmPerLitre: 3.0,
      baseHiringRatePerRound: 3000
    },
    // ... more capacities
  ],

  tollBillable: boolean,               // true for all 4 current firms
  notes: string | null,
  createdBy: ObjectId,                  // → users (audit)
  createdAt: Date,
  updatedAt: Date
}
// Indexes: { firm: 1, effectiveFrom: -1 }
//          { company: 1, firm: 1 }
```

#### `hsd_rates`
```typescript
{
  _id: ObjectId,
  ratePerLitre: Decimal128,          // ₹95.81
  effectiveFrom: Date,               // When this rate becomes active
  effectiveTo: Date | null,          // null = currently active
  notes: string | null,              // e.g. "Global diesel rate update July 2026"
  createdBy: ObjectId,               // → users
  createdAt: Date,
  updatedAt: Date
}
// Indexes: { effectiveFrom: -1 } — descending for efficient "find latest" lookup
```

#### `trips`
```typescript
{
  _id: ObjectId,
  date: Date,                         // Trip date
  vehicle: ObjectId,                  // → vehicles
  driver: ObjectId,                   // → drivers
  firm: ObjectId,                     // → firms (derived from vehicle's firm)
  route: ObjectId | null,             // → routes (optional)
  fromLocation: string,               // "TIRWAGANJ"
  toLocation: string,                 // "CFL"
  km: Decimal128,                     // Must be > 0

  // Derived/calculated fields (populated by billing engine on save)
  average: Decimal128,                // km/L — from contract capacity rate
  hsdLitres: Decimal128,              // km / average
  hsdRate: Decimal128,                // ₹/L — from global HSD rate
  hsdAmount: Decimal128,              // hsdLitres × hsdRate (rounded per row)
  rounds: Decimal128,                 // from KM slab lookup
  baseHiringRate: Decimal128,         // from contract capacity rate
  hiringCharge: Decimal128,           // rounds × baseHiringRate (rounded per row)
  tollAmount: Decimal128,             // entered manually (may be 0)
  tripTotal: Decimal128,              // hsdAmount + hiringCharge + tollAmount (rounded per row)

  // References to the rate sources used (for traceability, not for recalc)
  contractId: ObjectId,               // → contracts (the version used for this trip)
  hsdRateId: ObjectId,                // → hsd_rates (the rate record used)

  billId: ObjectId | null,            // → bills (null until included in a bill)
  status: 'draft' | 'billed' | 'finalized', // draft = editable, finalized = locked

  notes: string | null,
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
// Indexes: { firm: 1, date: 1 }
//          { vehicle: 1, date: 1 }
//          { driver: 1, date: 1 }
//          { billId: 1 }
//          { firm: 1, vehicle: 1, date: 1 }
```

#### `bills`
```typescript
{
  _id: ObjectId,
  billNumber: string,                  // "NIR/06/26-27/11"
  bookNumber: string | null,           // "01/2026-2027" — purpose TBD
  billingMonth: number,                // 6 (June)
  billingYear: number,                 // 2026
  financialYear: string,               // "26-27"
  firm: ObjectId,                      // → firms
  company: ObjectId,                   // → companies
  vehicle: ObjectId,                   // → vehicles
  billDate: Date,                      // Bill generate date (e.g. 30/06/2026)
  period: string,                      // "MONTH JUNE 2026"

  status: 'draft' | 'reviewed' | 'finalized' | 'paid' | 'partially_paid' | 'outstanding',

  // Aggregated totals
  totalKm: Decimal128,
  totalRounds: Decimal128,
  totalHsdLitres: Decimal128,
  totalHsdAmount: Decimal128,
  totalHiringCharge: Decimal128,
  totalToll: Decimal128,
  grandTotal: Decimal128,

  // Total payments received (denormalized for performance)
  totalPaid: Decimal128,
  outstandingAmount: Decimal128,

  // Snapshot of billing configuration at time of finalization (for historical reproduction)
  calculationSnapshot: {
    hsdRatePerLitre: Decimal128,
    contractId: ObjectId,
    contractName: string,
    kmSlabs: Array,                    // Copy of slab table used
    capacityRate: {
      capacity: number,
      averageKmPerLitre: Decimal128,
      baseHiringRatePerRound: Decimal128
    },
    // Per-trip snapshot
    tripSnapshots: [
      {
        tripId: ObjectId,
        date: Date,
        fromLocation: string,
        toLocation: string,
        km: Decimal128,
        average: Decimal128,
        hsdLitres: Decimal128,
        hsdRate: Decimal128,
        hsdAmount: Decimal128,
        rounds: Decimal128,
        baseHiringRate: Decimal128,
        hiringCharge: Decimal128,
        tollAmount: Decimal128,
        tripTotal: Decimal128
      }
    ]
  },

  // Audit
  finalizedAt: Date | null,
  finalizedBy: ObjectId | null,
  reopenedAt: Date | null,
  reopenReason: string | null,
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
// Indexes: { billNumber: 1 } unique
//          { firm: 1, vehicle: 1, billingMonth: 1, billingYear: 1 } unique
//          { firm: 1, status: 1 }
//          { status: 1 }
```

#### `payments`
```typescript
{
  _id: ObjectId,
  bill: ObjectId,                      // → bills
  firm: ObjectId,                      // → firms (denormalized for queries)
  amountReceived: Decimal128,
  paymentDate: Date,
  paymentMode: 'cheque' | 'neft' | 'rtgs' | 'cash' | 'other',
  referenceNumber: string | null,
  notes: string | null,
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
// Indexes: { bill: 1 }
//          { firm: 1, paymentDate: -1 }
```

#### `expenses`
```typescript
{
  _id: ObjectId,
  category: 'fuel' | 'toll' | 'maintenance' | 'loading_unloading' | 'driver_wages' | 'other',
  vehicle: ObjectId | null,            // → vehicles
  firm: ObjectId | null,               // → firms (derived from vehicle)
  trip: ObjectId | null,               // → trips (optional link)
  date: Date,
  amount: Decimal128,
  vendor: string | null,
  description: string,
  attachmentUrl: string | null,
  notes: string | null,
  
  // Category-specific fields (fuel)
  fuelDetails: {
    litres: Decimal128,
    ratePerLitre: Decimal128,
    pumpName: string
  } | null,

  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
// Indexes: { category: 1, date: -1 }
//          { vehicle: 1, date: -1 }
//          { firm: 1, date: -1 }
```

#### `salary_records`
```typescript
{
  _id: ObjectId,
  driver: ObjectId,                    // → drivers
  month: number,                       // 1–12
  year: number,                        // 2026
  daysWorked: number,                  // Count of distinct calendar days with trips
  dailyWageRate: Decimal128,           // Rate applicable for that month
  grossWages: Decimal128,              // daysWorked × dailyWageRate
  advance: Decimal128,                 // Amount already advanced
  deductions: Decimal128,              // Other deductions
  netPayable: Decimal128,              // grossWages − advance − deductions
  paidOn: Date | null,
  notes: string | null,
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
// Indexes: { driver: 1, year: 1, month: 1 } unique
```

#### `vehicle_documents`
```typescript
{
  _id: ObjectId,
  vehicle: ObjectId,                   // → vehicles
  documentType: 'rc' | 'insurance' | 'fitness' | 'permit' | 'puc' | 'other',
  documentNumber: string | null,
  issueDate: Date,
  expiryDate: Date,
  fileUrl: string | null,
  notes: string | null,
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
// Indexes: { vehicle: 1, documentType: 1 }
//          { expiryDate: 1 }
```

#### `audit_logs`
```typescript
{
  _id: ObjectId,
  action: string,                      // 'bill.finalized', 'bill.reopened', 'contract.created', etc.
  entityType: string,                  // 'bill', 'contract', 'trip', etc.
  entityId: ObjectId,
  userId: ObjectId,                    // → users
  changes: {
    before: object | null,             // Previous state (null for creates)
    after: object                      // New state
  },
  reason: string | null,              // Required for destructive actions (e.g., bill reopen)
  ipAddress: string | null,
  timestamp: Date
}
// Indexes: { entityType: 1, entityId: 1, timestamp: -1 }
//          { userId: 1, timestamp: -1 }
//          { timestamp: -1 }  // TTL or archival queries
```

---

## 5. Authentication Architecture

### Strategy: JWT in HTTP-only cookies

```
┌────────────┐     POST /api/auth/login      ┌──────────────┐
│   Browser  │  ─────────────────────────▶   │   Backend    │
│            │  { email, password }           │              │
│            │                                │  1. Validate │
│            │  ◀─────────────────────────   │  2. bcrypt   │
│            │  Set-Cookie: token=JWT;        │  3. Sign JWT │
│            │  HttpOnly; Secure; SameSite    │              │
└────────────┘                                └──────────────┘
```

| Decision | Choice | Rationale |
|---|---|---|
| Token storage | HTTP-only cookie | Cannot be accessed by JS — XSS-safe |
| Token format | JWT (jsonwebtoken) | Stateless; no server-side session store needed |
| Token expiry | 24 hours | Single user; re-login daily is acceptable |
| Refresh tokens | Not in V1 | Complexity not justified for single-user system |
| Password hashing | bcrypt (12 rounds) | Industry standard |
| CSRF protection | SameSite=Strict cookie + origin check | Simple, effective |
| Initial admin | Seeded by setup script | `npm run seed:admin` creates the first admin user |

### Auth middleware flow

```
Request arrives
  → Check HTTP-only cookie for JWT
  → Verify JWT signature and expiry
  → Extract userId and role from JWT payload
  → Attach user to req.user
  → Next()

If invalid or missing:
  → 401 Unauthorized
```

### API endpoints

```
POST   /api/auth/login          # Login → returns JWT in Set-Cookie
POST   /api/auth/logout         # Clears the cookie
GET    /api/auth/me             # Returns current user info
POST   /api/auth/change-password  # Password update (V1: admin only)
```

---

## 6. File / Document Storage Architecture

### Strategy: Local filesystem with path stored in MongoDB

```
uploads/
├── vehicle-documents/
│   ├── {vehicleId}/
│   │   ├── {documentId}-rc.pdf
│   │   ├── {documentId}-insurance.jpg
│   │   └── ...
├── expense-receipts/
│   ├── {expenseId}/
│   │   ├── fuel-receipt.jpg
│   │   └── ...
└── generated-bills/
    ├── {billId}/
    │   ├── NIR-06-26-27-11.pdf
    │   └── ...
```

| Decision | Choice | Rationale |
|---|---|---|
| Storage | Local filesystem (`/uploads`) | Single-server deployment; no cloud storage complexity |
| Upload handler | Multer middleware | Standard Express file upload library |
| File serving | Express static middleware for `/uploads` | Simple; files served via `GET /uploads/...` |
| File types | PDF, JPG, PNG (configurable whitelist) | Vehicle docs and receipts |
| Max file size | 10MB per file | Adequate for document scans |
| Path in DB | `fileUrl` field stores relative path | e.g. `vehicle-documents/abc123/doc456-rc.pdf` |

### Why not cloud storage (S3) in V1?

The system is used by one person. A local folder with proper backups is simpler and eliminates a cloud dependency. If multi-user or multi-location access is needed later, the `fileUrl` field can be migrated to S3 URLs without changing the schema.

---

## 7. PDF Invoice Generation Architecture

### Strategy: Server-side PDF generation using PDFKit

```
Bill Data (from MongoDB)
  → billing.service.ts (fetches bill + trip snapshots)
  → pdf-generator.ts (layouts the PDF)
  → PDFKit (generates binary PDF stream)
  → Save to /uploads/generated-bills/{billId}/
  → Return URL to frontend for download
```

### Library: PDFKit

| Decision | Choice | Rationale |
|---|---|---|
| Library | PDFKit (npm: pdfkit) | Pure Node.js; no headless browser dependency; fine-grained table layout control |
| Rendering | Server-side only | PDF is generated when "Generate PDF" is clicked |
| Storage | Saved to filesystem + URL stored in `bills` collection | Reusable without re-generation |
| Re-generation | If a bill is reopened and re-finalized, the old PDF is archived and a new one is generated | Ensures PDF always matches finalized data |

### PDF layout specification (from reference bill image)

```
┌─────────────────────────────────────────────────────────────────┐
│ BILL NO:-NIR/06/26-27/11              BOOK NO:-01/2026-2027    │
│                                                                 │
│ TO,[Company Name]           M/S [Firm Display Name]            │
│ [Company Address]           VILL:-[Firm Address]               │
│                             MOB:-[Phone]                        │
│                                                                 │
│ VEHICLE NO.[Registration]    PERIOD:-MONTH [Month] [Year]      │
│ TANKER COP:-[Capacity]      BILL GENERATE DATE:-[Date]        │
├─────────────────────────────────────────────────────────────────┤
│ SL | DATE | FROM | TO | KM | ROUNDS | AVG | HSD    | HSD  |   │
│ NO.|      |      |    |    | (BY    |     | (LTR.) | RATE |   │
│    |      |      |    |    | KMS)   |     |        |      |   │
│────┼──────┼──────┼────┼────┼────────┼─────┼────────┼──────┤   │
│    | HSD    | HIRING  | TOLL   | TOTAL  |                      │
│    | AMOUNT | CHARGE  | AMOUNT | AMOUNT |                      │
├────┼────────┼─────────┼────────┼────────┤                      │
│ 1  | 01-Jun | TIRW.. | CFL| 589| 1.5   | 2.5| 235.6 | 95.81│ │
│    | 22573  | 6750    | 4680   | 34003  |                      │
│ ...                                                             │
├─────────────────────────────────────────────────────────────────┤
│ GRAND TOTAL:- | 17081| 43.5 | 6832.4 | 654612 | 195750 |      │
│               | 135720 | 986082 |                               │
├─────────────────────────────────────────────────────────────────┤
│ BANK DETAILS:-                                                  │
│ ACCOUNT NAME:- [Account Name]         ACCOUNT NO.              │
│ [Account Number]                      IFSC CODE:-              │
│ [IFSC]                                BANK:- [Bank Name]       │
│ [Branch]                                                        │
│                                       AUTHORIZED SIGNATURE      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Billing Engine Architecture

### Core principle: Pure functions, no side effects

The billing engine (`billing-engine.ts`) is a collection of pure, testable functions. It has **zero database access**. Services feed it inputs; it returns computed results.

```
                      ┌────────────────────────────┐
                      │       billing-engine.ts      │
                      │                              │
  Inputs:             │  calculateHsdLitres(km, avg) │
  • km                │  calculateHsdAmount(ltrs,rate)│
  • average           │  calculateRounds(km, slabs)  │
  • hsdRate           │  calculateHiring(rnds, rate) │
  • hiringRate        │  calculateTripTotal(...)     │
  • slabTable         │  calculateBillTotals(trips)  │
  • tollAmount        │                              │
                      │  All use Decimal.js          │
  Output:             │  All round per row           │
  • Computed values   │                              │
                      └────────────────────────────┘
```

### Function signatures

```typescript
// billing-engine.ts — PURE FUNCTIONS ONLY

import Decimal from 'decimal.js';

interface KmSlab {
  upToKm: number | null;   // null = no upper limit
  rounds: number;           // 0.5, 1.0, 1.5, 2.0
}

interface TripCalculationInput {
  km: Decimal;
  averageKmPerLitre: Decimal;
  hsdRatePerLitre: Decimal;
  baseHiringRatePerRound: Decimal;
  tollAmount: Decimal;
  kmSlabs: KmSlab[];
}

interface TripCalculationResult {
  hsdLitres: Decimal;       // km / average
  hsdAmount: Decimal;       // hsdLitres × hsdRate, rounded to 2 dp
  rounds: Decimal;          // from slab lookup
  hiringCharge: Decimal;    // rounds × hiringRate, rounded to 2 dp
  tollAmount: Decimal;      // passthrough
  tripTotal: Decimal;       // hsdAmount + hiringCharge + tollAmount, rounded to 2 dp
}

function calculateHsdLitres(km: Decimal, average: Decimal): Decimal;
function calculateHsdAmount(hsdLitres: Decimal, hsdRate: Decimal): Decimal;
function calculateRounds(km: Decimal, slabs: KmSlab[]): Decimal;
function calculateHiringCharge(rounds: Decimal, baseRate: Decimal): Decimal;
function calculateTripTotal(input: TripCalculationInput): TripCalculationResult;
function calculateBillTotals(trips: TripCalculationResult[]): BillTotals;
```

### Decimal arithmetic

| Decision | Choice | Rationale |
|---|---|---|
| Library | decimal.js | Pure JS; no native dependencies; standard for financial calculations |
| Precision | Internal: unlimited; rounded to 2 dp per row on output | Owner confirmed: rounding happens per trip row |
| Rounding mode | ROUND_HALF_UP | Standard financial rounding |
| Storage | Mongoose Decimal128 | MongoDB native 128-bit decimal type |

### Rate lookup flow (performed by trip.service.ts, NOT by billing-engine.ts)

```
Trip save request arrives
  │
  ├─ 1. Look up vehicle → get firm + capacity
  │
  ├─ 2. Find active contract for firm where:
  │     effectiveFrom <= tripDate AND (effectiveTo > tripDate OR effectiveTo is null)
  │
  ├─ 3. Find capacity rate within contract:
  │     contract.capacityRates.find(r => r.capacity === vehicle.capacity)
  │     → Returns: averageKmPerLitre, baseHiringRatePerRound
  │
  ├─ 4. Find applicable global HSD rate:
  │     hsd_rates.findOne({ effectiveFrom <= tripDate }).sort({ effectiveFrom: -1 })
  │     → Returns: ratePerLitre
  │
  ├─ 5. Get KM slabs from contract → contract.kmSlabs
  │
  └─ 6. Call billing engine:
        calculateTripTotal({
          km: trip.km,
          averageKmPerLitre,
          hsdRatePerLitre,
          baseHiringRatePerRound,
          tollAmount: trip.tollAmount,
          kmSlabs
        })
        → Returns: all derived fields
        → Save to trip document
```

### Bill finalization flow

```
Owner clicks "Finalize Bill"
  │
  ├─ 1. Verify all trips are in 'draft' status
  │
  ├─ 2. Re-run billing engine for each trip (ensures consistency)
  │
  ├─ 3. Build calculationSnapshot:
  │     • Copy current HSD rate, contract, capacity rate, and slab table
  │     • Copy per-trip calculated values
  │
  ├─ 4. Calculate bill totals (sum of all trips)
  │
  ├─ 5. Generate bill number: {firmPrefix}/{MM}/{FY}/{vehicleNumber}
  │
  ├─ 6. Atomic update:
  │     • Set bill status = 'finalized'
  │     • Set bill.finalizedAt, finalizedBy
  │     • Set all trip.status = 'finalized'
  │     • Store calculationSnapshot
  │
  ├─ 7. Create audit_log entry
  │
  └─ 8. Return finalized bill
```

---

## 9. Validation Architecture

### Strategy: Zod schemas at the API boundary + Mongoose validation at the DB layer

```
Request arrives
  │
  ├─ validate.middleware.ts
  │    Uses Zod schema to validate:
  │    • req.body (POST/PUT)
  │    • req.query (GET — filters, pagination)
  │    • req.params (route params)
  │    If invalid → 400 Bad Request with structured error response
  │
  ├─ Controller (thin — passes validated data to service)
  │
  ├─ Service (business validation)
  │    • "Does this vehicle have an active contract?"
  │    • "Is this bill still in draft status?"
  │    • "Does this capacity exist in the contract?"
  │    If invalid → throws AppError (409 Conflict / 422 Unprocessable)
  │
  └─ Mongoose model (schema-level validation)
       • Required fields
       • Type enforcement
       • Unique index constraints
       If invalid → 500 (should not reach here if Zod + service catch it)
```

### Example Zod schema

```typescript
// trip.validator.ts
import { z } from 'zod';

export const createTripSchema = z.object({
  body: z.object({
    date: z.string().datetime(),
    vehicle: z.string().regex(/^[0-9a-fA-F]{24}$/),   // ObjectId
    driver: z.string().regex(/^[0-9a-fA-F]{24}$/),
    route: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    fromLocation: z.string().min(1).max(100),
    toLocation: z.string().min(1).max(100),
    km: z.number().positive('KM must be positive'),
    tollAmount: z.number().min(0).default(0),
    notes: z.string().max(500).optional(),
  })
});
```

### Validation middleware

```typescript
// validate.middleware.ts
import { AnyZodObject, ZodError } from 'zod';

export const validate = (schema: AnyZodObject) => {
  return async (req, res, next) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
};
```

---

## 10. Error Handling Architecture

### Custom error classes

```typescript
// shared/errors/app-error.ts

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code: string,             // Machine-readable error code
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id: string) {
    super(404, `${entity} not found: ${id}`, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, 'CONFLICT');
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(422, message, 'VALIDATION_ERROR', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, message, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(403, message, 'FORBIDDEN');
  }
}

export class BillingError extends AppError {
  constructor(message: string, details?: unknown) {
    super(422, message, 'BILLING_ERROR', details);
  }
}
```

### Global error handler

```typescript
// middleware/error-handler.middleware.ts

export const errorHandler = (err, req, res, next) => {
  // Log every error
  logger.error({
    message: err.message,
    code: err.code,
    statusCode: err.statusCode,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
  });

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_KEY',
        message: 'A record with this value already exists',
        details: err.keyValue,
      },
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'DB_VALIDATION_ERROR',
        message: err.message,
      },
    });
  }

  // Unhandled errors — never leak stack traces in production
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : err.message,
    },
  });
};
```

### Standard API response envelope

```typescript
// Success
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "totalCount": 150,
    "totalPages": 8
  }
}

// Error
{
  "success": false,
  "error": {
    "code": "BILLING_ERROR",
    "message": "No active contract found for firm X on date Y",
    "details": { ... }
  }
}
```

---

## 11. Logging Architecture

### Strategy: Structured JSON logging with Winston

```typescript
// shared/logger.ts
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'fleet-management' },
  transports: [
    // Console output (always)
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'development'
        ? winston.format.combine(winston.format.colorize(), winston.format.simple())
        : winston.format.json()
    }),
    // File output (production)
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024,     // 10MB rotation
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10
    }),
  ],
});
```

### What gets logged

| Log level | What |
|---|---|
| `error` | Unhandled exceptions, DB connection failures, billing calculation failures |
| `warn` | Duplicate trip warnings, missing rate profiles, expired documents |
| `info` | Bill finalized, bill reopened, contract created, payment recorded |
| `debug` | API request/response (development only), billing engine inputs/outputs |

### Request logging middleware

```typescript
// middleware/request-logger.middleware.ts
import morgan from 'morgan';

// Development: colorized one-liner
// Production: JSON structured log with response time
```

---

## 12. Audit / History Architecture

### Strategy: Dedicated `audit_logs` collection + immutable finalization snapshots

### What gets audited

| Entity | Audited Actions |
|---|---|
| Bill | Finalized, reopened, re-finalized, PDF generated |
| Contract | Created, rate changed (new version), deactivated |
| Trip | Created, edited, deleted (when not in finalized bill) |
| Payment | Recorded, modified, deleted |
| Vehicle | Status changed, firm reassignment |
| HSD Rate | New rate added |
| User | Login, password change |

### Audit log entry structure

```typescript
{
  action: 'bill.finalized',
  entityType: 'bill',
  entityId: ObjectId('...'),
  userId: ObjectId('...'),
  changes: {
    before: { status: 'draft' },
    after: { status: 'finalized', finalizedAt: '2026-06-30T...' }
  },
  reason: null,           // Required for bill.reopened
  ipAddress: '192.168.1.5',
  timestamp: ISODate('2026-06-30T12:00:00Z')
}
```

### Bill historical reproduction

The `calculationSnapshot` on the bill document stores **everything** needed to reproduce the bill line-by-line:

1. HSD rate used
2. Contract ID and name
3. KM slab table used
4. Capacity rate (average + hiring rate)
5. Per-trip: all inputs and all calculated outputs

This means: even if the contract is deleted, rates change, or the billing engine code is updated, the finalized bill PDF can always be re-generated from its snapshot.

### Mongoose plugin for timestamps

All models use:
```typescript
schema.set('timestamps', true);  // Adds createdAt and updatedAt automatically
```

### `createdBy` / `updatedBy` pattern

The auth middleware attaches `req.user.id`. Services pass this to model operations:

```typescript
await Trip.create({ ...tripData, createdBy: userId });
```

---

## 13. Configuration Architecture

### What is configurable (admin UI, not code changes)

| Configuration | Storage | Who manages |
|---|---|---|
| Companies (factories) | `companies` collection | Admin via UI |
| Firms (billing vendors) | `firms` collection | Admin via UI |
| Vehicles (registration, capacity) | `vehicles` collection | Admin via UI |
| Drivers (name, wage rate) | `drivers` collection | Admin via UI |
| Routes | `routes` collection | Admin via UI |
| Contracts (rates, slabs, averages) | `contracts` collection | Admin via UI |
| Global HSD rate | `hsd_rates` collection | Admin via UI |
| KM slab boundaries | Embedded in `contracts` | Admin via contract form |
| Capacity → average mapping | Embedded in `contracts` | Admin via contract form |
| Capacity → hiring rate | Embedded in `contracts` | Admin via contract form |
| Toll billable flag | On `contracts` | Admin via contract form |
| Firm bill prefix | On `firms` | Admin via firm form |

### What is configured via environment variables (see Section 14)

Application-level settings that do not change via the UI: database URL, JWT secret, port, log level, upload paths.

---

## 14. Environment Configuration

### `.env` structure

```bash
# ─── Server ───
NODE_ENV=development              # development | production
PORT=5000
API_PREFIX=/api

# ─── Database ───
MONGODB_URI=mongodb://localhost:27017/fleet-management
# For production: mongodb+srv://user:pass@cluster.mongodb.net/fleet-management

# ─── Authentication ───
JWT_SECRET=your-256-bit-secret-here
JWT_EXPIRY=24h
BCRYPT_ROUNDS=12

# ─── File Uploads ───
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=10
ALLOWED_FILE_TYPES=pdf,jpg,jpeg,png

# ─── Logging ───
LOG_LEVEL=info                    # error | warn | info | debug
LOG_DIR=./logs

# ─── Frontend (CORS) ───
FRONTEND_URL=http://localhost:5173

# ─── Admin Seed ───
ADMIN_EMAIL=admin@fleet.local
ADMIN_PASSWORD=changeme123        # Change on first login
```

### Config loader

```typescript
// config/index.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  MONGODB_URI: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRY: z.string().default('24h'),
  // ... all env vars validated at startup
});

// Parse and validate at application startup — fail fast if missing
export const config = envSchema.parse(process.env);
```

This ensures the application **refuses to start** if any required configuration is missing or invalid.

---

## 15. Development Environment

### Prerequisites

```
Node.js >= 18 LTS
npm >= 9
MongoDB >= 7.0 (local or Docker)
Git
```

### Setup steps

```bash
# 1. Clone
git clone <repo>
cd fleet-management-system

# 2. Backend setup
cd backend
cp .env.example .env               # Edit with local values
npm install
npm run seed:admin                  # Create initial admin user
npm run dev                         # Starts Express with ts-node-dev (hot reload)

# 3. Frontend setup
cd ../frontend
npm install
npm run dev                         # Starts Vite dev server with HMR
```

### Development tooling

| Tool | Purpose |
|---|---|
| `ts-node-dev` or `tsx` | TypeScript watch mode for backend (hot reload on save) |
| `Vite` | Frontend dev server with HMR |
| `ESLint` | Linting for both backend and frontend |
| `Prettier` | Code formatting |
| `Vitest` | Unit testing (shared across frontend and backend) |
| `MongoDB Compass` | Visual DB inspection during development |

### Development scripts (backend `package.json`)

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "seed:admin": "tsx src/scripts/seed-admin.ts",
    "seed:sample": "tsx src/scripts/seed-sample-data.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  }
}
```

### Development scripts (frontend `package.json`)

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  }
}
```

### Proxy configuration (Vite → Express)

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
```

---

## 16. Production Environment

### Deployment architecture

```
┌─────────────────────────────────────────────┐
│              Production Server               │
│  (Single VPS / VM — e.g. DigitalOcean)      │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │  Node.js process (Express)           │   │
│  │  • Serves REST APIs on :5000         │   │
│  │  • Serves frontend static build      │   │
│  │  • Managed by PM2                    │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │  Nginx (reverse proxy)               │   │
│  │  • SSL termination (Let's Encrypt)   │   │
│  │  • Port 80/443 → :5000              │   │
│  │  • Static file caching headers       │   │
│  │  • Rate limiting                     │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │  MongoDB (local or Atlas)            │   │
│  │  • Automated daily backups           │   │
│  │  • Stored in /backups or S3          │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  /uploads/    → File storage                 │
│  /logs/       → Application logs             │
│  /backups/    → DB backup dumps              │
└─────────────────────────────────────────────┘
```

### Production build and deploy

```bash
# Backend
cd backend
npm run build                      # Compiles TypeScript → dist/
NODE_ENV=production node dist/server.js

# Frontend
cd frontend
npm run build                      # Vite builds → dist/
# The built files are served by Express in production:
# app.use(express.static(path.join(__dirname, '../../frontend/dist')));
```

### Process management: PM2

```bash
pm2 start dist/server.js --name fleet-management \
  --max-memory-restart 512M \
  --log-date-format 'YYYY-MM-DD HH:mm:ss' \
  --merge-logs
```

### Backup strategy

| What | How | Frequency |
|---|---|---|
| MongoDB | `mongodump` to local `/backups/` directory | Daily (cron job) |
| Uploads | rsync to backup location | Daily |
| Retention | Keep last 30 daily backups | Automated cleanup |

### Security checklist

- [x] HTTPS via Nginx + Let's Encrypt
- [x] HTTP-only, Secure, SameSite cookies
- [x] Helmet.js for security headers
- [x] Rate limiting on auth endpoints
- [x] CORS restricted to specific origin
- [x] Environment variables for secrets (never in code)
- [x] MongoDB authentication enabled
- [x] File upload type and size validation
- [x] No stack traces in production error responses

---

## 17. Communication Flow

### Frontend → Backend (REST API)

```
React SPA (browser)
  │
  │  Axios HTTP client (src/api/client.ts)
  │  • Base URL: /api (proxied in dev, same-origin in prod)
  │  • Credentials: 'include' (sends JWT cookie automatically)
  │  • Content-Type: application/json
  │  • Interceptors: 401 → redirect to /login
  │
  │  Example: Create a trip
  │  POST /api/trips
  │  Body: { date, vehicle, driver, fromLocation, toLocation, km, tollAmount }
  │
  ▼
Express.js (backend)
  │
  ├─ CORS middleware (allows frontend origin)
  ├─ Cookie parser (extracts JWT)
  ├─ Auth middleware (verifies JWT → sets req.user)
  ├─ Request logger (logs method, path, response time)
  ├─ Route matching: POST /api/trips → trip.routes.ts
  ├─ Validation middleware (Zod schema: createTripSchema)
  ├─ Controller: trip.controller.ts → calls trip.service.ts
  ├─ Service: trip.service.ts
  │    • Looks up vehicle → firm → contract → rates
  │    • Calls billing-engine.ts (pure calculation)
  │    • Saves trip to MongoDB via Mongoose
  │    • Returns created trip with calculated fields
  ├─ Controller formats response: { success: true, data: trip }
  └─ Error handler (catches any thrown AppError)
```

### Backend → MongoDB (Mongoose ODM)

```
Service layer
  │
  │  Uses Mongoose models (e.g., Trip, Bill, Contract)
  │  Each model maps to a MongoDB collection
  │
  │  Example: trip.service.ts
  │
  │  // Find active contract for a firm on a given date
  │  const contract = await Contract.findOne({
  │    firm: vehicle.firm,
  │    effectiveFrom: { $lte: tripDate },
  │    $or: [
  │      { effectiveTo: null },
  │      { effectiveTo: { $gt: tripDate } }
  │    ]
  │  });
  │
  │  // Find capacity rate within the contract (embedded document)
  │  const capacityRate = contract.capacityRates.find(
  │    r => r.capacity === vehicle.capacity
  │  );
  │
  │  // Find global HSD rate effective on the trip date
  │  const hsdRate = await HsdRate.findOne({
  │    effectiveFrom: { $lte: tripDate }
  │  }).sort({ effectiveFrom: -1 });
  │
  │  // Calculate using billing engine (pure function)
  │  const result = calculateTripTotal({ km, average, hsdRate, ... });
  │
  │  // Save trip with calculated fields
  │  const trip = await Trip.create({ ...input, ...result });
  │
  ▼
MongoDB (via Mongoose driver)
  │
  │  Wire protocol → MongoDB server
  │  • Connection pool managed by Mongoose
  │  • Connected at application startup (database.ts)
  │  • Connection string from environment variable
  │  • Retry on disconnect
  │
  ▼
MongoDB collections
  │  trips, bills, contracts, hsd_rates, vehicles, ...
```

### Key communication principles

| Principle | How |
|---|---|
| All data flows through REST APIs | No direct MongoDB access from frontend |
| JWT cookie sent automatically | `credentials: 'include'` on Axios; HTTP-only cookie set by backend |
| All responses use standard envelope | `{ success, data, meta }` or `{ success, error }` |
| All calculations happen on backend | Frontend never computes billing amounts |
| Mongoose manages connection pool | Single connection established at startup; shared across all requests |
| Decimal128 serialized as strings | Mongoose serializes Decimal128 to string in JSON responses; frontend formats for display |

---

## Architecture Decision Summary

| Decision | Choice | Alternatives Considered | Why Not |
|---|---|---|---|
| Architecture | Modular monolith | Microservices | Single user, ~50 vehicles; no scale requirement |
| Backend runtime | Node.js + Express | NestJS, Fastify | Express is simpler, more than sufficient; NestJS adds unnecessary ceremony |
| Database | MongoDB + Mongoose | PostgreSQL + Prisma | Document model suits nested bill/trip/snapshot structure; owner familiar with simple deployment |
| HSD rate storage | Separate `hsd_rates` collection (global) | On contract | Owner confirmed HSD rate is global, not per-contract |
| Decimal handling | decimal.js + Mongoose Decimal128 | Native JS Number | Financial calculations require exact decimal arithmetic |
| Capacity rates | Embedded in contract document | Separate collection | Always read with contract; versioned together; simpler queries |
| KM slabs | Embedded in contract document | Separate config collection | Same reasoning; versioned with contract for historical reproduction |
| Bill snapshot | Full calculation snapshot on bill document | Re-derive from historical contract | Guarantees reproduction even if contract is deleted; eliminates complex temporal queries |
| Auth | JWT in HTTP-only cookie | Session store in Redis, localStorage | Simpler than Redis; safer than localStorage; sufficient for single user |
| PDF | PDFKit (server-side) | Puppeteer/headless Chrome, client-side | No heavy browser dependency; fine-grained control over table layout |
| File storage | Local filesystem | S3, GridFS | Single-server deployment; simplest option; migrateable later |
| Logging | Winston (JSON) | Pino, console.log | Structured logging with file rotation; production-ready |
| Process manager | PM2 | Docker, systemd | Familiar, simple, built-in log management and restart |
| Reverse proxy | Nginx | Caddy, none | Industry standard; SSL termination; static file caching |
