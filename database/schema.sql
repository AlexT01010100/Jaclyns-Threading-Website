-- Create database schema for Jaclyn's Beauty

-- Appointments table
CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    confirmation_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    service VARCHAR(100) NOT NULL,
    appointment_date DATE NOT NULL,
    time_slot TIME NOT NULL,
    status VARCHAR(20) DEFAULT 'booked' CHECK (status IN ('booked', 'cancelled', 'completed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Time slots table (for managing availability)
CREATE TABLE IF NOT EXISTS time_slots (
    id SERIAL PRIMARY KEY,
    slot_date DATE NOT NULL,
    time_slot TIME NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(slot_date, time_slot)
);

-- Contact messages table
CREATE TABLE IF NOT EXISTS contact_messages (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    email VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin users. Replaces static ADMIN_USERNAME/ADMIN_PASSWORD_HASH env vars so
-- the admin can change their own password in-app (POST /admin/change-password)
-- without a redeploy. Starts empty; server.js's seedAdminUserIfEmpty() seeds
-- one row from .env the first time the app runs against an empty table, then
-- never touches it again - see that function for why it's safe to call on
-- every startup.
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reviews table (for future use)
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_appointments_confirmation ON appointments(confirmation_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_time_slots_date ON time_slots(slot_date);
CREATE INDEX idx_time_slots_available ON time_slots(is_available);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for appointments table
CREATE TRIGGER update_appointments_updated_at 
    BEFORE UPDATE ON appointments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Sessions table for express-session with connect-pg-simple
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
) WITH (OIDS=FALSE);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- The admin's recurring weekly availability template - one row per day of
-- the week (0=Sunday..6=Saturday). is_open=false days have no slots. This is
-- what actually drives the rolling calendar now (see sync_time_slots_to_schedule
-- below); it's editable via PUT /api/admin/weekly-schedule instead of being
-- hardcoded, so changing hours doesn't require a code deploy.
CREATE TABLE IF NOT EXISTS weekly_schedule (
    day_of_week INTEGER PRIMARY KEY CHECK (day_of_week BETWEEN 0 AND 6),
    is_open BOOLEAN NOT NULL DEFAULT FALSE,
    start_time TIME,
    end_time TIME,
    CHECK (NOT is_open OR (start_time IS NOT NULL AND end_time IS NOT NULL AND start_time <= end_time))
);

-- Seed the template with the site's original hardcoded hours (Mon-Fri,
-- 9:00-17:00) so deploying this doesn't silently change anything - the
-- admin can then edit it from the admin panel.
INSERT INTO weekly_schedule (day_of_week, is_open, start_time, end_time) VALUES
    (0, FALSE, NULL, NULL),      -- Sunday
    (1, TRUE, '09:00', '17:00'), -- Monday
    (2, TRUE, '09:00', '17:00'), -- Tuesday
    (3, TRUE, '09:00', '17:00'), -- Wednesday
    (4, TRUE, '09:00', '17:00'), -- Thursday
    (5, TRUE, '09:00', '17:00'), -- Friday
    (6, FALSE, NULL, NULL)       -- Saturday
ON CONFLICT (day_of_week) DO NOTHING;

-- Syncs time_slots for [start_date, end_date] to match the current
-- weekly_schedule template: adds any 30-minute slots that should exist per
-- the template but don't yet, and removes any slot that's no longer part of
-- the template - but ONLY if that slot is unbooked (appointment_id IS NULL).
-- A slot tied to a real appointment is never touched by this function,
-- regardless of what the template says, so changing your hours can never
-- delete or orphan an existing booking. Safe to call repeatedly (e.g. once
-- daily to keep the calendar rolling forward, and once immediately whenever
-- the template itself is edited so the change takes effect right away
-- instead of waiting up to 90 days for the rolling window to catch up).
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
