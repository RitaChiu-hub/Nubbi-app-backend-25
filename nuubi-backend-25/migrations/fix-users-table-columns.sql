-- Migration to add missing columns to users table
-- Run this script to fix the database schema mismatch

-- Add avatar_url column if it doesn't exist
ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS avatar_url VARCHAR;

-- Add last_signin column if it doesn't exist
ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS last_signin TIMESTAMP NULL;

-- Add created_at column if it doesn't exist
ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Add updated_at column if it doesn't exist
ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Add push_notification_token column if it doesn't exist
ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS push_notification_token VARCHAR(255);

-- Add created_via_canvas column if it doesn't exist (from database_fixed.sql)
ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS created_via_canvas BOOLEAN DEFAULT FALSE;






