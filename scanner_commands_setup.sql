-- Run this in Supabase SQL Editor to support Remote Scanner Commands

-- 1. Ensure 'members' table has zk_id
ALTER TABLE members ADD COLUMN IF NOT EXISTS zk_id VARCHAR(50);

-- 2. Create the scanner_commands table
CREATE TABLE IF NOT EXISTS scanner_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    command_type VARCHAR(50) NOT NULL, -- e.g. 'ENROLL'
    user_id VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Add index for faster polling by the bridge
CREATE INDEX IF NOT EXISTS idx_scanner_commands_status ON scanner_commands(status);
