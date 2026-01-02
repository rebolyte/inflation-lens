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

    const count = await contentPage.getAdjustedPriceCount();
    expect(count).toBe(3);

    // Verify inflation math: 2010→2023 CPI ratio is 304.7/218.1 ≈ 1.397
    // $100 * 1.397 = $139.71, $50 * 1.397 = $69.85, $250 * 1.397 = $349.27
    const price0 = await contentPage.getAdjustedPrice(0);
    const price1 = await contentPage.getAdjustedPrice(1);
    const price2 = await contentPage.getAdjustedPrice(2);

    expect(price0).toBe('$139.71');
    expect(price1).toBe('$69.85');
    expect(price2).toBe('$349.27');

    expect(await contentPage.getOriginalYear(0)).toBe('2010');

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

  test('should swap prices in place when toggle is enabled and disabled', async ({ context, extensionId }) => {
    const contentPageHandle = await context.newPage();
    const contentPage = new ContentPage(contentPageHandle);
    const prices = ['Product A: $100.00', 'Product B: $50.00'];
    const url = new URL('/fixture.html', 'http://localhost:3000');
    url.searchParams.set('year', '2010');
    url.searchParams.set('prices', encodeURIComponent(JSON.stringify(prices)));
    await contentPage.goto(url.toString());
    await contentPage.waitForContentScript();
    await contentPage.waitForPriceProcessing(prices.length);

    // Verify adjusted prices are correct: $100 * (304.7/218.1) = $139.71, $50 = $69.85
    expect(await contentPage.getAdjustedPrice(0)).toBe('$139.71');
    expect(await contentPage.getAdjustedPrice(1)).toBe('$69.85');

    const popupPageHandle = await context.newPage();
    const popupPage = new PopupPage(popupPageHandle, extensionId);
    await popupPage.open();
    await popupPage.waitForStats();

    // Initially swap is off - displayed text shows original prices
    expect(await popupPage.isSwapInPlace()).toBe(false);
    expect(await contentPage.getDisplayedPriceText(0)).toBe('$100.00');
    expect(await contentPage.getDisplayedPriceText(1)).toBe('$50.00');

    // Enable swap - displayed text should show adjusted prices
    await popupPage.setSwapInPlace(true);
    expect(await popupPage.isSwapInPlace()).toBe(true);
    await contentPage.bringToFront();

    expect(await contentPage.getDisplayedPriceText(0)).toBe('$139.71');
    expect(await contentPage.getDisplayedPriceText(1)).toBe('$69.85');

    // Disable swap - displayed text should revert to original
    await popupPage.bringToFront();
    await popupPage.setSwapInPlace(false);
    expect(await popupPage.isSwapInPlace()).toBe(false);
    await contentPage.bringToFront();

    expect(await contentPage.getDisplayedPriceText(0)).toBe('$100.00');
    expect(await contentPage.getDisplayedPriceText(1)).toBe('$50.00');

    await contentPageHandle.close();
    await popupPageHandle.close();
  });

  test('should handle trillion dollar amounts with T suffix', async ({ context }) => {
    const page = await context.newPage();
    const contentPage = new ContentPage(page);

    const prices = ['National debt: $1T', 'GDP estimate: $2.5T'];
    const url = new URL('/fixture.html', 'http://localhost:3000');
    url.searchParams.set('year', '2010');
    url.searchParams.set('prices', encodeURIComponent(JSON.stringify(prices)));

    await contentPage.goto(url.toString());
    await contentPage.waitForContentScript();
    await contentPage.waitForPriceProcessing(prices.length);

    const count = await contentPage.getAdjustedPriceCount();
    expect(count).toBe(2);

    // $1T in 2010 → 2023: 1T * (304.7/218.1) = $1.4T
    // $2.5T in 2010 → 2023: 2.5T * (304.7/218.1) = $3.49T
    const price0 = await contentPage.getAdjustedPrice(0);
    const price1 = await contentPage.getAdjustedPrice(1);

    expect(price0).toBe('$1.4T');
    expect(price1).toBe('$3.49T');

    await page.close();
  });

  test('should handle boundary year 1913 (earliest CPI data)', async ({ context }) => {
    const page = await context.newPage();
    const contentPage = new ContentPage(page);

    const prices = ['Historical price: $10.00'];
    const url = new URL('/fixture.html', 'http://localhost:3000');
    url.searchParams.set('year', '1913');
    url.searchParams.set('prices', encodeURIComponent(JSON.stringify(prices)));

    await contentPage.goto(url.toString());
    await contentPage.waitForContentScript();
    await contentPage.waitForPriceProcessing(prices.length);

    const count = await contentPage.getAdjustedPriceCount();
    expect(count).toBe(1);

    // $10 in 1913 → 2023: 10 * (304.7/9.9) = $307.78
    const price = await contentPage.getAdjustedPrice(0);
    expect(price).toBe('$307.78');

    await page.close();
  });

  test('should handle boundary year 2023 (latest CPI data) - no adjustment when same year', async ({ context }) => {
    const page = await context.newPage();
    const contentPage = new ContentPage(page);

    const prices = ['Current price: $100.00'];
    const url = new URL('/fixture.html', 'http://localhost:3000');
    url.searchParams.set('year', '2023');
    url.searchParams.set('prices', encodeURIComponent(JSON.stringify(prices)));

    await contentPage.goto(url.toString());
    await contentPage.waitForContentScript();
    await page.waitForTimeout(1000);

    // When source year = target year (2023→2023), no adjustment is made
    // The extension correctly skips wrapping when adjusted === original
    const count = await contentPage.getAdjustedPriceCount();
    expect(count).toBe(0);

    await page.close();
  });

  test('should not misinterpret non-price text as prices', async ({ context }) => {
    const page = await context.newPage();
    const contentPage = new ContentPage(page);

    // Text that could be misread as prices but shouldn't be
    const nonPrices = [
      'Article 100 of the Constitution',
      'Room 250 is on the second floor',
      'Highway 50 runs through here',
      'Section 1000 covers this topic',
    ];
    const url = new URL('/fixture.html', 'http://localhost:3000');
    url.searchParams.set('year', '2010');
    url.searchParams.set('prices', encodeURIComponent(JSON.stringify(nonPrices)));

    await contentPage.goto(url.toString());
    await contentPage.waitForContentScript();
    await page.waitForTimeout(1000);

    // None of these should be detected as prices (no $ sign)
    const count = await contentPage.getAdjustedPriceCount();
    expect(count).toBe(0);

    await page.close();
  });

  test('should detect prices with various formats in same content', async ({ context }) => {
    const page = await context.newPage();
    const contentPage = new ContentPage(page);

    const prices = [
      'Basic: $100, Premium: $1,000, Enterprise: $10K',
      'Revenue was $5M and valuation hit $1B',
    ];
    const url = new URL('/fixture.html', 'http://localhost:3000');
    url.searchParams.set('year', '2010');
    url.searchParams.set('prices', encodeURIComponent(JSON.stringify(prices)));

    await contentPage.goto(url.toString());
    await contentPage.waitForContentScript();
    await contentPage.waitForPriceProcessing(5);

    // Should detect: $100, $1,000, $10K, $5M, $1B (5 prices total)
    const count = await contentPage.getAdjustedPriceCount();
    expect(count).toBe(5);

    // Verify actual adjusted values (2010→2023 ratio: 304.7/218.1 ≈ 1.397)
    // $100 → $139.71, $1,000 → $1,397, $10K → $13,971
    // $5M → $6.99M, $1B → $1.4B
    expect(await contentPage.getAdjustedPrice(0)).toBe('$139.71');
    expect(await contentPage.getAdjustedPrice(1)).toBe('$1,397');
    expect(await contentPage.getAdjustedPrice(2)).toBe('$13,971');
    expect(await contentPage.getAdjustedPrice(3)).toBe('$6.99M');
    expect(await contentPage.getAdjustedPrice(4)).toBe('$1.4B');

    await page.close();
  });
});
