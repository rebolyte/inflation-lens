import { it, beforeEach, afterEach, describe } from "node:test";
import assert from "node:assert";
import { JSDOM } from "jsdom";
import { shouldSkipNode, replacePricesInNode, findAndReplacePrices } from "../../content/price-replacer.js";

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
});
