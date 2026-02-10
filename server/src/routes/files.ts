import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';

export const filesRouter = Router();

// Configure multer for file uploads
const storagePath = process.env.STORAGE_PATH || './uploads';
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const userId = (req as AuthRequest).userId;
        const userDir = path.join(storagePath, userId!);
        await fs.mkdir(userDir, { recursive: true });
        cb(null, userDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const filename = `${uuidv4()}${ext}`;
        cb(null, filename);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'application/epub+zip',
            'text/html',
            'text/markdown',
            'text/plain',
        ];
        if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.epub')) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    },
});

// All file routes require authentication
filesRouter.use(authMiddleware);

// Default: allow file sync for everyone. Flip this on when you want to enforce paid tiers.
const REQUIRE_PAID_FILE_SYNC = process.env.REQUIRE_PAID_FILE_SYNC === 'true';

const checkPaidTier = async (req: AuthRequest, res: any, next: any) => {
    try {
        const pool = getPool();
        const result = await pool.query('SELECT subscription_tier FROM users WHERE id = $1', [req.userId]);

        if (result.rows.length === 0 || result.rows[0].subscription_tier === 'free') {
            throw createError('File uploads require a paid subscription', 403, 'PAYMENT_REQUIRED');
        }
        next();
    } catch (e) {
        next(e);
    }
};

async function allocateSyncVersions(client: any, userId: string, count: number): Promise<{ startVersion: number, endVersion: number }> {
    await client.query(`
      INSERT INTO sync_cursors (user_id, last_sync_version, last_sync_at)
      VALUES ($1, 0, NOW())
      ON CONFLICT (user_id) DO NOTHING
    `, [userId]);

    const result = await client.query(`
      UPDATE sync_cursors
      SET last_sync_version = last_sync_version + $2,
          last_sync_at = NOW()
      WHERE user_id = $1
      RETURNING last_sync_version
    `, [userId, count]);

    const endVersion = Number(result.rows[0].last_sync_version);
    const startVersion = endVersion - count + 1;
    return { startVersion, endVersion };
}

if (REQUIRE_PAID_FILE_SYNC) {
    filesRouter.use(checkPaidTier);
}

// Upload a file
filesRouter.post('/', upload.single('file'), async (req: AuthRequest, res, next) => {
    try {
        if (!req.file) {
            throw createError('No file uploaded', 400, 'NO_FILE');
        }

        const pool = getPool();
        const fileId = uuidv4();
        const storagePathOnDisk = req.file.path;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const { startVersion } = await allocateSyncVersions(client, req.userId!, 1);

            await client.query(`
        INSERT INTO files (id, user_id, filename, content_type, size_bytes, storage_path, sync_version)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
                fileId,
                req.userId,
                req.file.originalname,
                req.file.mimetype,
                req.file.size,
                storagePathOnDisk,
                startVersion,
            ]);

            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

        res.status(201).json({
            id: fileId,
            filename: req.file.originalname,
            contentType: req.file.mimetype,
            size: req.file.size,
        });
    } catch (error) {
        next(error);
    }
});

// Download a file
filesRouter.get('/:id', async (req: AuthRequest, res, next) => {
    try {
        const pool = getPool();
        const result = await pool.query(`
      SELECT * FROM files WHERE id = $1 AND user_id = $2
    `, [req.params.id, req.userId]);

        if (result.rows.length === 0) {
            throw createError('File not found', 404, 'FILE_NOT_FOUND');
        }

        const file = result.rows[0];
        if (file.deleted_at) {
            throw createError('File not found', 404, 'FILE_NOT_FOUND');
        }
        res.download(file.storage_path, file.filename);
    } catch (error) {
        next(error);
    }
});

// Delete a file
filesRouter.delete('/:id', async (req: AuthRequest, res, next) => {
    try {
        const pool = getPool();
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const result = await client.query(`
        SELECT * FROM files WHERE id = $1 AND user_id = $2
      `, [req.params.id, req.userId]);

            if (result.rows.length === 0) {
                throw createError('File not found', 404, 'FILE_NOT_FOUND');
            }

            const file = result.rows[0];
            if (file.deleted_at) {
                // Idempotent delete
                await client.query('COMMIT');
                return res.json({ success: true });
            }

            const { startVersion } = await allocateSyncVersions(client, req.userId!, 1);

            // Delete from disk
            try {
                await fs.unlink(file.storage_path);
            } catch (e) {
                console.warn('File already deleted from disk:', file.storage_path);
            }

            // Soft delete in database so other clients can sync the tombstone.
            await client.query(`
        UPDATE files
        SET deleted_at = NOW(),
            sync_version = $3
        WHERE id = $1 AND user_id = $2
      `, [req.params.id, req.userId, startVersion]);

            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// List user's files
filesRouter.get('/', async (req: AuthRequest, res, next) => {
    try {
        const pool = getPool();
        const result = await pool.query(`
      SELECT id, filename, content_type, size_bytes, created_at
      FROM files WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC
    `, [req.userId]);

        res.json(result.rows);
    } catch (error) {
        next(error);
    }
});
