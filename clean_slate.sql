-- IRON LEDGER: TOTAL DATABASE PURGE
-- DANGER: This script will delete EVERY piece of member, financial, and hardware data.
-- PURPOSE: Use this to start fresh before production handover.

-- 1. Clear Hardware Sync Commands
TRUNCATE TABLE "scanner_commands" CASCADE;

-- 2. Clear Attendance Activity Logs
TRUNCATE TABLE "attendance_logs" CASCADE;

-- 3. Clear Financial Ledger (Income/Expenses)
TRUNCATE TABLE "ledger_entries" CASCADE;

-- 4. Clear Member Fingerprints and Profiles
TRUNCATE TABLE "members" CASCADE;

-- 5. Clear Trainer Registry
TRUNCATE TABLE "trainers" CASCADE;

-- 6. Reset Internal ID Sequences (Optional but recommended for fresh start)
-- This ensures the next created items start with ID 1.
DO $$ 
DECLARE
    seq_record RECORD;
BEGIN
    FOR seq_record IN (
        SELECT n.nspname, c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'S' 
        AND n.nspname = 'public'
    ) 
    LOOP
        EXECUTE 'ALTER SEQUENCE ' || quote_ident(seq_record.nspname) || '.' || quote_ident(seq_record.relname) || ' RESTART WITH 1';
    END LOOP;
END $$;

-- 7. Verification Query (Should return all 0s)
SELECT 
    (SELECT COUNT(*) FROM members) as total_members,
    (SELECT COUNT(*) FROM attendance_logs) as total_logs,
    (SELECT COUNT(*) FROM ledger_entries) as total_ledger,
    (SELECT COUNT(*) FROM trainers) as total_trainers,
    (SELECT COUNT(*) FROM scanner_commands) as total_commands;
