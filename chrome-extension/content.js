// Content script that runs on Salesforce pages
// Detects the current account name from the page

function detectAccountName() {
  // Try multiple selectors for Salesforce Lightning
  const selectors = [
    // Account name in the record header
    'lightning-formatted-text[data-output-element-id="output-field"]',
    // Record header title
    '.slds-page-header__title .uiOutputText',
    'h1.slds-page-header__title',
    // Lightning record page
    'records-entity-label',
    'span.custom-truncate',
    // Account name field
    '[data-field="Name"] lightning-formatted-text',
    // Page title
    'h1[data-aura-class="forceActionsText"]',
    '.entityNameTitle',
    // Generic record name
    'records-highlights-details-item:first-child lightning-formatted-text',
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el && el.textContent.trim()) {
      return el.textContent.trim();
    }
  }

  // Try the page title as fallback
  const title = document.title;
  if (title && !title.includes('Salesforce') && !title.includes('Home')) {
    // Remove common suffixes
    return title.replace(/\s*\|.*$/, '').replace(/\s*-\s*Salesforce.*$/, '').trim();
  }

  return null;
}

// Detect account on page load and navigation
function checkForAccount() {
  const accountName = detectAccountName();
  if (accountName) {
    chrome.runtime.sendMessage({
      type: 'ACCOUNT_DETECTED',
      accountName: accountName,
      url: window.location.href,
    });
  }
}

// Run on load
setTimeout(checkForAccount, 2000);

// Watch for SPA navigation (Salesforce is a single-page app)
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    setTimeout(checkForAccount, 2000);
  }
});
observer.observe(document.body, { childList: true, subtree: true });
