/* globals chrome */
// Debug version of background script to isolate the error

// Test Chrome APIs step by step

// Test each API individually
function testChromeAPIs() {
  
  try {
    if (chrome && chrome.runtime) {
    } else {
      console.error('❌ chrome.runtime not available');
    }
  } catch (error) {
    console.error('❌ Error testing chrome.runtime:', error);
  }
  
  try {
    if (chrome && chrome.tabs) {
    } else {
      console.error('❌ chrome.tabs not available';
    }
  } catch (error) {
    console.error('❌ Error testing chrome.tabs:', error);
  }
  
  try {
    if (chrome && chrome.contextMenus) {
    } else {
      console.error('❌ chrome.contextMenus not available';
    }
  } catch (error) {
    console.error('❌ Error testing chrome.contextMenus:', error);
  }
  
  try {
    if (chrome && chrome.commands) {
    } else {
      console.error('❌ chrome.commands not available';
    }
  } catch (error) {
    console.error('❌ Error testing chrome.commands:', error);
  }
  
  try {
    if (chrome && chrome.storage) {
    } else {
      console.error('❌ chrome.storage not available';
    }
  } catch (error) {
    console.error('❌ Error testing chrome.storage:', error);
  }
  
  try {
    if (chrome && chrome.notifications) {
    } else {
      console.error('❌ chrome.notifications not available';
    }
  } catch (error) {
    console.error('❌ Error testing chrome.notifications:', error);
  }
}

// Test context menu creation specifically
function testContextMenuCreation() {
  
  try {
    if (!chrome || !chrome.contextMenus) {
      console.error('❌ chrome.contextMenus not available for context menu test');
      return;
    }
    
    chrome.contextMenus.removeAll(() => {
      if (chrome.runtime.lastError) {
        console.error('❌ Error removing context menus:', chrome.runtime.lastError);
        return;
      }
      
      chrome.contextMenus.create({
        id: 'debug-test-menu',
        title: 'Debug Test Menu',
        contexts: ['page']
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('❌ Error creating context menu:', chrome.runtime.lastError);
        } else {
        }
      });
    });
    
  } catch (error) {
    console.error('❌ Error in context menu test:', error);
  }
}

// Test message listener
function testMessageListener() {
  
  try {
    if (!chrome || !chrome.runtime) {
      console.error('❌ chrome.runtime not available for message listener test');
      return;
    }
    
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      sendResponse({ success: true, debug: true });
      return true;
    });
    
  } catch (error) {
    console.error('❌ Error setting up message listener:', error);
  }
}

testChromeAPIs();

// Test after a short delay to ensure APIs are ready
setTimeout(() => {
  testContextMenuCreation();
  testMessageListener();
}, 100);
