# Food Dose Tiffin Service 🍱

A single centralized platform for a home-style tiffin / meal-subscription service:

- **Public website** — home, menu, plans, about, areas we serve, contact, with a
  persistent *Enquire on WhatsApp* button.
- **User panel** — dashboard, subscription, place an order, meal calendar, meal
  history, cancel meals, credits & carry-forward, profile & address, invoices.
- **Admin panel** — dashboard, total meals, cancellations, customers, orders, meal
  demand, food requests, area-wise report, settings.

The public site, both panels, and the database all read and write the **same**
order and cancellation data — every customer action shows up on the admin side with
no manual sync step (the admin views poll and refresh on focus).

Stack: **Next.js 14** (App Router, TS, Tailwind) · **FastAPI** + **SQLAlchemy** +
**Alembic** · **PostgreSQL** · **Docker Compose**.

```
foodservice-platform/
├── backend/            FastAPI app, SQLAlchemy models, Alembic migrations, tests
├── frontend/           Next.js — (site) public, (panel) customer, /admin
├── scripts/            placeholder-image generator
└── docker-compose.yml  Postgres + backend + frontend, one command
```

---

## Quick start (Docker)

```bash
cp .env.example .env          # optional — sane defaults are baked into compose
docker compose up --build
```

| URL | What |
|-----|------|
| http://localhost:3000 | Public website + user panel + admin panel |
| http://localhost:8000/docs | Backend OpenAPI docs |

On first boot the backend runs **Alembic migrations** and an idempotent **seed**.
By default (`SEED_MODE=full`) that includes demo customers (with areas), the menu,
subscriptions, a few cancellations and the carry-forward credit each earned, three
published plans, six service areas, business settings, and previous/current-month
invoices. Set `SEED_MODE=minimal` to seed only the menu, plans, service areas, and
business settings — no demo customers, subscriptions, or orders — leaving the
customers table empty and ready for real signups.

### Demo logins

| Role | Credentials |
|------|-------------|
| Customer | phone **9000000001** … **9000000005**, PIN **1234** |
| Admin | username **admin**, password **admin123** |

New customers can self-register from `/login/customer`; the kitchen then sets up
their subscription from the admin **Customers** screen.

---

## Design system

Dark-green sidebar / headings / primary buttons, warm off-white (cream) backgrounds,
white cards with soft shadows and rounded corners. Red/orange is reserved for
cancellations and warnings; a green check marks consumed/confirmed. Fully responsive
— the fixed sidebar collapses to a drawer on small screens.

---

## How it works

- **Subscription** — one meal type (lunch/dinner), a set of weekdays, a
  `[start, end]` window, a per-plate price snapshotted at creation, and a status.
  The kitchen creates and edits these per customer.
- **Cancel a meal** — a customer marks a single scheduled `(subscription, date)` as
  cancelled, allowed only **before that meal's cutoff** (lunch 10:00, dinner 18:00,
  server-enforced against the app clock).
- **Carry-forward credit** — a qualifying cancellation books a `MealCredit` for the
  plate value on the customer's account. It is a standing balance shown on the
  dashboard, the **Credits & Carry Forward** page and the Credits tab of **Meal
  History**; restoring the meal voids the credit.
- **Meal / order records** — every meal record carries customer, order date
  (subscription created), start date, amount, meal type and status
  (upcoming / consumed / cancelled). Every cancellation stores its own
  timestamp, visible to the customer and in the admin **Cancellations** report.
- **Place an order** — a logged-in customer can buy a one-off plate outside their
  subscription from the **Place an Order** panel page: pick a date, meal and dish
  from the live menu. It creates the same `AdHocOrder` row an admin-entered order
  does (`app/routers/orders.py` for admin, `app/routers/customer_orders.py` for the
  customer's own create/list, sharing pricing logic in
  `app/services/adhoc_orders.py`), so it bills, reports and shows up in the kitchen
  plate count exactly like one the kitchen enters manually. The admin **Orders**
  tab lists every ad-hoc order (either source) with a status dropdown
  (confirmed / preparing / delivered / cancelled) and a "new" (confirmed) count
  badge in the sidebar. On the customer side, one-off orders are folded into
  every "all my meals" view alongside subscription meals — dashboard stats
  (Total/Consumed/Remaining), Upcoming Meals, Recent Activity, Meal History
  (all four tabs) and the Meal Calendar all include them, tagged with a small
  **One-off** badge so the two sources stay distinguishable. A customer can
  also cancel their own upcoming one-off order (before the same lunch/dinner
  cutoff as ordering) from **Cancel Meals** or the calendar's day panel. Just
  like a subscription skip, this books a `MealCredit` for the order's value
  (`app/services/credits.py:issue_for_order_cancel`, keyed on the order itself
  so it can't collide with a subscription credit on the same date/meal) —
  it shows up on **Credits & Carry Forward** and the admin credit balance
  immediately, tagged **One-off** to distinguish it.
- **Kitchen demand** — for any date, plates to cook per meal = active subscriptions
  covering that day, minus cancellations, plus ad-hoc orders, with a per-dish prep
  list. Drives the admin dashboard, **Meal Demand** and **Total Meals**.
- **Monthly invoicing** — the kitchen generates a per-customer invoice for a month:
  served (covered, not cancelled, not future) plates × price, plus ad-hoc orders.
- **Food requests** — a "suggest a dish" inbox: any logged-in customer can suggest
  an item that isn't on the fixed weekly menu from the **Menu** page. The kitchen
  reviews suggestions in the admin **Food Requests** tab (new / reviewed / added to
  menu / declined) and a badge shows the count still marked "new". This is purely a
  suggestion inbox — it never changes `MenuItem`; adding a dish for real is still a
  manual step in the menu manager.

---

## API surface (`/api/v1`)

```
POST /auth/customer/register            POST /auth/customer/login
POST /auth/admin/login                  GET  /auth/me      PATCH /auth/me/address

GET  /menu                              (admin: POST/PATCH/DELETE)
GET  /plans        GET /service-areas   GET /site/settings          (public)

GET  /subscriptions/me
POST /subscriptions/{id}/skip           DELETE /subscriptions/{id}/skip/{date}
POST /subscriptions/{id}/cancel

GET  /panel/dashboard                   GET /panel/credits
GET  /panel/meals/history?filter=       GET /panel/meals/calendar?year=&month=
GET  /billing/me

POST /food-requests                     (logged-in customer suggests a dish)
GET  /orders             POST /orders   DELETE /orders/{id}   (customer's own ad-hoc orders)

GET  /admin/dashboard                   GET /admin/meal-demand?date=
GET  /admin/total-meals?date_from=&date_to=
GET  /admin/cancellations?date_from=&date_to=
GET  /admin/area-report
GET  /admin/customers    GET /admin/customers/export   POST /admin/customers
GET  /admin/customers/{id}              POST /admin/customers/{id}/subscription
PATCH /admin/subscriptions/{id}
GET/PUT /admin/settings
GET  /admin/billing      POST /admin/invoices/generate
GET  /admin/food-requests?status=       PATCH /admin/food-requests/{id}
GET  /admin/orders?status=&meal_type=&q=&date_from=&date_to=   POST /admin/orders
GET  /admin/orders/{id}  PATCH /admin/orders/{id}   DELETE /admin/orders/{id}
```

---

## Running without Docker (local dev)

### Backend

```bash
cd backend
python -m venv .venv && . .venv/Scripts/activate      # Windows
pip install -r requirements.txt
export DATABASE_URL=postgresql+psycopg://tiffin:tiffin@localhost:5432/fooddose_tiffin
alembic upgrade head
python -m app.seed                      # add --reset to wipe & rebuild
# SEED_MODE=minimal python -m app.seed  # menu/plans/service areas only, no demo customers
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
cd backend && pytest          # cutoff, subscription→invoice flow, credits, panel & admin reports
```

The suite wipes every table before every test, so it always runs against a throwaway
database — never the real one. It defaults to a local sqlite file
(`test_gharse.db`) with no setup needed; `tests/conftest.py` refuses to start
(hard error, before any table is touched) unless `DATABASE_URL` is sqlite or a
Postgres URL with `test` in the database name. Inside Docker, since the backend
container's `DATABASE_URL` points at the real app database, run tests with an
explicit override:

```bash
docker compose run --rm --entrypoint "" -e DATABASE_URL=sqlite+pysqlite:///./test_gharse.db backend pytest
```

---

## Environment variables

| Variable | Default | Notes |
|----------|---------|-------|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `tiffin` / `tiffin` / `fooddose_tiffin` | Postgres container |
| `DATABASE_URL` | derived | `postgresql+psycopg://…` |
| `JWT_SECRET` | `change-me-in-production-please` | **set in production** |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `admin` / `admin123` | seeded admin login |
| `APP_TIMEZONE` | `Asia/Kolkata` | timezone the 10:00 / 18:00 cutoffs run in |
| `SEED_MODE` | `full` | `full` seeds demo customers/subscriptions/orders/invoices too; `minimal` seeds only menu/plans/service areas/site settings, leaving customers empty for real signups |
| `NEXT_PUBLIC_API_BASE` | `http://localhost:8000/api/v1` | browser → API URL (build-time for the image) |

Business details (WhatsApp number, contact, service hours, kitchen capacity) are
editable at runtime from the admin **Settings** screen.

---

## Notes

- Demo build. Change `JWT_SECRET` and the admin password for any real use.
- Menu / hero images ship as warm SVG placeholders in `frontend/public/images/`;
  drop in `<slug>.png` files to replace them (the frontend prefers `.png`).
- Testimonial videos point at `frontend/public/videos/testimonial-*.mp4` — add real
  files there or edit `frontend/lib/siteContent.ts`.
