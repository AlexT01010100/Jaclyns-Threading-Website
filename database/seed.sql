-- Seed data for initial time slots. Generates slots for the next 90 days
-- according to the weekly_schedule template (seeded in schema.sql with the
-- site's original Mon-Fri 9:00-17:00 hours). Uses the same
-- sync_time_slots_to_schedule() function server.js calls later to keep the
-- calendar rolling forward, so there's one source of truth for this logic.
SELECT sync_time_slots_to_schedule(CURRENT_DATE, (CURRENT_DATE + INTERVAL '90 days')::date);
