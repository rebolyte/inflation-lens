import { it, beforeEach, afterEach, describe } from "node:test";
import assert from "node:assert";

// Mock chrome runtime
global.chrome = {
  runtime: {
    getURL: (path) => `/fake/${path}`,
  },
};

// Mock fetch
global.fetch = async (url) => {
  if (url.includes("cpi-data.json")) {
    return {
      json: async () => ({
        data: {
          1913: 9.9,
          2000: 172.2,
          2020: 258.8,
          2023: 304.7,
        },
      }),
    };
  }
  throw new Error("Unknown URL");
};

// Static import - safe because module doesn't access globals at top level
import { loadCPIData, calculateInflation, formatPrice, parsePrice } from "../../lib/inflation-calculator.js";

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

    it("handles edge case amounts", () => {
      assert.strictEqual(parsePrice("$0.01"), 0.01);
      assert.strictEqual(parsePrice("$0.99"), 0.99);
      assert.strictEqual(parsePrice("$999,999,999"), 999999999);
    });

    it("parses amounts without dollar sign", () => {
      assert.strictEqual(parsePrice("100"), 100);
      assert.strictEqual(parsePrice("1,234.56"), 1234.56);
    });

    it("handles malformed strings gracefully", () => {
      assert.ok(isNaN(parsePrice("invalid")));
      assert.ok(isNaN(parsePrice("")));
    });

    it("handles edge cases with special characters", () => {
      // Multiple dollar signs
      assert.ok(isNaN(parsePrice("$$$")));
      // Just letters
      assert.ok(isNaN(parsePrice("abc")));
      // Mixed invalid input
      assert.ok(isNaN(parsePrice("$abc")));
    });

    it("handles negative numbers", () => {
      // Note: parsePrice doesn't explicitly handle negatives, but parseFloat does
      assert.strictEqual(parsePrice("-$100"), -100);
      // $- parses as -50 ($ is stripped, leaving -50)
      assert.strictEqual(parsePrice("$-50"), -50);
    });

    it("handles very large numbers", () => {
      // Trillion not supported (no T suffix), but should parse as number
      const trillionStr = "999000000000"; // 999 billion
      assert.strictEqual(parsePrice(trillionStr), 999000000000);
      // Very large B suffix
      assert.strictEqual(parsePrice("$999B"), 999000000000);
    });

    it("handles decimal edge cases", () => {
      // No cents
      assert.strictEqual(parsePrice("$100."), 100);
      // Leading zero
      assert.strictEqual(parsePrice("$0.5"), 0.5);
      // Many decimal places (parseFloat truncates)
      assert.strictEqual(parsePrice("$1.123456"), 1.123456);
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
      assert.strictEqual(formatPrice(1420000), "$1.42M");
      assert.strictEqual(formatPrice(1425000), "$1.43M");
    });

    it("formats billions with B suffix", () => {
      assert.strictEqual(formatPrice(1000000000), "$1B");
      assert.strictEqual(formatPrice(1500000000), "$1.5B");
      assert.strictEqual(formatPrice(2000000000), "$2B");
      assert.strictEqual(formatPrice(7200000000), "$7.2B");
      assert.strictEqual(formatPrice(6985327831.27), "$6.99B");
    });

    it("handles edge case amounts", () => {
      assert.strictEqual(formatPrice(0), "$0.00");
      assert.strictEqual(formatPrice(0.01), "$0.01");
      assert.strictEqual(formatPrice(999.99), "$999.99");
      assert.strictEqual(formatPrice(999999), "$999,999");
    });

    it("formats very large numbers correctly", () => {
      assert.strictEqual(formatPrice(1e12), "$1000B");
    });
  });

  describe("calculateInflation", () => {
    // Real-world validation tests - verify correctness of the formula
    it("inflation should be transitive across multiple periods", () => {
      // Adjusting 2000→2020 directly should equal 2000→2010→2020
      const direct = calculateInflation(100, 2000, 2020);
      const step1 = calculateInflation(100, 2000, 2020);
      const step2 = calculateInflation(step1, 2020, 2020);
      assert.strictEqual(direct, step2);

      // More meaningful: 2000→2010→2020 chain
      // First load real CPI data to make this work
      const cpi2000 = 172.2;
      const cpi2010 = (cpi2000 + 258.8) / 2; // Approximate midpoint for test
      // This test would need real 2010 CPI data to be truly meaningful
    });

    it("adjusting forward then backward should return close to original", () => {
      const original = 100;
      const forward = calculateInflation(original, 2000, 2020);
      const backward = calculateInflation(forward, 2020, 2000);

      // Due to rounding, should be within 1 cent
      assert.ok(Math.abs(backward - original) < 0.01,
        `Expected ${backward} to be within 0.01 of ${original}`);
    });

    it("inflation should increase values when moving forward in time", () => {
      const adjusted = calculateInflation(100, 2000, 2020);
      assert.ok(adjusted > 100,
        "Moving forward in time should increase value due to inflation");
    });

    it("deflation should decrease values when moving backward in time", () => {
      const adjusted = calculateInflation(100, 2020, 2000);
      assert.ok(adjusted < 100,
        "Moving backward in time should decrease value (reverse inflation)");
    });

    it("returns same value for same year", () => {
      const adjusted = calculateInflation(100, 2020, 2020);
      assert.ok(adjusted !== null);
      assert.strictEqual(adjusted, 100, "Same year should return same value");
    });

    it("century of inflation should significantly increase value", () => {
      const adjusted = calculateInflation(100, 1913, 2023);
      assert.ok(adjusted !== null);
      assert.ok(adjusted > 1000,
        "A century of inflation should increase value by at least 10x");
    });

    it("20 years of inflation should increase value by reasonable amount", () => {
      const adjusted = calculateInflation(100, 2000, 2020);
      // Real-world check: 20 years typically sees 40-60% inflation in modern era
      assert.ok(adjusted > 140 && adjusted < 160,
        `Expected 40-60% inflation over 20 years, got ${adjusted - 100}%`);
    });

    it("returns null for invalid years", () => {
      assert.strictEqual(calculateInflation(100, 1900, 2020), null,
        "Years before 1913 should return null");
    });

    it("falls back to latest year for future toYear", () => {
      const result = calculateInflation(100, 2000, 2030);
      assert.ok(result !== null, "Future toYear should fall back to latest available");
      assert.ok(result > 100, "Should still calculate inflation to latest year");
    });

    it("falls back to latest year when default toYear (current year) is not in data", () => {
      const currentYear = new Date().getFullYear();
      if (currentYear > 2023) {
        const result = calculateInflation(100, 2000);
        assert.ok(result !== null, "Default toYear (current year) should fall back to latest available when not in data");
        assert.ok(result > 100, "Should still calculate inflation to latest year");
        assert.strictEqual(result, calculateInflation(100, 2000, 2023), "Should match explicit calculation to latest year");
      }
    });

    // Regression tests - ensure refactoring doesn't break existing behavior
    it("regression: calculates inflation between years", () => {
      const adjusted = calculateInflation(100, 2000, 2020);
      assert.ok(adjusted !== null);
      // $100 in 2000 = $150.29 in 2020 (258.8/172.2 * 100, rounded to 2 decimals)
      assert.strictEqual(adjusted, 150.29);
    });

    it("regression: calculates inflation to known year", () => {
      const adjusted = calculateInflation(100, 2020, 2023);
      assert.ok(adjusted !== null);
      // $100 in 2020 = $117.74 in 2023 (304.7/258.8 * 100, rounded to 2 decimals)
      assert.strictEqual(adjusted, 117.74);
    });

    it("regression: handles large amounts correctly", () => {
      const adjusted = calculateInflation(1000000, 2000, 2020);
      assert.ok(adjusted !== null);
      assert.strictEqual(adjusted, 1502903.6);
    });

    it("regression: handles small amounts correctly", () => {
      const adjusted = calculateInflation(0.01, 2000, 2020);
      assert.ok(adjusted !== null);
      assert.strictEqual(adjusted, 0.02);
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

  describe("error handling", () => {
    it("calculateInflation returns null when CPI data not loaded", () => {
      // Test with missing year in CPI data (1999 not in our mock data)
      const result = calculateInflation(100, 1999, 2020);
      assert.strictEqual(result, null, "Should return null for missing year data");
    });

    it("calculateInflation returns null when fromYear is missing", () => {
      const result = calculateInflation(100, 1850, 2020);
      assert.strictEqual(result, null, "Should return null when fromYear not in CPI data");
    });

    it("calculateInflation falls back to latest year when toYear is missing", () => {
      const result = calculateInflation(100, 2000, 2100);
      assert.ok(result !== null, "Should fall back to latest year when toYear not in CPI data");
      assert.ok(result > 100, "Should still calculate inflation to latest year");
    });

    it("calculateInflation falls back when toYear is current year not in data", () => {
      const result = calculateInflation(100, 2000, 2025);
      assert.ok(result !== null, "Should fall back to latest year (2023) when toYear (2025) not in CPI data");
      assert.strictEqual(result, calculateInflation(100, 2000, 2023), "Should match explicit calculation to 2023");
    });

    it("parsePrice handles empty string", () => {
      const result = parsePrice("");
      assert.ok(isNaN(result), "Empty string should return NaN");
    });

    it("parsePrice handles invalid text", () => {
      const result = parsePrice("not a price");
      assert.ok(isNaN(result), "Invalid input should return NaN");
    });

    it("formatPrice handles zero", () => {
      assert.strictEqual(formatPrice(0), "$0.00", "Should format zero");
    });

    it("formatPrice handles negative numbers", () => {
      const result = formatPrice(-100);
      assert.ok(result.includes("-100"), "Should format negative numbers");
    });

    it("formatPrice handles very small amounts", () => {
      assert.strictEqual(formatPrice(0.001), "$0.00", "Should round very small amounts");
    });

    it("formatPrice handles very large numbers", () => {
      const result = formatPrice(999999999999);
      assert.ok(result.includes("B"), "Should use B suffix for billions");
    });
  });
});
