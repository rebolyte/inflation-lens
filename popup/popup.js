/**
 * @typedef {Object} InflationLensData
 * @property {number} priceCount
 * @property {number | null} detectedYear
 * @property {number | null} overrideYear
 * @property {boolean} enabled
 * @property {() => Promise<void>} init
 * @property {() => Promise<void>} toggleEnabled
 * @property {() => Promise<void>} updateYear
 */

document.addEventListener('alpine:init', () => {
  Alpine.data('inflationLens', () => ({
    priceCount: 0,
    detectedYear: null,
    overrideYear: null,
    enabled: true,
    swapInPlace: false,
    yearError: '',
    contentScriptAvailable: true,

    /**
     * Get the target tab to communicate with.
     * In testing mode (opened with ?testing=true), finds the first HTTP/HTTPS tab.
     * In normal mode, finds the active tab in the current window.
     * @returns {Promise<chrome.tabs.Tab | undefined>}
     */
    async getTargetTab() {
      const params = new URLSearchParams(window.location.search);
      const isTesting = params.get('testing') === 'true';

      if (isTesting) {
        // In E2E tests, the popup is a tab, so we need to find the active content page
        // Query for active tabs across all windows, excluding the popup itself
        const activeTabs = await chrome.tabs.query({ active: true });
        const popupUrl = window.location.href;
        const activeContentTab = activeTabs.find(t => 
          t.url && 
          (t.url.startsWith('http://') || t.url.startsWith('https://')) &&
          t.url !== popupUrl
        );
        if (activeContentTab) {
          return activeContentTab;
        }
        // Fallback to first HTTP/HTTPS tab (excluding popup) if no active content tab found
        const tabs = await chrome.tabs.query({});
        return tabs.find(t => 
          t.url && 
          (t.url.startsWith('http://') || t.url.startsWith('https://')) &&
          t.url !== popupUrl
        );
      }

      // Normal usage: get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab;
    },

    /**
     * @returns {Promise<void>}
     */
    async init() {
      console.log('[Inflation Lens] Popup initializing');
      const storage = await chrome.storage.local.get(['enabled', 'swapInPlace']);
      this.enabled = storage.enabled !== false;
      this.swapInPlace = storage.swapInPlace === true;

      const tab = await this.getTargetTab();

      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'getStats' }).then((response) => {
          if (response) {
            this.contentScriptAvailable = true;
            this.priceCount = response.priceCount || 0;
            this.detectedYear = response.detectedYear;
            this.overrideYear = response.detectedYear !== null && response.detectedYear !== undefined
              ? (response.currentYear || response.detectedYear)
              : null;
            this.enabled = response.enabled !== false;
            this.swapInPlace = response.swapInPlace === true;
          }
        }).catch((e) => {
          console.log('Content script unavailable:', e.message);
          this.contentScriptAvailable = false;
        });
      } else {
        this.contentScriptAvailable = false;
      }

      chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'updateStats') {
          this.contentScriptAvailable = true;
          this.priceCount = message.data.priceCount || 0;
          this.detectedYear = message.data.detectedYear;
          this.overrideYear = message.data.detectedYear !== null && message.data.detectedYear !== undefined
            ? (message.data.currentYear || message.data.detectedYear)
            : null;
          this.enabled = message.data.enabled !== false;
          this.swapInPlace = message.data.swapInPlace === true;
        }
        return false;
      });
    },

    /**
     * @returns {Promise<void>}
     */
    async toggleEnabled() {
      await chrome.storage.local.set({ enabled: this.enabled });

      const tab = await this.getTargetTab();
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'toggleEnabled',
          enabled: this.enabled
        }).catch((e) => console.log('Content script unavailable:', e.message));
      }
    },

    /**
     * @returns {Promise<void>}
     */
    async toggleSwapInPlace() {
      await chrome.storage.local.set({ swapInPlace: this.swapInPlace });

      const tab = await this.getTargetTab();
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'toggleSwapInPlace',
          swapInPlace: this.swapInPlace
        }).catch((e) => console.log('Content script unavailable:', e.message));
      }
    },

    /**
     * Validates and updates the year override for inflation calculations.
     * Year must be a valid number between 1913 and 2025 (CPI data range).
     * @returns {Promise<void>}
     */
    async updateYear() {
      let year = null;

      if (this.overrideYear) {
        const parsed = parseInt(this.overrideYear, 10);

        // Validate that parsing succeeded and year is in valid range
        if (!isNaN(parsed) && parsed >= 1913 && parsed <= 2025) {
          year = parsed;
          this.yearError = ''; // Clear error on valid input
        } else {
          console.warn('[Inflation Lens] Invalid year input:', this.overrideYear);
          // Show error message to user
          this.yearError = 'Year must be between 1913-2025';
          // Reset to detected year after showing error
          setTimeout(() => {
            this.overrideYear = this.detectedYear;
            this.yearError = '';
          }, 2000);
          return;
        }
      } else {
        this.yearError = ''; // Clear error when input is empty
      }

      const tab = await this.getTargetTab();
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'updateYear',
          year: year
        }).catch((e) => console.log('Content script unavailable:', e.message));
      }
    }
  }));
});
