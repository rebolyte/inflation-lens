import { BasePage } from './base.page.js';

/**
 * Page object for content pages with the extension's content script
 */
export class ContentPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);
  }

  /**
   * Wait for the content script to be loaded and ready
   * @returns {Promise<void>}
   */
  async waitForContentScript() {
    // Wait for the page to be fully loaded
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for prices to be adjusted (or for processing to complete)
   * @param {number} [expectedCount] - Expected number of adjusted prices
   * @returns {Promise<void>}
   */
  async waitForPriceProcessing(expectedCount) {
    if (expectedCount && expectedCount > 0) {
      // Wait for at least one adjusted price to appear
      await this.page.waitForSelector('.inflation-adjusted-price', { timeout: 5000 });
    } else {
      // Just wait for the page to stabilize
      await this.page.waitForLoadState('networkidle');
    }
  }

  /**
   * Get all inflation-adjusted price elements on the page
   * @returns {import('@playwright/test').Locator}
   */
  getAdjustedPrices() {
    return this.page.locator('.inflation-adjusted-price');
  }

  /**
   * Get the count of adjusted prices on the page
   * @returns {Promise<number>}
   */
  async getAdjustedPriceCount() {
    return await this.getAdjustedPrices().count();
  }

  /**
   * Verify that prices are adjusted on the page
   * @returns {Promise<boolean>}
   */
  async verifyPricesAdjusted() {
    const count = await this.getAdjustedPriceCount();
    return count > 0;
  }

  /**
   * Get a specific adjusted price element
   * @param {number} index
   * @returns {import('@playwright/test').Locator}
   */
  getAdjustedPriceAt(index) {
    return this.getAdjustedPrices().nth(index);
  }

  /**
   * Get the original price from an adjusted price element
   * @param {number} index
   * @returns {Promise<string | null>}
   */
  async getOriginalPrice(index) {
    const element = this.getAdjustedPriceAt(index);
    return await element.getAttribute('data-original-price');
  }

  /**
   * Get the adjusted price from an adjusted price element
   * @param {number} index
   * @returns {Promise<string | null>}
   */
  async getAdjustedPrice(index) {
    const element = this.getAdjustedPriceAt(index);
    return await element.getAttribute('data-adjusted-price');
  }

  /**
   * Get the original year from an adjusted price element
   * @param {number} index
   * @returns {Promise<string | null>}
   */
  async getOriginalYear(index) {
    const element = this.getAdjustedPriceAt(index);
    return await element.getAttribute('data-original-year');
  }

  /**
   * Verify that a specific price has been adjusted
   * @param {number} index
   * @returns {Promise<{original: string | null, adjusted: string | null, year: string | null}>}
   */
  async verifyPriceAdjusted(index) {
    return {
      original: await this.getOriginalPrice(index),
      adjusted: await this.getAdjustedPrice(index),
      year: await this.getOriginalYear(index),
    };
  }

  /**
   * Navigate to a test page with content
   * @param {string} url
   * @returns {Promise<void>}
   */
  async navigateToTestPage(url) {
    await this.goto(url);
    await this.waitForContentScript();
  }

  /**
   * Create a test page with prices and a year
   * @param {string[]} prices
   * @param {number} [year]
   * @returns {Promise<void>}
   */
  async createTestPageWithContent(prices, year) {
    const priceHtml = prices.map(price => `<p>${price}</p>`).join('\n');
    const yearMeta = year
      ? `<meta property="article:published_time" content="${year}-01-01T00:00:00Z" />`
      : '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Test Page</title>
        ${yearMeta}
      </head>
      <body>
        <h1>Test Page</h1>
        ${priceHtml}
      </body>
      </html>
    `;

    // Create a data URL with the HTML content
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
    await this.goto(dataUrl);
    await this.waitForContentScript();
    // If we have a year, expect prices to be adjusted
    if (year) {
      await this.waitForPriceProcessing(prices.length);
    }
  }

  /**
   * Wait for adjusted prices to disappear (when disabled)
   * @returns {Promise<void>}
   */
  async waitForPricesToDisappear() {
    await this.page.waitForSelector('.inflation-adjusted-price', { state: 'detached', timeout: 5000 }).catch(() => {
      // Already gone, that's fine
    });
  }
}
