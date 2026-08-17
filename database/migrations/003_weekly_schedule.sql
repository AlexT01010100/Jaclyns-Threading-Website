-- Migration: adds an editable weekly availability template (weekly_schedule)
-- so the admin can change business hours from the admin panel instead of
-- needing a code deploy. Replaces the old hardcoded ensure_time_slots()
-- (always Mon-Fri 9:00-17:00) with sync_time_slots_to_schedule(), which
-- reads the template and - critically - only ever adds/removes UNBOOKED
-- slots. A slot tied to a real appointment is never touched, no matter what
-- the template says.
--
-- Run with: docker exec -i jaclyns-threading-db psql -U postgres -d jaclyns_threading < database/migrations/003_weekly_schedule.sql

CREATE TABLE IF NOT EXISTS weekly_schedule (
    day_of_week INTEGER PRIMARY KEY CHECK (day_of_week BETWEEN 0 AND 6),
    is_open BOOLEAN NOT NULL DEFAULT FALSE,
    start_time TIME,
    end_time TIME,
    CHECK (NOT is_open OR (start_time IS NOT NULL AND end_time IS NOT NULL AND start_time <= end_time))
);

-- Seed with the site's existing hardcoded hours so this migration doesn't
-- silently change anything - edit it afterward from the admin panel.
INSERT INTO weekly_schedule (day_of_week, is_open, start_time, end_time) VALUES
    (0, FALSE, NULL, NULL),
    (1, TRUE, '09:00', '17:00'),
    (2, TRUE, '09:00', '17:00'),
    (3, TRUE, '09:00', '17:00'),
    (4, TRUE, '09:00', '17:00'),
    (5, TRUE, '09:00', '17:00'),
    (6, FALSE, NULL, NULL)
ON CONFLICT (day_of_week) DO NOTHING;

CREATE OR REPLACE FUNCTION sync_time_slots_to_schedule(start_date DATE, end_date DATE)
RETURNS VOID AS $$
BEGIN
    CREATE TEMP TABLE _should_exist ON COMMIT DROP AS
    SELECT d::date AS slot_date, t::time AS time_slot
    FROM generate_series(start_date, end_date, INTERVAL '1 day') AS d
    JOIN weekly_schedule ws
        ON ws.day_of_week = EXTRACT(DOW FROM d)::int
        AND ws.is_open = TRUE
    CROSS JOIN LATERAL generate_series(
        (d::date + ws.start_time)::timestamp,
        (d::date + ws.end_time)::timestamp,
        INTERVAL '30 minutes'
    ) AS t;

    INSERT INTO time_slots (slot_date, time_slot, is_available)
    SELECT slot_date, time_slot, TRUE FROM _should_exist
    ON CONFLICT (slot_date, time_slot) DO NOTHING;

    DELETE FROM time_slots ts
    WHERE ts.slot_date BETWEEN start_date AND end_date
      AND ts.appointment_id IS NULL
      AND NOT EXISTS (
          SELECT 1 FROM _should_exist se
          WHERE se.slot_date = ts.slot_date AND se.time_slot = ts.time_slot
      );

    DROP TABLE _should_exist;
END;
$$ LANGUAGE plpgsql;

-- Apply the (currently unchanged) schedule to the existing rolling window
-- immediately, so the new function's behavior is verified on real data
-- before server.js switches over to calling it instead of ensure_time_slots.
SELECT sync_time_slots_to_schedule(CURRENT_DATE, (CURRENT_DATE + INTERVAL '90 days')::date);

-- The old function is superseded - nothing calls it anymore after this
-- deploy, so drop it rather than leave dead code sitting in the database.
DROP FUNCTION IF EXISTS ensure_time_slots(DATE, DATE);
