# Frontend API Integration Specification

This document describes the backend APIs currently implemented in `backend/src`. It is intentionally based on the running Express routes, Zod validators, controllers, services, and Mongoose models. It does not describe planned APIs or the design documents.

## 1. Base URL and Transport

The API is mounted under:

```text
/api/v1
```

Use JSON request bodies for POST and PATCH requests. The backend also accepts URL-encoded bodies. The JSON body limit is 10 KB.

The health endpoint is unauthenticated:

```http
GET /health
```

Response:

```json
{
  "success": true,
  "message": "Server is healthy"
}
```

The API is rate-limited at 100 requests per IP per 15 minutes under `/api`. CORS is configured by the backend environment and credentials are enabled.

## 2. Authentication

### Login

```http
POST /api/v1/auth/login
Content-Type: application/json
```

Request body:

```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

Successful response:

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "<jwt>",
    "user": {
      "id": "<user-id>",
      "name": "Admin",
      "email": "admin@example.com",
      "role": "owner"
    }
  }
}
```

The accepted roles are `owner` and `admin`. All Vehicles, Drivers, Firms, Routes, Contracts, and Trips endpoints require one of these roles.

Send the token on protected requests:

```http
Authorization: Bearer <jwt>
```

JWT logout is client-side only. The backend does not revoke tokens:

```http
POST /api/v1/auth/logout
```

Current user:

```http
GET /api/v1/auth/me
Authorization: Bearer <jwt>
```

Response data is shaped as `{ "user": <user-document> }`. The password hash is excluded.

Owner seed endpoint:

```http
POST /api/v1/auth/seed
```

This endpoint is publicly routed but requires `name`, `email`, `password`, and `adminSecret` in the body. The service compares `adminSecret` with the configured JWT secret and allows only one owner. It should be treated as an administrative setup endpoint, not a normal frontend workflow.

## 3. Response and Error Formats

### Success

All controllers use:

```json
{
  "success": true,
  "message": "Human-readable message",
  "data": {}
}
```

Delete responses normally omit `data`.

### Paginated lists

List responses put pagination inside `data`:

```json
{
  "success": true,
  "message": "Entities retrieved successfully",
  "data": {
    "data": [],
    "meta": {
      "total": 0,
      "page": 1,
      "limit": 10,
      "totalPages": 0
    }
  }
}
```

Most list services sort newest first. The exact sort is documented per resource below.

### Application errors

```json
{
  "success": false,
  "message": "Vehicle not found",
  "errors": null
}
```

`errors` may be omitted or null for operational errors. Common statuses are:

| Status | Meaning |
|---|---|
| 400 | Validation failure or bad request |
| 401 | Missing, invalid, expired, or disabled authentication |
| 403 | Authenticated user lacks `owner` or `admin` role |
| 404 | Resource not found or inactive reference |
| 409 | Duplicate or conflicting resource/business rule |
| 500 | Unhandled server error |

### Validation errors

Zod validation errors return:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "path": "body.email",
      "message": "Invalid email address"
    }
  ]
}
```

Paths use `body`, `query`, and `params`, including array indexes where relevant.

## 4. Common List Parameters

Vehicles, Drivers, Firms, Routes, and Contracts support some combination of:

| Parameter | Type | Behavior |
|---|---|---|
| `page` | numeric string | Page number; defaults to 1 in services |
| `limit` | numeric string | Page size; defaults to 10 in services |
| `search` | string | Case-insensitive text search where supported |
| `isActive` | `true` or `false` | Active-state filter where supported |

Routes and Contracts reject non-positive pagination values. Vehicles, Drivers, and Firms accept any digit string at validation level, including `0`; the frontend should send positive values consistently.

## 5. Resource APIs

All endpoints in this section require:

```http
Authorization: Bearer <jwt>
```

### 5.1 Vehicles

Base path: `/api/v1/vehicles`

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/vehicles` | Create vehicle |
| GET | `/api/v1/vehicles` | List/search vehicles |
| GET | `/api/v1/vehicles/:id` | Get vehicle |
| PATCH | `/api/v1/vehicles/:id` | Update vehicle |
| DELETE | `/api/v1/vehicles/:id` | Soft-delete vehicle |

Create body:

```json
{
  "registrationNumber": "MH 12 AB 1234",
  "vehicleType": "Truck",
  "capacity": 10.5,
  "make": "Tata",
  "vehicleModel": "Prima",
  "firmId": "<firm-id>",
  "status": "available",
  "metadata": {}
}
```

`registrationNumber`, `vehicleType`, and `capacity` are required. Valid statuses are `available`, `on_trip`, and `maintenance`. `firmId` is optional and may be set to `null` during PATCH.

Vehicle list query parameters:

```text
page, limit, search, status, isActive, vehicleType, firmId
```

Search matches registration number, make, or vehicle model. Results sort by `createdAt` descending. Vehicle responses include `registrationNumber`, `vehicleType`, `capacity`, optional `make`, `vehicleModel`, `firmId`, `status`, `metadata`, `isActive`, `isDeleted`, `createdAt`, and `updatedAt`.

DELETE sets `isDeleted=true` and `isActive=false`; deleted vehicles are excluded from normal reads and lists.

### 5.2 Drivers

Base path: `/api/v1/drivers`

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/drivers` | Create driver |
| GET | `/api/v1/drivers` | List/search drivers |
| GET | `/api/v1/drivers/:id` | Get driver |
| PATCH | `/api/v1/drivers/:id` | Update driver |
| DELETE | `/api/v1/drivers/:id` | Soft-delete driver |

Create body:

```json
{
  "name": "Driver Name",
  "mobile": "+919876543210",
  "employeeId": "DRV-001",
  "joiningDate": "2026-01-15T00:00:00.000Z",
  "dailyWage": 800,
  "isActive": true,
  "notes": "",
  "history": [
    {
      "eventType": "hired",
      "date": "2026-01-15T00:00:00.000Z",
      "notes": "Joined fleet"
    }
  ]
}
```

Required fields are `name`, `mobile`, and `dailyWage`. Valid history event types are `hired`, `suspended`, `terminated`, `rejoined`, and `other`.

Driver list query parameters:

```text
page, limit, search, isActive
```

Search matches driver name, mobile, or employee ID. Results sort by `createdAt` descending. Driver `dailyWage` is stored as MongoDB Decimal128; the frontend should treat its actual JSON representation as backend-defined rather than assuming a JavaScript number.

DELETE soft-deletes the driver, sets it inactive, and appends a `terminated` history event.

### 5.3 Firms

Base path: `/api/v1/firms`

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/firms` | Create firm |
| GET | `/api/v1/firms` | List/search firms |
| GET | `/api/v1/firms/:id` | Get firm |
| PATCH | `/api/v1/firms/:id` | Update firm |
| DELETE | `/api/v1/firms/:id` | Soft-delete firm |

Create body:

```json
{
  "name": "Nirupama Gupta",
  "billingName": "M/S Nirupama Gupta",
  "address": {
    "street": "Radha Nagar",
    "city": "Bulandshahr",
    "state": "Uttar Pradesh",
    "pinCode": "203001"
  },
  "contactDetails": {
    "name": "Manager",
    "email": "manager@example.com",
    "mobile": "+919876543210"
  },
  "gstNumber": "07AAAAA0000A1Z5",
  "isActive": true,
  "billingConfiguration": {},
  "notes": ""
}
```

Only `name` is required. Firm list query parameters are `page`, `limit`, `search`, and `isActive`. Search matches `name`, `billingName`, `contactDetails.name`, or `gstNumber`. Results sort by `createdAt` descending.

Firms are globally named in the current implementation. DELETE sets `isDeleted=true` and `isActive=false`.

### 5.4 Routes

Base path: `/api/v1/routes`

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/routes` | Create route |
| GET | `/api/v1/routes` | List/search routes |
| GET | `/api/v1/routes/:id` | Get route |
| PATCH | `/api/v1/routes/:id` | Update route |
| DELETE | `/api/v1/routes/:id` | Soft-delete route |

Create body:

```json
{
  "name": "Delhi to Mumbai",
  "routeCode": "DEL-MUM-001",
  "pickupLocation": "Delhi Depot",
  "dropLocation": "Mumbai Warehouse",
  "intermediateStops": ["Jaipur", "Ahmedabad"],
  "expectedDistanceKm": 1400,
  "isActive": true,
  "notes": ""
}
```

Required fields are `name`, `pickupLocation`, and `dropLocation`. Route list query parameters are `page`, `limit`, `search`, and `isActive`. Search matches name, code, pickup, drop, intermediate stops, and notes. Results sort by `createdAt` descending.

DELETE sets `isDeleted=true` and `isActive=false`.

### 5.5 Contracts and Billing Rules

Base path: `/api/v1/contracts`

All contract and nested version endpoints require owner/admin authentication.

Contract endpoints:

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/contracts` | Create contract metadata |
| GET | `/api/v1/contracts` | List contracts |
| GET | `/api/v1/contracts/:id` | Get contract metadata |
| PATCH | `/api/v1/contracts/:id` | Update contract metadata |
| DELETE | `/api/v1/contracts/:id` | Deactivate/soft-delete contract |

Contract create body:

```json
{
  "firmId": "<firm-id>",
  "companyId": "<company-id>",
  "name": "NIR-CFL 2026",
  "description": "2026 commercial agreement",
  "isActive": true
}
```

`firmId` and `name` are required. `companyId` is optional because no Company module/API currently exists.

Contract list query parameters:

```text
page, limit, search, firmId, companyId, isActive
```

Search matches contract `name` and `description`. Results sort by `createdAt` descending.

Version endpoints:

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/contracts/:id/versions` | Create dated version and billing rules |
| GET | `/api/v1/contracts/:id/versions` | List versions |
| GET | `/api/v1/contracts/:id/versions/:versionId` | Get one version |
| GET | `/api/v1/contracts/:id/versions/effective?date=...` | Find version effective on date, or today |
| GET | `/api/v1/contracts/:id/versions/active` | Find currently effective version |

Version create body:

```json
{
  "effectiveFrom": "2026-01-01T00:00:00.000Z",
  "effectiveTo": "2026-07-01T00:00:00.000Z",
  "billingRules": {
    "capacityRates": [
      {
        "capacity": 29000,
        "contractualAverageKmPerLitre": 2.5,
        "baseHiringRatePerRound": 4500,
        "hiringMultiplierRules": [
          { "minKm": 0, "maxKm": 500, "multiplier": 1 }
        ]
      }
    ],
    "fuelRatePerLitre": 95.81,
    "kmThresholds": [
      { "upToKm": 127, "rounds": 0.5 },
      { "upToKm": 500, "rounds": 1 },
      { "upToKm": 700, "rounds": 1.5 },
      { "rounds": 2 }
    ],
    "tollTreatment": "actual",
    "otherBillableCharges": [
      {
        "code": "loading",
        "name": "Loading charge",
        "amount": 100,
        "basis": "perTrip",
        "isActive": true
      }
    ]
  },
  "notes": "Initial version"
}
```

`effectiveFrom` and `billingRules` are required. Billing rules require at least one capacity rate and one KM threshold. Toll treatment is `excluded`, `actual`, or `fixed`. Charge basis is `flat`, `perTrip`, `perKm`, or `perRound`.

Versions cannot overlap. Lookup uses:

```text
effectiveFrom <= requested date
AND (effectiveTo is null OR effectiveTo > requested date)
```

The matching version with the newest `effectiveFrom` is returned. The `effectiveTo` boundary is exclusive.

Contract version list results sort by `effectiveFrom` descending. Version creation assigns a sequential `version` number. There is no PATCH or DELETE endpoint for individual versions; create a new version instead.

### 5.6 Trips

Base path: `/api/v1/trips`

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/trips` | Create trip |
| GET | `/api/v1/trips` | List/filter trips |
| GET | `/api/v1/trips/:id` | Get trip |
| PATCH | `/api/v1/trips/:id` | Update trip |
| DELETE | `/api/v1/trips/:id` | Cancel and soft-delete trip |

Create body:

```json
{
  "tripDate": "2026-06-30T00:00:00.000Z",
  "vehicleId": "<vehicle-id>",
  "driverId": "<driver-id>",
  "firmId": "<firm-id>",
  "contractId": "<contract-id>",
  "routeId": "<route-id>",
  "pickupLocation": "Delhi Depot",
  "dropLocation": "Mumbai Warehouse",
  "startKm": 10000,
  "endKm": 10589,
  "totalKm": 589,
  "operationalStatus": "completed",
  "toll": {
    "amount": 4680,
    "reference": "FASTAG-001",
    "notes": ""
  },
  "operationalInfo": {
    "shift": "day"
  },
  "notes": ""
}
```

Required fields are `tripDate`, `vehicleId`, `driverId`, `firmId`, `contractId`, `pickupLocation`, `dropLocation`, and positive `totalKm`. `routeId` may be null. Operational statuses are `planned`, `in_progress`, `completed`, and `cancelled`.

If both `startKm` and `endKm` are supplied:

```text
endKm >= startKm
totalKm = endKm - startKm
```

The service verifies that referenced vehicle, driver, firm, contract, and optional route are active and not deleted. It verifies that the vehicle belongs to the selected firm and that the contract belongs to the selected firm. It resolves and stores `contractVersionId` effective for `tripDate`. The actual `vehicleId` and `driverId` are stored on the trip, so drivers may change vehicles between trips.

Trip list query parameters:

```text
page, limit, search, fromDate, toDate, month, vehicleId, driverId, firmId, operationalStatus
```

`month` must use `YYYY-MM`. `fromDate` and `toDate` are date values; `toDate` is inclusive in service behavior. `month` takes precedence over `fromDate` and `toDate` when both are supplied. Search matches pickup location, drop location, and notes. Results sort by `tripDate` descending, then `createdAt` descending.

Trip DELETE behavior is cancellation, not physical deletion: it sets `operationalStatus=cancelled`, `isDeleted=true`, and `deletedAt`. Completed trips cannot be deleted through this endpoint. Cancelled trips cannot be updated. Deleted trips are excluded from normal list/get operations.

Trip responses contain the operational fields plus `contractVersionId`, `isDeleted`, `deletedAt`, `createdAt`, and `updatedAt`. The Trips module does not calculate invoice amounts.

## 6. Entity Relationships

The relationships implemented in code are:

```text
Firm 1 -> many Vehicles through Vehicle.firmId (optional on Vehicle)
Firm 1 -> many Contracts through Contract.firmId
Contract 1 -> many ContractVersions through ContractVersion.contractId
ContractVersion embeds BillingRules
Vehicle 1 -> many Trips through Trip.vehicleId
Driver 1 -> many Trips through Trip.driverId
Firm 1 -> many Trips through Trip.firmId
Contract 1 -> many Trips through Trip.contractId
ContractVersion 1 -> many Trips through Trip.contractVersionId
Route 1 -> many Trips through Trip.routeId (optional)
```

The frontend should treat the trip's `vehicleId` and `driverId` as independent per-trip assignments. There is no permanent driver-to-vehicle relationship in the implemented API.

## 7. Sorting and Pagination Summary

| Resource | Default page | Default limit | Sort |
|---|---:|---:|---|
| Vehicles | 1 | 10 | `createdAt` descending |
| Drivers | 1 | 10 | `createdAt` descending |
| Firms | 1 | 10 | `createdAt` descending |
| Routes | 1 | 10 | `createdAt` descending |
| Contracts | 1 | 10 | `createdAt` descending |
| Contract versions | N/A | N/A | `effectiveFrom` descending |
| Trips | 1 | 10 | `tripDate` descending, then `createdAt` descending |

There is no general client-controlled sort parameter in the implemented APIs.

## 8. Frontend Integration Inconsistencies and Risks

1. **No Company module exists.** Contracts accept optional `companyId` and models reference `Company`, but there is no Company CRUD endpoint or mounted Company model in the current API.
2. **Relationship naming is inconsistent with the documented domain model.** Vehicles, Contracts, and Trips use `firmId`; the design documentation also describes a `firm` field in places. Frontend types should follow the actual API field names.
3. **Firm/customer terminology is ambiguous.** The API exposes `/firms`, while contracts also accept `companyId`; the frontend needs separate labels even though Company management is unavailable.
4. **Pagination validation is inconsistent.** Routes and Contracts reject invalid/oversized limits, while Vehicles, Drivers, and Firms accept digit strings such as `0` and do not cap the limit in their validators.
5. **Validation transformations are not written back to requests.** `validateResource` calls `schema.parse(...)` but discards the parsed result. Controllers/services therefore receive original query/date strings and must normalize them themselves. Frontend clients should still send the documented string query formats.
6. **Query parameter transformations differ by module.** Some schemas transform `isActive` and pagination values, but services commonly cast `req.query` directly. Do not depend on transformed query types in the frontend contract.
7. **Decimal128 response serialization is not standardized.** Driver wages, trip toll amounts, and contract monetary values use Decimal128. The frontend should normalize these values at the API boundary and should not assume every response is a JSON number or string.
8. **Soft deletion is not uniform in naming or lifecycle.** Vehicles, Drivers, Firms, Routes, and Contracts expose DELETE but retain records with `isDeleted`; Trips also sets `operationalStatus=cancelled` and blocks updates. Contract versions have no delete/update endpoint.
9. **Route and firm uniqueness is enforced partly in services and partly by MongoDB indexes.** Duplicate errors may be returned as a domain-specific message or the generic `Duplicate entry found`.
10. **Authentication logout is stateless.** The frontend must remove its token locally; calling logout does not invalidate an already-issued JWT.
11. **The backend does not expose a client-controlled sort parameter.** List UIs must sort using server order or sort the loaded page locally, which cannot provide globally correct sorting across pages.
12. **The backend has no invoice/billing calculation endpoints yet.** Contract rules and trip contract-version references are available, but invoice previews, finalized invoices, calculations, and billing snapshots are not implemented.
13. **Error shape is not fully uniform.** Validation errors contain an array, while operational errors often return `errors: null` or omit useful structured codes. Frontend error handling should use HTTP status and `message`, with optional parsing of `errors`.
