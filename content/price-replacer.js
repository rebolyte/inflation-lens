/**
 * @typedef {Object} InflationCalculator
 * @property {(priceStr: string) => number} parsePrice
 * @property {(originalPrice: number, fromYear: number, toYear?: number) => number | null} calculateInflation
 * @property {(num: number) => string} formatPrice
 * @property {(() => number | null) | undefined} [getAdjustedYear]
 */

/**
 * Regular expression to match price patterns in text.
 * Matches:
 * - Prices with K/M/B/T suffixes: $5K, $2.5M, $1B, $1.5T
 * - Prices with word suffixes: $46 Billion, $1.5 Trillion
 * - Large numbers (4+ digits): $5000, $1234.56
 * - Comma-separated numbers: $1,234.56
 * - Optional USD suffix: $100 USD
 *
 * Examples: $100, $1,234.56, $5K, $2.5M, $1B, $1.5T, $100 USD, $46 Billion
 */
const PRICE_REGEX = /\$(\d+(?:\.\d{1,2})?\s*(?:trillion|billion|million|thousand)|\d+(?:\.\d{1,2})?[KkMmBbTt]|\d{4,}(?:\.\d{2})?|\d{1,3}(?:,\d{3})*(?:\.\d{2})?)(?:\s*(?:USD|usd))?/gi;

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'NOSCRIPT', 'TEXTAREA']);

/** @type {WeakSet<Node>} */
const processedNodes = new WeakSet();

/**
 * Determines whether a text node should be skipped during price replacement.
 * Skips nodes that are:
 * - Inside code blocks (SCRIPT, STYLE, CODE, PRE, NOSCRIPT, TEXTAREA)
 * - Inside elements with data-no-inflation attribute
 * - Already processed (inflation-adjusted-price class)
 * - Inside tooltip containers
 *
 * @param {Node} node - The text node to check
 * @returns {boolean} True if the node should be skipped, false otherwise
 */
export function shouldSkipNode(node) {
  if (!node || !node.parentElement) return true;

  /** @type {HTMLElement | null} */
  let element = node.parentElement;
  while (element) {
    if (SKIP_TAGS.has(element.tagName)) return true;
    if (element.hasAttribute('data-no-inflation')) return true;
    if (element.classList && element.classList.contains('inflation-adjusted-price')) return true;
    if (element.id === 'tooltips') return true;
    element = element.parentElement;
  }

  return false;
}

/**
 * @param {Node} textNode
 * @param {number} year
 * @param {InflationCalculator} calculator
 * @param {boolean} swapInPlace
 * @returns {number}
 */
export function replacePricesInNode(textNode, year, calculator, swapInPlace = false) {
  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return 0;
  if (processedNodes.has(textNode)) return 0;
  if (shouldSkipNode(textNode)) return 0;

  const text = textNode.textContent;
  if (!text || !PRICE_REGEX.test(text)) return 0;

  PRICE_REGEX.lastIndex = 0;

  const matches = [];
  let match;
  while ((match = PRICE_REGEX.exec(text)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      priceText: match[0],
      priceValue: match[1]
    });
  }

  if (matches.length === 0) return 0;

  const parent = textNode.parentNode;
  if (!parent) return 0;

  const fragment = document.createDocumentFragment();
  let lastIndex = 0;
  let replacementCount = 0;

  matches.forEach(m => {
    if (m.index > lastIndex) {
      fragment.appendChild(document.createTextNode(text.substring(lastIndex, m.index)));
    }

    const priceNum = calculator.parsePrice(m.priceValue);
    const adjusted = calculator.calculateInflation(priceNum, year);
    const adjustedYear = calculator.getAdjustedYear ? calculator.getAdjustedYear() : null;

    if (adjusted && adjusted !== priceNum) {
      const span = document.createElement('span');
      span.className = 'inflation-adjusted-price';
      span.setAttribute('data-testid', 'adjusted-price');
      span.setAttribute('data-original-price', m.priceText);
      span.setAttribute('data-original-year', String(year));
      span.setAttribute('data-adjusted-price', calculator.formatPrice(adjusted));
      
      const adjustedPriceText = adjustedYear 
        ? `${calculator.formatPrice(adjusted)} (${adjustedYear})`
        : calculator.formatPrice(adjusted);
      
      if (swapInPlace) {
        span.textContent = calculator.formatPrice(adjusted);
        const tooltipText = `${m.priceText} in ${year} = ${adjustedPriceText}`;
        span.setAttribute('data-tooltip', tooltipText);
      } else {
        span.textContent = m.priceText;
        const tooltipText = `${m.priceText} in ${year} = ${adjustedPriceText}`;
        span.setAttribute('data-tooltip', tooltipText);
      }
      
      fragment.appendChild(span);
      replacementCount++;
    } else {
      fragment.appendChild(document.createTextNode(m.priceText));
    }

    lastIndex = m.index + m.length;
  });

  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
  }

  parent.replaceChild(fragment, textNode);
  processedNodes.add(textNode);

  return replacementCount;
}

/**
 * @param {Element} rootElement
 * @param {number} year
 * @param {InflationCalculator} calculator
 * @param {boolean} swapInPlace
 * @returns {number}
 */
export function findAndReplacePrices(rootElement, year, calculator, swapInPlace = false) {
  if (!rootElement || !year || !calculator) return 0;

  const MAX_NODES = 250000;
  const walker = document.createTreeWalker(
    rootElement,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        if (shouldSkipNode(node)) return NodeFilter.FILTER_REJECT;
        if (processedNodes.has(node)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const nodesToProcess = [];
  let node;
  let count = 0;

  while ((node = walker.nextNode()) && count < MAX_NODES) {
    nodesToProcess.push(node);
    count++;
  }

  if (count >= MAX_NODES) {
    console.warn('[Inflation Lens] Hit maximum node limit of', MAX_NODES, '- some prices may not be adjusted');
  }

  let totalReplacements = 0;
  nodesToProcess.forEach(textNode => {
    totalReplacements += replacePricesInNode(textNode, year, calculator, swapInPlace);
  });

  return totalReplacements;
}
