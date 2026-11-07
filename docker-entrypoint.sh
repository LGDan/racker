#!/bin/sh
set -eu

echo "Waiting for PostgreSQL and applying schema..."
i=0
until npx prisma db push --accept-data-loss --skip-generate; do
  i=$((i + 1))
  if [ "$i" -gt 20 ]; then
    echo "Database did not become ready."
    exit 1
  fi
  echo "Database not ready (attempt $i). Retrying..."
  sleep 3
done

echo "Seeding demo datacenter (skipped if users already exist)..."
npx tsx prisma/seed.ts

echo "Starting Racker on port 3000..."
exec npx next start -H 0.0.0.0 -p 3000
