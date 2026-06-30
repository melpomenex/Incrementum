/* eslint-disable no-console */
import express from "express";
import multer from "multer";
import crypto from "crypto";
import path from "path";
import fs from "fs/promises";

const app = express();

const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = process.env.FILES_DATA_DIR || "/data/files";
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);

function allowOrigin(req, res) {
  const origin = req.headers.origin;
  if (!origin) return;
  if (CORS_ORIGINS.length === 0 || CORS_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
}

app.use((req, res, next) => {
  allowOrigin(req, res);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true }));

function isSafeRoom(room) {
  // Room IDs are capability tokens; keep a conservative charset to avoid path games.
  return typeof room === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(room);
}

function roomDir(room) {
  const dir = path.join(DATA_DIR, room);
  const resolvedBase = path.resolve(DATA_DIR);
  const resolvedDir = path.resolve(dir);
  if (!resolvedDir.startsWith(resolvedBase + path.sep)) {
    throw new Error("Invalid room path");
  }
  return dir;
}

function filePaths(room, id) {
  const dir = roomDir(room);
  return {
    dir,
    blob: path.join(dir, `${id}.bin`),
    meta: path.join(dir, `${id}.json`),
  };
}

async function readMeta(metaPath) {
  try {
    const raw = await fs.readFile(metaPath, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

async function writeMeta(metaPath, meta) {
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8");
}

const storage = multer.diskStorage({
  destination: async (req, _file, cb) => {
    try {
      const room = req.params.room;
      if (!isSafeRoom(room)) return cb(new Error("Invalid room"));
      const dir = roomDir(room);
      await fs.mkdir(dir, { recursive: true });
      cb(null, dir);
    } catch (e) {
      cb(e);
    }
  },
  filename: (req, _file, cb) => {
    const id = req.query.id || crypto.randomUUID();
    cb(null, `${id}.bin`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = new Set([
      "application/pdf",
      "application/epub+zip",
      "text/html",
      "text/markdown",
      "text/plain",
    ]);
    if (allowedTypes.has(file.mimetype) || file.originalname.endsWith(".epub")) return cb(null, true);
    cb(new Error("Invalid file type"));
  },
});

app.post("/files/:room", upload.single("file"), async (req, res) => {
  const room = req.params.room;
  if (!isSafeRoom(room)) return res.status(400).json({ error: "Invalid room" });
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const id = path.basename(req.file.filename, ".bin");
  const { meta } = filePaths(room, id);
  const now = new Date().toISOString();

  const metadata = {
    id,
    room,
    filename: req.file.originalname,
    contentType: req.file.mimetype,
    sizeBytes: req.file.size,
    createdAt: now,
    deletedAt: null,
  };

  await writeMeta(meta, metadata);
  res.status(201).json(metadata);
});

// List (metadata only)
app.get("/files/:room", async (req, res) => {
  const room = req.params.room;
  if (!isSafeRoom(room)) return res.status(400).json({ error: "Invalid room" });

  const dir = roomDir(room);
  try {
    const entries = await fs.readdir(dir);
    const metas = entries.filter((n) => n.endsWith(".json")).sort();
    const out = [];
    for (const name of metas) {
      const m = await readMeta(path.join(dir, name));
      if (m) out.push(m);
    }
    res.json(out);
  } catch (e) {
    // Room has no files yet.
    res.json([]);
  }
});

app.get("/files/:room/:id", async (req, res) => {
  const room = req.params.room;
  const id = req.params.id;
  if (!isSafeRoom(room)) return res.status(400).json({ error: "Invalid room" });
  if (!id || !/^[0-9a-fA-F-]{16,64}$/.test(id)) return res.status(400).json({ error: "Invalid id" });

  const { blob, meta } = filePaths(room, id);
  const m = await readMeta(meta);
  if (!m || m.deletedAt) return res.status(404).json({ error: "Not found" });

  m.lastAccessedAt = new Date().toISOString();
  await writeMeta(meta, m).catch((err) => {
    console.warn("Failed to update lastAccessedAt metadata:", err);
  });

  // Use absolute path for sendFile.
  res.setHeader("Content-Type", m.contentType || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${(m.filename || "file").replace(/"/g, "")}"`);
  res.sendFile(path.resolve(blob), (err) => {
    if (err) res.status(404).end();
  });
});

// Delete (soft tombstone + delete bytes)
app.delete("/files/:room/:id", async (req, res) => {
  const room = req.params.room;
  const id = req.params.id;
  if (!isSafeRoom(room)) return res.status(400).json({ error: "Invalid room" });
  if (!id || !/^[0-9a-fA-F-]{16,64}$/.test(id)) return res.status(400).json({ error: "Invalid id" });

  const { blob, meta } = filePaths(room, id);
  const m = (await readMeta(meta)) || { id, room };
  if (m.deletedAt) return res.json({ ok: true });

  m.deletedAt = new Date().toISOString();
  await writeMeta(meta, m);
  try {
    await fs.unlink(blob);
  } catch {
    // already gone
  }
  res.json({ ok: true });
});

async function runCleanup() {
  try {
    const rooms = await fs.readdir(DATA_DIR);
    const now = Date.now();
    const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days of inactivity

    for (const room of rooms) {
      const dir = path.join(DATA_DIR, room);
      const stat = await fs.stat(dir).catch(() => null);
      if (!stat || !stat.isDirectory()) continue;

      const files = await fs.readdir(dir);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));

      for (const jsonFile of jsonFiles) {
        const metaPath = path.join(dir, jsonFile);
        const m = await readMeta(metaPath);
        if (!m) continue;

        const id = m.id;
        const blobPath = path.join(dir, `${id}.bin`);

        const lastUsedStr = m.lastAccessedAt || m.createdAt || m.uploadedAt;
        const lastUsed = lastUsedStr ? Date.parse(lastUsedStr) : 0;
        const isStale = lastUsed && (now - lastUsed > MAX_AGE_MS);

        if (m.deletedAt || isStale || !lastUsed) {
          console.log(`[Cleanup] Deleting stale/deleted file: room=${room}, id=${id}, lastUsed=${lastUsedStr}`);
          try {
            await fs.unlink(blobPath);
          } catch (e) {}
          try {
            await fs.unlink(metaPath);
          } catch (e) {}
        }
      }

      // Check if room directory is empty now, if so remove it
      const remaining = await fs.readdir(dir).catch(() => []);
      if (remaining.length === 0) {
        console.log(`[Cleanup] Removing empty room directory: ${room}`);
        await fs.rmdir(dir).catch(() => {});
      }
    }
  } catch (err) {
    console.error("[Cleanup] error during clean cycle:", err);
  }
}

app.listen(PORT, async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  runCleanup();
  setInterval(runCleanup, 24 * 60 * 60 * 1000);
});
