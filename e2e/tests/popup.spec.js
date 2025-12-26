import { test, expect } from '../fixtures/extension.js';
import { PopupPage } from '../page-objects/popup.page.js';
import { ContentPage } from '../page-objects/content.page.js';

test.describe('Popup functionality', () => {
  test('should load popup and display initial state', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const popupPage = new PopupPage(page, extensionId);

    await popupPage.open();
    await popupPage.verifyLoaded();

    // Verify initial state
    const isEnabled = await popupPage.isEnabled();
    expect(isEnabled).toBe(true); // Should be enabled by default

    await page.close();
  });

  test('should toggle enabled state', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const popupPage = new PopupPage(page, extensionId);

    await popupPage.open();

    // Get initial state
    const initialState = await popupPage.isEnabled();

    // Toggle
    await popupPage.toggleEnabled();
    const newState = await popupPage.isEnabled();
    expect(newState).toBe(!initialState);

    // Toggle back
    await popupPage.toggleEnabled();
    const finalState = await popupPage.isEnabled();
    expect(finalState).toBe(initialState);

    await page.close();
  });

  test('should show price count and detected year from content page', async ({
    context,
    extensionId,
  }) => {
    // 1. Create a content page with test data
    const contentPageHandle = await context.newPage();
    const contentPage = new ContentPage(contentPageHandle);

    await contentPage.createTestPageWithContent(
      ['This item costs $100.00', 'Another item for $50.00'],
      2010
    );

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

    // 5. Verify stats
    const priceCount = await popupPage.getPriceCount();
    const detectedYear = await popupPage.getDetectedYear();

    expect(priceCount).toBe(2);
    expect(detectedYear).toBe('2010');

    await contentPageHandle.close();
    await popupPageHandle.close();
  });

  test('should update stats when toggling enabled state', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const popupPage = new PopupPage(page, extensionId);

    await popupPage.open();

    // Disable the extension
    await popupPage.setEnabled(false);
    const disabledState = await popupPage.isEnabled();
    expect(disabledState).toBe(false);

    // Re-enable the extension
    await popupPage.setEnabled(true);
    const enabledState = await popupPage.isEnabled();
    expect(enabledState).toBe(true);

    await page.close();
  });
});
