/**
 * @typedef {Object} InflationCalculator
 * @property {(priceStr: string) => number} parsePrice
 * @property {(originalPrice: number, fromYear: number, toYear?: number) => number | null} calculateInflation
 * @property {(num: number) => string} formatPrice
 */

const PRICE_REGEX = /\$(\d+(?:\.\d{1,2})?[KkMmBb]|\d{1,3}(?:,\d{3})*(?:\.\d{2})?)(?:\s*(?:USD|usd))?/g;

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'NOSCRIPT', 'TEXTAREA']);

/** @type {WeakSet<Node>} */
const processedNodes = new WeakSet();

/**
 * @param {Node} node
 * @returns {boolean}
 */
export function shouldSkipNode(node) {
  if (!node || !node.parentElement) return true;

  /** @type {HTMLElement | null} */
  let element = node.parentElement;
  while (element) {
    if (SKIP_TAGS.has(element.tagName)) return true;
    if (element.hasAttribute('data-no-inflation')) return true;
    if (element.classList && element.classList.contains('inflation-adjusted-price')) return true;
    element = element.parentElement;
  }

  return false;
}

/**
 * @param {Node} textNode
 * @param {number} year
 * @param {InflationCalculator} calculator
 * @returns {number}
 */
export function replacePricesInNode(textNode, year, calculator) {
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

    if (adjusted && adjusted !== priceNum) {
      const span = document.createElement('span');
      span.className = 'inflation-adjusted-price';
      span.textContent = m.priceText;
      span.setAttribute('data-original-price', m.priceText);
      span.setAttribute('data-original-year', String(year));
      span.setAttribute('data-adjusted-price', calculator.formatPrice(adjusted));
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
 * @returns {number}
 */
export function findAndReplacePrices(rootElement, year, calculator) {
  if (!rootElement || !year || !calculator) return 0;

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
  while ((node = walker.nextNode())) {
    nodesToProcess.push(node);
  }

  let totalReplacements = 0;
  nodesToProcess.forEach(textNode => {
    totalReplacements += replacePricesInNode(textNode, year, calculator);
  });

  return totalReplacements;
}
