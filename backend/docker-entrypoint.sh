#!/usr/bin/env bash
set -e

echo "==> Waiting for Postgres at ${DATABASE_URL} ..."
python - <<'PY'
import os, time, sys
import sqlalchemy as sa

url = os.environ["DATABASE_URL"]
for attempt in range(60):
    try:
        sa.create_engine(url).connect().close()
        print("    Postgres is up.")
        break
    except Exception as e:
        time.sleep(1)
else:
    print("    Postgres never became available.", file=sys.stderr)
    sys.exit(1)
PY

echo "==> Running Alembic migrations ..."
alembic upgrade head

echo "==> Seeding demo data (idempotent) ..."
python -m app.seed || true

echo "==> Starting API on :8000"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
