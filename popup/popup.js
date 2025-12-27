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
    swapInPlace: false,

    /**
     * @returns {Promise<void>}
     */
    async init() {
      console.log('[Inflation Lens] Popup initializing');
      const storage = await chrome.storage.local.get(['enabled', 'swapInPlace']);
      this.enabled = storage.enabled !== false;
      this.swapInPlace = storage.swapInPlace === true;

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'getStats' }).then((response) => {
          if (response) {
            this.priceCount = response.priceCount || 0;
            this.detectedYear = response.detectedYear;
            this.enabled = response.enabled !== false;
            this.swapInPlace = response.swapInPlace === true;
          }
        }).catch((e) => console.log('Content script unavailable:', e.message));
      }

      chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'updateStats') {
          this.priceCount = message.data.priceCount || 0;
          this.detectedYear = message.data.detectedYear;
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

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
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

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'toggleSwapInPlace',
          swapInPlace: this.swapInPlace
        }).catch((e) => console.log('Content script unavailable:', e.message));
      }
    }
  }));
});
