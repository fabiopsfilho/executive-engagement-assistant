// Content script that runs on Salesforce pages
// Detects the current account name from the page

function detectAccountName() {
  // Method 1: Page title (most reliable — Salesforce sets it to the record name)
  const title = document.title;
  if (title && title.length > 2) {
    // Remove common Salesforce suffixes
    const cleaned = title
      .replace(/\s*\|\s*Salesforce.*$/i, '')
      .replace(/\s*-\s*Salesforce.*$/i, '')
      .replace(/\s*–\s*Salesforce.*$/i, '')
      .trim();
    if (cleaned && cleaned.length > 2 && !cleaned.toLowerCase().includes('home') && !cleaned.toLowerCase().includes('salesforce')) {
      return cleaned;
    }
  }

  // Method 2: Lightning record page header
  const headerSelectors = [
    'records-entity-label',
    'h1.slds-page-header__title',
    '.slds-page-header__title .uiOutputText',
    'span.custom-truncate',
    'lightning-formatted-text[data-output-element-id="output-field"]',
    '[data-field="Name"] lightning-formatted-text',
    'h1[data-aura-class="forceActionsText"]',
    '.entityNameTitle',
    'records-highlights-details-item:first-child lightning-formatted-text',
    // Lightning Experience specific
    'slot[name="primaryField"] lightning-formatted-text',
    'h1 slot[name="primaryField"]',
    '.primaryFieldRow lightning-formatted-text',
  ];

  for (const selector of headerSelectors) {
    try {
      const el = document.querySelector(selector);
      if (el && el.textContent && el.textContent.trim().length > 2) {
        return el.textContent.trim();
      }
    } catch (e) {
      // Skip invalid selectors
    }
  }

  return null;
}

// Send detected account to background
function sendAccount() {
  const accountName = detectAccountName();
  if (accountName) {
    chrome.runtime.sendMessage({
      type: 'ACCOUNT_DETECTED',
      accountName: accountName,
      url: window.location.href,
    });
  }
}

// Run detection after page loads (Salesforce is slow to render)
setTimeout(sendAccount, 3000);
setTimeout(sendAccount, 5000);
setTimeout(sendAccount, 8000);

// Watch for SPA navigation
let lastUrl = window.location.href;
let lastTitle = document.title;

setInterval(() => {
  if (window.location.href !== lastUrl || document.title !== lastTitle) {
    lastUrl = window.location.href;
    lastTitle = document.title;
    setTimeout(sendAccount, 2000);
  }
}, 1000);
