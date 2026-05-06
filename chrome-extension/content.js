// Content script that runs on Salesforce pages
// Detects the current account name from the page

function detectAccountName() {
  // Method 1: Page title (Salesforce sets it to "Account Name | Salesforce")
  const title = document.title;
  if (title && title.includes('|')) {
    const name = title.split('|')[0].trim();
    if (name && name.length > 2 && name.length < 100 && name !== 'Home') {
      return name;
    }
  }

  // Method 2: Look for the account name in the record header
  // Salesforce Lightning uses this structure for account pages
  const headerEl = document.querySelector('div.entityNameTitle') ||
    document.querySelector('h1 span') ||
    document.querySelector('records-entity-label') ||
    document.querySelector('.slds-page-header__name-title span') ||
    document.querySelector('slot[name="primaryField"] lightning-formatted-text');

  if (headerEl) {
    const text = headerEl.textContent.trim();
    if (text && text.length > 2 && text.length < 100) {
      return text;
    }
  }

  // Method 3: Look for "Account" type indicator followed by name
  const recordHeader = document.querySelector('records-lwc-highlights-panel');
  if (recordHeader) {
    const nameEl = recordHeader.querySelector('lightning-formatted-text') ||
      recordHeader.querySelector('span[class*="field"]');
    if (nameEl) {
      return nameEl.textContent.trim();
    }
  }

  // Method 4: URL-based detection for account pages
  if (window.location.pathname.includes('/Account/')) {
    // Try title without pipe
    const cleanTitle = title.replace(/\s*\|.*$/, '').replace(/\s*-\s*Salesforce.*$/, '').trim();
    if (cleanTitle && cleanTitle.length > 2) return cleanTitle;
  }

  return null;
}

// Send account name to the extension
function sendAccountToExtension(accountName) {
  if (accountName) {
    chrome.runtime.sendMessage({
      type: 'ACCOUNT_DETECTED',
      accountName: accountName,
      url: window.location.href,
    });
  }
}

// Detect account on page load and navigation
function checkForAccount() {
  const accountName = detectAccountName();
  sendAccountToExtension(accountName);
}

// Run detection after page loads (Salesforce is slow to render)
setTimeout(checkForAccount, 3000);
setTimeout(checkForAccount, 5000);
setTimeout(checkForAccount, 8000);

// Watch for SPA navigation (Salesforce is a single-page app)
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    setTimeout(checkForAccount, 3000);
    setTimeout(checkForAccount, 5000);
  }
});
observer.observe(document.body, { childList: true, subtree: true });

// Also listen for manual trigger from the side panel
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'REQUEST_ACCOUNT') {
    checkForAccount();
  }
});
