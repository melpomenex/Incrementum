-- Fix collections table: add any columns missing from earlier incomplete migration
ALTER TABLE collections ADD COLUMN is_default TEXT NOT NULL DEFAULT 0;
ALTER TABLE collections ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'));
ALTER TABLE collections ADD COLUMN modified_at TEXT NOT NULL DEFAULT (datetime('now'));

-- Ensure the default Personal collection exists with correct flags
INSERT OR IGNORE INTO collections (id, name, is_default, created_at, modified_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'Personal', '1', datetime('now'), datetime('now'));
UPDATE collections SET is_default = '1' WHERE id = '00000000-0000-0000-0000-000000000001';
