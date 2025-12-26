/**
 * @typedef {Object} InflationLensData
 * @property {number} priceCount
 * @property {number | null} detectedYear
 * @property {boolean} enabled
 * @property {() => Promise<void>} init
 * @property {() => Promise<void>} toggleEnabled
 */

document.addEventListener('alpine:init', () => {
  Alpine.data('inflationLens', () => ({
    priceCount: 0,
    detectedYear: null,
    enabled: true,

    /**
     * @returns {Promise<void>}
     */
    async init() {
      const storage = await chrome.storage.local.get(['enabled']);
      this.enabled = storage.enabled !== false;

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (tab?.id) {
        // @ts-ignore - Chrome sendMessage overload mismatch
        chrome.tabs.sendMessage(tab.id, { action: 'getStats' }, (response) => {
          if (response) {
            this.priceCount = response.priceCount || 0;
            this.detectedYear = response.detectedYear;
            this.enabled = response.enabled !== false;
          }
        });
      }

      chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'updateStats') {
          this.priceCount = message.data.priceCount || 0;
          this.detectedYear = message.data.detectedYear;
          this.enabled = message.data.enabled !== false;
        }
        return false;
      });
    },

    /**
     * @returns {Promise<void>}
     */
    async toggleEnabled() {
      await chrome.storage.local.set({ enabled: this.enabled });

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'toggleEnabled',
          enabled: this.enabled
        });
      }
    }
  }));
});
