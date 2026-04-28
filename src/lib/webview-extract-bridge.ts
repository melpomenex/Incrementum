/**
 * Webview Extract Bridge
 * 
 * This script is injected into Tauri webviews to enable text extraction
 * without losing focus. It tracks selection, shows a floating button,
 * and communicates with the parent window.
 */

export const WEBVIEW_EXTRACT_BRIDGE_SCRIPT = `
(function() {
  'use strict';
  
  // Prevent multiple injections
  if (window.__incrementumExtractBridge) {
    return;
  }
  window.__incrementumExtractBridge = true;
  
  // Configuration
  const CONFIG = {
    MIN_SELECTION_LENGTH: 3,
    BUTTON_OFFSET_Y: -45,
    BUTTON_OFFSET_X: 0,
    STORAGE_KEY: '__incrementum_selection_data'
  };
  
  // State
  let floatingButton = null;
  let lastSelection = '';
  let lastSelectionHtml = '';
  let hideTimeout = null;
  
  // Create the floating extract button
  function createFloatingButton() {
    if (floatingButton) {
      return floatingButton;
    }
    
    const button = document.createElement('div');
    button.id = '__incrementum-extract-btn';
    button.innerHTML = \`
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
        <path d="M12 5v14M5 12h14"/>
      </svg>
      <span>Extract</span>
    \`;
    
    // Styles
    button.style.cssText = \`
      position: fixed;
      z-index: 2147483647;
      display: none;
      align-items: center;
      padding: 8px 16px;
      background: #3b82f6;
      color: white;
      border-radius: 8px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: transform 0.15s ease, opacity 0.15s ease;
      user-select: none;
      pointer-events: auto;
    \`;
    
    // Hover effects
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.05)';
      clearTimeout(hideTimeout);
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
    });
    
    // Click handler
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      saveSelectionAndNotify();
      hideButton();
    });
    
    document.body.appendChild(button);
    floatingButton = button;
    return button;
  }
  
  // Get selected HTML content
  function getSelectedHtml() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return '';
    
    const range = selection.getRangeAt(0);
    const fragment = range.cloneContents();
    const div = document.createElement('div');
    div.appendChild(fragment);
    return div.innerHTML;
  }
  
  // Save selection to localStorage for parent to retrieve
  function saveSelectionAndNotify() {
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : '';
    
    if (text.length >= CONFIG.MIN_SELECTION_LENGTH) {
      const data = {
        text: text,
        html: lastSelectionHtml || getSelectedHtml(),
        url: window.location.href,
        title: document.title,
        timestamp: Date.now()
      };
      
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
      
      // Also try to notify via custom event (for same-origin iframes)
      try {
        window.dispatchEvent(new CustomEvent('__incrementum:extract', { detail: data }));
      } catch (e) {}
      
      // Try to notify parent window
      try {
        if (window.parent !== window) {
          window.parent.postMessage({
            type: '__incrementum:extract',
            data: data
          }, '*');
        }
      } catch (e) {}
    }
  }
  
  // Show floating button at selection position
  function showButtonAtSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      hideButton();
      return;
    }
    
    const text = selection.toString().trim();
    if (text.length < CONFIG.MIN_SELECTION_LENGTH) {
      hideButton();
      return;
    }
    
    // Save the selection
    lastSelection = text;
    lastSelectionHtml = getSelectedHtml();
    
    // Get position
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    // Create and position button
    const button = createFloatingButton();
    
    // Calculate position (above the selection, centered)
    let left = rect.left + (rect.width / 2) + CONFIG.BUTTON_OFFSET_X;
    let top = rect.top + CONFIG.BUTTON_OFFSET_Y;
    
    // Keep within viewport
    const buttonRect = button.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Center horizontally if possible
    left = Math.max(60, Math.min(left, viewportWidth - 60));
    
    // If above doesn't fit, show below
    if (top < 50) {
      top = rect.bottom + 10;
    }
    
    button.style.left = left + 'px';
    button.style.top = top + 'px';
    button.style.transform = 'translateX(-50%)';
    button.style.display = 'flex';
    button.style.opacity = '1';
    
    clearTimeout(hideTimeout);
  }
  
  // Hide the floating button
  function hideButton() {
    if (floatingButton) {
      floatingButton.style.opacity = '0';
      hideTimeout = setTimeout(() => {
        if (floatingButton) {
          floatingButton.style.display = 'none';
        }
      }, 150);
    }
  }
  
  // Handle selection change
  function handleSelectionChange() {
    // Small delay to let selection settle
    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection ? selection.toString().trim() : '';
      
      if (text.length >= CONFIG.MIN_SELECTION_LENGTH) {
        showButtonAtSelection();
      } else {
        hideButton();
      }
    }, 10);
  }
  
  // Handle mouse up (selection complete)
  function handleMouseUp(e) {
    // Don't trigger if clicking the button itself
    if (e.target.closest('#__incrementum-extract-btn')) {
      return;
    }
    
    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection ? selection.toString().trim() : '';
      
      if (text.length >= CONFIG.MIN_SELECTION_LENGTH) {
        showButtonAtSelection();
      }
    }, 10);
  }
  
  // Handle mouse down (clear selection)
  function handleMouseDown(e) {
    // Don't clear if clicking the button
    if (e.target.closest('#__incrementum-extract-btn')) {
      return;
    }
    hideButton();
  }
  
  // Configurable shortcut — defaults to Ctrl/Cmd+Shift+E, updated via _setShortcut
  let shortcutConfig = { ctrl: true, meta: true, shift: true, alt: false, key: 'E' };

  function matchesShortcut(e) {
    const sk = shortcutConfig;
    // meta is treated as an alias for ctrl on macOS when ctrl is not set (and vice versa)
    const wantCtrl = sk.ctrl || (sk.meta && !sk.ctrl);
    const wantMeta = sk.meta || (sk.ctrl && !sk.meta);
    const gotCtrl = e.ctrlKey || e.metaKey; // either modifier counts on any OS
    return (
      gotCtrl === (wantCtrl || wantMeta) &&
      e.altKey === !!sk.alt &&
      e.shiftKey === !!sk.shift &&
      e.key.toUpperCase() === sk.key.toUpperCase()
    );
  }

  // Keyboard shortcut handler
  function handleKeyDown(e) {
    if (matchesShortcut(e)) {
      e.preventDefault();
      const selection = window.getSelection();
      const text = selection ? selection.toString().trim() : '';

      if (text.length >= CONFIG.MIN_SELECTION_LENGTH) {
        saveSelectionAndNotify();
      }
    }
  }
  
  // Listen for requests from parent to get selection
  window.addEventListener('__incrementum:getSelection', () => {
    saveSelectionAndNotify();
  });
  
  // Listen for storage requests from parent (polling mechanism)
  window.addEventListener('storage', (e) => {
    if (e.key === '__incrementum:requestSelection') {
      saveSelectionAndNotify();
    }
  });
  
  // Set up event listeners
  document.addEventListener('selectionchange', handleSelectionChange);
  document.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('keydown', handleKeyDown);
  
  // Also listen on window for better capture
  window.addEventListener('mouseup', handleMouseUp);
  window.addEventListener('mousedown', handleMouseDown);
  
  // Hide button on scroll
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    hideButton();
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const selection = window.getSelection();
      const text = selection ? selection.toString().trim() : '';
      if (text.length >= CONFIG.MIN_SELECTION_LENGTH) {
        showButtonAtSelection();
      }
    }, 100);
  }, { passive: true });
  
  // Expose API for parent window
  window.__incrementum = {
    getSelection: () => {
      return JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || 'null');
    },
    clearSelection: () => {
      localStorage.removeItem(CONFIG.STORAGE_KEY);
      hideButton();
    },
    hasSelection: () => {
      const sel = window.getSelection();
      return sel && sel.toString().trim().length >= CONFIG.MIN_SELECTION_LENGTH;
    },
    _setShortcut: (combo) => {
      shortcutConfig = combo;
    },
  };
  
  console.log('[Incrementum] Extract bridge initialized');
})();
`;

/**
 * Get the storage key used by the bridge script
 */
export const SELECTION_STORAGE_KEY = '__incrementum_selection_data';

/**
 * Request storage key (parent writes this to trigger selection save)
 */
export const REQUEST_SELECTION_KEY = '__incrementum:requestSelection';
