-- Extract priority inheritance (SuperMemo-style IR priority chain)
-- Extracts now carry their own priority_score, inherited from the parent
-- document at creation time and used to order the reading queue.

ALTER TABLE extracts ADD COLUMN priority_score REAL NOT NULL DEFAULT 0.0;

-- Backfill: copy parent document priority into existing extracts so the
-- inheritance semantics apply retroactively. Documents without a priority
-- (NULL or 0) leave their extracts at the 0.0 default.
UPDATE extracts
SET priority_score = COALESCE(
    (SELECT d.priority_score FROM documents d WHERE d.id = extracts.document_id),
    0.0
);
