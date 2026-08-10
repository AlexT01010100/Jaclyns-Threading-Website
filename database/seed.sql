-- Seed data for initial time slots
-- Generates 30-minute slots from 9:00 AM to 5:00 PM, Monday-Friday, for the
-- next 90 days. Uses ensure_time_slots() from schema.sql so the same logic
-- that seeds this initial window is what the app calls later to keep the
-- calendar rolling forward (see server.js's startup/daily top-up job).
SELECT ensure_time_slots(CURRENT_DATE, (CURRENT_DATE + INTERVAL '90 days')::date);
