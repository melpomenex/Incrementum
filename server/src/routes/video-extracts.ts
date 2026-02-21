import { Router } from 'express';
import { getPool } from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { Card, createEmptyCard, fsrs, generatorParameters, Rating } from 'ts-fsrs';

export const videoExtractsRouter = Router();

// Initialize FSRS with default parameters
const f = fsrs(generatorParameters());

// Get all video extracts for a document
videoExtractsRouter.get('/document/:documentId', authMiddleware, async (req: AuthRequest, res, next) => {
    try {
        const pool = getPool();
        const { documentId } = req.params;
        const userId = req.userId!;

        // Verify user owns the document
        const docCheck = await pool.query(
            'SELECT id FROM documents WHERE id = $1 AND user_id = $2',
            [documentId, userId]
        );

        if (docCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found or not owned by user' });
        }

        const result = await pool.query(`
            SELECT id, document_id, start_time, end_time, title,
                   transcript_text, notes, tags, thumbnail_url,
                   memory_state, next_review_date, last_review_date,
                   review_count, reps, date_created, date_modified
            FROM video_extracts
            WHERE document_id = $1
            ORDER BY start_time ASC
        `, [documentId]);

        // Parse JSON fields
        const extracts = result.rows.map(row => ({
            ...row,
            tags: row.tags ? JSON.parse(row.tags) : [],
            memory_state: row.memory_state ? JSON.parse(row.memory_state) : null,
        }));

        res.json(extracts);
    } catch (error) {
        next(error);
    }
});

// Get a single video extract by ID
videoExtractsRouter.get('/:id', authMiddleware, async (req: AuthRequest, res, next) => {
    try {
        const pool = getPool();
        const { id } = req.params;
        const userId = req.userId!;

        const result = await pool.query(`
            SELECT ve.id, ve.document_id, ve.start_time, ve.end_time, ve.title,
                   ve.transcript_text, ve.notes, ve.tags, ve.thumbnail_url,
                   ve.memory_state, ve.next_review_date, ve.last_review_date,
                   ve.review_count, ve.reps, ve.date_created, ve.date_modified,
                   d.title as document_title
            FROM video_extracts ve
            JOIN documents d ON ve.document_id = d.id
            WHERE ve.id = $1 AND d.user_id = $2
        `, [id, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Video extract not found' });
        }

        const row = result.rows[0];
        const extract = {
            ...row,
            tags: row.tags ? JSON.parse(row.tags) : [],
            memory_state: row.memory_state ? JSON.parse(row.memory_state) : null,
        };

        res.json(extract);
    } catch (error) {
        next(error);
    }
});

// Get due video extracts (for review queue)
videoExtractsRouter.get('/due/before/:timestamp', authMiddleware, async (req: AuthRequest, res, next) => {
    try {
        const pool = getPool();
        const { timestamp } = req.params;
        const userId = req.userId!;
        const date = new Date(timestamp);

        const result = await pool.query(`
            SELECT ve.id, ve.document_id, ve.start_time, ve.end_time, ve.title,
                   ve.transcript_text, ve.notes, ve.tags, ve.thumbnail_url,
                   ve.memory_state, ve.next_review_date, ve.last_review_date,
                   ve.review_count, ve.reps, ve.date_created, ve.date_modified,
                   d.title as document_title
            FROM video_extracts ve
            JOIN documents d ON ve.document_id = d.id
            WHERE ve.next_review_date IS NOT NULL
              AND ve.next_review_date <= $1
              AND d.user_id = $2
            ORDER BY ve.next_review_date ASC
        `, [date.toISOString(), userId]);

        const extracts = result.rows.map(row => ({
            ...row,
            tags: row.tags ? JSON.parse(row.tags) : [],
            memory_state: row.memory_state ? JSON.parse(row.memory_state) : null,
        }));

        res.json(extracts);
    } catch (error) {
        next(error);
    }
});

// Create a new video extract
videoExtractsRouter.post('/', authMiddleware, async (req: AuthRequest, res, next) => {
    try {
        const pool = getPool();
        const userId = req.userId!;
        const {
            document_id,
            start_time,
            end_time,
            title,
            transcript_text,
            notes,
            tags,
            add_to_queue,
        } = req.body;

        // Validate required fields
        if (!document_id || start_time === undefined || end_time === undefined || !title) {
            return res.status(400).json({ error: 'Missing required fields: document_id, start_time, end_time, title' });
        }

        // Verify user owns the document
        const docCheck = await pool.query(
            'SELECT id FROM documents WHERE id = $1 AND user_id = $2',
            [document_id, userId]
        );

        if (docCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found or not owned by user' });
        }

        // Validate time range
        if (start_time < 0) {
            return res.status(400).json({ error: 'Start time cannot be negative' });
        }
        if (end_time <= start_time) {
            return res.status(400).json({ error: 'End time must be greater than start time' });
        }
        const duration = end_time - start_time;
        if (duration > 600) {
            return res.status(400).json({ error: 'Extract duration cannot exceed 10 minutes (600 seconds)' });
        }

        // Calculate next review date if adding to queue
        let next_review_date = null;
        if (add_to_queue) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            next_review_date = tomorrow.toISOString();
        }

        const result = await pool.query(`
            INSERT INTO video_extracts (
                id, document_id, start_time, end_time, title,
                transcript_text, notes, tags, next_review_date,
                date_created, date_modified
            ) VALUES (
                gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
            )
            RETURNING id, document_id, start_time, end_time, title,
                      transcript_text, notes, tags, next_review_date,
                      review_count, reps, date_created, date_modified
        `, [
            document_id,
            start_time,
            end_time,
            title,
            transcript_text || null,
            notes || null,
            JSON.stringify(tags || []),
            next_review_date,
        ]);

        const row = result.rows[0];
        const extract = {
            ...row,
            tags: row.tags ? JSON.parse(row.tags) : [],
        };

        res.status(201).json(extract);
    } catch (error) {
        next(error);
    }
});

// Update a video extract
videoExtractsRouter.put('/:id', authMiddleware, async (req: AuthRequest, res, next) => {
    try {
        const pool = getPool();
        const { id } = req.params;
        const userId = req.userId!;
        const { title, notes, tags } = req.body;

        // Verify user owns the extract
        const checkResult = await pool.query(`
            SELECT ve.id
            FROM video_extracts ve
            JOIN documents d ON ve.document_id = d.id
            WHERE ve.id = $1 AND d.user_id = $2
        `, [id, userId]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Video extract not found or not owned by user' });
        }

        const result = await pool.query(`
            UPDATE video_extracts
            SET title = COALESCE($2, title),
                notes = COALESCE($3, notes),
                tags = COALESCE($4, tags),
                date_modified = NOW()
            WHERE id = $1
            RETURNING id, document_id, start_time, end_time, title,
                      transcript_text, notes, tags, thumbnail_url,
                      memory_state, next_review_date, last_review_date,
                      review_count, reps, date_created, date_modified
        `, [id, title, notes, tags ? JSON.stringify(tags) : null]);

        const row = result.rows[0];
        const extract = {
            ...row,
            tags: row.tags ? JSON.parse(row.tags) : [],
            memory_state: row.memory_state ? JSON.parse(row.memory_state) : null,
        };

        res.json(extract);
    } catch (error) {
        next(error);
    }
});

// Delete a video extract
videoExtractsRouter.delete('/:id', authMiddleware, async (req: AuthRequest, res, next) => {
    try {
        const pool = getPool();
        const { id } = req.params;
        const userId = req.userId!;

        // Verify user owns the extract
        const checkResult = await pool.query(`
            SELECT ve.id
            FROM video_extracts ve
            JOIN documents d ON ve.document_id = d.id
            WHERE ve.id = $1 AND d.user_id = $2
        `, [id, userId]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Video extract not found or not owned by user' });
        }

        await pool.query('DELETE FROM video_extracts WHERE id = $1', [id]);

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// Rate a video extract (update FSRS scheduling)
videoExtractsRouter.post('/:id/rate', authMiddleware, async (req: AuthRequest, res, next) => {
    try {
        const pool = getPool();
        const { id } = req.params;
        const userId = req.userId!;
        const { rating } = req.body;

        // Validate rating
        if (!rating || rating < 1 || rating > 4) {
            return res.status(400).json({ error: 'Rating must be between 1 (Again) and 4 (Easy)' });
        }

        // Get the extract with document info
        const extractResult = await pool.query(`
            SELECT ve.*
            FROM video_extracts ve
            JOIN documents d ON ve.document_id = d.id
            WHERE ve.id = $1 AND d.user_id = $2
        `, [id, userId]);

        if (extractResult.rows.length === 0) {
            return res.status(404).json({ error: 'Video extract not found or not owned by user' });
        }

        const extract = extractResult.rows[0];
        const now = new Date();

        // Create or load a Card from the extract's memory state
        let card: Card;
        const memoryState = extract.memory_state ? JSON.parse(extract.memory_state) : null;

        if (memoryState && memoryState.stability !== undefined && memoryState.difficulty !== undefined) {
            // Load existing card state
            const lastReview = extract.last_review_date ? new Date(extract.last_review_date) : new Date(extract.date_created);

            card = {
                due: extract.next_review_date ? new Date(extract.next_review_date) : now,
                stability: memoryState.stability,
                difficulty: memoryState.difficulty,
                last_review: lastReview,
                reps: extract.reps,
                elapsed_days: Math.max(0, (now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24)),
                scheduled_days: 0,
                state: extract.review_count > 0 ? 2 : 0, // 0 = New, 2 = Review
            } as Card;
        } else {
            // Create new card
            card = createEmptyCard(extract.date_created ? new Date(extract.date_created) : now);
            card.reps = extract.reps;
        }

        // Get the rating enum value
        const grade = rating === 1 ? Rating.Again :
                       rating === 2 ? Rating.Hard :
                       rating === 3 ? Rating.Good : Rating.Easy;

        // Use FSRS to calculate the next review date
        const schedulingCards = f.repeat(card, now);

        // Find the scheduling result for the given rating
        const scheduledCard = schedulingCards[grade - 1]; // ratings are 1-indexed, array is 0-indexed

        if (!scheduledCard || !scheduledCard.card) {
            return res.status(500).json({ error: 'FSRS scheduling failed' });
        }

        const newCard = scheduledCard.card;

        // Update the extract with the new FSRS state
        const result = await pool.query(`
            UPDATE video_extracts
            SET memory_state = $2,
                next_review_date = $3,
                last_review_date = $4,
                review_count = review_count + 1,
                reps = $5,
                date_modified = NOW()
            WHERE id = $1
            RETURNING next_review_date
        `, [
            id,
            JSON.stringify({
                stability: newCard.stability,
                difficulty: newCard.difficulty,
            }),
            newCard.due.toISOString(),
            now.toISOString(),
            newCard.reps,
        ]);

        res.json({
            success: true,
            next_review_date: result.rows[0].next_review_date,
            stability: newCard.stability,
            difficulty: newCard.difficulty,
            interval_days: newCard.scheduled_days,
            message: `Next review: ${newCard.due.toLocaleDateString()} (${Math.round(newCard.stability * 10) / 10} stability)`,
        });
    } catch (error) {
        next(error);
    }
});

// Get video chapters for a document
videoExtractsRouter.get('/document/:documentId/chapters', authMiddleware, async (req: AuthRequest, res, next) => {
    try {
        const pool = getPool();
        const { documentId } = req.params;
        const userId = req.userId!;

        // Verify user owns the document
        const docCheck = await pool.query(
            'SELECT id FROM documents WHERE id = $1 AND user_id = $2',
            [documentId, userId]
        );

        if (docCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found or not owned by user' });
        }

        const result = await pool.query(`
            SELECT id, document_id, title, start_time, end_time, "order"
            FROM video_chapters
            WHERE document_id = $1
            ORDER BY "order" ASC
        `, [documentId]);

        res.json(result.rows);
    } catch (error) {
        next(error);
    }
});

// Set video chapters for a document
videoExtractsRouter.put('/document/:documentId/chapters', authMiddleware, async (req: AuthRequest, res, next) => {
    try {
        const pool = getPool();
        const { documentId } = req.params;
        const userId = req.userId!;
        const { chapters } = req.body;

        if (!Array.isArray(chapters)) {
            return res.status(400).json({ error: 'chapters must be an array' });
        }

        // Verify user owns the document
        const docCheck = await pool.query(
            'SELECT id FROM documents WHERE id = $1 AND user_id = $2',
            [documentId, userId]
        );

        if (docCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found or not owned by user' });
        }

        // Delete existing chapters
        await pool.query('DELETE FROM video_chapters WHERE document_id = $1', [documentId]);

        // Insert new chapters
        for (const chapter of chapters) {
            await pool.query(`
                INSERT INTO video_chapters (id, document_id, title, start_time, end_time, "order")
                VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
            `, [documentId, chapter.title, chapter.start_time, chapter.end_time, chapter.order]);
        }

        res.json({ success: true, count: chapters.length });
    } catch (error) {
        next(error);
    }
});

// Get video transcript for a document
videoExtractsRouter.get('/document/:documentId/transcript', authMiddleware, async (req: AuthRequest, res, next) => {
    try {
        const pool = getPool();
        const { documentId } = req.params;
        const userId = req.userId!;

        // Verify user owns the document
        const docCheck = await pool.query(
            'SELECT id FROM documents WHERE id = $1 AND user_id = $2',
            [documentId, userId]
        );

        if (docCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found or not owned by user' });
        }

        const result = await pool.query(`
            SELECT document_id, transcript, segments
            FROM video_transcripts
            WHERE document_id = $1
        `, [documentId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Transcript not found' });
        }

        const row = result.rows[0];
        res.json({
            document_id: row.document_id,
            transcript: row.transcript,
            segments: row.segments ? JSON.parse(row.segments) : [],
        });
    } catch (error) {
        next(error);
    }
});

// Set video transcript for a document
videoExtractsRouter.put('/document/:documentId/transcript', authMiddleware, async (req: AuthRequest, res, next) => {
    try {
        const pool = getPool();
        const { documentId } = req.params;
        const userId = req.userId!;
        const { transcript, segments } = req.body;

        // Verify user owns the document
        const docCheck = await pool.query(
            'SELECT id FROM documents WHERE id = $1 AND user_id = $2',
            [documentId, userId]
        );

        if (docCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found or not owned by user' });
        }

        // Upsert transcript
        await pool.query(`
            INSERT INTO video_transcripts (document_id, transcript, segments)
            VALUES ($1, $2, $3)
            ON CONFLICT (document_id) DO UPDATE
            SET transcript = $2, segments = $3
        `, [documentId, transcript, JSON.stringify(segments || [])]);

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});
