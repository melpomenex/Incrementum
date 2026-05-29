/* globals chrome */
// Minimal background script for debugging

// Test Chrome APIs availability

// Simple initialization without complex logic
class MinimalIncrementumSync {
  constructor() {
    this.serverUrl = 'http://127.0.0.1:8766';
    this.isEnabled = true;
  }

  async init() {
    
    try {
      // Test basic Chrome API access
      if (chrome && chrome.runtime) {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
          sendResponse({ success: true, message: 'Minimal sync active' });
          return true;
        });
        
      } else {
        console.error('Chrome runtime not available');
      }
      
      // Test context menus only if available
      if (chrome && chrome.contextMenus) {
        chrome.contextMenus.removeAll(() => {
          if (chrome.runtime.lastError) {
            console.error('Error removing context menus:', chrome.runtime.lastError);
            return;
          }
          
          chrome.contextMenus.create({
            id: 'test-menu',
            title: 'Test Incrementum',
            contexts: ['page']
          }, () => {
            if (chrome.runtime.lastError) {
              console.error('Error creating context menu:', chrome.runtime.lastError);
            } else {
            }
          });
        });
      } else {
        console.warn('Chrome contextMenus not available');
      }
      
    } catch (error) {
      console.error('Error in MinimalIncrementumSync init:', error);
    }
  }
}

const minimalSync = new MinimalIncrementumSync();

// Initialize after a short delay to ensure Chrome APIs are ready
setTimeout(() => {
  minimalSync.init().catch(error => {
    console.error('Initialization failed:', error);
  });
}, 100);
