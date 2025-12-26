# E2E Testing for Inflation Lens

This directory contains end-to-end tests for the Inflation Lens Chrome extension using Playwright and Chrome DevTools Protocol (CDP).

## Overview

The E2E testing setup allows testing of:
- Extension popup functionality
- Price detection and replacement
- Integration between popup and content scripts
- Multi-tab behavior
- Enable/disable state management

## Architecture

### Fixtures (`/fixtures`)

- **extension.js** - Playwright fixture that loads the Chrome extension and dynamically retrieves the extension ID

### Page Objects (`/page-objects`)

Following the Page Object Pattern for maintainable test code:

- **base.page.js** - Base page object with common functionality including CDP's `bringToFront()` method
- **popup.page.js** - Page object for interacting with the extension popup
- **content.page.js** - Page object for testing content pages with injected scripts

### Tests (`/tests`)

- **popup.spec.js** - Tests for popup UI and state management
- **price-replacement.spec.js** - Tests for core price adjustment functionality

## Running Tests

### Install browsers first

```bash
npx playwright install chromium
```

### Run all tests

```bash
npm run test:e2e
```

### Run tests in UI mode (interactive)

```bash
npm run test:e2e:ui
```

### Run tests in headed mode (see browser)

```bash
npm run test:e2e:headed
```

### Debug tests

```bash
npm run test:e2e:debug
```

### View test report

```bash
npm run test:e2e:report
```

## Key Concepts

### Loading the Extension

The extension is loaded using `launchPersistentContext` with special Chrome flags:
- `--disable-extensions-except` - Only load our extension
- `--load-extension` - Load the extension from the build directory

### Dynamic Extension ID

The extension ID changes based on the environment, so we dynamically retrieve it from `chrome://extensions/`.

### Opening Popups as Pages

Instead of trying to interact with the actual browser toolbar popup (which Playwright can't access), we open the popup as a regular page:

```javascript
await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
```

This allows full testing of popup functionality while avoiding the freeze issue of real popups.

### Multi-Window Control with CDP

Chrome DevTools Protocol's `Page.bringToFront` is used to switch between multiple tabs/windows, which is essential for testing interactions between popup and content pages:

```javascript
async bringToFront() {
  const client = await this.page.context().newCDPSession(this.page);
  await client.send('Page.bringToFront');
}
```

### Page Object Pattern

Tests use Page Objects to keep test code clean and maintainable:

```javascript
const popupPage = new PopupPage(page, extensionId);
await popupPage.open();
await popupPage.setEnabled(false);
```

## Limitations

1. **No Headless Mode** - Chrome extensions don't work in headless mode. Tests must run with `headless: false`.
2. **Popup Behavior** - We test the popup as a regular page, not the actual toolbar popup behavior.
3. **Single Worker** - Tests run sequentially (1 worker) due to the persistent context.

## CI/CD Integration

For CI environments like GitHub Actions, you'll need to use Xvfb to run tests since headless mode isn't supported:

```yaml
- name: Run E2E tests
  run: xvfb-run npm run test:e2e
```

## Extending Tests

To add new tests:

1. Create a new test file in `/tests`
2. Import the extension fixture and relevant page objects
3. Write tests using the Page Object Pattern
4. Follow the existing patterns for multi-window scenarios

Example:

```javascript
import { test, expect } from '../fixtures/extension.js';
import { ContentPage } from '../page-objects/content.page.js';

test.describe('My new feature', () => {
  test('should do something', async ({ context }) => {
    const page = await context.newPage();
    const contentPage = new ContentPage(page);

    // Your test code here

    await page.close();
  });
});
```

## Troubleshooting

### Extension not loading
- Make sure the extension is built/compiled before running tests
- Check that the path in `extension.js` fixture points to the correct directory

### Tests timing out
- Increase wait times for content script initialization
- Use `page.waitForTimeout()` or `page.waitForSelector()` appropriately

### Tests flaky
- Ensure proper use of `bringToFront()` when switching between tabs
- Add explicit waits for asynchronous operations
- Check that extension state is properly reset between tests
