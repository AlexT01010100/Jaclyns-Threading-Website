-- Migration: add admin_users table so the admin password can be rotated
-- in-app (POST /admin/change-password) instead of requiring a redeploy every
-- time it changes.
--
-- The table starts empty. server.js seeds one row from ADMIN_USERNAME /
-- ADMIN_PASSWORD_HASH in .env the next time the app starts (see
-- seedAdminUserIfEmpty() - it only inserts when the table is empty, so it's
-- a one-time bootstrap, not a reset-on-every-restart). Nothing else to do
-- here beyond creating the table.
--
-- Run with: docker exec -i jaclyns-threading-db psql -U postgres -d jaclyns_threading < database/migrations/002_admin_users_table.sql

CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
