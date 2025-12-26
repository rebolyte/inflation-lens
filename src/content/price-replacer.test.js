import { it, beforeEach, afterEach, describe } from "node:test";
import assert from "node:assert";
import { JSDOM } from "jsdom";
import { shouldSkipNode, replacePricesInNode, findAndReplacePrices } from "../../content/price-replacer.js";

// Set up mocks for real calculator before import
global.chrome = {
  runtime: {
    getURL: (path) => `/fake/${path}`,
  },
};

global.fetch = async (url) => {
  if (url.includes("cpi-data.json")) {
    return {
      json: async () => ({
        data: {
          1913: 9.9,
          2000: 172.2,
          2020: 258.8,
          2024: 310.3,
          2025: 320.0, // Current year for tests
        },
      }),
    };
  }
  throw new Error("Unknown URL");
};

// Import real calculator for integration tests
import { loadCPIData, calculateInflation, formatPrice, parsePrice } from "../../lib/inflation-calculator.js";

let dom;
let originalDocument;

// Mock calculator for testing
const mockCalculator = {
  parsePrice: (str) => parseFloat(str.replace(/[$,]/g, '')),
  calculateInflation: (price, year) => price * 1.5, // Simple 50% inflation for testing
  formatPrice: (num) => `$${num.toFixed(2)}`
};

describe("price-replacer", () => {
  beforeEach(() => {
    dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>");
    originalDocument = global.document;
    global.document = dom.window.document;
    global.Node = dom.window.Node;
    global.NodeFilter = dom.window.NodeFilter;
  });

  afterEach(() => {
    global.document = originalDocument;
    delete global.Node;
    delete global.NodeFilter;
  });

  describe("PRICE_REGEX pattern matching", () => {
    it("matches simple dollar amounts", () => {
      const div = dom.window.document.createElement("div");
      div.textContent = "The item costs $100";

      const count = findAndReplacePrices(div, 2000, mockCalculator);
      assert.strictEqual(count, 1);
      assert.ok(div.innerHTML.includes("inflation-adjusted-price"));
    });

    it("matches prices with cents", () => {
      const div = dom.window.document.createElement("div");
      div.textContent = "Price: $99.99";

      const count = findAndReplacePrices(div, 2000, mockCalculator);
      assert.strictEqual(count, 1);
    });

    it("matches prices with thousands separators", () => {
      const div = dom.window.document.createElement("div");
      div.textContent = "Cost was $1,234.56";

      const count = findAndReplacePrices(div, 2000, mockCalculator);
      assert.strictEqual(count, 1);
    });

    it("matches prices with K suffix", () => {
      const div = dom.window.document.createElement("div");
      div.textContent = "Budget: $5K";

      const count = findAndReplacePrices(div, 2000, mockCalculator);
      assert.strictEqual(count, 1);
    });

    it("matches prices with M suffix", () => {
      const div = dom.window.document.createElement("div");
      div.textContent = "Value: $2.5M";

      const count = findAndReplacePrices(div, 2000, mockCalculator);
      assert.strictEqual(count, 1);
    });

    it("matches prices with B suffix", () => {
      const div = dom.window.document.createElement("div");
      div.textContent = "Deal worth $1.2B";

      const count = findAndReplacePrices(div, 2000, mockCalculator);
      assert.strictEqual(count, 1);
    });

    it("matches prices with USD suffix", () => {
      const div = dom.window.document.createElement("div");
      div.textContent = "Price: $100 USD";

      const count = findAndReplacePrices(div, 2000, mockCalculator);
      assert.strictEqual(count, 1);
    });

    it("matches multiple prices in same text", () => {
      const div = dom.window.document.createElement("div");
      div.textContent = "Prices range from $10 to $100 or even $1,000";

      const count = findAndReplacePrices(div, 2000, mockCalculator);
      assert.strictEqual(count, 3);
    });

    it("matches prices without comma separators", () => {
      const div = dom.window.document.createElement("div");
      div.textContent = "The price was $1000";

      const count = findAndReplacePrices(div, 2000, mockCalculator);
      assert.strictEqual(count, 1);
      const span = div.querySelector(".inflation-adjusted-price");
      assert.ok(span);
      assert.strictEqual(span.getAttribute("data-original-price"), "$1000");
    });

    it("matches various prices without comma separators", () => {
      const div = dom.window.document.createElement("div");
      div.textContent = "Prices: $2400, $2400.28, $500000, $10000000";

      const count = findAndReplacePrices(div, 2000, mockCalculator);
      assert.strictEqual(count, 4);
      const spans = div.querySelectorAll(".inflation-adjusted-price");
      assert.strictEqual(spans.length, 4);
      
      const prices = Array.from(spans).map(s => s.getAttribute("data-original-price"));
      assert.ok(prices.includes("$2400"), `Expected $2400, got ${prices}`);
      assert.ok(prices.includes("$2400.28"), `Expected $2400.28, got ${prices}`);
      assert.ok(prices.includes("$500000"), `Expected $500000, got ${prices}`);
      assert.ok(prices.includes("$10000000"), `Expected $10000000, got ${prices}`);
    });

    it("does not match invalid patterns", () => {
      const div = dom.window.document.createElement("div");
      div.textContent = "Model: S100, Year: 2020, Code: USD123";

      const count = findAndReplacePrices(div, 2000, mockCalculator);
      assert.strictEqual(count, 0);
    });
  });

  describe("shouldSkipNode", () => {
    it("skips nodes in SCRIPT tags", () => {
      const script = dom.window.document.createElement("script");
      script.textContent = "$100";
      dom.window.document.body.appendChild(script);

      const textNode = script.firstChild;
      assert.strictEqual(shouldSkipNode(textNode), true);
    });

    it("skips nodes in STYLE tags", () => {
      const style = dom.window.document.createElement("style");
      style.textContent = "$100";
      dom.window.document.body.appendChild(style);

      const textNode = style.firstChild;
      assert.strictEqual(shouldSkipNode(textNode), true);
    });

    it("skips nodes in CODE tags", () => {
      const code = dom.window.document.createElement("code");
      code.textContent = "$100";
      dom.window.document.body.appendChild(code);

      const textNode = code.firstChild;
      assert.strictEqual(shouldSkipNode(textNode), true);
    });

    it("skips nodes in PRE tags", () => {
      const pre = dom.window.document.createElement("pre");
      pre.textContent = "$100";
      dom.window.document.body.appendChild(pre);

      const textNode = pre.firstChild;
      assert.strictEqual(shouldSkipNode(textNode), true);
    });

    it("skips nodes with data-no-inflation attribute", () => {
      const div = dom.window.document.createElement("div");
      div.setAttribute("data-no-inflation", "true");
      div.textContent = "$100";
      dom.window.document.body.appendChild(div);

      const textNode = div.firstChild;
      assert.strictEqual(shouldSkipNode(textNode), true);
    });

    it("skips nodes with inflation-adjusted-price class", () => {
      const span = dom.window.document.createElement("span");
      span.className = "inflation-adjusted-price";
      span.textContent = "$100";
      dom.window.document.body.appendChild(span);

      const textNode = span.firstChild;
      assert.strictEqual(shouldSkipNode(textNode), true);
    });

    it("does not skip regular text nodes", () => {
      const div = dom.window.document.createElement("div");
      div.textContent = "$100";
      dom.window.document.body.appendChild(div);

      const textNode = div.firstChild;
      assert.strictEqual(shouldSkipNode(textNode), false);
    });

    it("skips nodes in nested excluded tags", () => {
      const div = dom.window.document.createElement("div");
      const code = dom.window.document.createElement("code");
      const span = dom.window.document.createElement("span");
      span.textContent = "$100";
      code.appendChild(span);
      div.appendChild(code);
      dom.window.document.body.appendChild(div);

      const textNode = span.firstChild;
      assert.strictEqual(shouldSkipNode(textNode), true);
    });
  });

  describe("replacePricesInNode", () => {
    it("replaces price with span containing data attributes", () => {
      const div = dom.window.document.createElement("div");
      div.textContent = "Price: $100";
      dom.window.document.body.appendChild(div);

      const textNode = div.firstChild;
      const count = replacePricesInNode(textNode, 2000, mockCalculator);

      assert.strictEqual(count, 1);
      const span = div.querySelector(".inflation-adjusted-price");
      assert.ok(span);
      assert.strictEqual(span.getAttribute("data-original-price"), "$100");
      assert.strictEqual(span.getAttribute("data-original-year"), "2000");
      assert.ok(span.getAttribute("data-adjusted-price"));
    });

    it("preserves text before and after price", () => {
      const div = dom.window.document.createElement("div");
      div.textContent = "The price was $100 yesterday";
      dom.window.document.body.appendChild(div);

      const textNode = div.firstChild;
      replacePricesInNode(textNode, 2000, mockCalculator);

      assert.ok(div.textContent.includes("The price was"));
      assert.ok(div.textContent.includes("yesterday"));
    });

    it("handles multiple prices in one text node", () => {
      const div = dom.window.document.createElement("div");
      div.textContent = "$50 or $100";
      dom.window.document.body.appendChild(div);

      const textNode = div.firstChild;
      const count = replacePricesInNode(textNode, 2000, mockCalculator);

      assert.strictEqual(count, 2);
      const spans = div.querySelectorAll(".inflation-adjusted-price");
      assert.strictEqual(spans.length, 2);
    });

    it("returns 0 for non-text nodes", () => {
      const div = dom.window.document.createElement("div");

      const count = replacePricesInNode(div, 2000, mockCalculator);
      assert.strictEqual(count, 0);
    });

    it("returns 0 for text without prices", () => {
      const div = dom.window.document.createElement("div");
      div.textContent = "No prices here";
      dom.window.document.body.appendChild(div);

      const textNode = div.firstChild;
      const count = replacePricesInNode(textNode, 2000, mockCalculator);
      assert.strictEqual(count, 0);
    });

    it("does not process same node twice", () => {
      const div = dom.window.document.createElement("div");
      div.textContent = "$100";
      dom.window.document.body.appendChild(div);

      const textNode = div.firstChild;
      const count1 = replacePricesInNode(textNode, 2000, mockCalculator);
      const count2 = replacePricesInNode(textNode, 2000, mockCalculator);

      assert.strictEqual(count1, 1);
      assert.strictEqual(count2, 0); // Should not process again
    });
  });

  describe("findAndReplacePrices", () => {
    it("processes all text nodes in tree", () => {
      const div = dom.window.document.createElement("div");
      div.innerHTML = "<p>$100</p><p>$200</p><p>$300</p>";

      const count = findAndReplacePrices(div, 2000, mockCalculator);
      assert.strictEqual(count, 3);
    });

    it("skips excluded elements", () => {
      const div = dom.window.document.createElement("div");
      div.innerHTML = "<p>$100</p><code>$200</code><p>$300</p>";

      const count = findAndReplacePrices(div, 2000, mockCalculator);
      assert.strictEqual(count, 2); // Should skip the code block
    });

    it("handles nested elements", () => {
      const div = dom.window.document.createElement("div");
      div.innerHTML = "<p>Price: <strong>$100</strong> or <em>$200</em></p>";

      const count = findAndReplacePrices(div, 2000, mockCalculator);
      assert.strictEqual(count, 2);
    });

    it("returns 0 for invalid inputs", () => {
      assert.strictEqual(findAndReplacePrices(null, 2000, mockCalculator), 0);
      assert.strictEqual(findAndReplacePrices(dom.window.document.body, null, mockCalculator), 0);
      assert.strictEqual(findAndReplacePrices(dom.window.document.body, 2000, null), 0);
    });

    it("handles complex real-world HTML", () => {
      const div = dom.window.document.createElement("div");
      div.innerHTML = `
        <article>
          <h1>Product Review</h1>
          <p>The product originally cost $199.99 but is now on sale.</p>
          <div class="specs">
            <code>SKU: $-12345</code>
            <p>Price history: $150, $175, $200</p>
          </div>
          <footer data-no-inflation>Price as of today: $149.99</footer>
        </article>
      `;

      const count = findAndReplacePrices(div, 2000, mockCalculator);
      // Should match: $199.99, $150, $175, $200 (but NOT the code or footer)
      assert.strictEqual(count, 4);
    });

    it("returns correct count for empty elements", () => {
      const div = dom.window.document.createElement("div");

      const count = findAndReplacePrices(div, 2000, mockCalculator);
      assert.strictEqual(count, 0);
    });
  });

  describe("integration with real calculator", () => {
    let realCalculator;

    beforeEach(async () => {
      // Load CPI data for the real calculator
      await loadCPIData();
      realCalculator = { parsePrice, calculateInflation, formatPrice };
    });

    it("replaces prices with realistic inflation adjustments", () => {
      const div = dom.window.document.createElement("div");
      div.textContent = "In 2000, this cost $100";
      dom.window.document.body.appendChild(div);

      const count = findAndReplacePrices(div, 2000, realCalculator);

      assert.strictEqual(count, 1, "Should find one price");

      const span = div.querySelector(".inflation-adjusted-price");
      assert.ok(span, "Should create inflation-adjusted span");
      assert.strictEqual(span.getAttribute("data-original-price"), "$100");
      assert.strictEqual(span.getAttribute("data-original-year"), "2000");

      // Verify it calculated real inflation, not mock 50%
      // $100 in 2000 = $185.83 in 2025 (320.0/172.2 * 100)
      const adjustedPrice = span.getAttribute("data-adjusted-price");
      assert.ok(adjustedPrice.includes("$185") || adjustedPrice.includes("$186"),
        `Expected ~$185-186 inflation-adjusted price, got ${adjustedPrice}`);
    });

    it("handles multiple prices with real calculations", () => {
      const div = dom.window.document.createElement("div");
      div.innerHTML = `
        <p>Back in 2000, a coffee was $2 and a sandwich was $5.</p>
        <p>By 2020, prices had changed significantly.</p>
      `;
      dom.window.document.body.appendChild(div);

      const count = findAndReplacePrices(div, 2000, realCalculator);

      assert.strictEqual(count, 2, "Should find two prices");

      const spans = div.querySelectorAll(".inflation-adjusted-price");
      assert.strictEqual(spans.length, 2);

      // Verify both use real inflation calculations
      spans.forEach(span => {
        assert.strictEqual(span.getAttribute("data-original-year"), "2000");
        assert.ok(span.getAttribute("data-adjusted-price"),
          "Should have adjusted price");
      });
    });

    it("respects skip rules with real calculator", () => {
      const div = dom.window.document.createElement("div");
      div.innerHTML = `
        <p>Regular price: $100</p>
        <code>const price = $100;</code>
        <div data-no-inflation>Current: $100</div>
      `;
      dom.window.document.body.appendChild(div);

      const count = findAndReplacePrices(div, 2000, realCalculator);

      // Should only process the first $100, not in code or data-no-inflation
      assert.strictEqual(count, 1, "Should skip code and data-no-inflation");
    });

    it("handles prices with suffixes using real calculator", () => {
      const div = dom.window.document.createElement("div");
      div.textContent = "The budget was $5M in 2000";
      dom.window.document.body.appendChild(div);

      const count = findAndReplacePrices(div, 2000, realCalculator);

      assert.strictEqual(count, 1);

      const span = div.querySelector(".inflation-adjusted-price");
      const originalPrice = span.getAttribute("data-original-price");
      // Should capture the full price including suffix
      assert.strictEqual(originalPrice, "$5M",
        `Expected $5M, got ${originalPrice}`);

      // Verify inflation was calculated on 5 million, not 5
      // $5M in 2000 = ~$9.29M in 2025 (5000000 * 320.0/172.2)
      const adjustedPrice = span.getAttribute("data-adjusted-price");
      assert.ok(adjustedPrice, "Should have adjusted price");
      assert.ok(adjustedPrice.includes("$9") && adjustedPrice.toUpperCase().includes("M"),
        `Expected ~$9M inflation-adjusted price, got ${adjustedPrice}`);
    });

    it("handles decimal + suffix combinations correctly", () => {
      const div = dom.window.document.createElement("div");
      div.textContent = "The deal was $2.5M in 2000";
      dom.window.document.body.appendChild(div);

      const count = findAndReplacePrices(div, 2000, realCalculator);

      assert.strictEqual(count, 1);

      const span = div.querySelector(".inflation-adjusted-price");
      const originalPrice = span.getAttribute("data-original-price");
      // Must capture the full price including decimal and suffix
      assert.strictEqual(originalPrice, "$2.5M",
        `Expected $2.5M, got ${originalPrice}`);

      // Verify inflation was calculated on 2.5 million, not 2.5
      // $2.5M in 2000 = ~$4.65M in 2025 (2500000 * 320.0/172.2)
      const adjustedPrice = span.getAttribute("data-adjusted-price");
      assert.ok(adjustedPrice.includes("$4") && adjustedPrice.toUpperCase().includes("M"),
        `Expected ~$4.6M inflation-adjusted price, got ${adjustedPrice}`);
    });

    it("handles lowercase suffixes correctly", () => {
      const div = dom.window.document.createElement("div");
      div.innerHTML = `
        <p>Budget was $10k, revenue was $5m, and valuation was $1b in 2000</p>
      `;
      dom.window.document.body.appendChild(div);

      const count = findAndReplacePrices(div, 2000, realCalculator);

      assert.strictEqual(count, 3, "Should find all three prices");

      const spans = div.querySelectorAll(".inflation-adjusted-price");
      assert.strictEqual(spans.length, 3);

      // Verify each is captured with its suffix
      const prices = Array.from(spans).map(s => s.getAttribute("data-original-price"));
      assert.ok(prices.includes("$10k"), `Expected $10k, got ${prices}`);
      assert.ok(prices.includes("$5m"), `Expected $5m, got ${prices}`);
      assert.ok(prices.includes("$1b"), `Expected $1b, got ${prices}`);

      // Verify calculations are on correct magnitudes
      const adjusted = Array.from(spans).map(s => s.getAttribute("data-adjusted-price"));
      // $10k → ~$18.6k, $5m → ~$9.3m, $1b → ~$1.86b
      assert.ok(adjusted.some(p => p.includes("$18") || p.includes("$19")),
        `Expected ~$18-19k, got ${adjusted}`);
      assert.ok(adjusted.some(p => p.toUpperCase().includes("M")),
        `Expected millions price, got ${adjusted}`);
      assert.ok(adjusted.some(p => p.toUpperCase().includes("B")),
        `Expected billions price, got ${adjusted}`);
    });

    it("handles simple prices without formatting", () => {
      const div = dom.window.document.createElement("div");
      div.textContent = "In 2000, a burger was $5 and a movie was $8";
      dom.window.document.body.appendChild(div);

      const count = findAndReplacePrices(div, 2000, realCalculator);

      assert.strictEqual(count, 2, "Should find both simple prices");

      const spans = div.querySelectorAll(".inflation-adjusted-price");

      // Verify simple prices are captured correctly (not confused with suffixes)
      const prices = Array.from(spans).map(s => s.getAttribute("data-original-price"));
      assert.ok(prices.includes("$5"), `Expected $5, got ${prices}`);
      assert.ok(prices.includes("$8"), `Expected $8, got ${prices}`);

      // Verify calculations are on small amounts (not millions)
      // $5 in 2000 = ~$9.29 in 2025, $8 in 2000 = ~$14.87 in 2025
      const adjusted = Array.from(spans).map(s => s.getAttribute("data-adjusted-price"));
      assert.ok(adjusted.some(p => p.includes("$9") && !p.toUpperCase().includes("M")),
        `Expected ~$9 (not millions), got ${adjusted}`);
      assert.ok(adjusted.some(p => (p.includes("$14") || p.includes("$15")) && !p.toUpperCase().includes("M")),
        `Expected ~$14-15 (not millions), got ${adjusted}`);
    });

    it("handles prices without comma separators using real calculator", () => {
      const div = dom.window.document.createElement("div");
      div.textContent = "In 2000, this cost $1000";
      dom.window.document.body.appendChild(div);

      const count = findAndReplacePrices(div, 2000, realCalculator);

      assert.strictEqual(count, 1, "Should find one price");
      const span = div.querySelector(".inflation-adjusted-price");
      assert.ok(span, "Should create inflation-adjusted span");
      assert.strictEqual(span.getAttribute("data-original-price"), "$1000",
        "Should capture full $1000, not just $100");
      
      // Verify it calculated real inflation on $1000, not $100
      // $1000 in 2000 = $1858.30 in 2025 (320.0/172.2 * 1000)
      const adjustedPrice = span.getAttribute("data-adjusted-price");
      const priceWithoutCommas = adjustedPrice.replace(/,/g, "");
      assert.ok(priceWithoutCommas.includes("$1858") || priceWithoutCommas.includes("$1859"),
        `Expected ~$1858-1859 inflation-adjusted price, got ${adjustedPrice}`);
    });

    it("handles suffix + USD combination", () => {
      const div = dom.window.document.createElement("div");
      div.textContent = "Contract was $3M USD in 2000";
      dom.window.document.body.appendChild(div);

      const count = findAndReplacePrices(div, 2000, realCalculator);

      assert.strictEqual(count, 1);

      const span = div.querySelector(".inflation-adjusted-price");
      const originalPrice = span.getAttribute("data-original-price");
      // Should capture suffix but may or may not include USD (implementation dependent)
      assert.ok(originalPrice.includes("$3M"),
        `Expected price to include $3M, got ${originalPrice}`);

      // Verify calculation is on 3 million
      // $3M in 2000 = ~$5.57M in 2025 (3000000 * 320.0/172.2)
      const adjustedPrice = span.getAttribute("data-adjusted-price");
      assert.ok(adjustedPrice.includes("$5") && adjustedPrice.toUpperCase().includes("M"),
        `Expected ~$5.5M inflation-adjusted price, got ${adjustedPrice}`);
    });
  });
});
