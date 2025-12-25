import { it, beforeEach, afterEach, describe } from "node:test";
import assert from "node:assert";
import { JSDOM } from "jsdom";

let dom;
let originalWindow;
let originalDocument;

describe("date-detector", () => {
  beforeEach(() => {
    dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", {
      url: "https://example.com/",
    });
    originalWindow = global.window;
    originalDocument = global.document;
    global.window = dom.window;
    global.document = dom.window.document;
  });

  afterEach(() => {
    global.window = originalWindow;
    global.document = originalDocument;
  });

  describe("validateYear", () => {
    it("validates years within range", async () => {
      const { validateYear } = await import("../../content/date-detector.js");
      assert.strictEqual(validateYear(1913), 1913);
      assert.strictEqual(validateYear(2024), 2024);
      assert.strictEqual(validateYear(2000), 2000);
    });

    it("rejects years outside range", async () => {
      const { validateYear } = await import("../../content/date-detector.js");
      assert.strictEqual(validateYear(1900), null);
      assert.strictEqual(validateYear(2030), null);
      assert.strictEqual(validateYear(1800), null);
    });

    it("handles string input", async () => {
      const { validateYear } = await import("../../content/date-detector.js");
      assert.strictEqual(validateYear("2020"), 2020);
      assert.strictEqual(validateYear("1950"), 1950);
    });
  });

  describe("detectFromMetaTags", () => {
    it("detects year from article:published_time", async () => {
      const meta = dom.window.document.createElement("meta");
      meta.setAttribute("property", "article:published_time");
      meta.setAttribute("content", "2020-03-15T10:30:00Z");
      dom.window.document.head.appendChild(meta);

      const { detectFromMetaTags } = await import("../../content/date-detector.js");
      assert.strictEqual(detectFromMetaTags(), 2020);
    });

    it("detects year from og:published_time", async () => {
      const meta = dom.window.document.createElement("meta");
      meta.setAttribute("property", "og:published_time");
      meta.setAttribute("content", "2019-06-20");
      dom.window.document.head.appendChild(meta);

      const { detectFromMetaTags } = await import("../../content/date-detector.js");
      assert.strictEqual(detectFromMetaTags(), 2019);
    });

    it("returns null when no meta tags found", async () => {
      const { detectFromMetaTags } = await import("../../content/date-detector.js");
      assert.strictEqual(detectFromMetaTags(), null);
    });
  });

  describe("detectFromJsonLd", () => {
    it("detects year from JSON-LD datePublished", async () => {
      const script = dom.window.document.createElement("script");
      script.type = "application/ld+json";
      script.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        datePublished: "2021-08-10",
      });
      dom.window.document.body.appendChild(script);

      const { detectFromJsonLd } = await import("../../content/date-detector.js");
      assert.strictEqual(detectFromJsonLd(), 2021);
    });

    it("handles multiple JSON-LD scripts", async () => {
      const script1 = dom.window.document.createElement("script");
      script1.type = "application/ld+json";
      script1.textContent = JSON.stringify({ "@type": "WebSite" });
      dom.window.document.body.appendChild(script1);

      const script2 = dom.window.document.createElement("script");
      script2.type = "application/ld+json";
      script2.textContent = JSON.stringify({
        "@type": "Article",
        dateCreated: "2018-12-25",
      });
      dom.window.document.body.appendChild(script2);

      const { detectFromJsonLd } = await import("../../content/date-detector.js");
      assert.strictEqual(detectFromJsonLd(), 2018);
    });

    it("returns null for invalid JSON", async () => {
      const script = dom.window.document.createElement("script");
      script.type = "application/ld+json";
      script.textContent = "{ invalid json }";
      dom.window.document.body.appendChild(script);

      const { detectFromJsonLd } = await import("../../content/date-detector.js");
      assert.strictEqual(detectFromJsonLd(), null);
    });
  });

  describe("detectFromUrl", () => {
    it("detects year from /YYYY/MM/DD/ pattern", async () => {
      dom.reconfigure({
        url: "https://example.com/2022/05/15/article-title",
      });

      const { detectFromUrl } = await import("../../content/date-detector.js");
      assert.strictEqual(detectFromUrl(), 2022);
    });

    it("detects year from /YYYY-MM-DD pattern", async () => {
      dom.reconfigure({
        url: "https://example.com/posts/2019-11-20-post-title",
      });

      const { detectFromUrl } = await import("../../content/date-detector.js");
      assert.strictEqual(detectFromUrl(), 2019);
    });

    it("detects year from /YYYY/ pattern", async () => {
      dom.reconfigure({
        url: "https://example.com/archive/2017/article",
      });

      const { detectFromUrl } = await import("../../content/date-detector.js");
      assert.strictEqual(detectFromUrl(), 2017);
    });

    it("detects year from query parameter", async () => {
      dom.reconfigure({
        url: "https://example.com/article?year=2015&page=1",
      });

      const { detectFromUrl } = await import("../../content/date-detector.js");
      assert.strictEqual(detectFromUrl(), 2015);
    });

    it("returns null when no year pattern found", async () => {
      dom.reconfigure({
        url: "https://example.com/random-article",
      });

      const { detectFromUrl } = await import("../../content/date-detector.js");
      assert.strictEqual(detectFromUrl(), null);
    });
  });

  describe("detectPageYear", () => {
    it("prefers meta tags over other methods", async () => {
      const meta = dom.window.document.createElement("meta");
      meta.setAttribute("property", "article:published_time");
      meta.setAttribute("content", "2020-01-01");
      dom.window.document.head.appendChild(meta);

      dom.reconfigure({
        url: "https://example.com/2019/article",
      });

      const { detectPageYear } = await import("../../content/date-detector.js");
      assert.strictEqual(detectPageYear(), 2020);
    });

    it("falls back to current year when no date found", async () => {
      const { detectPageYear } = await import("../../content/date-detector.js");
      const currentYear = new Date().getFullYear();
      assert.strictEqual(detectPageYear(), currentYear);
    });
  });
});
