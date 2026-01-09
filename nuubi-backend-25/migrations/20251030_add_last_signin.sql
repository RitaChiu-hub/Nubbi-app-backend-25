-- Add last_signin column to users
ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS last_signin TIMESTAMP NULL;


