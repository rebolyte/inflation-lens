# Inflation Lens

A Chrome extension see any price in today's dollars.

<img width="1439" alt="screenshot" src="https://github.com/user-attachments/assets/25a7ddd9-db9e-452f-8a53-169bd79c8b11" />

Using real CPI (Consumer Price Index) data, the extension will detect the year a page was published and either highlight or replace all prices in the page with today's inflation-adjusted amount.

Currently this detects US dollars.

The extension runs entirely locally in your browser. It doesn't collect anything about you or send anything anywhere.

## Installation

### From Chrome Web Store

`TODO`

### From Source

1. Clone or download this repository
2. Load the extension

   - Open Chrome and navigate to `chrome://extensions/` (or overflow menu -> Extensions -> Manage extensions)
   - Enable "Developer mode" (toggle in the top right)
   - Click "Load unpacked"
   - Select the `inflation-lens` folder

You should see the extension in your extensions list. Pin it in your toolbar for easy access.

## Usage

1. Navigate to your Amazon wishlist
2. Click the extension icon in your Chrome toolbar
3. Choose CSV (Excel/Numbers/Google Sheets), JSON, or HTML (print to PDF)
4. Click "Export Wishlist"
5. Open the exported file

## Errata

https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world

https://developer.chrome.com/docs/extensions/reference

### Test pages

https://www.zillow.com/research/q4-2014-market-report-8759/

https://www.oprah.com/oprahshow/oprahs-ultimate-favorite-things-2010/all

https://www.caranddriver.com/features/a15140883/2000-10best-cars/
