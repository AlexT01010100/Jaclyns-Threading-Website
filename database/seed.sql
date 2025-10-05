-- Seed data for initial time slots
-- This script generates available time slots for the next 90 days
-- Generates 30-minute intervals from 9:00 AM to 5:00 PM

-- Function to generate time slots for a date range
DO $$
DECLARE
    start_date DATE := CURRENT_DATE;
    end_date DATE := CURRENT_DATE + INTERVAL '90 days';
    time_slots TEXT[] := ARRAY[
        '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
        '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM',
        '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM'
    ];
    slot TEXT;
BEGIN
    WHILE start_date <= end_date LOOP
        -- Skip Sundays (0) and Mondays (1) if closed on those days
        IF EXTRACT(DOW FROM start_date) NOT IN (0, 1) THEN
            FOREACH slot IN ARRAY time_slots
            LOOP
                INSERT INTO time_slots (slot_date, time_slot, is_available)
                VALUES (start_date, slot, TRUE)
                ON CONFLICT (slot_date, time_slot) DO NOTHING;
            END LOOP;
        END IF;
        start_date := start_date + INTERVAL '1 day';
    END LOOP;
END $$;
