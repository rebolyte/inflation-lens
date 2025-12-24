const YEAR_REGEX = /\b(19[1-9]\d|20[0-2]\d)\b/;
const MIN_YEAR = 1913;
const MAX_YEAR = 2025;

function validateYear(year) {
  const y = parseInt(year, 10);
  return y >= MIN_YEAR && y <= MAX_YEAR ? y : null;
}

function detectFromMetaTags() {
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

function detectFromJsonLd() {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');

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

function detectFromUrl() {
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

function detectPageYear() {
  let year = detectFromMetaTags();
  if (year) return year;

  year = detectFromJsonLd();
  if (year) return year;

  year = detectFromUrl();
  if (year) return year;

  return new Date().getFullYear();
}
