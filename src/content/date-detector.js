const YEAR_REGEX = /\b(19[1-9]\d|20[0-2]\d)\b/;
const MIN_YEAR = 1913;
const MAX_YEAR = 2025;

/**
 * @param {string | number} year
 * @returns {number | null}
 */
export function validateYear(year) {
  const y = typeof year === 'number' ? year : parseInt(year, 10);
  return y >= MIN_YEAR && y <= MAX_YEAR ? y : null;
}

/**
 * @returns {number | null}
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
 * @returns {number | null}
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
      // JSON-LD parsing failed - likely malformed JSON, continue to next script
      console.debug('[Inflation Lens] Failed to parse JSON-LD script:', e.message);
      continue;
    }
  }

  return null;
}

/**
 * @returns {number | null}
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
 * @returns {number}
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
