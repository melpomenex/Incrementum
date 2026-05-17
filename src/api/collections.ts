import { invoke } from '@tauri-apps/api/core';
import type { Collection } from '../types/collection';

export async function createCollection(
  name: string,
  icon?: string,
  color?: string
): Promise<Collection> {
  return await invoke<Collection>('create_collection', { name, icon, color });
}

export async function getCollections(): Promise<Collection[]> {
  return await invoke<Collection[]>('get_collections');
}

export async function getCollection(id: string): Promise<Collection> {
  return await invoke<Collection>('get_collection', { id });
}

export async function updateCollection(
  id: string,
  name?: string,
  icon?: string,
  color?: string
): Promise<Collection> {
  return await invoke<Collection>('update_collection', { id, name, icon, color });
}

export async function deleteCollection(id: string): Promise<void> {
  return await invoke('delete_collection', { id });
}

export async function getActiveCollection(): Promise<string> {
  return await invoke<string>('get_active_collection');
}

export async function setActiveCollection(id: string): Promise<void> {
  return await invoke('set_active_collection', { id });
}

export async function getCollectionDueCount(id: string): Promise<number> {
  return await invoke<number>('get_collection_due_count', { id });
}
