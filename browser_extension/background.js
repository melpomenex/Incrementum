/* globals chrome */
// Background service worker for Incrementum Browser Sync
// Handles tab monitoring, bookmark syncing, and communication with Incrementum

let INCREMENTUM_BASE_URL = 'http://127.0.0.1:8766';
let ENABLE_CONTEXT_MENU = true;
let ENABLE_NOTIFICATIONS = true;
let keepAliveCount = 0;
const PENDING_EXTRACTS_KEY = 'pendingExtracts';
let flushInProgress = false;

function isRuntimeAvailable() {
  return Boolean(globalThis.chrome?.runtime?.id);
}

function isExtensionContextInvalidatedError(error) {
  const message = error?.message || '';
  return message.includes('Extension context invalidated');
}

async function safeSendTabMessage(tabId, message) {
  if (!isRuntimeAvailable() || !tabId) {
    return null;
  }

  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    if (isExtensionContextInvalidatedError(error)) {
      console.warn('[DEBUG] Extension context invalidated while sending tab message');
      return null;
    }
    throw error;
  }
}

async function resolveExtractToastTabId(sender, extract) {
  if (sender?.tab?.id) {
    return sender.tab.id;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && (!extract?.url || tab.url === extract.url)) {
      return tab.id;
    }
  } catch (error) {
    console.error('[DEBUG] Could not resolve toast tab id:', error.message);
  }

  return null;
}

function browserSyncEndpoint() {
  // Always hit the root path; QHttpServer is routed on "/"
  return new URL('/', INCREMENTUM_BASE_URL).toString();
}

async function getPendingExtracts() {
  const stored = await chrome.storage.local.get(PENDING_EXTRACTS_KEY);
  return Array.isArray(stored[PENDING_EXTRACTS_KEY]) ? stored[PENDING_EXTRACTS_KEY] : [];
}

async function setPendingExtracts(items) {
  await chrome.storage.local.set({ [PENDING_EXTRACTS_KEY]: items });
}

function createQueuedExtractPayload(data) {
  return {
    ...data,
    source: data.source || 'browser_extension',
    queuedAt: new Date().toISOString(),
    queueId: data.queueId || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  };
}

async function queueExtractForSync(data) {
  const queuedPayload = createQueuedExtractPayload(data);
  const pending = await getPendingExtracts();
  pending.push(queuedPayload);
  await setPendingExtracts(pending);
  return queuedPayload;
}

function isRetryableConnectionError(result) {
  if (!result || result.success) {
    return false;
  }

  if (result.retryable === true) {
    return true;
  }

  const message = (result.error || '').toLowerCase();
  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network error') ||
    message.includes('connection refused') ||
    message.includes('econnrefused') ||
    message.includes('err_connection_refused') ||
    message.includes('timeout') ||
    message.includes('fetch failed')
  );
}

async function flushQueuedExtracts() {
  if (flushInProgress) {
    return { success: true, flushed: 0, remaining: (await getPendingExtracts()).length, skipped: true };
  }

  flushInProgress = true;
  try {
    const pending = await getPendingExtracts();
    if (pending.length === 0) {
      return { success: true, flushed: 0, remaining: 0 };
    }

    const remaining = [];
    let flushed = 0;

    for (const item of pending) {
      const result = await sendToIncrementum(item, { allowFlush: false });
      if (result.success) {
        flushed += 1;
      } else {
        remaining.push(item);
        if (isRetryableConnectionError(result)) {
          break;
        }
      }
    }

    const firstRemainingIndex = flushed + remaining.length < pending.length
      ? flushed + remaining.length
      : pending.length;
    if (firstRemainingIndex < pending.length) {
      remaining.push(...pending.slice(firstRemainingIndex));
    }

    await setPendingExtracts(remaining);
    return { success: true, flushed, remaining: remaining.length };
  } finally {
    flushInProgress = false;
  }
}

async function flushQueuedExtractsIfPossible() {
  const pending = await getPendingExtracts();
  if (pending.length === 0) {
    return { success: true, flushed: 0, remaining: 0 };
  }

  const status = await getStatus({ flushQueue: false });
  if (!status.connected) {
    return { success: false, flushed: 0, remaining: pending.length, error: status.error };
  }

  return flushQueuedExtracts();
}

async function loadSettings() {
  try {
    const settings = await chrome.storage.sync.get(['serverUrl', 'browserSyncPort', 'enableContextMenu', 'enableNotifications']);

    let serverUrl = settings.serverUrl || '127.0.0.1';
    let port = settings.browserSyncPort || 8766;

    serverUrl = serverUrl.replace(/:\d+$/, '');

    // Ensure serverUrl has protocol
    if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
      serverUrl = `http://${serverUrl}`;
    }

    // Construct final URL with port
    const url = new URL(serverUrl);
    url.port = port.toString();
    // Use origin to avoid accidental double-slashes when appending "/"
    INCREMENTUM_BASE_URL = url.origin;

    ENABLE_CONTEXT_MENU = settings.enableContextMenu !== false;
    ENABLE_NOTIFICATIONS = settings.enableNotifications !== false;
  } catch (error) {
    console.error('[DEBUG] Error loading settings:', error);
    INCREMENTUM_BASE_URL = 'http://127.0.0.1:8766'; // Fallback
    ENABLE_CONTEXT_MENU = true;
    ENABLE_NOTIFICATIONS = true;
  }
}

chrome.runtime.onInstalled.addListener(async () => {

  await loadSettings();

  refreshContextMenus();
  await flushQueuedExtractsIfPossible();
});

// Service worker startup event
chrome.runtime.onStartup.addListener(async () => {
  await loadSettings();
  refreshContextMenus();
  await flushQueuedExtractsIfPossible();
});

chrome.runtime.onSuspend.addListener(() => {
  keepAliveCount = 0;
});

// Keep service worker active when needed
chrome.action.onClicked.addListener((_tab) => {
  // Intentionally empty: placeholder for future popup toggle behavior
});

function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'save-page',
      title: '💾 Save to Incrementum',
      contexts: ['page']
    });

    chrome.contextMenus.create({
      id: 'save-link',
      title: '🔗 Save Link to Incrementum',
      contexts: ['link']
    });

    chrome.contextMenus.create({
      id: 'create-extract',
      title: '📝 Create Extract',
      contexts: ['selection']
    });
  });
}

function refreshContextMenus() {
  if (!chrome?.contextMenus) {
    return;
  }
  if (ENABLE_CONTEXT_MENU) {
    createContextMenus();
  } else {
    chrome.contextMenus.removeAll();
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case 'save-page':
      await saveCurrentTab();
      break;

    case 'save-link':
      if (info.linkUrl) {
        await saveLink(info.linkUrl, tab?.id, info.linkText);
      }
      break;

    case 'create-extract':
      if (info.selectionText) {
        await createExtractFromSelection(info.selectionText, tab);
      }
      break;
  }
});

// NOTE: In MV3, onMessage listeners must not be `async`, otherwise the returned Promise
// can cause Chrome to close the message channel before `sendResponse()` runs.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  (async () => {
    try {
      switch (message.action) {
        case 'getStatus': {
          const statusResponse = await getStatus();
          sendResponse(statusResponse);
          break;
        }

        case 'saveCurrentTab': {
          try {
            const saveResponse = await saveCurrentTab();
            sendResponse(saveResponse);
          } catch (error) {
            console.error('[DEBUG] Error in saveCurrentTab handler:', error);
            sendResponse({ success: false, error: error.message });
            console.error('[DEBUG] saveCurrentTab error response sent');
          }
          break;
        }

        case 'saveAllTabs':
          sendResponse(await saveAllTabs());
          break;

        case 'testConnection':
          sendResponse(await testConnection());
          break;

        case 'keepAlive':
          keepAliveCount += 1;
          await flushQueuedExtractsIfPossible();
          sendResponse({ success: true, keepAliveCount, timestamp: new Date().toISOString() });
          break;

        case 'sendToIncrementum':
          sendResponse(await sendToIncrementum(message.data));
          break;

        case 'createExtract': {
          if (message.data && message.data.text) {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
              sendResponse(await createExtractFromSelection(message.data.text, tab));
            } else {
              sendResponse({ success: false, error: 'No active tab found' });
            }
          } else {
            sendResponse({ success: false, error: 'No text provided for extract' });
          }
          break;
        }

        case 'settingsChanged':
          // Reload settings when they change
          await loadSettings();

          if (message.settings && message.settings.enableContextMenu !== undefined) {
            ENABLE_CONTEXT_MENU = message.settings.enableContextMenu !== false;
            refreshContextMenus();
          }
          if (message.settings && message.settings.enableNotifications !== undefined) {
            ENABLE_NOTIFICATIONS = message.settings.enableNotifications !== false;
          }

          sendResponse({ success: true });
          break;

        case 'saveExtract':
        case 'saveExtractWithPriority': {
          const extract = message.extract || {};
          const text = (extract.text || '').trim();
          const url = extract.url || sender?.tab?.url || '';
          const title = extract.title || sender?.tab?.title || 'Untitled';
          const toastTabId = await resolveExtractToastTabId(sender, extract);

          if (!text) {
            sendResponse({ success: false, error: 'No text provided for extract' });
            break;
          }

          if (!url) {
            sendResponse({ success: false, error: 'No URL provided for extract' });
            break;
          }

          const payload = {
            url,
            title,
            text,
            html_content: extract.html_content, // Include rich HTML content
            type: 'extract',
            context: extract.context,
            tags: extract.tags,
            priority: extract.priority,
            analysis: extract.analysis,
            fsrs_data: extract.fsrs_data
          };

          const response = await sendToIncrementum(payload);

          if (!response.success && isRetryableConnectionError(response)) {
            const queuedItem = await queueExtractForSync(payload);
            await sendInPageToast(
              toastTabId,
              true,
              'Extract cached locally and will sync when Incrementum launches.'
            );
            sendResponse({
              success: true,
              queued: true,
              queueId: queuedItem.queueId,
              message: 'Extract cached locally and will sync when Incrementum launches.'
            });
            break;
          }

          await sendInPageToast(toastTabId, response.success, 'Extract sent to Incrementum!');
          sendResponse(response);
          break;
        }

        case 'generateAISummary': {
          const data = message.data || {};
          if (!data.content) {
            sendResponse({ success: false, error: 'No content provided for analysis' });
            break;
          }

          const aiResponse = await requestAIAnalysis(data);
          sendResponse(aiResponse);
          break;
        }

        case 'getAIStatus': {
          const statusResult = await checkAIStatus();
          sendResponse(statusResult);
          break;
        }

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('[DEBUG] Error in message handler:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  return true; // Keep message channel open for async response
});

async function getStatus(options = {}) {
  try {
    await loadSettings();

    // Since BrowserSyncServer only handles POST requests, test connectivity differently
    // Try to make a simple POST request with minimal data to test server availability
    const response = await fetch(browserSyncEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ test: true, source: 'status_check' })
    });

    // Any response (including 400) means the server is reachable
    if (options.flushQueue !== false) {
      await flushQueuedExtracts();
    }
    const pending = await getPendingExtracts();
    return { connected: true, status: response.status, pendingExtracts: pending.length };
  } catch (error) {
    console.error('Error checking status:', error);
    const pending = await getPendingExtracts();
    return { connected: false, error: error.message, pendingExtracts: pending.length };
  }
}

// Test connection
async function testConnection() {
  try {
    await loadSettings();

    const requestBody = JSON.stringify({ test: true, source: 'connection_test', timestamp: new Date().toISOString() });

    // Test with a simple POST request since that's what the server expects
    const response = await fetch(browserSyncEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: requestBody
    });

    // Any response means the server is running
    const flushResult = await flushQueuedExtracts();
    const pending = await getPendingExtracts();
    return { connected: true, status: response.status, pendingExtracts: pending.length, flushedExtracts: flushResult.flushed || 0 };
  } catch (error) {
    console.error('[DEBUG] Error testing connection:', error);
    console.error('[DEBUG] Error details:', error.name, error.message);
    const pending = await getPendingExtracts();
    return { connected: false, error: error.message, pendingExtracts: pending.length };
  }
}

async function saveCurrentTab() {
  try {

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || isInternalUrl(tab.url)) {
      console.error('[DEBUG] Cannot save - internal URL or no tab');
      return { success: false, error: 'Cannot save internal browser pages' };
    }

    const result = await savePage(tab.url, tab.title);

    if (result.success) {
      await sendInPageToast(tab.id, result.success, 'Page saved to Incrementum!');
    }

    return result;
  } catch (error) {
    console.error('[DEBUG] Error in saveCurrentTab:', error);
    return { success: false, error: error.message };
  }
}

async function saveAllTabs() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const validTabs = tabs.filter(tab => tab.url && !isInternalUrl(tab.url));

    let successful = 0;
    const results = await Promise.allSettled(
      validTabs.map(tab => savePage(tab.url, tab.title))
    );

    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value.success) {
        successful++;
      }
    });

    return {
      success: true,
      successful,
      total: validTabs.length
    };
  } catch (error) {
    console.error('Error saving all tabs:', error);
    return { success: false, error: error.message };
  }
}

async function sendToIncrementum(data, options = {}) {
  try {
    await loadSettings();

    // Use the root endpoint as expected by BrowserSyncServer
    const endpoint = browserSyncEndpoint();

    const trimmedText = (data.text || '').trim();

    const requestBody = JSON.stringify({
      url: data.url,
      title: data.title || 'Untitled',
      text: trimmedText,
      content: trimmedText, // kept for backward compatibility
      html_content: data.html_content, // Rich HTML content for visual fidelity
      extracted_images: data.extracted_images,
      type: data.type || (trimmedText ? 'extract' : 'page'),
      source: data.source || 'browser_extension',
      timestamp: data.timestamp || new Date().toISOString(),
      context: data.context,
      tags: data.tags,
      priority: data.priority,
      analysis: data.analysis,
      fsrs_data: data.fsrs_data
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: requestBody
    });

    if (response.ok) {
      // The BrowserSyncServer returns 200 OK without JSON body
      if (options.allowFlush !== false) {
        await flushQueuedExtractsIfPossible();
      }
      return { success: true, message: 'Data sent successfully' };
    } else {
      const errorText = await response.text();
      console.error('Server response error:', errorText);
      return { success: false, error: `Server error: ${response.status}`, retryable: response.status >= 500 };
    }
  } catch (error) {
    console.error('[DEBUG] Network error in sendToIncrementum:', error);
    console.error('[DEBUG] Network error details:', error.name, error.message);
    return { success: false, error: error.message, retryable: true };
  }
}
async function saveLink(url, sourceTabId, linkText) {
  // Resolve a title without opening a tab — use link text or hostname
  let fallbackTitle = '';
  try {
    fallbackTitle = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    fallbackTitle = 'Saved link';
  }

  const resolvedLinkText = typeof linkText === 'string' ? linkText.trim() : '';
  const title = resolvedLinkText || fallbackTitle;

  try {
    const result = await sendToIncrementum({
      url,
      title,
      text: '',
      type: 'page'
    });
    const msg = result.success ? 'Link sent to Incrementum!' : 'Failed to save link';
    await sendInPageToast(sourceTabId, result.success, msg);
    return result;
  } catch (error) {
    console.error('[DEBUG] Error in saveLink:', error);
    await sendInPageToast(sourceTabId, false, 'Failed to save link — server unreachable');
    return { success: false, error: error.message };
  }
}

async function savePage(url, title) {
  try {
    // Try to extract page content using the content script
    const tabs = await chrome.tabs.query({ url: url });
    let pageContent = '';
    let pageHtml = undefined;
    let extractedImages = undefined;

    if (tabs.length > 0 && tabs[0].id) {
      try {
        // Request content from the content script
        const response = await chrome.tabs.sendMessage(tabs[0].id, {
          action: 'getPageContent'
        });
        if (response && response.success) {
          pageContent = response.page?.text || response.content || '';
          pageHtml = response.page?.html_content;
          extractedImages = response.page?.extracted_images;
        }
      } catch (error) {
        console.error('[DEBUG] Could not get content from content script:', error.message);
      }
    }

    // If we couldn't get content from the content script, return at least URL and title
    return await sendToIncrementum({
      url,
      title,
      text: pageContent,
      html_content: pageHtml,
      extracted_images: extractedImages
    });
  } catch (error) {
    console.error('[DEBUG] Error in savePage:', error);
    // Fallback to basic save without content
    return await sendToIncrementum({ url, title, text: '' });
  }
}

// Create extract from selection (context menu)
async function createExtractFromSelection(selectedText, tab) {
  const text = (selectedText || '').trim();
  if (!text) {
    return { success: false, error: 'No selection provided' };
  }
  const payload = { url: tab.url, title: tab.title, text, type: 'extract' };
  const result = await sendToIncrementum(payload);
  if (!result.success && isRetryableConnectionError(result)) {
    const queuedItem = await queueExtractForSync(payload);
    await sendInPageToast(tab?.id, true, 'Extract cached and will sync when Incrementum launches.');
    return {
      success: true,
      queued: true,
      queueId: queuedItem.queueId,
      message: 'Extract cached locally and will sync when Incrementum launches.'
    };
  }
  await sendInPageToast(tab?.id, result.success, 'Extract sent to Incrementum!');
  return result;
}

async function sendInPageToast(tabId, success, message) {
  if (!ENABLE_NOTIFICATIONS) {
    return;
  }
  try {
    if (tabId) {
      await safeSendTabMessage(tabId, {
        action: 'showSaveIndicator',
        text: message,
        type: success ? 'success' : 'error'
      });
    } else {
      // Fallback to native notification when no tab context is available
      if (chrome.notifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon48.png',
          title: 'Incrementum',
          message: message
        });
      }
    }
  } catch (error) {
    console.error('[DEBUG] Could not send in-page toast:', error.message);
  }
}

// Helper function to check if URL is internal
function isInternalUrl(url) {
  if (!url) return true;

  const internalPrefixes = [
    'chrome://',
    'chrome-extension://',
    'moz-extension://',
    'about:',
    'edge://',
    'opera://',
    'brave://'
  ];

  return internalPrefixes.some(prefix => url.startsWith(prefix));
}

chrome.commands.onCommand.addListener(async (command) => {
  switch (command) {
    case 'save-current-tab':
      await saveCurrentTab();
      break;

    case 'toggle-extract-mode':
      await toggleExtractMode();
      break;

    case 'quick-extract':
      await quickExtract();
      break;

    case 'toggle-highlights':
      await toggleHighlights();
      break;

    case 'save-all-tabs':
      await saveAllTabs();
      break;
  }
});

// Toggle extract mode
async function toggleExtractMode() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      await safeSendTabMessage(tab.id, { action: 'toggleExtractMode' });
    }
  } catch (error) {
    console.error('Error toggling extract mode:', error);
  }
}

// Quick extract from selection
async function quickExtract() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      const response = await safeSendTabMessage(tab.id, { action: 'getSelection' });
      if (response && response.success && response.text) {
        await createExtractFromSelection(response.text, tab);
      } else {
        console.warn('[DEBUG] No selection text available for quick extract');
      }
    }
  } catch (error) {
    console.error('Error in quick extract:', error);
  }
}

// Toggle highlights
async function toggleHighlights() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      await safeSendTabMessage(tab.id, { action: 'toggleHighlights' });
    }
  } catch (error) {
    console.error('Error toggling highlights:', error);
  }
}

// Request AI analysis from desktop app
async function requestAIAnalysis(data) {
  try {
    await loadSettings();
    const endpoint = `${INCREMENTUM_BASE_URL}/ai/process`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: data.content,
        operation: data.operation || 'all',
        max_words: data.max_words || 150,
        count: data.count || 5,
        url: data.url,
        title: data.title
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DEBUG] AI request failed:', response.status, errorText);
      return {
        success: false,
        error: response.status === 503
          ? 'AI is not configured. Please configure an AI provider in the desktop app settings.'
          : `AI request failed: ${response.status}`
      };
    }

    const result = await response.json();
    return result;

  } catch (error) {
    console.error('[DEBUG] AI analysis error:', error);
    return {
      success: false,
      error: error.message || 'Failed to connect to AI service'
    };
  }
}

async function checkAIStatus() {
  try {
    await loadSettings();
    const endpoint = `${INCREMENTUM_BASE_URL}/ai/status`;

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return { configured: false, error: 'Failed to check AI status' };
    }

    const result = await response.json();
    return result;

  } catch (error) {
    console.error('[DEBUG] AI status check error:', error);
    return { configured: false, error: error.message };
  }
}
