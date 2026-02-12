/**
 * Bundle Image Store for Browser/PWA
 *
 * Stores images from markdown bundles in IndexedDB for offline access.
 * Used when running in browser mode (non-Tauri).
 */

const DB_NAME = 'incrementum-bundle-images';
const DB_VERSION = 1;
const STORE_NAME = 'images';

interface StoredImage {
  docId: string;
  imageName: string;
  blob: Blob;
  storedAt: number;
}

let db: IDBDatabase | null = null;

/**
 * Initialize the IndexedDB database
 */
async function getDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[bundleImageStore] Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Create object store with composite key
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: ['docId', 'imageName'] });
        store.createIndex('docId', 'docId', { unique: false });
        store.createIndex('storedAt', 'storedAt', { unique: false });
      }
    };
  });
}

/**
 * Store an image for a document
 *
 * @param docId - The document ID
 * @param imageName - The image name/path
 * @param blob - The image blob
 */
export async function storeImage(docId: string, imageName: string, blob: Blob): Promise<void> {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const image: StoredImage = {
      docId,
      imageName,
      blob,
      storedAt: Date.now(),
    };

    const request = store.put(image);

    request.onsuccess = () => {
      console.log(`[bundleImageStore] Stored image: ${docId}/${imageName}`);
      resolve();
    };

    request.onerror = () => {
      console.error('[bundleImageStore] Failed to store image:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Get an image for a document
 *
 * @param docId - The document ID
 * @param imageName - The image name/path
 * @returns The image blob or null if not found
 */
export async function getImage(docId: string, imageName: string): Promise<Blob | null> {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get([docId, imageName]);

    request.onsuccess = () => {
      const result = request.result as StoredImage | undefined;
      resolve(result?.blob || null);
    };

    request.onerror = () => {
      console.error('[bundleImageStore] Failed to get image:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Get a blob URL for an image
 *
 * @param docId - The document ID
 * @param imageName - The image name/path
 * @returns Blob URL or null if not found
 */
export async function getImageUrl(docId: string, imageName: string): Promise<string | null> {
  const blob = await getImage(docId, imageName);
  if (!blob) return null;

  return URL.createObjectURL(blob);
}

/**
 * Check if an image exists
 */
export async function hasImage(docId: string, imageName: string): Promise<boolean> {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get([docId, imageName]);

    request.onsuccess = () => {
      resolve(!!request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Delete all images for a document
 *
 * @param docId - The document ID
 */
export async function deleteBundleImages(docId: string): Promise<void> {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('docId');
    const request = index.openCursor(IDBKeyRange.only(docId));

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        console.log(`[bundleImageStore] Deleted all images for doc: ${docId}`);
        resolve();
      }
    };

    request.onerror = () => {
      console.error('[bundleImageStore] Failed to delete images:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Store multiple images at once
 *
 * @param docId - The document ID
 * @param images - Map of image name to blob
 * @param onProgress - Optional progress callback
 */
export async function storeImages(
  docId: string,
  images: Map<string, Blob>,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const entries = Array.from(images.entries());
  const total = entries.length;

  for (let i = 0; i < entries.length; i++) {
    const [imageName, blob] = entries[i];
    await storeImage(docId, imageName, blob);
    onProgress?.(i + 1, total);
  }
}

/**
 * Get all image names for a document
 */
export async function getImageNames(docId: string): Promise<string[]> {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('docId');
    const request = index.getAllKeys(IDBKeyRange.only(docId));

    request.onsuccess = () => {
      // Keys are returned as [docId, imageName] arrays
      const keys = request.result as [string, string][];
      resolve(keys.map(([, imageName]) => imageName));
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Get storage usage for bundle images
 */
export async function getStorageUsage(): Promise<{ count: number; size: number }> {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const images = request.result as StoredImage[];
      let totalSize = 0;

      for (const img of images) {
        totalSize += img.blob.size;
      }

      resolve({
        count: images.length,
        size: totalSize,
      });
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Clear all stored images (for cleanup/reset)
 */
export async function clearAllImages(): Promise<void> {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => {
      console.log('[bundleImageStore] Cleared all images');
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}
