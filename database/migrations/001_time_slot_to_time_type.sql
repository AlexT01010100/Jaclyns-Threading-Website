-- Migration: convert time_slot columns from VARCHAR("9:00 AM") to a real TIME type.
--
-- Why: the old VARCHAR column sorted alphabetically, not chronologically
-- ("1:00 PM" < "10:00 AM" < "9:00 AM" as text), which made multi-slot
-- bookings (anything needing more than one consecutive 30-minute slot) grab
-- the wrong block of time. See server.js's /book_appointment handler.
--
-- This only needs to run once against an EXISTING database (a fresh
-- deployment already gets the TIME column from schema.sql). Safe to re-run:
-- CREATE OR REPLACE and a column-type check make every step idempotent.
--
-- Run with: docker exec -i jaclyns-threading-db psql -U postgres -d jaclyns_threading < database/migrations/001_time_slot_to_time_type.sql
-- Take a backup first: docker exec jaclyns-threading-db pg_dump -U postgres jaclyns_threading > backup_before_migration.sql

DO $$
BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'time_slots' AND column_name = 'time_slot') = 'character varying' THEN
        ALTER TABLE time_slots ALTER COLUMN time_slot TYPE TIME USING time_slot::time;
        RAISE NOTICE 'time_slots.time_slot converted to TIME';
    ELSE
        RAISE NOTICE 'time_slots.time_slot is already TIME - skipping';
    END IF;

    IF (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'appointments' AND column_name = 'time_slot') = 'character varying' THEN
        ALTER TABLE appointments ALTER COLUMN time_slot TYPE TIME USING time_slot::time;
        RAISE NOTICE 'appointments.time_slot converted to TIME';
    ELSE
        RAISE NOTICE 'appointments.time_slot is already TIME - skipping';
    END IF;
END $$;

-- Add the rolling-slot-generation function (idempotent - CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION ensure_time_slots(start_date DATE, end_date DATE)
RETURNS VOID AS $$
BEGIN
    INSERT INTO time_slots (slot_date, time_slot, is_available)
    SELECT d::date, t::time, TRUE
    FROM generate_series(start_date, end_date, INTERVAL '1 day') AS d
    CROSS JOIN generate_series(
        '2000-01-01 09:00'::timestamp,
        '2000-01-01 17:00'::timestamp,
        INTERVAL '30 minutes'
    ) AS t
    WHERE EXTRACT(DOW FROM d) NOT IN (0, 6)
    ON CONFLICT (slot_date, time_slot) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Top up the calendar immediately so nothing regresses while you deploy
SELECT ensure_time_slots(CURRENT_DATE, (CURRENT_DATE + INTERVAL '90 days')::date);
