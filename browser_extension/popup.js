/* globals chrome */
// Popup script for Incrementum Browser Sync

class PopupController {
  constructor() {
    this.extractMode = false;
    this.pageExtracts = [];
    this.apiConfig = null;
    this.keepAliveTimer = null;
    this.init();
  }

  async init() {
    this.setupEventListeners();
    this.startKeepAlive();

    await this.loadStatus();
    await this.loadStats();
    await this.checkExtractMode();
  }

  setupEventListeners() {
    document.getElementById('save-current-tab').addEventListener('click', () => {
      this.saveCurrentTab();
    });

    document.getElementById('save-all-tabs').addEventListener('click', () => {
      this.saveAllTabs();
    });

    document.getElementById('toggle-extract-mode').addEventListener('click', () => {
      this.toggleExtractMode();
    });

    document.getElementById('quick-extract').addEventListener('click', () => {
      this.quickExtract();
    });

    document.getElementById('toggle-highlights').addEventListener('click', () => {
      this.toggleHighlights();
    });

    document.getElementById('test-connection').addEventListener('click', () => {
      this.testConnection();
    });

    document.getElementById('options-link').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });

    document.getElementById('generate-summary').addEventListener('click', () => {
      this.generateAISummary();
    });

    document.getElementById('modal-close').addEventListener('click', () => {
      this.closeModal();
    });

    document.getElementById('ai-save-extract').addEventListener('click', () => {
      this.saveAIExtract();
    });

    document.getElementById('ai-regenerate').addEventListener('click', () => {
      this.generateAISummary();
    });

    // Close modal on overlay click
    document.getElementById('ai-modal').addEventListener('click', (e) => {
      if (e.target.id === 'ai-modal') {
        this.closeModal();
      }
    });
  }

  async loadStatus() {
    try {
      const response = await this.sendMessage({ action: 'getStatus' });

      if (response) {
        this.updateConnectionStatus(response.connected);
      }
    } catch (error) {
      console.error('Error loading status:', error);
      this.updateConnectionStatus(false);
    }
  }

  async loadStats() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id || this.isInternalUrl(tab.url)) {
        document.getElementById('extracts-count').textContent = '0';
        document.getElementById('highlights-count').textContent = '0';
        this.pageExtracts = [];
        return;
      }
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getPageStats' });

      if (response && response.success) {
        document.getElementById('extracts-count').textContent = response.extractsCount || '0';
        document.getElementById('highlights-count').textContent = response.highlightsCount || '0';
        this.pageExtracts = response.extracts || [];
      } else {
        document.getElementById('extracts-count').textContent = '0';
        document.getElementById('highlights-count').textContent = '0';
        this.pageExtracts = [];
      }

    } catch (error) {
      console.error('Error loading stats:', error);
      document.getElementById('extracts-count').textContent = '?';
      document.getElementById('highlights-count').textContent = '?';
    }
  }

  async saveCurrentTab() {
    const button = document.getElementById('save-current-tab');
    const originalContent = button.innerHTML;

    try {
      button.disabled = true;
      this.setButtonLoading(button, true);

      const response = await this.sendMessage({ action: 'saveCurrentTab' });

      if (response && response.success) {
        this.showNotification('Current tab saved successfully!', 'success');
      } else {
        this.showNotification(response?.error || 'Failed to save tab', 'error');
      }
    } catch (error) {
      console.error('Error saving current tab:', error);
      this.showNotification('Error saving tab', 'error');
    } finally {
      button.disabled = false;
      button.innerHTML = originalContent;
    }
  }

  async saveAllTabs() {
    const button = document.getElementById('save-all-tabs');
    const originalText = button.innerHTML;

    try {
      button.disabled = true;
      button.innerHTML = '<div class="loading"></div> Saving...';

      const response = await this.sendMessage({ action: 'saveAllTabs' });

      if (response && response.success) {
        const successful = response.successful || 0;
        const total = response.total || 0;
        this.showNotification(`Saved ${successful}/${total} tabs successfully!`, 'success');
      } else {
        this.showNotification(response?.error || 'Failed to save tabs', 'error');
      }
    } catch (error) {
      console.error('Error saving all tabs:', error);
      this.showNotification('Error saving tabs', 'error');
    } finally {
      button.disabled = false;
      button.innerHTML = originalText;
    }
  }

  async testConnection() {
    const link = document.getElementById('test-connection');
    const originalText = link.textContent;

    try {
      link.textContent = 'Testing...';

      const response = await this.sendMessage({ action: 'testConnection' });

      if (response && response.connected) {
        this.showNotification('Connection successful!', 'success');
        this.updateConnectionStatus(true);
      } else {
        this.showNotification('Connection failed. Check if Incrementum is running.', 'error');
        this.updateConnectionStatus(false);
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      this.showNotification('Connection test failed', 'error');
      this.updateConnectionStatus(false);
    } finally {
      link.textContent = originalText;
    }
  }

  updateConnectionStatus(connected) {
    const indicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');

    if (connected) {
      indicator.classList.add('connected');
      indicator.classList.remove('disconnected');
      statusText.textContent = 'Connected';
    } else {
      indicator.classList.remove('connected');
      indicator.classList.add('disconnected');
      statusText.textContent = 'Disconnected';
    }
  }

  showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');

    notification.textContent = message;
    notification.className = `notification ${type} show`;
    notification.style.display = 'block';

    // Auto-hide after 3 seconds
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.style.display = 'none';
      }, 300);
    }, 3000);
  }

  // Helper method to set button loading state
  setButtonLoading(button, isLoading) {
    const icon = button.querySelector('.btn-icon');
    const text = button.querySelector('.btn-text > div:first-child');

    if (isLoading) {
      if (icon) icon.style.display = 'none';
      if (text) text.innerHTML = 'Processing...';
    } else {
      if (icon) icon.style.display = 'block';
      // Reset text when needed
    }
  }

  async checkExtractMode() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id && !this.isInternalUrl(tab.url)) {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getExtractModeStatus' });
        if (response && response.extractMode !== undefined) {
          this.updateExtractModeIndicator(response.extractMode);
        }
      }
    } catch (error) {
      this.handleContentScriptError(error);
    }
  }

  // Toggle extract mode
  async toggleExtractMode() {
    try {
      const button = document.getElementById('toggle-extract-mode');

      button.disabled = true;
      this.setButtonLoading(button, true);

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id && !this.isInternalUrl(tab.url)) {
        await chrome.tabs.sendMessage(tab.id, { action: 'toggleExtractMode' });

        setTimeout(() => {
          this.checkExtractMode();
        }, 100);
      } else {
        this.showNotification('Extract mode not available on this page.', 'info');
      }
    } catch (error) {
      this.handleContentScriptError(error, 'Error toggling extract mode');
    } finally {
      const button = document.getElementById('toggle-extract-mode');
      button.disabled = false;
      button.innerHTML = button.innerHTML.replace('Processing...', 'Toggle Extract Mode');
    }
  }

  // Quick extract from selection
  async quickExtract() {
    try {
      const button = document.getElementById('quick-extract');

      button.disabled = true;
      this.setButtonLoading(button, true);

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id && !this.isInternalUrl(tab.url)) {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelection' });

        if (response && response.success && response.text) {
          const result = await this.sendMessage({
            action: 'createExtract',
            data: {
              text: response.text,
              url: tab.url,
              title: tab.title
            }
          });

          if (result && result.success) {
            this.showNotification(
              result.queued
                ? (result.message || 'Extract cached locally and will sync when Incrementum launches.')
                : 'Extract created successfully!',
              result.queued ? 'info' : 'success'
            );
            await this.loadStats(); // Refresh stats
          } else {
            this.showNotification(result?.error || 'Failed to create extract', 'error');
          }
        } else {
          this.showNotification('No text selected. Please select some text first.', 'info');
        }
      } else {
        this.showNotification('Extract mode not available on this page.', 'info');
      }
    } catch (error) {
      this.handleContentScriptError(error, 'Error creating extract');
    } finally {
      const button = document.getElementById('quick-extract');
      button.disabled = false;
      button.innerHTML = button.innerHTML.replace('Processing...', 'Quick Extract');
    }
  }

  // Toggle highlights
  async toggleHighlights() {
    try {
      const button = document.getElementById('toggle-highlights');

      button.disabled = true;
      this.setButtonLoading(button, true);

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id && !this.isInternalUrl(tab.url)) {
        await chrome.tabs.sendMessage(tab.id, { action: 'toggleHighlights' });
      } else {
        this.showNotification('Highlights not available on this page.', 'info');
      }
    } catch (error) {
      this.handleContentScriptError(error, 'Error toggling highlights');
    } finally {
      const button = document.getElementById('toggle-highlights');
      button.disabled = false;
      button.innerHTML = button.innerHTML.replace('Processing...', 'Toggle Highlights');
    }
  }

  updateExtractModeIndicator(isActive) {
    this.extractMode = isActive;
    const indicator = document.getElementById('extract-mode-indicator');

    if (isActive) {
      indicator.classList.remove('hidden');
    } else {
      indicator.classList.add('hidden');
    }
  }

  sendMessage(message) {
    return new Promise((resolve, reject) => {
      if (!chrome?.runtime?.id) {
        reject(new Error('Extension context invalidated'));
        return;
      }

      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  }

  isInternalUrl(url) {
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

  handleContentScriptError(error, fallbackMessage = 'Action failed') {
    const message = error?.message || '';
    if (message.includes('Extension context invalidated')) {
      this.showNotification('Extension reloaded. Close and reopen the popup, then retry.', 'error');
      return;
    }
    if (message.includes('Receiving end does not exist')) {
      this.showNotification('This page does not allow extension content scripts.', 'info');
      return;
    }
    console.error(fallbackMessage + ':', error);
    this.showNotification(fallbackMessage, 'error');
  }

  startKeepAlive() {
    if (this.keepAliveTimer !== null) {
      clearInterval(this.keepAliveTimer);
    }

    this.keepAliveTimer = setInterval(() => {
      this.sendMessage({ action: 'keepAlive', source: 'popup' }).catch((error) => {
        if ((error?.message || '').includes('Extension context invalidated')) {
          clearInterval(this.keepAliveTimer);
          this.keepAliveTimer = null;
        }
      });
    }, 20000);
  }

  // Store current AI response for saving
  currentAIResponse = null;
  currentPageContent = null;
  currentPageInfo = null;

  buildAISummaryExtractPayload() {
    if (!this.currentAIResponse || !this.currentPageInfo) {
      return null;
    }

    const sections = [];
    const summary = (this.currentAIResponse.summary || '').trim();
    const keyPoints = Array.isArray(this.currentAIResponse.key_points) ? this.currentAIResponse.key_points : [];
    const questions = Array.isArray(this.currentAIResponse.questions) ? this.currentAIResponse.questions : [];

    if (summary) {
      sections.push(`Summary\n${summary}`);
    }

    if (keyPoints.length > 0) {
      sections.push(`Key Points\n${keyPoints.map((point) => `- ${point}`).join('\n')}`);
    }

    if (questions.length > 0) {
      sections.push(`Questions\n${questions.map((question) => `- ${question}`).join('\n')}`);
    }

    const text = sections.join('\n\n').trim();
    if (!text) {
      return null;
    }

    return {
      text,
      url: this.currentPageInfo.url,
      title: `${this.currentPageInfo.title} - AI Summary`,
      context: this.currentPageContent || null,
      analysis: this.currentAIResponse,
      tags: ['ai-summary']
    };
  }

  async persistAISummaryExtract({ closeModalOnSuccess = false } = {}) {
    const extract = this.buildAISummaryExtractPayload();
    if (!extract) {
      throw new Error('No AI summary available to save');
    }

    const result = await this.sendMessage({
      action: 'saveExtract',
      extract
    });

    if (!result?.success) {
      throw new Error(result?.error || 'Failed to save AI summary extract');
    }

    this.showNotification(
      result.queued
        ? (result.message || 'AI summary cached locally and will sync when Incrementum launches.')
        : 'AI summary saved to Incrementum!',
      result.queued ? 'info' : 'success'
    );

    if (closeModalOnSuccess) {
      this.closeModal();
    }

    return result;
  }

  async generateAISummary() {
    const modal = document.getElementById('ai-modal');
    const modalContent = document.getElementById('ai-modal-content');

    // Show modal with loading state
    modal.classList.remove('hidden');
    modalContent.innerHTML = `
      <div class="ai-loading">
        <div class="ai-loading-spinner"></div>
        <div class="ai-loading-text">Analyzing content with AI...</div>
      </div>
    `;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || this.isInternalUrl(tab.url)) {
        throw new Error('Cannot analyze internal browser pages');
      }

      this.currentPageInfo = { url: tab.url, title: tab.title };

      // Try to get selected text first, then fall back to page content
      let content = '';
      try {
        const selectionResponse = await chrome.tabs.sendMessage(tab.id, { action: 'getSelection' });
        if (selectionResponse?.success && selectionResponse.text?.trim()) {
          content = selectionResponse.text;
        }
      } catch (e) {
        console.warn('[Popup] Could not get selection text from content script:', e?.message);
      }

      if (!content) {
        try {
          const contentResponse = await chrome.tabs.sendMessage(tab.id, { action: 'getPageContent' });
          if (contentResponse?.success && contentResponse.content) {
            content = contentResponse.content.slice(0, 10000); // Limit content size
          }
        } catch (e) {
          console.warn('[Popup] Could not get page content from content script:', e?.message);
        }
      }

      if (!content) {
        throw new Error('Could not extract content from this page');
      }

      this.currentPageContent = content;

      // Send to AI endpoint
      const response = await this.sendMessage({
        action: 'generateAISummary',
        data: {
          content,
          operation: 'all', // Get summary, key points, and questions
          url: tab.url,
          title: tab.title
        }
      });

      if (!response || !response.success) {
        throw new Error(response?.error || 'AI analysis failed');
      }

      this.currentAIResponse = response;
      await this.persistAISummaryExtract();

      this.renderAIResults(response);

    } catch (error) {
      console.error('AI Summary error:', error);
      modalContent.innerHTML = `
        <div class="ai-error">
          <div style="font-size: 32px; margin-bottom: 12px;">⚠️</div>
          <p>${error.message}</p>
          <p style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">
            Make sure AI is configured in the desktop app settings.
          </p>
        </div>
      `;
    }
  }

  renderAIResults(response) {
    const modalContent = document.getElementById('ai-modal-content');

    let html = '';

    if (response.reading_time_minutes || response.word_count || response.complexity_score) {
      html += `
        <div class="ai-section">
          <div class="ai-stats-row">
            <div class="ai-stat">
              <div class="ai-stat-value">${response.word_count || '—'}</div>
              <div class="ai-stat-label">Words</div>
            </div>
            <div class="ai-stat">
              <div class="ai-stat-value">${response.reading_time_minutes || '—'}m</div>
              <div class="ai-stat-label">Read Time</div>
            </div>
            <div class="ai-stat">
              <div class="ai-stat-value">${response.complexity_score || '—'}/10</div>
              <div class="ai-stat-label">Complexity</div>
            </div>
          </div>
        </div>
      `;
    }

    if (response.summary) {
      html += `
        <div class="ai-section">
          <div class="ai-section-title">📝 Summary</div>
          <div class="ai-summary">${this.escapeHtml(response.summary)}</div>
        </div>
      `;
    }

    if (response.key_points && response.key_points.length > 0) {
      html += `
        <div class="ai-section">
          <div class="ai-section-title">🎯 Key Points</div>
          <ul class="ai-key-points">
            ${response.key_points.map(point => `<li>${this.escapeHtml(point)}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    if (response.questions && response.questions.length > 0) {
      html += `
        <div class="ai-section">
          <div class="ai-section-title">❓ Questions to Consider</div>
          <ul class="questions-list">
            ${response.questions.map(q => `<li>${this.escapeHtml(q)}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    if (response.flashcards && response.flashcards.length > 0) {
      html += `
        <div class="ai-section">
          <div class="ai-section-title">🎴 Generated Flashcards</div>
          ${response.flashcards.slice(0, 3).map(card => `
            <div style="background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 8px; padding: 12px; margin-bottom: 8px;">
              <div style="font-weight: 600; margin-bottom: 6px;">Q: ${this.escapeHtml(card.question)}</div>
              <div style="color: var(--text-secondary); font-size: 13px;">A: ${this.escapeHtml(card.answer)}</div>
            </div>
          `).join('')}
        </div>
      `;
    }

    if (!html) {
      html = '<div class="ai-error">No analysis results returned</div>';
    }

    modalContent.innerHTML = html;
  }

  async saveAIExtract() {
    if (!this.currentPageInfo || !this.currentAIResponse) {
      this.showNotification('No content to save', 'error');
      return;
    }

    try {
      await this.persistAISummaryExtract({ closeModalOnSuccess: true });
    } catch (error) {
      console.error('Save error:', error);
      this.showNotification(error.message || 'Failed to save extract', 'error');
    }
  }

  // Close modal
  closeModal() {
    document.getElementById('ai-modal').classList.add('hidden');
  }

  // Helper to escape HTML
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
