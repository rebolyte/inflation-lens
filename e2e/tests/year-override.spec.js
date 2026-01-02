import { test, expect } from '../fixtures/extension.js';
import { PopupPage } from '../page-objects/popup.page.js';
import { ContentPage } from '../page-objects/content.page.js';

test.describe('Year override functionality', () => {
  test('year input initializes with detected year', async ({ context, extensionId }) => {
    const contentPageHandle = await context.newPage();
    const contentPage = new ContentPage(contentPageHandle);
    const prices = ['This item costs $100.00'];
    const url = new URL('/fixture.html', 'http://localhost:3000');
    url.searchParams.set('year', '2010');
    url.searchParams.set('prices', encodeURIComponent(JSON.stringify(prices)));

    await contentPage.goto(url.toString());
    await contentPage.waitForContentScript();
    await contentPage.waitForPriceProcessing(prices.length);

    const popupPageHandle = await context.newPage();
    const popupPage = new PopupPage(popupPageHandle, extensionId);
    await popupPage.open();
    await contentPage.bringToFront();
    await popupPage.bringToFront();
    await popupPageHandle.reload();
    await popupPage.verifyLoaded();
    await popupPage.waitForStats();

    const yearValue = await popupPage.getYearInputValue();
    expect(yearValue).toBe('2010');

    await contentPageHandle.close();
    await popupPageHandle.close();
  });

  test('year input is empty when no date detected', async ({ context, extensionId }) => {
    const contentPageHandle = await context.newPage();
    const contentPage = new ContentPage(contentPageHandle);
    const prices = ['This item costs $100.00'];
    const url = new URL('/fixture.html', 'http://localhost:3000');
    url.searchParams.set('prices', encodeURIComponent(JSON.stringify(prices)));

    await contentPage.goto(url.toString());
    await contentPage.waitForContentScript();

    const popupPageHandle = await context.newPage();
    const popupPage = new PopupPage(popupPageHandle, extensionId);
    await popupPage.open();
    await contentPage.bringToFront();
    await popupPage.bringToFront();
    await popupPageHandle.reload();
    await popupPage.verifyLoaded();

    const yearValue = await popupPage.getYearInputValue();
    expect(yearValue).toBe('');

    await contentPageHandle.close();
    await popupPageHandle.close();
  });

  test('changing year input updates prices on page', async ({ context, extensionId }) => {
    const contentPageHandle = await context.newPage();
    const contentPage = new ContentPage(contentPageHandle);
    const prices = ['This item costs $100.00', 'Another item for $50.00'];
    const url = new URL('/fixture.html', 'http://localhost:3000');
    url.searchParams.set('year', '2010');
    url.searchParams.set('prices', encodeURIComponent(JSON.stringify(prices)));

    await contentPage.goto(url.toString());
    await contentPage.waitForContentScript();
    await contentPage.waitForPriceProcessing(prices.length);

    // Initial: 2010 prices adjusted to 2023
    // $100 * (304.7/218.1) = $139.71, $50 * (304.7/218.1) = $69.85
    expect(await contentPage.getOriginalYear(0)).toBe('2010');
    expect(await contentPage.getAdjustedPrice(0)).toBe('$139.71');
    expect(await contentPage.getAdjustedPrice(1)).toBe('$69.85');

    const popupPageHandle = await context.newPage();
    const popupPage = new PopupPage(popupPageHandle, extensionId);
    await popupPage.open();
    await contentPage.bringToFront();
    await popupPage.bringToFront();
    await popupPageHandle.reload();
    await popupPage.verifyLoaded();
    await popupPage.waitForStats();

    // Change to 2015: $100 * (304.7/237) = $128.57, $50 * (304.7/237) = $64.28
    await popupPage.setYearInput(2015);
    await contentPage.bringToFront();
    await contentPage.waitForPriceProcessing(prices.length);

    expect(await contentPage.getOriginalYear(0)).toBe('2015');
    expect(await contentPage.getAdjustedPrice(0)).toBe('$128.57');
    expect(await contentPage.getAdjustedPrice(1)).toBe('$64.28');

    await contentPageHandle.close();
    await popupPageHandle.close();
  });

  test('clearing year input reverts to detected year', async ({ context, extensionId }) => {
    const contentPageHandle = await context.newPage();
    const contentPage = new ContentPage(contentPageHandle);
    const prices = ['This item costs $100.00'];
    const url = new URL('/fixture.html', 'http://localhost:3000');
    url.searchParams.set('year', '2010');
    url.searchParams.set('prices', encodeURIComponent(JSON.stringify(prices)));

    await contentPage.goto(url.toString());
    await contentPage.waitForContentScript();
    await contentPage.waitForPriceProcessing(prices.length);

    const popupPageHandle = await context.newPage();
    const popupPage = new PopupPage(popupPageHandle, extensionId);
    await popupPage.open();
    await contentPage.bringToFront();
    await popupPage.bringToFront();
    await popupPageHandle.reload();
    await popupPage.verifyLoaded();
    await popupPage.waitForStats();

    await popupPage.setYearInput(2015);
    await contentPage.bringToFront();
    await contentPage.waitForPriceProcessing(prices.length);
    let year = await contentPage.getOriginalYear(0);
    expect(year).toBe('2015');

    await popupPage.bringToFront();
    await popupPage.setYearInput(null);
    await contentPage.bringToFront();
    await contentPage.waitForPriceProcessing(prices.length);
    year = await contentPage.getOriginalYear(0);
    expect(year).toBe('2010');

    await contentPageHandle.close();
    await popupPageHandle.close();
  });

  test('invalid year values are rejected', async ({ context, extensionId }) => {
    const contentPageHandle = await context.newPage();
    const contentPage = new ContentPage(contentPageHandle);
    const prices = ['This item costs $100.00'];
    const url = new URL('/fixture.html', 'http://localhost:3000');
    url.searchParams.set('year', '2010');
    url.searchParams.set('prices', encodeURIComponent(JSON.stringify(prices)));

    await contentPage.goto(url.toString());
    await contentPage.waitForContentScript();
    await contentPage.waitForPriceProcessing(prices.length);

    const originalYear = await contentPage.getOriginalYear(0);
    expect(originalYear).toBe('2010');

    const popupPageHandle = await context.newPage();
    const popupPage = new PopupPage(popupPageHandle, extensionId);
    await popupPage.open();
    await contentPage.bringToFront();
    await popupPage.bringToFront();
    await popupPageHandle.reload();
    await popupPage.verifyLoaded();
    await popupPage.waitForStats();

    // Enter invalid year (2030 is beyond CPI data range)
    const yearInput = popupPage.getYearInput();
    await yearInput.fill('2030');
    await yearInput.blur();
    await popupPageHandle.waitForTimeout(300);

    // Error should be shown
    const hasError = await popupPage.hasYearInputError();
    expect(hasError).toBe(true);

    // Content page should still show original year (invalid year rejected)
    await contentPage.bringToFront();
    await contentPageHandle.waitForTimeout(500);

    // Prices should still be present with original detected year
    const adjustedCount = await contentPage.getAdjustedPriceCount();
    expect(adjustedCount).toBe(1);
    const year = await contentPage.getOriginalYear(0);
    expect(year).toBe('2010');

    await contentPageHandle.close();
    await popupPageHandle.close();
  });

  test('override is independent per tab', async ({ context, extensionId }) => {
    // Tab 1: Set year to 2015
    const page1 = await context.newPage();
    const contentPage1 = new ContentPage(page1);
    const prices1 = ['Tab 1: $100.00'];
    const url1 = new URL('/fixture.html', 'http://localhost:3000');
    url1.searchParams.set('year', '2010');
    url1.searchParams.set('prices', encodeURIComponent(JSON.stringify(prices1)));
    await contentPage1.goto(url1.toString());
    await contentPage1.waitForContentScript();
    await contentPage1.waitForPriceProcessing(prices1.length);

    const popupPage1Handle = await context.newPage();
    const popupPage1 = new PopupPage(popupPage1Handle, extensionId);
    await contentPage1.bringToFront();
    await popupPage1.open();
    await popupPage1.waitForStats();
    await popupPage1.setYearInput(2015);
    await contentPage1.bringToFront();
    await page1.waitForTimeout(500);

    let year1Check = await contentPage1.getOriginalYear(0);
    expect(year1Check).toBe('2015');

    // Close popup1 to avoid confusion
    await popupPage1Handle.close();

    // Tab 2: Set year to 2020
    const page2 = await context.newPage();
    const contentPage2 = new ContentPage(page2);
    const prices2 = ['Tab 2: $100.00'];
    const url2 = new URL('/fixture.html', 'http://localhost:3000');
    url2.searchParams.set('year', '2010');
    url2.searchParams.set('prices', encodeURIComponent(JSON.stringify(prices2)));
    await contentPage2.goto(url2.toString());
    await contentPage2.waitForContentScript();
    await contentPage2.waitForPriceProcessing(prices2.length);

    const popupPage2Handle = await context.newPage();
    const popupPage2 = new PopupPage(popupPage2Handle, extensionId);
    await contentPage2.bringToFront();
    await popupPage2.open();
    await popupPage2.waitForStats();
    await popupPage2.setYearInput(2020);
    await page2.waitForTimeout(500);

    const yearInputValue = await popupPage2.getYearInputValue();
    expect(yearInputValue).toBe('2020');

    await contentPage2.bringToFront();
    await page2.waitForTimeout(500);

    let year2Check = await contentPage2.getOriginalYear(0);
    expect(year2Check).toBe('2020');

    // Verify tab 1 still has year 2015
    await contentPage1.bringToFront();
    await page1.waitForTimeout(300);
    const year1 = await contentPage1.getOriginalYear(0);
    expect(year1).toBe('2015');

    // Verify tab 2 still has year 2020
    await contentPage2.bringToFront();
    await page2.waitForTimeout(300);
    const year2 = await contentPage2.getOriginalYear(0);
    expect(year2).toBe('2020');

    await page1.close();
    await page2.close();
    await popupPage2Handle.close();
  });

  test('override resets on page refresh', async ({ context, extensionId }) => {
    const contentPageHandle = await context.newPage();
    const contentPage = new ContentPage(contentPageHandle);
    const prices = ['This item costs $100.00'];
    const url = new URL('/fixture.html', 'http://localhost:3000');
    url.searchParams.set('year', '2010');
    url.searchParams.set('prices', encodeURIComponent(JSON.stringify(prices)));

    await contentPage.goto(url.toString());
    await contentPage.waitForContentScript();
    await contentPage.waitForPriceProcessing(prices.length);

    const popupPageHandle = await context.newPage();
    const popupPage = new PopupPage(popupPageHandle, extensionId);
    await popupPage.open();
    await contentPage.bringToFront();
    await popupPage.bringToFront();
    await popupPageHandle.reload();
    await popupPage.verifyLoaded();
    await popupPage.waitForStats();

    await popupPage.setYearInput(2015);
    await contentPage.bringToFront();
    await contentPage.waitForPriceProcessing(prices.length);
    let year = await contentPage.getOriginalYear(0);
    expect(year).toBe('2015');

    await contentPageHandle.reload();
    await contentPage.waitForContentScript();
    await contentPage.waitForPriceProcessing(prices.length);
    year = await contentPage.getOriginalYear(0);
    expect(year).toBe('2010');

    await popupPage.bringToFront();
    await popupPageHandle.reload();
    await popupPage.verifyLoaded();
    await popupPage.waitForStats();
    const yearValue = await popupPage.getYearInputValue();
    expect(yearValue).toBe('2010');

    await contentPageHandle.close();
    await popupPageHandle.close();
  });

  test('override persists when closing/reopening popup (same tab)', async ({ context, extensionId }) => {
    const contentPageHandle = await context.newPage();
    const contentPage = new ContentPage(contentPageHandle);
    const prices = ['This item costs $100.00'];
    const url = new URL('/fixture.html', 'http://localhost:3000');
    url.searchParams.set('year', '2010');
    url.searchParams.set('prices', encodeURIComponent(JSON.stringify(prices)));

    await contentPage.goto(url.toString());
    await contentPage.waitForContentScript();
    await contentPage.waitForPriceProcessing(prices.length);

    const popupPageHandle = await context.newPage();
    const popupPage = new PopupPage(popupPageHandle, extensionId);
    await popupPage.open();
    await contentPage.bringToFront();
    await popupPage.bringToFront();
    await popupPageHandle.reload();
    await popupPage.verifyLoaded();
    await popupPage.waitForStats();

    await popupPage.setYearInput(2015);
    await contentPage.bringToFront();
    await contentPage.waitForPriceProcessing(prices.length);
    await contentPageHandle.waitForTimeout(300);

    await popupPageHandle.close();

    const popupPageHandle2 = await context.newPage();
    const popupPage2 = new PopupPage(popupPageHandle2, extensionId);
    await popupPage2.open();
    await contentPage.bringToFront();
    await popupPage2.bringToFront();
    await popupPageHandle2.reload();
    await popupPage2.verifyLoaded();
    await popupPage2.waitForStats();
    await popupPageHandle2.waitForTimeout(200);

    const yearValue = await popupPage2.getYearInputValue();
    expect(yearValue).toBe('2015');

    await contentPage.bringToFront();
    const year = await contentPage.getOriginalYear(0);
    expect(year).toBe('2015');

    await contentPageHandle.close();
    await popupPageHandle2.close();
  });

  test('year override works with swap toggle', async ({ context, extensionId }) => {
    const contentPageHandle = await context.newPage();
    const contentPage = new ContentPage(contentPageHandle);
    const prices = ['This item costs $100.00'];
    const url = new URL('/fixture.html', 'http://localhost:3000');
    url.searchParams.set('year', '2010');
    url.searchParams.set('prices', encodeURIComponent(JSON.stringify(prices)));

    await contentPage.goto(url.toString());
    await contentPage.waitForContentScript();
    await contentPage.waitForPriceProcessing(prices.length);

    const popupPageHandle = await context.newPage();
    const popupPage = new PopupPage(popupPageHandle, extensionId);
    await popupPage.open();
    await contentPage.bringToFront();
    await popupPage.bringToFront();
    await popupPageHandle.reload();
    await popupPage.verifyLoaded();
    await popupPage.waitForStats();

    await popupPage.setYearInput(2015);
    await popupPage.page.getByTestId('swap-toggle').check();
    await contentPage.bringToFront();
    await contentPage.waitForPriceProcessing(prices.length);

    const year = await contentPage.getOriginalYear(0);
    expect(year).toBe('2015');

    // $100 in 2015 → 2023: 100 * (304.7/237) = $128.57
    const adjustedPrice = await contentPage.getAdjustedPrice(0);
    expect(adjustedPrice).toBe('$128.57');

    // With swap toggle on, the displayed text should be the adjusted price
    const priceElement = contentPage.getAdjustedPriceAt(0);
    const displayedText = await priceElement.textContent();
    expect(displayedText).toBe('$128.57');

    await contentPageHandle.close();
    await popupPageHandle.close();
  });

  test('year override updates immediately on input change', async ({ context, extensionId }) => {
    const contentPageHandle = await context.newPage();
    const contentPage = new ContentPage(contentPageHandle);
    const prices = ['This item costs $100.00'];
    const url = new URL('/fixture.html', 'http://localhost:3000');
    url.searchParams.set('year', '2010');
    url.searchParams.set('prices', encodeURIComponent(JSON.stringify(prices)));

    await contentPage.goto(url.toString());
    await contentPage.waitForContentScript();
    await contentPage.waitForPriceProcessing(prices.length);

    // Initial: $100 in 2010 → 2023 = $139.71
    expect(await contentPage.getOriginalYear(0)).toBe('2010');
    expect(await contentPage.getAdjustedPrice(0)).toBe('$139.71');

    const popupPageHandle = await context.newPage();
    const popupPage = new PopupPage(popupPageHandle, extensionId);
    await popupPage.open();
    await contentPage.bringToFront();
    await popupPage.bringToFront();
    await popupPageHandle.reload();
    await popupPage.verifyLoaded();
    await popupPage.waitForStats();

    // Change to 2015: $100 in 2015 → 2023 = $128.57
    await popupPage.setYearInput(2015);
    await contentPage.bringToFront();
    await contentPage.waitForPriceProcessing(prices.length);

    expect(await contentPage.getOriginalYear(0)).toBe('2015');
    expect(await contentPage.getAdjustedPrice(0)).toBe('$128.57');

    // Change to 2020: $100 in 2020 → 2023 = $117.74
    await popupPage.bringToFront();
    await popupPage.setYearInput(2020);
    await contentPage.bringToFront();
    await contentPage.waitForPriceProcessing(prices.length);

    expect(await contentPage.getOriginalYear(0)).toBe('2020');
    expect(await contentPage.getAdjustedPrice(0)).toBe('$117.74');

    await contentPageHandle.close();
    await popupPageHandle.close();
  });

  test('invalid year shows error message and visual feedback', async ({ context, extensionId }) => {
    const contentPageHandle = await context.newPage();
    const contentPage = new ContentPage(contentPageHandle);
    const prices = ['This item costs $100.00'];
    const url = new URL('/fixture.html', 'http://localhost:3000');
    url.searchParams.set('year', '2010');
    url.searchParams.set('prices', encodeURIComponent(JSON.stringify(prices)));

    await contentPage.goto(url.toString());
    await contentPage.waitForContentScript();
    await contentPage.waitForPriceProcessing(prices.length);

    const popupPageHandle = await context.newPage();
    const popupPage = new PopupPage(popupPageHandle, extensionId);
    await popupPage.open();
    await contentPage.bringToFront();
    await popupPage.bringToFront();
    await popupPageHandle.reload();
    await popupPage.verifyLoaded();
    await popupPage.waitForStats();

    // Verify no error initially
    let hasError = await popupPage.hasYearInputError();
    expect(hasError).toBe(false);
    let isErrorVisible = await popupPage.isErrorMessageVisible();
    expect(isErrorVisible).toBe(false);

    // Test year too high (2025 > 2023)
    const yearInput = popupPage.getYearInput();
    await yearInput.fill('2025');
    await popupPageHandle.waitForTimeout(100);

    // Check error message appears
    isErrorVisible = await popupPage.isErrorMessageVisible();
    expect(isErrorVisible).toBe(true);

    const errorMessage = await popupPage.getErrorMessage();
    expect(errorMessage).toBe('Year must be between 1913-2023');

    // Check input has error styling
    hasError = await popupPage.hasYearInputError();
    expect(hasError).toBe(true);

    // Wait for auto-reset (2 seconds)
    await popupPageHandle.waitForTimeout(2100);

    // Verify error cleared and input reset to detected year
    isErrorVisible = await popupPage.isErrorMessageVisible();
    expect(isErrorVisible).toBe(false);

    hasError = await popupPage.hasYearInputError();
    expect(hasError).toBe(false);

    const yearValue = await popupPage.getYearInputValue();
    expect(yearValue).toBe('2010');

    // Test year too low (1900 < 1913)
    await yearInput.fill('1900');
    await popupPageHandle.waitForTimeout(100);

    isErrorVisible = await popupPage.isErrorMessageVisible();
    expect(isErrorVisible).toBe(true);

    hasError = await popupPage.hasYearInputError();
    expect(hasError).toBe(true);

    // Wait for auto-reset
    await popupPageHandle.waitForTimeout(2100);

    isErrorVisible = await popupPage.isErrorMessageVisible();
    expect(isErrorVisible).toBe(false);

    // Note: input[type=number] prevents text input at browser level
    // so we can't test 'abcd' input - browser itself rejects it

    // Test valid year clears error
    await yearInput.fill('2015');
    await popupPageHandle.waitForTimeout(100);

    isErrorVisible = await popupPage.isErrorMessageVisible();
    expect(isErrorVisible).toBe(false);

    hasError = await popupPage.hasYearInputError();
    expect(hasError).toBe(false);

    await contentPageHandle.close();
    await popupPageHandle.close();
  });
});
