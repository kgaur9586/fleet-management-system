# Fleet Ledger

Fleet Ledger is an operations and billing system for a transport business. It keeps vehicles, drivers, firms, routes, contracts, and trips in one place, then calculates factory bills from those trips.

The browser app talks to a REST API. Money is calculated on the server. Finalized invoices stay frozen.

## What it covers

- Companies, firms, vehicles, drivers, and routes
- Contracts with dated versions, capacity rates, and kilometre slabs
- Trip records, including a hiring charge entered on the trip, an optional hiring multiplier, and optional courier charges
- Monthly invoices, approval, finalization, reopen, and PDF bills
- Expenses, payments, driver advances, and payroll
- Global HSD (fuel) rates, vehicle documents, a dashboard, and reports

## Stack

| Part | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query |
| Backend | Node.js, Express, TypeScript, Zod, Mongoose |
| Database | MongoDB |
| Auth | Email and password, JWT sent as a Bearer token and kept in `sessionStorage` |
| Invoices | PDFKit |

## Project layout

```text
backend/     API, billing engine, tests
frontend/    Web app
docs/        Billing rules, schema notes, and API notes
```

The API is mounted at `/api/v1`.

## Prerequisites

- Node.js (current LTS)
- npm
- A MongoDB database

## Run it locally

Use two terminals.

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Edit `backend/.env` before starting:

- `MONGODB_URI` — your database
- `JWT_SECRET` — a long random string
- `SEED_SECRET` — a different long random string, used only to create the first owner
- `CORS_ORIGIN` — `http://localhost:5173` when the browser talks to this API directly

The API listens on port `5000` unless `PORT` is set.

Create the first owner once. This works only while no owner exists, and `adminSecret` must match `SEED_SECRET`:

```bash
curl -X POST http://localhost:5000/api/v1/auth/seed ^
  -H "Content-Type: application/json" ^
  -d "{\"name\":\"Owner\",\"email\":\"owner@example.com\",\"password\":\"change-me\",\"adminSecret\":\"your-seed-secret\"}"
```

On macOS or Linux, use `\` instead of `^`.

### 2. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`.

Point the app at the local API by setting this in `frontend/.env`:

```text
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

If that variable is empty, the app calls `/api/v1` on the Vite server. The Vite proxy in `frontend/vite.config.ts` currently forwards `/api` to the deployed API, not to `localhost:5000`.

Sign in with the owner account you seeded.

## Scripts

From `backend`:

| Command | What it does |
|---|---|
| `npm run dev` | Start the API with reload |
| `npm test` | Run the Jest suite against an in-memory database |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled API |
| `npm run remove-vehicle-hiring-charges` | Unset leftover `operationalRates.hiringChargePerRound` values on vehicles. It does not change trips or invoices. Run it only when you intend to update that database. |

From `frontend`:

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Typecheck and build the production bundle |
| `npm run preview` | Serve the production bundle locally |

## Billing, in short

A trip stores its own hiring charge. The hiring amount is that charge times a multiplier. The multiplier is a number typed on the trip, or the contract kilometre slab when the field is left blank. An optional courier amount on the trip is added to the bill when it is greater than zero. Vehicle records keep average fuel consumption and an optional fuel rate. They do not supply the hiring charge.

The rules, examples, and stored fields are in [docs/trip-level-hiring-and-courier-charges.md](docs/trip-level-hiring-and-courier-charges.md).

## Further reading

- [docs/billing-engine.md](docs/billing-engine.md) — how a trip line is calculated
- [docs/frontend-api-integration.md](docs/frontend-api-integration.md) — request and response notes
- [docs/requirements-analysis.md](docs/requirements-analysis.md) — original product requirements

Some documents under `docs/` describe earlier designs. Where a document and the code disagree, trust the code.
