import { it, beforeEach, describe } from "node:test";
import assert from "node:assert";

// Mock chrome runtime
global.chrome = {
  runtime: {
    getURL: (path: string) => `/fake/${path}`,
  },
} as any;

// Mock fetch
global.fetch = async (url: string) => {
  if (url.includes("cpi-data.json")) {
    return {
      json: async () => ({
        data: {
          1913: 9.9,
          2000: 172.2,
          2020: 258.8,
          2024: 310.3,
        },
      }),
    } as Response;
  }
  throw new Error("Unknown URL");
};

// Import after mocking
const { loadCPIData, calculateInflation, formatPrice, parsePrice } = await import(
  "../../lib/inflation-calculator.js"
);

describe("inflation-calculator", () => {
  beforeEach(async () => {
    await loadCPIData();
  });

  describe("parsePrice", () => {
    it("parses simple dollar amounts", () => {
      assert.strictEqual(parsePrice("$100"), 100);
      assert.strictEqual(parsePrice("$1,234.56"), 1234.56);
    });

    it("parses amounts with K suffix", () => {
      assert.strictEqual(parsePrice("$5K"), 5000);
      assert.strictEqual(parsePrice("$10.5k"), 10500);
    });

    it("parses amounts with M suffix", () => {
      assert.strictEqual(parsePrice("$2M"), 2000000);
      assert.strictEqual(parsePrice("$1.5m"), 1500000);
    });

    it("parses amounts with B suffix", () => {
      assert.strictEqual(parsePrice("$1B"), 1000000000);
      assert.strictEqual(parsePrice("$2.5b"), 2500000000);
    });
  });

  describe("formatPrice", () => {
    it("formats small amounts with decimals", () => {
      assert.strictEqual(formatPrice(5.99), "$5.99");
      assert.strictEqual(formatPrice(99.99), "$99.99");
    });

    it("formats thousands with commas", () => {
      assert.strictEqual(formatPrice(1000), "$1,000");
      assert.strictEqual(formatPrice(50000), "$50,000");
    });

    it("formats millions with M suffix", () => {
      assert.strictEqual(formatPrice(1000000), "$1M");
      assert.strictEqual(formatPrice(1500000), "$1.5M");
      assert.strictEqual(formatPrice(2000000), "$2M");
    });

    it("formats billions with B suffix", () => {
      assert.strictEqual(formatPrice(1000000000), "$1B");
      assert.strictEqual(formatPrice(1500000000), "$1.5B");
      assert.strictEqual(formatPrice(2000000000), "$2B");
    });
  });

  describe("calculateInflation", () => {
    it("calculates inflation between years", () => {
      const adjusted = calculateInflation(100, 2000, 2020);
      assert.ok(adjusted !== null);
      // $100 in 2000 = $150.29 in 2020 (258.8/172.2 * 100)
      assert.strictEqual(adjusted, 150.29);
    });

    it("calculates inflation to known year", () => {
      const adjusted = calculateInflation(100, 2020, 2024);
      assert.ok(adjusted !== null);
      // $100 in 2020 = $119.90 in 2024 (310.3/258.8 * 100)
      assert.strictEqual(adjusted, 119.9);
    });

    it("returns null for invalid years", () => {
      const adjusted = calculateInflation(100, 1900, 2020);
      assert.strictEqual(adjusted, null);
    });

    it("handles large amounts correctly", () => {
      const adjusted = calculateInflation(1000000, 2000, 2020);
      assert.ok(adjusted !== null);
      assert.strictEqual(adjusted, 1502903.6);
    });
  });

  describe("loadCPIData", () => {
    it("loads and caches CPI data", async () => {
      const data = await loadCPIData();
      assert.ok(data !== null);
      assert.ok(data.data);
      assert.strictEqual(data.data[2000], 172.2);
      assert.strictEqual(data.data[2020], 258.8);
    });

    it("returns cached data on subsequent calls", async () => {
      const data1 = await loadCPIData();
      const data2 = await loadCPIData();
      assert.strictEqual(data1, data2);
    });
  });
});
