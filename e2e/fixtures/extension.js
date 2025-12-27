import { test as base, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * @typedef {Object} ExtensionFixtures
 * @property {import('@playwright/test').BrowserContext} context
 * @property {string} extensionId
 */

export const test = base.extend({
  context: async ({}, use) => {
    const pathToExtension = path.join(__dirname, '../../');
    const context = await chromium.launchPersistentContext('', {
      headless: false, // Extensions don't work in headless mode
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    // Dynamically get the extension ID
    let pages = context.pages();
    let page = pages.length > 0 ? pages[0] : await context.newPage();

    await page.goto('chrome://extensions/');

    // Enable developer mode if not already enabled
    const devModeToggle = page.locator('cr-toggle#devMode');
    const isChecked = await devModeToggle.evaluate((el) => {
      return el.checked;
    });

    if (!isChecked) {
      await devModeToggle.click();
    }

    // Get the extension ID from the first extension card
    const extensionCard = page.locator('extensions-item').first();
    const extensionId = await extensionCard.getAttribute('id');

    if (!extensionId) {
      throw new Error('Could not find extension ID');
    }

    await page.close();
    await use(extensionId);
  },
});

export { expect } from '@playwright/test';
