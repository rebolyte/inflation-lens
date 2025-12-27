import { BasePage } from './base.page.js';

/**
 * Page object for the extension popup
 */
export class PopupPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {string} extensionId
   */
  constructor(page, extensionId) {
    super(page);
    this.extensionId = extensionId;
  }

  /**
   * Open the popup as a regular page
   * @returns {Promise<void>}
   */
  async open() {
    await this.goto(`chrome-extension://${this.extensionId}/popup/popup.html?testing=true`);
    await this.verifyLoaded();
  }

  /**
   * Get the price count displayed in the popup
   * @returns {Promise<number>}
   */
  async getPriceCount() {
    const countText = await this.page.getByTestId('price-count').textContent();
    return parseInt(countText || '0', 10);
  }

  /**
   * Get the detected year displayed in the popup
   * @returns {Promise<string | null>}
   */
  async getDetectedYear() {
    const yearElement = this.page.getByTestId('detected-year');
    const isVisible = await yearElement.isVisible();

    if (!isVisible) {
      return null;
    }

    const text = await yearElement.textContent();
    const match = text?.match(/Page from (\d{4})/);
    return match ? match[1] : null;
  }

  /**
   * Check if the extension is enabled
   * @returns {Promise<boolean>}
   */
  async isEnabled() {
    const checkbox = this.page.getByTestId('enable-toggle');
    return await checkbox.isChecked();
  }

  /**
   * Toggle the enabled state
   * @returns {Promise<void>}
   */
  async toggleEnabled() {
    const checkbox = this.page.getByTestId('enable-toggle');
    const currentState = await checkbox.isChecked();
    await checkbox.click();
    // Wait for state to change
    await checkbox.evaluate((el, expected) => {
      return new Promise((resolve) => {
        const check = () => {
          if (el.checked === expected) {
            resolve();
          } else {
            setTimeout(check, 10);
          }
        };
        check();
      });
    }, !currentState);
  }

  /**
   * Set the enabled state to a specific value
   * @param {boolean} enabled
   * @returns {Promise<void>}
   */
  async setEnabled(enabled) {
    const currentState = await this.isEnabled();
    if (currentState !== enabled) {
      await this.toggleEnabled();
    }
  }

  /**
   * Verify the popup is loaded
   * @returns {Promise<void>}
   */
  async verifyLoaded() {
    await this.page.getByRole('heading', { name: 'Inflation Lens' }).waitFor();
    await this.page.getByTestId('price-count').waitFor();
  }

  /**
   * Wait for stats to be populated from content page
   * @returns {Promise<void>}
   */
  async waitForStats() {
    await this.page.getByTestId('detected-year').getByText(/Page from \d{4}/).waitFor();
  }
}
