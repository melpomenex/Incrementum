import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { authRouter } from './routes/auth.js';
import { oauthRouter } from './routes/oauth.js';
import { syncRouter } from './routes/sync.js';
import { filesRouter } from './routes/files.js';
import { documentsRouter } from './routes/documents.js';
import { videoExtractsRouter } from './routes/video-extracts.js';
import { errorHandler } from './middleware/errorHandler.js';
import { initDatabase } from './db/connection.js';

const app = express();
const PORT = process.env.PORT || 3000;

const corsOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:15173'];

app.use(helmet({
    contentSecurityPolicy: false,
}));
app.use(compression());
app.use(cors({
    origin: corsOrigins,
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/auth', authRouter);
app.use('/auth', oauthRouter);
app.use('/sync', syncRouter);
app.use('/files', filesRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/video-extracts', videoExtractsRouter);

app.use(errorHandler);

async function start() {
    try {
        await initDatabase();

        app.listen(PORT, () => {
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

start();

export { app };
