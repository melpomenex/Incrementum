/**
 * Background notification service using Periodic Background Sync API.
 * Works entirely client-side - no server needed.
 *
 * The SW registers a periodic sync that wakes up periodically to check
 * for due cards and show local notifications.
 *
 * Limitations:
 * - Only works in Chromium-based browsers (Chrome, Edge)
 * - Requires the PWA to be installed
 * - Browser controls the sync frequency (may be less frequent than requested)
 * - User must have recently used the app
 */

import { isPWA } from '../lib/tauri';

const SYNC_TAG = 'check-due-cards';

/**
 * Check if periodic background sync is supported.
 */
export function isPeriodicSyncSupported(): boolean {
  return (
    isPWA() &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PeriodicSyncManager' in window
  );
}

/**
 * Get the current background sync registration status.
 */
export async function getPushSubscriptionStatus(): Promise<{
  supported: boolean;
  subscribed: boolean;
  permission: NotificationPermission;
}> {
  const supported = isPeriodicSyncSupported();

  if (!supported) {
    return {
      supported: false,
      subscribed: false,
      permission: Notification.permission,
    };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const tags = await (registration as any).periodicSync.getTags();
    return {
      supported: true,
      subscribed: tags.includes(SYNC_TAG),
      permission: Notification.permission,
    };
  } catch {
    return {
      supported: false,
      subscribed: false,
      permission: Notification.permission,
    };
  }
}

/**
 * Register a periodic background sync to check for due cards.
 * The SW will wake up periodically and show notifications for due reviews.
 */
export async function subscribeToPush(): Promise<boolean> {
  if (!isPeriodicSyncSupported()) return false;

  // Request notification permission if needed
  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;
  }

  if (Notification.permission !== 'granted') return false;

  try {
    const registration = await navigator.serviceWorker.ready;

    // Store notification preferences in IndexedDB for the SW to read
    await storePrefsForSW();

    // Register periodic sync - browser will wake the SW at ~24 hour intervals
    await (registration as any).periodicSync.register(SYNC_TAG, {
      minInterval: 24 * 60 * 60 * 1000, // 24 hours
    });

    return true;
  } catch (error) {
    console.error('Failed to register periodic sync:', error);
    return false;
  }
}

/**
 * Unregister the periodic background sync.
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    await (registration as any).periodicSync.unregister(SYNC_TAG);
    return true;
  } catch (error) {
    console.error('Failed to unregister periodic sync:', error);
    return false;
  }
}

/**
 * Store notification preferences in IndexedDB so the SW can read them
 * when it wakes up (SW can't access localStorage or Zustand stores).
 */
async function storePrefsForSW(): Promise<void> {
  try {
    const raw = localStorage.getItem('incrementum-settings');
    if (!raw) return;

    const parsed = JSON.parse(raw);
    const notifications = parsed.state?.settings?.notifications || {};

    const db = await openDB();
    const tx = db.transaction('preferences', 'readwrite');
    const store = tx.objectStore('preferences');
    store.put({
      key: 'notifications',
      studyReminders: notifications.studyReminders ?? false,
      reminderTime: notifications.reminderTime ?? '09:00',
      dueDateReminders: notifications.dueDateReminders ?? true,
      quietHoursEnabled: notifications.quietHoursEnabled ?? false,
      quietHoursStart: notifications.quietHoursStart ?? '22:00',
      quietHoursEnd: notifications.quietHoursEnd ?? '08:00',
      soundEnabled: notifications.soundEnabled ?? true,
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // IndexedDB may not be available
  }
}

/**
 * Open (or create) the IndexedDB for SW preferences.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('incrementum-sw', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('preferences')) {
        db.createObjectStore('preferences', { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
