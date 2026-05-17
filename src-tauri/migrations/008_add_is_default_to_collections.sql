-- Add missing is_default column to collections table
ALTER TABLE collections ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT 0;

-- Ensure the default Personal collection has is_default = 1
UPDATE collections SET is_default = 1 WHERE id = '00000000-0000-0000-0000-000000000001';
