import { test, expect } from '../fixtures/extension.js';
import { PopupPage } from '../page-objects/popup.page.js';
import { ContentPage } from '../page-objects/content.page.js';

test.describe('Popup functionality', () => {
  test('should load popup and display initial state', async ({ context, extensionId }) => {
    const contentPageHandle = await context.newPage();
    const contentPage = new ContentPage(contentPageHandle);
    const url = new URL('/fixture.html', 'http://localhost:3000');
    url.searchParams.set('year', '2010');
    url.searchParams.set('prices', encodeURIComponent(JSON.stringify(['$100'])));
    await contentPage.goto(url.toString());
    await contentPage.waitForContentScript();

    const page = await context.newPage();
    const popupPage = new PopupPage(page, extensionId);

    await contentPage.bringToFront();
    await popupPage.open();
    await popupPage.verifyLoaded();
    await popupPage.waitForStats();

    const isEnabled = await popupPage.isEnabled();
    expect(isEnabled).toBe(true);

    await contentPageHandle.close();
    await page.close();
  });

  test('should toggle enabled state', async ({ context, extensionId }) => {
    const contentPageHandle = await context.newPage();
    const contentPage = new ContentPage(contentPageHandle);
    const url = new URL('/fixture.html', 'http://localhost:3000');
    url.searchParams.set('year', '2010');
    url.searchParams.set('prices', encodeURIComponent(JSON.stringify(['$100'])));
    await contentPage.goto(url.toString());
    await contentPage.waitForContentScript();

    const page = await context.newPage();
    const popupPage = new PopupPage(page, extensionId);

    await contentPage.bringToFront();
    await popupPage.open();
    await popupPage.waitForStats();

    const initialState = await popupPage.isEnabled();

    await popupPage.toggleEnabled();
    const newState = await popupPage.isEnabled();
    expect(newState).toBe(!initialState);

    await popupPage.toggleEnabled();
    const finalState = await popupPage.isEnabled();
    expect(finalState).toBe(initialState);

    await contentPageHandle.close();
    await page.close();
  });

  test('should show price count and detected year from content page', async ({
    context,
    extensionId,
  }) => {
    // 1. Create a content page with test data
    const contentPageHandle = await context.newPage();
    const contentPage = new ContentPage(contentPageHandle);

    const prices = ['This item costs $100.00', 'Another item for $50.00'];
    const url = new URL('/fixture.html', 'http://localhost:3000');
    url.searchParams.set('year', '2010');
    url.searchParams.set('prices', encodeURIComponent(JSON.stringify(prices)));
    
    await contentPage.goto(url.toString());
    await contentPage.waitForContentScript();
    await contentPage.waitForPriceProcessing(prices.length);

    // 2. Open popup in a new page
    const popupPageHandle = await context.newPage();
    const popupPage = new PopupPage(popupPageHandle, extensionId);
    await popupPage.open();

    // 3. Bring content page to front to activate the tab
    await contentPage.bringToFront();

    // 4. Bring popup to front to check stats
    await popupPage.bringToFront();
    // Reload popup to get fresh stats from the active tab
    await popupPageHandle.reload();
    await popupPage.verifyLoaded();
    await popupPage.waitForStats();

    // 5. Verify stats
    const priceCount = await popupPage.getPriceCount();
    const detectedYear = await popupPage.getDetectedYear();

    expect(priceCount).toBe(2);
    expect(detectedYear).toBe('2010');

    await contentPageHandle.close();
    await popupPageHandle.close();
  });

  test('stats section hidden when disabled', async ({ context, extensionId }) => {
    const contentPageHandle = await context.newPage();
    const contentPage = new ContentPage(contentPageHandle);
    const url = new URL('/fixture.html', 'http://localhost:3000');
    url.searchParams.set('year', '2010');
    url.searchParams.set('prices', encodeURIComponent(JSON.stringify(['$100'])));
    await contentPage.goto(url.toString());
    await contentPage.waitForContentScript();

    const page = await context.newPage();
    const popupPage = new PopupPage(page, extensionId);

    await contentPage.bringToFront();
    await popupPage.open();
    await popupPage.waitForStats();

    const enableToggle = page.getByTestId('enable-toggle');
    await expect(enableToggle).toBeVisible();

    await popupPage.setEnabled(false);

    const statsVisible = await popupPage.isStatsSectionVisible();
    expect(statsVisible).toBe(false);

    const yearInputVisible = await popupPage.isYearInputVisible();
    expect(yearInputVisible).toBe(false);

    const swapToggleVisible = await popupPage.isSwapToggleVisible();
    expect(swapToggleVisible).toBe(false);

    await contentPageHandle.close();
    await page.close();
  });

  test('stats section visible when enabled', async ({ context, extensionId }) => {
    const contentPageHandle = await context.newPage();
    const contentPage = new ContentPage(contentPageHandle);
    const prices = ['This item costs $100.00'];
    const url = new URL('/fixture.html', 'http://localhost:3000');
    url.searchParams.set('year', '2010');
    url.searchParams.set('prices', encodeURIComponent(JSON.stringify(prices)));
    
    await contentPage.goto(url.toString());
    await contentPage.waitForContentScript();
    await contentPage.waitForPriceProcessing(prices.length);

    const page = await context.newPage();
    const popupPage = new PopupPage(page, extensionId);
    await popupPage.open();
    await contentPage.bringToFront();
    await popupPage.bringToFront();
    await page.reload();
    await popupPage.verifyLoaded();
    await popupPage.waitForStats();

    await popupPage.setEnabled(false);
    await page.waitForTimeout(100);

    const statsVisibleBefore = await popupPage.isStatsSectionVisible();
    expect(statsVisibleBefore).toBe(false);

    await popupPage.setEnabled(true);
    await page.waitForTimeout(200);

    const statsVisible = await popupPage.isStatsSectionVisible();
    expect(statsVisible).toBe(true);

    const yearInputVisible = await popupPage.isYearInputVisible();
    expect(yearInputVisible).toBe(true);

    const swapToggleVisible = await popupPage.isSwapToggleVisible();
    expect(swapToggleVisible).toBe(true);

    await contentPageHandle.close();
    await page.close();
  });

  test('shows unavailable message when content script not active', async ({ context, extensionId }) => {
    // Open popup directly without a content page (simulates chrome:// pages or other restricted pages)
    const page = await context.newPage();
    const popupPage = new PopupPage(page, extensionId);

    await popupPage.open();
    await popupPage.verifyLoaded();
    await page.waitForTimeout(500); // Wait for init to complete

    // Verify unavailable message is shown
    const isUnavailableVisible = await popupPage.isUnavailableMessageVisible();
    expect(isUnavailableVisible).toBe(true);

    const unavailableMessage = await popupPage.getUnavailableMessage();
    expect(unavailableMessage).toContain('Extension not available on this page');
    expect(unavailableMessage).toContain('http://');

    // Verify stats section is hidden
    const statsVisible = await popupPage.isStatsSectionVisible();
    expect(statsVisible).toBe(false);

    // Verify year input is hidden
    const yearInputVisible = await popupPage.isYearInputVisible();
    expect(yearInputVisible).toBe(false);

    await page.close();
  });
});
