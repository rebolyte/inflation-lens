/**
 * Base page object class with common functionality
 */
export class BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  /**
   * Brings this page to the front using Chrome DevTools Protocol
   * This is essential for switching between multiple windows/tabs
   * @returns {Promise<void>}
   */
  async bringToFront() {
    const client = await this.page.context().newCDPSession(this.page);
    await client.send('Page.bringToFront');
  }

  /**
   * Navigate to a URL
   * @param {string} url
   * @returns {Promise<void>}
   */
  async goto(url) {
    await this.page.goto(url);
  }

  /**
   * Wait for a selector to be visible
   * @param {string} selector
   * @param {number} [timeout]
   * @returns {Promise<void>}
   */
  async waitForSelector(selector, timeout) {
    await this.page.waitForSelector(selector, { timeout });
  }

  /**
   * Get the page title
   * @returns {Promise<string>}
   */
  async title() {
    return await this.page.title();
  }
}
