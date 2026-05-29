import { createDocument, updateDocument } from "../api/documents";
import type { Document } from "../types/document";

export interface ReferenceImportItem {
  title: string;
  abstract?: string;
  url?: string;
  author?: string;
  year?: number;
  venue?: string;
  source: "zotero" | "mendeley";
}

function extractZoteroCreator(creators?: Array<{ firstName?: string; lastName?: string; name?: string }>): string | undefined {
  if (!creators?.length) return undefined;
  const first = creators[0];
  if (first.name) return first.name;
  const full = [first.firstName, first.lastName].filter(Boolean).join(" ").trim();
  return full || undefined;
}

export function parseZoteroItems(payload: unknown): ReferenceImportItem[] {
  const items = Array.isArray(payload) ? payload : [];
  return items
    .map((entry: any) => {
      const data = entry?.data ?? entry;
      const title = String(data?.title || "").trim();
      if (!title) return null;
      return {
        title,
        abstract: data?.abstractNote ? String(data.abstractNote) : undefined,
        url: data?.url ? String(data.url) : undefined,
        author: extractZoteroCreator(data?.creators),
        year: data?.date ? Number(String(data.date).slice(0, 4)) || undefined : undefined,
        venue: data?.publicationTitle ? String(data.publicationTitle) : undefined,
        source: "zotero" as const,
      };
    })
    .filter((item) => item !== null && item !== undefined) as ReferenceImportItem[];
}

export function parseMendeleyItems(payload: unknown): ReferenceImportItem[] {
  const items = Array.isArray(payload) ? payload : [];
  return items
    .map((entry: any) => {
      const title = String(entry?.title || "").trim();
      if (!title) return null;
      const firstAuthor = Array.isArray(entry?.authors) ? entry.authors[0] : null;
      const author = firstAuthor
        ? [firstAuthor.first_name, firstAuthor.last_name].filter(Boolean).join(" ").trim() || undefined
        : undefined;

      return {
        title,
        abstract: entry?.abstract ? String(entry.abstract) : undefined,
        url: entry?.websites?.[0] ? String(entry.websites[0]) : undefined,
        author,
        year: typeof entry?.year === "number" ? entry.year : undefined,
        venue: entry?.source ? String(entry.source) : undefined,
        source: "mendeley" as const,
      };
    })
    .filter((item) => item !== null && item !== undefined) as ReferenceImportItem[];
}

export async function importReferenceItems(items: ReferenceImportItem[]): Promise<number> {
  let imported = 0;

  for (const item of items) {
    const doc = await createDocument(item.title, item.url || `reference://${item.source}/${encodeURIComponent(item.title)}`, "markdown");

    const metadata = {
      ...doc.metadata,
      author: item.author,
      createdAt: item.year ? `${item.year}-01-01T00:00:00.000Z` : doc.metadata?.createdAt,
      subject: item.venue,
      keywords: [item.source, item.venue, item.year ? String(item.year) : null].filter(Boolean) as string[],
    };

    const contentParts = [
      item.abstract ? `Abstract\n\n${item.abstract}` : "",
      item.url ? `Source URL\n\n${item.url}` : "",
    ].filter(Boolean);

    const updatePayload: Document = {
      ...doc,
      metadata,
      content: contentParts.join("\n\n"),
      tags: Array.from(new Set([...(doc.tags || []), item.source, "reference-import"])),
    };

    await updateDocument(doc.id, updatePayload);
    imported += 1;
  }

  return imported;
}
