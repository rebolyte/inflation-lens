const YEAR_REGEX = /\b(19[1-9]\d|20[0-2]\d)\b/;
const MIN_YEAR = 1913;
const MAX_YEAR = 2025;

/**
 * Validates that a year is within the acceptable range for CPI data
 * @param {string | number} year - The year to validate
 * @returns {number | null} The validated year as a number, or null if invalid
 */
export function validateYear(year) {
  const y = typeof year === 'number' ? year : parseInt(year, 10);
  return y >= MIN_YEAR && y <= MAX_YEAR ? y : null;
}

/**
 * Attempts to detect the publication year from meta tags in the page
 * @returns {number | null} The detected year or null if not found
 */
export function detectFromMetaTags() {
  const metaSelectors = [
    'meta[property="article:published_time"]',
    'meta[property="og:published_time"]',
    'meta[name="datePublished"]',
    'meta[itemprop="datePublished"]',
    'meta[name="date"]',
    'meta[name="publication_date"]'
  ];

  for (const selector of metaSelectors) {
    const meta = document.querySelector(selector);
    if (meta) {
      const content = meta.getAttribute('content') || meta.getAttribute('value');
      if (content) {
        const match = content.match(YEAR_REGEX);
        if (match) {
          const year = validateYear(match[1]);
          if (year) return year;
        }
      }
    }
  }

  return null;
}

/**
 * Attempts to detect the publication year from JSON-LD structured data
 * @returns {number | null} The detected year or null if not found
 */
export function detectFromJsonLd() {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));

  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent);
      const dateFields = ['datePublished', 'dateCreated', 'publishDate'];

      for (const field of dateFields) {
        const date = data[field];
        if (date && typeof date === 'string') {
          const match = date.match(YEAR_REGEX);
          if (match) {
            const year = validateYear(match[1]);
            if (year) return year;
          }
        }
      }
    } catch (e) {
      continue;
    }
  }

  return null;
}

/**
 * Attempts to detect the publication year from the URL
 * @returns {number | null} The detected year or null if not found
 */
export function detectFromUrl() {
  const url = window.location.href;
  const pathname = window.location.pathname;

  const patterns = [
    /\/(\d{4})\/\d{2}\/\d{2}\//,
    /\/(\d{4})-\d{2}-\d{2}/,
    /\/(\d{4})\/\d{2}\//,
    /\/(\d{4})\//,
    /[?&]year=(\d{4})/
  ];

  for (const pattern of patterns) {
    const match = (pathname + url).match(pattern);
    if (match) {
      const year = validateYear(match[1]);
      if (year) return year;
    }
  }

  return null;
}

/**
 * Detects the publication year of the current page using multiple strategies
 * Falls back to current year if detection fails
 * @returns {number} The detected or current year
 */
export function detectPageYear() {
  let year = detectFromMetaTags();
  if (year) return year;

  year = detectFromJsonLd();
  if (year) return year;

  year = detectFromUrl();
  if (year) return year;

  return new Date().getFullYear();
}
