#!/bin/sh
# Runs once, on an empty data volume. One least-privilege role + database per product.
set -e
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" <<SQL
CREATE ROLE adano LOGIN PASSWORD '${ADANO_DB_PASSWORD}';
CREATE DATABASE adano OWNER adano;
CREATE ROLE fraudless LOGIN PASSWORD '${FRAUDLESS_DB_PASSWORD}';
CREATE DATABASE fraudless OWNER fraudless;
-- by default every role may connect to every database; keep each product to its own
REVOKE CONNECT ON DATABASE adano FROM PUBLIC;
REVOKE CONNECT ON DATABASE fraudless FROM PUBLIC;
SQL
