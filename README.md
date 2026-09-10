# GharSe Tiffin 🍱

A subscription-based home-tiffin management system, built as a real monorepo:
**Next.js** frontend, **FastAPI** backend, **PostgreSQL** via **SQLAlchemy + Alembic**.

The kitchen owner creates customers and sets each one a standing **subscription** — a
meal (lunch or dinner) on a chosen set of weekdays, at an agreed per-plate price.
Customers see their plan, **skip** any upcoming day before a strict server-enforced
cutoff (and aren't billed for it), and pay a **monthly invoice** the owner generates
from the plates actually served. The owner also gets a **daily plate report** for
kitchen prep, a menu manager, and a demo clock for demonstrating cutoffs.

```
gharse-tiffin/
├── backend/            FastAPI app, SQLAlchemy models, Alembic migrations, tests
├── frontend/           Next.js (App Router, TS) + Tailwind
├── scripts/            placeholder-image generator
└── docker-compose.yml  Postgres + backend + frontend, one command
```

---

## Quick start (Docker)

**Prerequisites:** Docker + Docker Compose.

```bash
cp .env.example .env          # optional — sane defaults are baked into compose
docker compose up --build
```

Then open:

| URL | What |
|-----|------|
| http://localhost:3000 | Customer + owner web app |
| http://localhost:8000/docs | Backend OpenAPI docs |
| http://localhost:8000/api/v1/meta | Capability flags (timezone, cutoffs, server clock) |

On first boot the backend automatically runs **Alembic migrations** and an idempotent
**seed script** that creates demo customers, the menu, subscriptions, a few skips, and
one generated previous-month invoice per customer.

### Demo logins

| Role | Credentials |
|------|-------------|
| Customer | phone **9000000001** … **9000000005**, PIN **1234** |
| Owner / admin | username **admin**, password **admin123** |

You can also self-register a new customer from the login screen; the owner then sets
up their subscription.

---

## Running without Docker (local dev)

### Backend

```bash
cd backend
python -m venv .venv && . .venv/Scripts/activate      # Windows
#                       source .venv/bin/activate      # macOS/Linux
pip install -r requirements.txt

# Point at a local Postgres (or run `docker compose up db`):
export DATABASE_URL=postgresql+psycopg://tiffin:tiffin@localhost:5432/gharse_tiffin

alembic upgrade head
python -m app.seed                      # add --reset to wipe & rebuild
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
echo 'NEXT_PUBLIC_API_BASE=http://localhost:8000/api/v1' > .env.local
npm run dev            # http://localhost:3000
```

### Tests

```bash
cd backend
pip install -r requirements.txt
pytest                 # cutoff logic + the subscription→plate-report→invoice flow, on a throwaway SQLite DB
```

---

## Environment variables

All are optional for a demo — defaults live in `docker-compose.yml` and
`backend/app/config.py`.

| Variable | Default | Notes |
|----------|---------|-------|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `tiffin` / `tiffin` / `gharse_tiffin` | Postgres container |
| `DATABASE_URL` | derived from the above | SQLAlchemy URL (`postgresql+psycopg://…`) |
| `JWT_SECRET` | `change-me-in-production-please` | **set this in production** |
| `JWT_EXPIRE_MINUTES` | `720` | token lifetime |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `admin` / `admin123` | fixed owner login (hashed into `admins` on seed) |
| `APP_TIMEZONE` | `Asia/Kolkata` | timezone the 10:00 / 18:00 cutoffs run in |
| `NEXT_PUBLIC_API_BASE` | `http://localhost:8000/api/v1` | URL the browser uses for the API (build-time for the frontend image) |

---

## How it works

- **Subscription** — one meal type, a set of weekdays (Mon…Sun), a `[start, end]` date
  window (end optional), a per-plate `price` snapshotted at creation, and a status
  (`active` / `paused` / `cancelled`). One lunch and one dinner subscription per
  customer. The owner creates and edits these.
- **Skip** — a customer (or the owner) marks a single scheduled `(subscription, date)`
  as skipped. Allowed only **before that meal's cutoff** on that date. Skipped days
  drop out of the plate report and the invoice.
- **Plate report** — for any date, the number of plates to cook per meal = active
  subscriptions whose weekday set and date window cover that day, minus skips, plus the
  per-customer breakdown. Drives the dashboard and the Plate Report screen.
- **Monthly invoicing** — the owner generates/refreshes a per-customer invoice for a
  month: one line per subscription for `served plates × price`, where "served" means
  covered, not skipped, and not in the future. Invoices are then marked paid — cash
  (recorded by the owner) or a simulated online payment by the customer.

---

## What's simulated vs. real

| Area | Status | Detail |
|------|--------|--------|
| **Database** | ✅ Real | PostgreSQL, SQLAlchemy models, **Alembic** migrations (no `create_all` in the app). |
| **Backend API** | ✅ Real | FastAPI, JWT auth, everything under `/api/v1`. |
| **Cutoff enforcement** | ✅ Real | Server-side, checked against the app clock. Lunch locks at 10:00, dinner at 18:00 on the delivery day. An admin **demo clock override** (`/api/v1/admin/clock`, and the 🕒 control in the owner header) lets you move time to demonstrate cutoffs without waiting. |
| **Plate report / billing maths** | ✅ Real | Plain date arithmetic over subscriptions and skips — see `backend/app/services/plates.py` and `invoicing.py`. |
| **Payments** | ⚠️ **Simulated** | No Razorpay account, no API keys, no real money. `SimulatedRazorpayGateway` invents a `pay_demo_…` transaction id after a short artificial delay and marks the invoice paid. The UI says "demo payment — no real money moves" and the gateway sits behind a `PaymentGateway` interface (`backend/app/services/payments.py`) so swapping in real Razorpay later is a contained change. |
| **SMS / OTP** | ⚠️ Absent | Login is phone + 4-digit PIN (bcrypt-hashed). No OTP, no SMS provider. |
| **Menu / hero images** | ⚠️ **Placeholder path used** | The intended path was real AI-generated food photography, but the image-generation connector was unavailable at build time (auth expired), so the repo ships **warm, food-styled SVG placeholders** generated by `scripts/generate_placeholder_images.py`. See below to swap in real photos. |

### Swapping in real food photos

1. Generate/collect one image per menu item plus a hero banner.
2. Drop them into `frontend/public/images/` as `<slug>.png` (e.g.
   `lunch-rajma-chawal.png`, `hero-tiffin.png`). The frontend prefers `.png` and
   falls back to `.svg`, so existing `image_url` values keep working.
3. Or set each `menu_items.image_url` from the owner **Menu manager** screen.

### Swapping in real Razorpay

Implement the `PaymentGateway` protocol in `backend/app/services/payments.py`
with the Razorpay SDK (create order → client checkout → verify webhook
signature) and change the object returned by `get_gateway()`. Routers depend only
on the interface, so nothing else changes.

---

## API surface (`/api/v1`)

```
POST /auth/customer/register            POST /auth/customer/login
POST /auth/admin/login                  GET  /auth/me      PATCH /auth/me/address

GET  /menu                              POST /menu   PATCH /menu/{id}   DELETE /menu/{id}   (admin)

GET  /subscriptions/me
POST /subscriptions/{id}/skip           DELETE /subscriptions/{id}/skip/{date}
POST /subscriptions/{id}/cancel

GET  /billing/me                        POST /billing/invoices/{id}/pay

GET  /admin/dashboard                   GET  /admin/plate-report?date=
GET  /admin/customers                   POST /admin/customers
GET  /admin/customers/{id}/log          POST /admin/customers/{id}/subscription
PATCH /admin/subscriptions/{id}
POST /admin/subscriptions/{id}/skip     DELETE /admin/subscriptions/{id}/skip/{date}
GET  /admin/billing?year=&month=        POST /admin/invoices/generate?year=&month=
POST /admin/invoices/{id}/mark-paid
GET/PUT /admin/clock

GET  /meta   (public capability flags)
```

---

## Notes & limitations

- This is a demo build. `JWT_SECRET` and the admin password must be changed for any real use.
- The demo clock override is global (one kitchen). Resetting it (🕒 → "Reset to real time") returns the whole system to the real clock.
- Invoices bill plates served up to "today" (the app clock); regenerating an unpaid
  invoice recomputes it, a paid invoice is left untouched.
