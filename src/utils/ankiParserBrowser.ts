/**
 * Browser-side Anki Package Parser
 *
 * Parses .apkg files (Anki export packages) in the browser
 * using jszip and sql.js
 */

import * as JSZip from 'jszip';
import initSqlJs, { Database } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

export interface AnkiField {
  name: string;
  value: string;
}

export interface AnkiNote {
  id: number;
  guid: string;
  mid: number;
  modelName: string;
  tags: string[];
  fields: AnkiField[];
  timestamp: number;
}

export interface AnkiCard {
  id: number;
  noteId: number;
  ord: number;
  interval: number;
  ease: number;
  due: number;
}

export interface AnkiDeck {
  id: number;
  name: string;
  notes: AnkiNote[];
  cards: AnkiCard[];
}

interface AnkiMediaAsset {
  fileName: string;
  mimeType: string;
  dataUrl: string;
}

/**
 * Parse an Anki .apkg file in the browser
 */
export async function parseAnkiPackage(file: File | Uint8Array): Promise<AnkiDeck[]> {
  const SQL = await initSqlJs({
    // Use bundled wasm for offline/PWA compatibility
    locateFile: () => sqlWasmUrl
  });

  // Read the ZIP file
  let arrayBuffer: ArrayBuffer;
  if (file instanceof Uint8Array) {
    arrayBuffer = file.buffer;
  } else {
    arrayBuffer = await file.arrayBuffer();
  }

  const zip = await JSZip.loadAsync(arrayBuffer);

  // Try to find the collection database
  const collectionFile = zip.file('collection.anki2') || zip.file('collection.anki21');
  if (!collectionFile) {
    throw new Error('Invalid Anki package: missing collection database');
  }

  // Read the database as ArrayBuffer
  const dbBuffer = await collectionFile.async('arraybuffer');
  const db = new SQL.Database(new Uint8Array(dbBuffer));
  const mediaMap = await extractAnkiMediaMap(zip);

  const decks = parseAnkiDatabase(db, mediaMap);

  return decks;
}

/**
 * Parse Anki SQLite database
 */
function parseAnkiDatabase(db: Database, mediaMap: Map<string, AnkiMediaAsset>): AnkiDeck[] {
  // Get models (note types)
  const models: Map<number, { name: string; fields: string[] }> = new Map();
  const normalizeModelFields = (raw: unknown): Array<{ name?: string }> => {
    if (!raw) {
      return [];
    }
    if (Array.isArray(raw)) {
      return raw as Array<{ name?: string }>;
    }
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as Array<{ name?: string }>) : [];
      } catch {
        return [];
      }
    }
    if (typeof raw === "object") {
      return [];
    }
    return [];
  };

  // The models are stored in JSON in the 'models' column of the 'col' table
  const colData = db.exec('SELECT models FROM col');
  if (colData.length > 0 && colData[0].values.length > 0) {
    const modelsJson = JSON.parse(colData[0].values[0][0] as string);
    for (const [id, model] of Object.entries(modelsJson)) {
      const m = model as any;
      const fieldNames: string[] = [];
      if (m.flds) {
        const fields = normalizeModelFields(m.flds);
        for (const field of fields) {
          if (field?.name) {
            fieldNames.push(field.name);
          }
        }
      }
      models.set(parseInt(id, 10), {
        name: m.name,
        fields: fieldNames
      });
    }
  }

  const notesResult = db.exec('SELECT id, guid, mid, tags, flds, mod FROM notes');
  const notes: AnkiNote[] = [];

  // Error message stored in notes when .apkg file wasn't properly upgraded
  const UPGRADE_ERROR_MARKER = 'Please update to the latest Anki version';

  if (notesResult.length > 0) {
    for (const row of notesResult[0].values) {
      const noteId = row[0] as number;
      const guid = row[1] as string;
      const mid = row[2] as number;
      const tagsStr = (row[3] as string || '');
      const fieldsStr = row[4] as string;
      const ctime = row[5] as number;

      if (fieldsStr.includes(UPGRADE_ERROR_MARKER)) {
        console.warn(`[AnkiParser] Skipping note ${noteId} with upgrade error marker`);
        continue;
      }

      const tags = tagsStr ? tagsStr.split(' ').filter(t => t.length > 0) : [];

      const model = models.get(mid);

      // Parse fields (separated by \x1f)
      const fieldValues = fieldsStr.split('\x1f');
      const fields: AnkiField[] = [];

      if (model) {
        for (let i = 0; i < Math.min(fieldValues.length, model.fields.length); i++) {
          fields.push({
            name: model.fields[i],
            value: resolveAnkiMediaReferences(fieldValues[i], mediaMap)
          });
        }
      } else {
        // Fallback: use generic field names
        for (let i = 0; i < fieldValues.length; i++) {
          fields.push({
            name: `Field ${i + 1}`,
            value: resolveAnkiMediaReferences(fieldValues[i], mediaMap)
          });
        }
      }

      notes.push({
        id: noteId,
        guid,
        mid,
        modelName: model?.name || 'Unknown',
        tags,
        fields,
        timestamp: ctime
      });
    }
  }

  const cardsResult = db.exec('SELECT id, nid, ord, ivl, factor, due, type FROM cards WHERE type != 4'); // type 4 is a filtered deck card
  const cards: AnkiCard[] = [];

  if (cardsResult.length > 0) {
    for (const row of cardsResult[0].values) {
      cards.push({
        id: row[0] as number,
        noteId: row[1] as number,
        ord: row[2] as number,
        interval: row[3] as number,
        ease: (row[4] as number) / 1000, // Convert from Anki's internal format
        due: row[5] as number
      });
    }
  }

  const decksResult = db.exec('SELECT decks FROM col');
  const decks: AnkiDeck[] = [];

  if (decksResult.length > 0 && decksResult[0].values.length > 0) {
    const decksJson = JSON.parse(decksResult[0].values[0][0] as string);

    for (const [id, deck] of Object.entries(decksJson)) {
      const d = deck as any;
      if (d.name) {
        // Get cards for this deck (in Anki, cards have a did field pointing to deck id)
        const deckId = parseInt(id);
        const deckCards = cards.filter(_card => {
          // We need to check if card belongs to this deck
          // This is a simplification - in reality, we'd need to query the card's did
          return true; // For now, include all cards
        });

        const deckNoteIds = new Set(deckCards.map(c => c.noteId));
        const deckNotes = notes.filter(n => deckNoteIds.has(n.id));

        decks.push({
          id: deckId,
          name: d.name,
          notes: deckNotes,
          cards: deckCards.filter(c => deckNotes.some(n => n.id === c.noteId))
        });
      }
    }
  }

  // If no decks found, create a default deck
  if (decks.length === 0) {
    console.error(`[AnkiParser] No decks found, creating default deck with ${notes.length} notes and ${cards.length} cards`);
    decks.push({
      id: 0,
      name: 'Default',
      notes,
      cards
    });
  }

  for (const deck of decks) {
  }

  return decks;
}

async function extractAnkiMediaMap(zip: JSZip): Promise<Map<string, AnkiMediaAsset>> {
  const map = new Map<string, AnkiMediaAsset>();
  const mediaManifest = zip.file("media");
  if (!mediaManifest) {
    return map;
  }

  let manifestRaw = "";
  try {
    manifestRaw = await mediaManifest.async("text");
  } catch {
    return map;
  }

  let manifest: Record<string, string>;
  try {
    const parsed = JSON.parse(manifestRaw);
    if (!parsed || typeof parsed !== "object") return map;
    manifest = parsed as Record<string, string>;
  } catch {
    return map;
  }

  for (const [archiveName, logicalName] of Object.entries(manifest)) {
    if (!logicalName || typeof logicalName !== "string") continue;
    const file = zip.file(archiveName);
    if (!file) continue;
    const bytes = await file.async("uint8array");
    if (!bytes || bytes.length === 0) continue;
    const mimeType = inferMediaMimeType(logicalName, bytes);
    const base64 = uint8ToBase64(bytes);
    const dataUrl = `data:${mimeType};base64,${base64}`;
    const asset: AnkiMediaAsset = { fileName: logicalName, mimeType, dataUrl };
    for (const key of mediaLookupKeys(logicalName)) {
      map.set(key, asset);
    }
  }

  return map;
}

function resolveAnkiMediaReferences(value: string, mediaMap: Map<string, AnkiMediaAsset>): string {
  if (!value || mediaMap.size === 0) return value;

  // Replace Anki audio markers with native controls.
  let out = value.replace(/\[sound:([^\]]+)\]/gi, (_full, src) => {
    const asset = findMedia(mediaMap, src);
    if (!asset) return _full;
    return `<audio controls preload="none" src="${asset.dataUrl}"></audio>`;
  });

  // Rewrite src=... references to data URLs when APKG-local media exists.
  out = out.replace(/\bsrc\s*=\s*["']([^"']+)["']/gi, (full, src) => {
    const asset = findMedia(mediaMap, src);
    if (!asset) return full;
    return `src="${asset.dataUrl}"`;
  });

  return out;
}

function findMedia(mediaMap: Map<string, AnkiMediaAsset>, rawRef: string): AnkiMediaAsset | undefined {
  for (const key of mediaLookupKeys(rawRef)) {
    const asset = mediaMap.get(key);
    if (asset) return asset;
  }
  return undefined;
}

function mediaLookupKeys(rawName: string): string[] {
  const out = new Set<string>();
  if (!rawName) return [];

  let decoded = rawName;
  try {
    decoded = decodeURIComponent(rawName);
  } catch {
    decoded = rawName;
  }

  const noFragment = decoded.split("#")[0] || decoded;
  const noQuery = noFragment.split("?")[0] || noFragment;
  const sanitized = noQuery.trim().replace(/^\.?\//, "");
  if (!sanitized) return [];

  out.add(sanitized);
  out.add(sanitized.toLowerCase());

  const pathParts = sanitized.split("/");
  const base = pathParts[pathParts.length - 1];
  if (base) {
    out.add(base);
    out.add(base.toLowerCase());
  }

  return Array.from(out);
}

function inferMediaMimeType(fileName: string, bytes: Uint8Array): string {
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "wav") return "audio/wav";
  if (ext === "ogg") return "audio/ogg";
  if (ext === "m4a") return "audio/mp4";
  if (ext === "mp4") return "video/mp4";
  if (ext === "webm") return "video/webm";

  if (bytes.length >= 4) {
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
  }
  return "application/octet-stream";
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

/**
 * Convert parsed Anki deck to learning items format
 */
/**
 * Normalize Anki cloze format to internal format
 * Converts {{c1::text}} to [[c1::text]]
 */
function normalizeClozeText(text: string): string {
  return text.replace(/\{\{c/g, '[[c').replace(/\}\}/g, ']]');
}

/**
 * Check if text contains cloze deletions
 */
function isClozeText(text: string): boolean {
  return text.includes('{{c');
}

/**
 * Calculate cloze ranges from normalized cloze text
 * Returns array of [start, end] positions for each cloze deletion
 */
function calculateClozeRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  // Pattern matches [[c1::content]] or [[c1::content::hint]]
  const pattern = /\[\[c\d+::([^\]]+?)\]\]/g;
  
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const fullMatch = match[0];
    const matchStart = match.index;
    const matchEnd = match.index + fullMatch.length;
    ranges.push([matchStart, matchEnd]);
  }
  
  return ranges;
}

export function convertAnkiToLearningItems(decks: AnkiDeck[]): {
  documents: Array<{ title: string; content: string; fileType: string; category: string; tags: string[] }>;
  learningItems: Array<{ documentId: string; itemType: string; question: string; answer: string; clozeText?: string; clozeRanges?: [number, number][]; tags: string[] }>;
} {
  const learningItems: Array<{ documentId: string; itemType: string; question: string; answer: string; clozeText?: string; clozeRanges?: [number, number][]; tags: string[] }> = [];

  // Track imported note GUIDs to prevent duplicates
  const importedNoteGuids = new Set<string>();
  let skippedCount = 0;

  for (const deck of decks) {

    const docId = '';
    // No document created — only learning items are useful from an Anki import

    const buildItemFromNote = (note: AnkiNote) => {
      
      // Skip if we've already imported this note (by GUID)
      if (importedNoteGuids.has(note.guid)) {
        skippedCount++;
        return;
      }
      importedNoteGuids.add(note.guid);

      const questionField = note.fields.find(f =>
        f.name.toLowerCase().includes('front') ||
        f.name.toLowerCase().includes('question') ||
        f.name.toLowerCase().includes('text')
      );

      const answerField = note.fields.find(f =>
        f.name.toLowerCase().includes('back') ||
        f.name.toLowerCase().includes('answer')
      );

      const fallbackQuestion = note.fields[0];
      const fallbackAnswer = note.fields[1];

      const questionValue = questionField?.value ?? fallbackQuestion?.value;
      const answerValue = answerField?.value ?? fallbackAnswer?.value ?? '';

      if (!questionValue) {
        return;
      }

      const isCloze = isClozeText(questionValue);
      
      if (isCloze) {
        const clozeText = normalizeClozeText(questionValue);
        const clozeRanges = calculateClozeRanges(clozeText);
        learningItems.push({
          documentId: docId,
          itemType: 'cloze',
          question: clozeText,
          answer: '',
          clozeText: clozeText,
          clozeRanges: clozeRanges,
          tags: [...note.tags, 'anki-import', note.modelName, deck.name]
        });
      } else {
        learningItems.push({
          documentId: docId,
          itemType: 'flashcard',
          question: questionValue,
          answer: answerValue,
          tags: [...note.tags, 'anki-import', note.modelName, deck.name]
        });
      }
    };

    // Prefer cards, but fall back to notes if cards are missing or obviously incomplete.
    if (deck.cards.length >= deck.notes.length && deck.cards.length > 0) {
      for (const card of deck.cards) {
        const note = deck.notes.find(n => n.id == card.noteId); // Use loose equality for type safety
        if (!note) {
          console.error(`[AnkiParser] No note found for card ${card.id} with noteId ${card.noteId}`);
          continue;
        }
        buildItemFromNote(note);
      }
    } else {
      for (const note of deck.notes) {
        buildItemFromNote(note);
      }
    }
  }

  return { documents: [], learningItems };
}
