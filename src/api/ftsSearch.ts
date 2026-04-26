/**
 * Full-text search API with FTS5
 */

import { invoke } from '@tauri-apps/api/core';

export interface FtsSearchQuery {
  query: string;
  limit?: number;
  offset?: number;
  resultTypes?: string[];
}

export interface FtsSearchResult {
  id: string;
  resultType: string;
  title?: string;
  excerpt?: string;
  score: number;
  documentId?: string;
  fileType?: string;
}

export interface FtsSearchStats {
  totalDocuments: number;
  totalExtracts: number;
}

export async function ftsSearch(query: FtsSearchQuery): Promise<FtsSearchResult[]> {
  return await invoke<FtsSearchResult[]>('fts_search', { query });
}

export async function ftsSearchSuggestions(query: string): Promise<string[]> {
  return await invoke<string[]>('fts_search_suggestions', { query });
}

export async function ftsGetStats(): Promise<FtsSearchStats> {
  return await invoke<FtsSearchStats>('fts_get_stats');
}

export async function ftsReindex(): Promise<void> {
  return await invoke('fts_reindex');
}
