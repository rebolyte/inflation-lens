import { test, expect } from '../fixtures/extension.js';
import { ContentPage } from '../page-objects/content.page.js';
import { PopupPage } from '../page-objects/popup.page.js';

test.describe('Price replacement functionality', () => {
  test('should detect and replace prices on a page with a year', async ({ context }) => {
    const page = await context.newPage();
    const contentPage = new ContentPage(page);

    // Create a test page with prices from 2010
    await contentPage.createTestPageWithContent(
      ['This costs $100.00', 'Sale price: $50.00', 'Premium option: $250.00'],
      2010
    );

    // Wait for content script to process
    await page.waitForTimeout(1500);

    // Verify prices were adjusted
    const count = await contentPage.getAdjustedPriceCount();
    expect(count).toBeGreaterThan(0);

    // Verify the first adjusted price has correct attributes
    const priceData = await contentPage.verifyPriceAdjusted(0);
    expect(priceData.original).toBeTruthy();
    expect(priceData.adjusted).toBeTruthy();
    expect(priceData.year).toBe('2010');

    await page.close();
  });

  test('should handle pages without a detected year', async ({ context }) => {
    const page = await context.newPage();
    const contentPage = new ContentPage(page);

    // Create a test page without a year (should use current year)
    await contentPage.createTestPageWithContent(['Price: $100.00']);

    // Wait for content script to process
    await page.waitForTimeout(1500);

    // Since it's using current year, prices shouldn't be adjusted
    const count = await contentPage.getAdjustedPriceCount();
    expect(count).toBe(0);

    await page.close();
  });

  test('should replace multiple prices on the same page', async ({ context }) => {
    const page = await context.newPage();
    const contentPage = new ContentPage(page);

    // Create a page with multiple prices
    const prices = [
      'Basic plan: $10.00',
      'Standard plan: $25.00',
      'Premium plan: $50.00',
      'Enterprise: $100.00',
    ];

    await contentPage.createTestPageWithContent(prices, 2015);
    await page.waitForTimeout(1500);

    const count = await contentPage.getAdjustedPriceCount();
    expect(count).toBeGreaterThanOrEqual(3); // Should find at least 3 prices

    await page.close();
  });

  test('should work independently across multiple tabs', async ({ context }) => {
    // Create first tab with 2010 prices
    const page1 = await context.newPage();
    const contentPage1 = new ContentPage(page1);
    await contentPage1.createTestPageWithContent(['Tab 1: $100.00'], 2010);

    // Create second tab with 2015 prices
    const page2 = await context.newPage();
    const contentPage2 = new ContentPage(page2);
    await contentPage2.createTestPageWithContent(['Tab 2: $100.00'], 2015);

    // Wait for both to process
    await page1.waitForTimeout(1500);
    await page2.waitForTimeout(1500);

    // Verify first tab
    await contentPage1.bringToFront();
    const count1 = await contentPage1.getAdjustedPriceCount();
    const year1 = await contentPage1.getOriginalYear(0);
    expect(count1).toBeGreaterThan(0);
    expect(year1).toBe('2010');

    // Verify second tab
    await contentPage2.bringToFront();
    const count2 = await contentPage2.getAdjustedPriceCount();
    const year2 = await contentPage2.getOriginalYear(0);
    expect(count2).toBeGreaterThan(0);
    expect(year2).toBe('2015');

    await page1.close();
    await page2.close();
  });

  test('should respect enabled/disabled state from popup', async ({ context, extensionId }) => {
    // Open a content page
    const contentPageHandle = await context.newPage();
    const contentPage = new ContentPage(contentPageHandle);
    await contentPage.createTestPageWithContent(['Price: $100.00'], 2010);

    // Open popup and disable extension
    const popupPageHandle = await context.newPage();
    const popupPage = new PopupPage(popupPageHandle, extensionId);
    await popupPage.open();
    await popupPage.setEnabled(false);

    // Bring content page to front
    await contentPage.bringToFront();

    // Reload the content page to test with disabled state
    await contentPageHandle.reload();
    await contentPage.waitForContentScript();

    // Prices should not be adjusted when disabled
    const countDisabled = await contentPage.getAdjustedPriceCount();
    expect(countDisabled).toBe(0);

    // Re-enable through popup
    await popupPage.bringToFront();
    await popupPage.setEnabled(true);

    // Bring content page to front and reload
    await contentPage.bringToFront();
    await contentPageHandle.reload();
    await contentPage.waitForContentScript();

    // Prices should now be adjusted
    const countEnabled = await contentPage.getAdjustedPriceCount();
    expect(countEnabled).toBeGreaterThan(0);

    await contentPageHandle.close();
    await popupPageHandle.close();
  });

  test('should handle various price formats', async ({ context }) => {
    const page = await context.newPage();
    const contentPage = new ContentPage(page);

    // Test different price formats
    const prices = [
      '$100',
      '$1,000.00',
      '$50.99',
      '$1,234.56',
    ];

    await contentPage.createTestPageWithContent(prices, 2010);
    await page.waitForTimeout(1500);

    const count = await contentPage.getAdjustedPriceCount();
    expect(count).toBeGreaterThan(0);

    await page.close();
  });
});
