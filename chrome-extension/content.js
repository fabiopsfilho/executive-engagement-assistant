// Content script that runs on Salesforce pages
// Detects the current account name from the page

function detectAccountName() {
  // Try multiple selectors for Salesforce Lightning / AWSentral
  const selectors = [
    // Account record page header (most common)
    'h1 .slds-page-header__title span',
    'h1[data-aura-class="forceActionsText"]',
    'div.entityNameTitle',
    'span.uiOutputText[data-aura-rendered-by]',
    // Record highlights - account name
    'div.slds-page-header__name-title h1 span',
    'records-entity-label',
    // Lightning record page title
    'lightning-formatted-text[data-output-element-id="output-field"]',
    '.slds-page-header__title .uiOutputText',
    // Specific to Account pages
    'div.primaryField span',
    'h1.slds-page-header__title',
    'slot[name="primaryField"] lightning-formatted-text',
    'records-highlights-details-item:first-child lightning-formatted-text',
    // Breadcrumb with account name
    'div.slds-page-header__name-title span',
    'span.custom-truncate',
    'force-highlights-details-item:first-child .fieldComponent .uiOutputText',
  ];

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      const text = el.textContent.trim();
      // Filter out common non-account text
      if (text && text.length > 2 && text.length < 100 &&
          !text.includes('Account') && !text.includes('Home') &&
          !text.includes('Salesforce') && !text.includes('AWSentral') &&
          !text.includes('Search') && !text.includes('New') &&
          !text.match(/^\d+$/) && !text.includes('Show Details')) {
        return text;
      }
    }
  }

  // Try to get from the page URL (account pages have /Account/ in the URL)
  const urlMatch = window.location.pathname.match(/\/Account\/([a-zA-Z0-9]+)/);
  if (urlMatch) {
    // Try to find the account name in the page title
    const title = document.title.replace(/\s*\|.*$/, '').replace(/\s*-\s*Salesforce.*$/, '').trim();
    if (title && title.length > 2 && !title.includes('Salesforce') && !title.includes('Home')) {
      return title;
    }
  }

  // Last resort: look for "Account" label followed by the name
  const allSpans = document.querySelectorAll('span');
  let foundAccountLabel = false;
  for (const span of allSpans) {
    if (foundAccountLabel) {
      const text = span.textContent.trim();
      if (text && text.length > 2 && text.length < 100) {
        return text;
      }
    }
    if (span.textContent.trim() === 'Account') {
      foundAccountLabel = true;
    }
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
