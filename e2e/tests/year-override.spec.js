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

    await popupPage.setYearInput(2015);
    await contentPage.bringToFront();
    await contentPage.waitForPriceProcessing(prices.length);

    const newYear = await contentPage.getOriginalYear(0);
    expect(newYear).toBe('2015');

    const adjustedPrice1 = await contentPage.getAdjustedPrice(0);
    const adjustedPrice2 = await contentPage.getAdjustedPrice(1);
    expect(adjustedPrice1).toBeTruthy();
    expect(adjustedPrice2).toBeTruthy();

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

    const yearInput = popupPage.getYearInput();
    const maxValue = await yearInput.getAttribute('max');
    expect(maxValue).toBe('2023');

    await yearInput.fill('2025');
    await yearInput.blur();
    await popupPageHandle.waitForTimeout(300);
    await contentPage.bringToFront();
    await contentPageHandle.waitForTimeout(300);

    const adjustedCount = await contentPage.getAdjustedPriceCount();
    if (adjustedCount > 0) {
      const year = await contentPage.getOriginalYear(0);
      expect(year).toBe('2010');
    }

    await contentPageHandle.close();
    await popupPageHandle.close();
  });

  test('override is independent per tab', async ({ context, extensionId }) => {
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
    await popupPage1.open();
    await contentPage1.bringToFront();
    await popupPage1.bringToFront();
    await popupPage1Handle.reload();
    await popupPage1.verifyLoaded();
    await popupPage1.waitForStats();
    await popupPage1.setYearInput(2015);
    await contentPage1.bringToFront();
    await contentPage1.waitForPriceProcessing(prices1.length);
    await page1.waitForTimeout(500);
    
    let year1Check = await contentPage1.getOriginalYear(0);
    expect(year1Check).toBe('2015');

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
    await popupPage2.open();
    await contentPage2.bringToFront();
    await popupPage2.bringToFront();
    await popupPage2Handle.reload();
    await popupPage2.verifyLoaded();
    await popupPage2.waitForStats();
    await contentPage2.bringToFront();
    await page2.waitForTimeout(300);
    await popupPage2.bringToFront();
    await popupPage2Handle.waitForTimeout(200);
    await contentPage2.bringToFront();
    await page2.waitForTimeout(100);
    await popupPage2.bringToFront();
    await popupPage2.setYearInput(2020);
    await popupPage2Handle.waitForTimeout(500);
    
    const yearInputValue = await popupPage2.getYearInputValue();
    expect(yearInputValue).toBe('2020');
    
    await contentPage2.bringToFront();
    await page2.waitForTimeout(1000);
    
    let year2Check = await contentPage2.getOriginalYear(0);
    expect(year2Check).toBe('2020');

    await contentPage1.bringToFront();
    await page1.waitForTimeout(300);
    const year1 = await contentPage1.getOriginalYear(0);
    expect(year1).toBe('2015');

    await contentPage2.bringToFront();
    await page2.waitForTimeout(300);
    const year2 = await contentPage2.getOriginalYear(0);
    expect(year2).toBe('2020');

    await page1.close();
    await page2.close();
    await popupPage1Handle.close();
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

    const adjustedPrice = await contentPage.getAdjustedPrice(0);
    expect(adjustedPrice).toBeTruthy();

    const priceElement = contentPage.getAdjustedPriceAt(0);
    const displayedText = await priceElement.textContent();
    expect(displayedText).toBe(adjustedPrice);

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

    await popupPage.setYearInput(2015);
    await contentPage.bringToFront();
    await contentPage.waitForPriceProcessing(prices.length);

    const newYear = await contentPage.getOriginalYear(0);
    expect(newYear).toBe('2015');

    const adjustedPrice1 = await contentPage.getAdjustedPrice(0);
    expect(adjustedPrice1).toBeTruthy();

    await popupPage.bringToFront();
    await popupPage.setYearInput(2020);
    await contentPage.bringToFront();
    await contentPage.waitForPriceProcessing(prices.length);

    const finalYear = await contentPage.getOriginalYear(0);
    expect(finalYear).toBe('2020');

    const adjustedPrice2 = await contentPage.getAdjustedPrice(0);
    expect(adjustedPrice2).toBeTruthy();
    expect(adjustedPrice2).not.toBe(adjustedPrice1);

    await contentPageHandle.close();
    await popupPageHandle.close();
  });
});
