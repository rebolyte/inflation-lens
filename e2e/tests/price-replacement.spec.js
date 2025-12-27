import { test, expect } from '../fixtures/extension.js';
import { ContentPage } from '../page-objects/content.page.js';
import { PopupPage } from '../page-objects/popup.page.js';

test.describe('Price replacement functionality', () => {
  test('should detect and replace prices on a page with a year', async ({ context }) => {
    const page = await context.newPage();
    const contentPage = new ContentPage(page);

    const prices = ['This costs $100.00', 'Sale price: $50.00', 'Premium option: $250.00'];
    const url = new URL('/fixture.html', 'http://localhost:3000');
    url.searchParams.set('year', '2010');
    url.searchParams.set('prices', encodeURIComponent(JSON.stringify(prices)));
    
    await contentPage.goto(url.toString());
    await contentPage.waitForContentScript();
    await contentPage.waitForPriceProcessing(prices.length);

    // Verify prices were adjusted
    const count = await contentPage.getAdjustedPriceCount();
    expect(count).toBe(3);

    // Verify the first adjusted price has correct attributes
    const priceData = await contentPage.verifyPriceAdjusted(0);
    expect(priceData.original).toBeTruthy();
    expect(priceData.adjusted).toBeTruthy();
    expect(priceData.year).toBe('2010');

    await page.close();
  });

  test('should work independently across multiple tabs', async ({ context }) => {
    // Create first tab with 2010 prices
    const page1 = await context.newPage();
    const contentPage1 = new ContentPage(page1);
    const prices1 = ['Tab 1: $100.00'];
    const url1 = new URL('/fixture.html', 'http://localhost:3000');
    url1.searchParams.set('year', '2010');
    url1.searchParams.set('prices', encodeURIComponent(JSON.stringify(prices1)));
    await contentPage1.goto(url1.toString());
    await contentPage1.waitForContentScript();
    await contentPage1.waitForPriceProcessing(prices1.length);

    // Create second tab with 2015 prices
    const page2 = await context.newPage();
    const contentPage2 = new ContentPage(page2);
    const prices2 = ['Tab 2: $100.00'];
    const url2 = new URL('/fixture.html', 'http://localhost:3000');
    url2.searchParams.set('year', '2015');
    url2.searchParams.set('prices', encodeURIComponent(JSON.stringify(prices2)));
    await contentPage2.goto(url2.toString());
    await contentPage2.waitForContentScript();
    await contentPage2.waitForPriceProcessing(prices2.length);

    // Verify first tab
    await contentPage1.bringToFront();
    const count1 = await contentPage1.getAdjustedPriceCount();
    const year1 = await contentPage1.getOriginalYear(0);
    expect(count1).toBe(1);
    expect(year1).toBe('2010');

    // Verify second tab
    await contentPage2.bringToFront();
    const count2 = await contentPage2.getAdjustedPriceCount();
    const year2 = await contentPage2.getOriginalYear(0);
    expect(count2).toBe(1);
    expect(year2).toBe('2015');

    await page1.close();
    await page2.close();
  });

  test('should respect enabled/disabled state from popup', async ({ context, extensionId }) => {
    // Open a content page
    const contentPageHandle = await context.newPage();
    const contentPage = new ContentPage(contentPageHandle);
    const prices = ['Price: $100.00'];
    const url = new URL('/fixture.html', 'http://localhost:3000');
    url.searchParams.set('year', '2010');
    url.searchParams.set('prices', encodeURIComponent(JSON.stringify(prices)));
    await contentPage.goto(url.toString());
    await contentPage.waitForContentScript();
    await contentPage.waitForPriceProcessing(prices.length);

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
    expect(countEnabled).toBe(1);

    await contentPageHandle.close();
    await popupPageHandle.close();
  });

  test('should show/hide adjusted prices when toggling enabled state', async ({
    context,
    extensionId,
  }) => {
    // 1. Load a page with prices
    const contentPageHandle = await context.newPage();
    const contentPage = new ContentPage(contentPageHandle);
    const prices = ['Product A: $100.00', 'Product B: $50.00', 'Product C: $25.00'];
    const url = new URL('/fixture.html', 'http://localhost:3000');
    url.searchParams.set('year', '2010');
    url.searchParams.set('prices', encodeURIComponent(JSON.stringify(prices)));
    await contentPage.goto(url.toString());
    await contentPage.waitForContentScript();
    await contentPage.waitForPriceProcessing(prices.length);

    // 2. Verify prices are adjusted initially
    const initialCount = await contentPage.getAdjustedPriceCount();
    expect(initialCount).toBe(3);

    // 3. Open popup and disable extension
    const popupPageHandle = await context.newPage();
    const popupPage = new PopupPage(popupPageHandle, extensionId);
    await popupPage.open();
    await popupPage.setEnabled(false);

    // 4. Bring content page to front
    await contentPage.bringToFront();

    // 5. Wait for prices to be removed/hidden
    await contentPage.waitForPricesToDisappear();

    // 6. Verify adjusted prices are gone
    const disabledCount = await contentPage.getAdjustedPriceCount();
    expect(disabledCount).toBe(0);

    // 7. Re-enable through popup
    await popupPage.bringToFront();
    await popupPage.setEnabled(true);

    // 8. Bring content page to front
    await contentPage.bringToFront();

    // 9. Wait for prices to reappear
    await contentPage.waitForPriceProcessing(3);

    // 10. Verify prices are adjusted again
    const enabledCount = await contentPage.getAdjustedPriceCount();
    expect(enabledCount).toBe(3);

    await contentPageHandle.close();
    await popupPageHandle.close();
  });
});
