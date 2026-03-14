#!/bin/bash
set -e

npm install

# Run pending SQL migration files (all use IF NOT EXISTS — safe and idempotent)
for f in migrations/*.sql; do
  [ -f "$f" ] || continue
  echo "Running migration: $f"
  node -e "
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(fs.readFileSync(process.argv[1], 'utf-8')).then(() => { console.log('OK'); pool.end(); }).catch(e => { console.error('FAIL:', e.message); pool.end(); process.exit(1); });
" "$f"
done

echo "Post-merge setup complete."
