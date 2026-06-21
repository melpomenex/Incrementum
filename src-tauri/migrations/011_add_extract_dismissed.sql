-- Extract lifecycle: dismissed flag (mirrors documents.is_dismissed).
-- Dismissed extracts leave the review queue but remain in the library,
-- enabling the SuperMemo-style Dismiss / Forget / Done workflow.

ALTER TABLE extracts ADD COLUMN is_dismissed INTEGER NOT NULL DEFAULT 0;
