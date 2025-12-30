/**
 * @typedef {Object} CPIData
 * @property {Object.<string, number>} data
 */

/** @type {CPIData | null} */
let cpiDataCache = null;

/**
 * @returns {Promise<CPIData | null>}
 */
export async function loadCPIData() {
  if (cpiDataCache) {
    return cpiDataCache;
  }

  try {
    const url = chrome.runtime.getURL('data/cpi-data.json');
    const response = await fetch(url);

    // Check response status if available (may not exist in test mocks)
    if (response.ok === false) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    cpiDataCache = data;
    console.log('[Inflation Lens] CPI data loaded successfully');
    return data;
  } catch (error) {
    console.error('[Inflation Lens] Failed to load CPI data:', error);
    // This is a critical failure - extension won't work without CPI data
    return null;
  }
}

/**
 * @param {number} originalPrice
 * @param {number} fromYear
 * @param {number} [toYear]
 * @returns {number | null}
 */
export function calculateInflation(originalPrice, fromYear, toYear = new Date().getFullYear()) {
  if (!cpiDataCache || !cpiDataCache.data) {
    return null;
  }

  const fromCPI = cpiDataCache.data[fromYear];
  let toCPI = cpiDataCache.data[toYear];

  if (!toCPI) {
    const years = Object.keys(cpiDataCache.data).map(Number).sort((a, b) => b - a);
    const latestYear = years[0];
    toCPI = cpiDataCache.data[latestYear];
  }

  if (!fromCPI || !toCPI) {
    return null;
  }

  const adjusted = originalPrice * (toCPI / fromCPI);
  return Math.round(adjusted * 100) / 100;
}

/**
 * @param {number} num
 * @returns {string}
 */
export function formatPrice(num) {
  if (num >= 1000000000) {
    const billions = num / 1000000000;
    const formatted = billions.toFixed(2);
    return '$' + formatted.replace(/\.?0+$/, '') + 'B';
  }
  if (num >= 1000000) {
    const millions = num / 1000000;
    const formatted = millions.toFixed(2);
    return '$' + formatted.replace(/\.?0+$/, '') + 'M';
  }
  if (num >= 1000) {
    return '$' + num.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  return '$' + num.toFixed(2);
}

/**
 * @param {string} priceStr
 * @returns {number}
 */
export function parsePrice(priceStr) {
  const cleaned = priceStr.replace(/[$,]/g, '');

  if (cleaned.match(/[BbMmKk]$/)) {
    const num = parseFloat(cleaned);
    const suffix = cleaned.slice(-1).toUpperCase();

    if (suffix === 'B') return num * 1000000000;
    if (suffix === 'M') return num * 1000000;
    if (suffix === 'K') return num * 1000;
  }

  return parseFloat(cleaned);
}

/**
 * @param {number} [toYear]
 * @returns {number | null}
 */
export function getAdjustedYear(toYear = new Date().getFullYear()) {
  if (!cpiDataCache || !cpiDataCache.data) {
    return null;
  }

  if (cpiDataCache.data[toYear]) {
    return toYear;
  }

  const years = Object.keys(cpiDataCache.data).map(Number).sort((a, b) => b - a);
  return years[0] || null;
}
