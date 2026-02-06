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

/**
 * Parse an Anki .apkg file in the browser
 */
export async function parseAnkiPackage(file: File | Uint8Array): Promise<AnkiDeck[]> {
  // Load sql.js WASM
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

  // Parse the database
  const decks = parseAnkiDatabase(db, zip);

  return decks;
}

/**
 * Parse Anki SQLite database
 */
function parseAnkiDatabase(db: Database, zip: JSZip): AnkiDeck[] {
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

  // Get notes
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

      // Skip notes that contain the upgrade error message
      // This happens when .apkg files are exported from older Anki versions
      // and the notes weren't properly upgraded
      if (fieldsStr.includes(UPGRADE_ERROR_MARKER)) {
        console.warn(`[AnkiParser] Skipping note ${noteId} with upgrade error marker`);
        continue;
      }

      // Parse tags
      const tags = tagsStr ? tagsStr.split(' ').filter(t => t.length > 0) : [];

      // Get model info
      const model = models.get(mid);

      // Parse fields (separated by \x1f)
      const fieldValues = fieldsStr.split('\x1f');
      const fields: AnkiField[] = [];

      if (model) {
        for (let i = 0; i < Math.min(fieldValues.length, model.fields.length); i++) {
          fields.push({
            name: model.fields[i],
            value: fieldValues[i]
          });
        }
      } else {
        // Fallback: use generic field names
        for (let i = 0; i < fieldValues.length; i++) {
          fields.push({
            name: `Field ${i + 1}`,
            value: fieldValues[i]
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

  // Get cards
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

  // Get decks
  const decksResult = db.exec('SELECT decks FROM col');
  const decks: AnkiDeck[] = [];

  if (decksResult.length > 0 && decksResult[0].values.length > 0) {
    const decksJson = JSON.parse(decksResult[0].values[0][0] as string);

    for (const [id, deck] of Object.entries(decksJson)) {
      const d = deck as any;
      if (d.name) {
        // Get cards for this deck (in Anki, cards have a did field pointing to deck id)
        const deckId = parseInt(id);
        const deckCards = cards.filter(card => {
          // We need to check if card belongs to this deck
          // This is a simplification - in reality, we'd need to query the card's did
          return true; // For now, include all cards
        });

        // Get notes for this deck's cards
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
    console.log(`[AnkiParser] No decks found, creating default deck with ${notes.length} notes and ${cards.length} cards`);
    decks.push({
      id: 0,
      name: 'Default',
      notes,
      cards
    });
  }

  // Log deck summary
  for (const deck of decks) {
    console.log(`[AnkiParser] Deck '${deck.name}': ${deck.notes.length} notes, ${deck.cards.length} cards`);
  }

  return decks;
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
  const documents: Array<{ title: string; content: string; fileType: string; category: string; tags: string[] }> = [];
  const learningItems: Array<{ documentId: string; itemType: string; question: string; answer: string; clozeText?: string; clozeRanges?: [number, number][]; tags: string[] }> = [];

  // Track imported note GUIDs to prevent duplicates
  const importedNoteGuids = new Set<string>();
  let skippedCount = 0;

  console.log(`[AnkiParser] convertAnkiToLearningItems: ${decks.length} decks to process`);
  
  for (const deck of decks) {
    console.log(`[AnkiParser] Processing deck '${deck.name}' with ${deck.notes.length} notes and ${deck.cards.length} cards`);

    // Create a document for the deck
    const docId = `anki-deck-${deck.id}`;
    documents.push({
      title: deck.name,
      content: `Anki deck with ${deck.notes.length} notes and ${deck.cards.length} cards`,
      fileType: 'anki',
      category: 'anki-import',
      tags: ['anki-import', deck.name]
    });

    const buildItemFromNote = (note: AnkiNote) => {
      console.log(`[AnkiParser] Building item from note ${note.id} (GUID: ${note.guid}), fields: ${note.fields.length}`);
      
      // Skip if we've already imported this note (by GUID)
      if (importedNoteGuids.has(note.guid)) {
        skippedCount++;
        console.log(`[AnkiParser] Skipping duplicate note GUID: ${note.guid}`);
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

      // Check if this is a cloze deletion
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
      console.log(`[AnkiParser] Using card-based iteration for deck '${deck.name}'`);
      for (const card of deck.cards) {
        const note = deck.notes.find(n => n.id == card.noteId); // Use loose equality for type safety
        if (!note) {
          console.log(`[AnkiParser] No note found for card ${card.id} with noteId ${card.noteId}`);
          continue;
        }
        buildItemFromNote(note);
      }
    } else {
      console.log(`[AnkiParser] Using note-based iteration for deck '${deck.name}'`);
      for (const note of deck.notes) {
        buildItemFromNote(note);
      }
    }
  }

  console.log(`[DEBUG] Import complete - created ${learningItems.length} items, skipped ${skippedCount} duplicates`);

  return { documents, learningItems };
}
