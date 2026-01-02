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
    const yearValue = await this.getYearInputValue();
    return yearValue || null;
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
  }

  /**
   * Wait for stats to be populated from content page
   * @returns {Promise<void>}
   */
  async waitForStats() {
    await this.page.getByTestId('price-count').waitFor();
    await this.page.waitForTimeout(200);
  }

  /**
   * Get the year input element
   * @returns {import('@playwright/test').Locator}
   */
  getYearInput() {
    return this.page.getByTestId('year-input');
  }

  /**
   * Set the year input value
   * @param {number | null} year
   * @returns {Promise<void>}
   */
  async setYearInput(year) {
    const input = this.getYearInput();
    if (year === null || year === undefined) {
      await input.clear();
    } else {
      await input.fill(year.toString());
      await input.blur();
    }
    await this.page.waitForTimeout(100);
  }

  /**
   * Get the current year input value
   * @returns {Promise<string>}
   */
  async getYearInputValue() {
    const input = this.getYearInput();
    const value = await input.inputValue();
    return value || '';
  }

  /**
   * Check if the year input is visible
   * @returns {Promise<boolean>}
   */
  async isYearInputVisible() {
    const input = this.getYearInput();
    return await input.isVisible();
  }

  /**
   * Check if the stats section is visible
   * @returns {Promise<boolean>}
   */
  async isStatsSectionVisible() {
    const statsSection = this.page.locator('.stats');
    return await statsSection.isVisible();
  }

  /**
   * Check if the swap toggle is visible
   * @returns {Promise<boolean>}
   */
  async isSwapToggleVisible() {
    const swapToggle = this.page.getByTestId('swap-toggle');
    return await swapToggle.isVisible();
  }

  /**
   * Check if swap in place is enabled
   * @returns {Promise<boolean>}
   */
  async isSwapInPlace() {
    const checkbox = this.page.getByTestId('swap-toggle');
    return await checkbox.isChecked();
  }

  /**
   * Set the swap in place state to a specific value
   * @param {boolean} swapInPlace
   * @returns {Promise<void>}
   */
  async setSwapInPlace(swapInPlace) {
    const checkbox = this.page.getByTestId('swap-toggle');
    const currentState = await checkbox.isChecked();
    if (currentState !== swapInPlace) {
      await checkbox.click();
    }
  }

  /**
   * Check if the year input has error styling
   * @returns {Promise<boolean>}
   */
  async hasYearInputError() {
    const input = this.getYearInput();
    const classes = await input.getAttribute('class');
    return classes?.includes('error') ?? false;
  }

  /**
   * Get the error message text
   * @returns {Promise<string>}
   */
  async getErrorMessage() {
    const errorMessage = this.page.locator('.error-message');
    const isVisible = await errorMessage.isVisible();
    if (!isVisible) return '';
    return await errorMessage.textContent() || '';
  }

  /**
   * Check if error message is visible
   * @returns {Promise<boolean>}
   */
  async isErrorMessageVisible() {
    const errorMessage = this.page.locator('.error-message');
    return await errorMessage.isVisible();
  }

  /**
   * Check if the unavailable message is visible
   * @returns {Promise<boolean>}
   */
  async isUnavailableMessageVisible() {
    const unavailableMessage = this.page.getByTestId('unavailable-message');
    return await unavailableMessage.isVisible();
  }

  /**
   * Get the unavailable message text
   * @returns {Promise<string>}
   */
  async getUnavailableMessage() {
    const unavailableMessage = this.page.getByTestId('unavailable-message');
    const isVisible = await unavailableMessage.isVisible();
    if (!isVisible) return '';
    return await unavailableMessage.textContent() || '';
  }
}
