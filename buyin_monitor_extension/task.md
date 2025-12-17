# Task: Extract UI and API Logic to product_info.js

## Context
Refactoring `content.js` to improve maintainability by separating the Product Info Modal UI and related API logic into a new file `product_info.js`.

## Plan
1.  [x] Create `product_info.js` with `window.ProductInfo` object.
2.  [x] Move `makeDraggable`, `sendInjectedRequest`, `fetchProductData`, `fetchDataFordays`, `calculateStats`, `createTableHtml`, `showPopup` to `product_info.js`.
    -   [x] Ensure `sendInjectedRequest` has its own `pendingRequests` and message listener for results.
    -   [x] Ensure `fetchDataFordays` accepts `originalBody` as an argument.
3.  [x] Modify `content.js`:
    -   [x] Remove moved functions.
    -   [x] Update `handleBtnClick` to call `ProductInfo` methods.
    -   [x] Update `createButton` to use `ProductInfo.makeDraggable`.
4.  [x] Update `manifest.json` to include `product_info.js` before `content.js`.
5.  [x] Verify functionality (Code Review).
