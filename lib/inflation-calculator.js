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
    const data = await response.json();
    cpiDataCache = data;
    return data;
  } catch (error) {
    console.error('Failed to load CPI data:', error);
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
  const toCPI = cpiDataCache.data[toYear];

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
    return '$' + (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
  }
  if (num >= 1000000) {
    return '$' + (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
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
