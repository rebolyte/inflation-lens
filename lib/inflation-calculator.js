/**
 * @typedef {Object} CPIData
 * @property {Object.<string, number>} data - CPI values indexed by year
 */

/** @type {CPIData | null} */
let cpiDataCache = null;

/**
 * Loads CPI data from the extension's data file
 * @returns {Promise<CPIData | null>} The CPI data object or null if loading fails
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
 * Calculates inflation-adjusted price from one year to another
 * @param {number} originalPrice - The original price amount
 * @param {number} fromYear - The year of the original price
 * @param {number} [toYear] - The target year for adjustment (defaults to current year)
 * @returns {number | null} The adjusted price or null if calculation fails
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
 * Formats a numeric price into a readable string with appropriate suffix
 * @param {number} num - The numeric price to format
 * @returns {string} Formatted price string (e.g., "$1.5M", "$1,234", "$12.34")
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
 * Parses a price string into a numeric value, handling K/M/B suffixes
 * @param {string} priceStr - The price string to parse (e.g., "$1.5M", "$1,234.56")
 * @returns {number} The numeric value of the price
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
