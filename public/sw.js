/**
 * Incrementum Service Worker
 *
 * Provides offline support, caching strategies, and background sync
 * for the Progressive Web App (PWA) version of Incrementum.
 */

const VERSION = 'incrementum-v7';

// Disable SW on localhost/dev (unregister and bypass all caching)
const IS_DEV_HOST = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

if (IS_DEV_HOST) {
  self.addEventListener('install', (event) => {
    event.waitUntil(
      (async () => {
        await self.skipWaiting();
        const registrations = await self.registration.unregister();
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
        return registrations;
      })()
    );
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
  });

  self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
  });
}
const CACHE_NAME = `${VERSION}-main`;
const STATIC_CACHE = `${VERSION}-static`;
const API_CACHE = `${VERSION}-api`;

// Cache durations (in seconds)
const CACHE_DURATION = {
  STATIC: 30 * 24 * 60 * 60, // 30 days
  API: 5 * 60, // 5 minutes
  IMAGES: 7 * 24 * 60 * 60, // 7 days
  DOCUMENTS: 24 * 60 * 60, // 1 day
};

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/apple-touch-icon.png',
  '/icons/sprout-192x192.png',
  '/icons/sprout-512x512.png',
];

// API endpoints that should be cached
const CACHEABLE_API_PATTERNS = [
  '/api/documents',
  '/api/queue',
  '/api/review',
  '/api/rss',
  '/api/analytics',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker:', VERSION);

  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)),
      // Pre-cache essential API data
      caches.open(API_CACHE).then((cache) => {
        // Optionally preload some data
        return cache.addAll([
          '/api/documents?limit=20',
          '/api/analytics/dashboard',
        ]);
      }),
    ]).then(() => {
      // Activate immediately
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker:', VERSION);

  event.waitUntil(
    Promise.all([
      // Delete old caches
      caches.keys().then((cacheNames) => {
        const activeCaches = new Set([CACHE_NAME, STATIC_CACHE, API_CACHE]);
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('incrementum-') && !activeCaches.has(name))
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      }),
      // Take control of all clients immediately
      self.clients.claim(),
    ])
  );
});

// Fetch event - intelligent caching strategy
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (e.g., YouTube, external APIs)
  // Only handle requests to the same origin
  if (url.origin !== self.location.origin) {
    // Let the browser handle external requests normally
    return;
  }

  // Handle API requests with special strategy
  if (url.pathname.startsWith('/api')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle navigation requests (SPA routing)
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Handle image requests with longer cache
  if (request.destination === 'image') {
    event.respondWith(handleImageRequest(request));
    return;
  }

  // Handle all other requests with cache-first strategy
  event.respondWith(handleStaticRequest(request));
});

/**
 * Handle API requests with stale-while-revalidate strategy
 */
async function handleApiRequest(request) {
  const url = new URL(request.url);

  // Check if this is a cacheable API endpoint
  const isCacheable = CACHEABLE_API_PATTERNS.some(pattern =>
    url.pathname.startsWith(pattern)
  );

  if (!isCacheable) {
    // Non-cacheable API: network only with error handling
    try {
      return await fetch(request);
    } catch (error) {
      console.error('[SW] API request failed:', error);
      return new Response(
        JSON.stringify({
          error: 'Network unavailable',
          message: 'Could not connect to server. Please check your internet connection.'
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }

  // Cacheable API: stale-while-revalidate
  const cache = await caches.open(API_CACHE);
  const cachedResponse = await cache.match(request);

  // Fetch in background to update cache
  const fetchPromise = fetch(request)
    .then((response) => {
      // Only cache successful responses
      if (response && response.status === 200) {
        // Clone before caching since response can only be read once
        const responseClone = response.clone();
        cache.put(request, responseClone);
      }
      return response;
    })
    .catch((error) => {
      console.error('[SW] API fetch failed:', error);
      // If network fails and we have a cached response, use it
      if (cachedResponse) {
        return cachedResponse;
      }
      throw error;
    });

  // Return cached response immediately, update in background
  if (cachedResponse) {
    return cachedResponse;
  }

  // No cache, wait for network
  return fetchPromise;
}

/**
 * Handle navigation requests (SPA routing)
 */
async function handleNavigationRequest(request) {
  try {
    // Try network first for fresh content
    const response = await fetch(request);

    if (response && response.status === 200) {
      // Cache successful navigation responses
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.error('[SW] Navigation fetch failed, trying cache:', error);

    // Fall back to cached index.html for offline SPA
    const cachedResponse = await caches.match('/index.html');
    if (cachedResponse) {
      return cachedResponse;
    }

    // No cache available, show offline page
    return new Response(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>Offline - Incrementum</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              background: #0a0a0a;
              color: #e4e4e7;
              text-align: center;
              padding: 20px;
            }
            .offline-icon {
              font-size: 64px;
              margin-bottom: 20px;
            }
            h1 { margin: 0 0 10px; }
            p { margin: 0 0 20px; opacity: 0.8; }
            button {
              background: #6366f1;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 8px;
              cursor: pointer;
              font-size: 16px;
            }
          </style>
        </head>
        <body>
          <div class="offline-icon">📱</div>
          <h1>You're Offline</h1>
          <p>Check your internet connection to continue learning.</p>
          <button onclick="window.location.reload()">Try Again</button>
        </body>
      </html>`,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
}

/**
 * Handle image requests with aggressive caching
 */
async function handleImageRequest(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    // Check if cache is still valid (7 days)
    const cacheDate = cachedResponse.headers.get('date');
    if (cacheDate) {
      const age = (Date.now() - new Date(cacheDate).getTime()) / 1000;
      if (age < CACHE_DURATION.IMAGES) {
        return cachedResponse;
      }
    }
  }

  try {
    const response = await fetch(request);

    if (response && response.status === 200) {
      // Cache images with long expiration
      const responseClone = response.clone();
      cache.put(request, responseClone);
    }

    return response;
  } catch (error) {
    console.error('[SW] Image fetch failed:', error);
    // Return cached image even if expired
    return cachedResponse || new Response(null, { status: 404 });
  }
}

/**
 * Handle static requests with appropriate strategy.
 *
 * Hashed Vite assets (e.g. DocumentViewer-lND-KinN.js) already have built-in
 * cache busting via their content hash, so we use network-first to always get
 * the correct version referenced by index.html.
 *
 * Truly static assets (fonts, icons, etc.) use cache-first for offline support.
 */
async function handleStaticRequest(request) {
  const url = new URL(request.url);
  const isHashedAsset = /\.[a-zA-Z0-9_-]{8}\.(js|css|woff2?|ttf|svg)$/.test(url.pathname);

  if (isHashedAsset) {
    // Network-first for hashed assets: the hash guarantees uniqueness,
    // so a cache hit means the content is correct. But serving stale
    // cached versions of old hashes alongside a new index.html breaks
    // module imports (e.g. "Can't find variable: useCallback").
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cachedResponse = await cache.match(request);
      if (cachedResponse) return cachedResponse;
      return new Response('Resource not available offline', { status: 404 });
    }
  }

  // Cache-first for truly static assets
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);

    if (response && response.status === 200) {
      const responseClone = response.clone();
      cache.put(request, responseClone);
    }

    return response;
  } catch (error) {
    console.error('[SW] Static fetch failed:', error);
    return new Response('Resource not available offline', { status: 404 });
  }
}

/**
 * Background sync for offline actions
 */
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'sync-review-progress') {
    event.waitUntil(syncReviewProgress());
  }
});

/**
 * Sync review progress when back online
 */
async function syncReviewProgress() {
  try {
    // Get pending sync data from IndexedDB
    const pendingSync = await getPendingSyncData();

    // Send to server
    for (const item of pendingSync) {
      await fetch('/api/review/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.data),
      });

      // Remove from pending after successful sync
      await removePendingSyncData(item.id);
    }
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

/**
 * Get pending sync data from IndexedDB
 */
async function getPendingSyncData() {
  // This would interact with IndexedDB to get offline actions
  // For now, return empty array
  return [];
}

/**
 * Remove pending sync data after successful sync
 */
async function removePendingSyncData(id) {
  // This would remove the item from IndexedDB
  console.log('[SW] Removing synced item:', id);
}

/**
 * Push notification event
 */
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);

  const options = event.data?.json() || {
    title: 'Incrementum',
    body: 'You have a new notification',
    icon: '/icons/sprout-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'general',
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(options.title, {
      body: options.body,
      icon: options.icon,
      badge: options.badge,
      tag: options.tag,
      requireInteraction: options.requireInteraction,
      data: options.data,
      actions: options.actions || [],
    })
  );
});

/**
 * Notification click event
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);

  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it
      if (clientList.length > 0) {
        const client = clientList[0];
        client.focus();

        // Send message to client about notification click
        client.postMessage({
          type: 'NOTIFICATION_CLICKED',
          payload: { action, data },
        });

        // Navigate to specific route if provided
        if (data.url) {
          client.navigate(data.url);
        }
      } else {
        // Open new window
        const url = data.url || '/';
        self.clients.openWindow(url);
      }
    })
  );
});

/**
 * Notification close event
 */
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event);
});

/**
 * Message handler for manual cache control and notifications
 */
self.addEventListener('message', (event) => {
  const { action, data, type, payload } = event.data;

  switch (action || type) {
    case 'skipWaiting':
      self.skipWaiting();
      break;

    case 'cache-documents':
      event.waitUntil(cacheDocuments(data));
      break;

    case 'clear-cache':
      event.waitUntil(clearCache());
      break;

    case 'get-version':
      event.ports[0].postMessage({ version: VERSION });
      break;

    case 'SHOW_NOTIFICATION':
      // Show notification from main thread
      if (payload) {
        self.registration.showNotification(payload.title, {
          body: payload.body,
          icon: payload.icon || '/icons/sprout-192x192.png',
          badge: payload.badge || '/icons/badge-72x72.png',
          tag: payload.tag || 'default',
          requireInteraction: payload.requireInteraction || false,
          silent: payload.silent || false,
          data: payload.data || {},
          actions: payload.actions || [],
        });
      }
      break;

    case 'SCHEDULE_NOTIFICATION':
      // Store scheduled notification for later
      // In a real implementation, you'd use the Push API or periodic sync
      console.log('[SW] Scheduled notification:', payload);
      break;

    case 'CANCEL_NOTIFICATION':
      // Cancel a scheduled notification
      console.log('[SW] Cancel notification:', data);
      break;
  }
});

/**
 * Cache specific documents for offline reading
 */
async function cacheDocuments(documentIds) {
  const cache = await caches.open(API_CACHE);

  for (const id of documentIds) {
    try {
      const response = await fetch(`/api/documents/${id}`);
      if (response.ok) {
        await cache.put(`/api/documents/${id}`, response);
      }
    } catch (error) {
      console.error(`[SW] Failed to cache document ${id}:`, error);
    }
  }
}

/**
 * Clear all caches
 */
async function clearCache() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map(name => caches.delete(name))
  );
  console.log('[SW] All caches cleared');
}

// Log when service worker is fully loaded
self.addEventListener('controllerchange', () => {
  console.log('[SW] Controller changed, new service worker is active');
});

/**
 * Periodic Background Sync
 * Wakes up periodically to check for due cards and show notifications.
 * No server required - reads review data from IndexedDB.
 */
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-due-cards') {
    event.waitUntil(checkDueCardsAndNotify());
  }
});

async function checkDueCardsAndNotify() {
  console.log('[SW] Periodic sync: checking for due cards...');

  try {
    // Read notification preferences from IndexedDB
    const prefs = await readSWPreferences();
    if (!prefs || !prefs.studyReminders) return;

    // Check quiet hours
    if (isInQuietHours(prefs)) return;

    // Count due items by reading from IndexedDB (sql.js data)
    // Since the main app stores data in sql.js (IndexedDB-backed),
    // we can read review counts from the app's IndexedDB
    const dueCount = await getDueCardCount();

    if (dueCount > 0) {
      await self.registration.showNotification('Cards Due for Review', {
        body: `You have ${dueCount} card${dueCount > 1 ? 's' : ''} due for review. Keep your streak going!`,
        icon: '/icons/sprout-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: 'due-cards',
        requireInteraction: false,
        data: { type: 'due-cards', url: '/#/review', count: dueCount },
        actions: [
          { action: 'review', title: 'Start Review' },
          { action: 'dismiss', title: 'Later' },
        ],
      });
    }
  } catch (err) {
    console.error('[SW] Periodic sync failed:', err);
  }
}

async function readSWPreferences() {
  return new Promise((resolve) => {
    const request = indexedDB.open('incrementum-sw', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('preferences')) {
        db.createObjectStore('preferences', { keyPath: 'key' });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      try {
        const tx = db.transaction('preferences', 'readonly');
        const store = tx.objectStore('preferences');
        const getReq = store.get('notifications');
        getReq.onsuccess = () => resolve(getReq.result || null);
        getReq.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    };
    request.onerror = () => resolve(null);
  });
}

function isInQuietHours(prefs) {
  if (!prefs.quietHoursEnabled || !prefs.quietHoursStart || !prefs.quietHoursEnd) return false;

  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = prefs.quietHoursStart.split(':').map(Number);
  const [endH, endM] = prefs.quietHoursEnd.split(':').map(Number);
  const start = startH * 60 + startM;
  const end = endH * 60 + endM;

  if (start <= end) return current >= start && current < end;
  return current >= start || current < end;
}

async function getDueCardCount() {
  // Read from the app's sql.js database stored in IndexedDB
  // The app stores its SQLite database in IndexedDB under a known key
  return new Promise((resolve) => {
    const request = indexedDB.open('incrementum-sw', 1);
    request.onsuccess = () => {
      const db = request.result;
      try {
        // Try to read the due count from preferences store
        // (the main app will write this value when syncing prefs)
        const tx = db.transaction('preferences', 'readonly');
        const store = tx.objectStore('preferences');
        const getReq = store.get('due-card-count');
        getReq.onsuccess = () => resolve(getReq.result?.count || 0);
        getReq.onerror = () => resolve(0);
      } catch {
        resolve(0);
      }
    };
    request.onerror = () => resolve(0);
  });
}
