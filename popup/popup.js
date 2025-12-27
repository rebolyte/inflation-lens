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
            this.priceCount = response.priceCount || 0;
            this.detectedYear = response.detectedYear;
            this.overrideYear = response.detectedYear !== null && response.detectedYear !== undefined 
              ? (response.currentYear || response.detectedYear) 
              : null;
            this.enabled = response.enabled !== false;
            this.swapInPlace = response.swapInPlace === true;
          }
        }).catch((e) => console.log('Content script unavailable:', e.message));
      }

      chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'updateStats') {
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
     * @returns {Promise<void>}
     */
    async updateYear() {
      const year = this.overrideYear ? parseInt(this.overrideYear, 10) : null;

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
