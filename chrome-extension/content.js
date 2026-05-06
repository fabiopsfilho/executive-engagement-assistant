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

// Create floating button on the right side (like Quick's icon)
function createFloatingButton() {
  if (document.getElementById('tc-advisor-fab')) return;

  const fab = document.createElement('div');
  fab.id = 'tc-advisor-fab';
  fab.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round">
      <path d="M12 4C8 4 6 6.5 6 9c0 1.5.5 2.5 1.5 3.5S9 14 9 15.5V17h6v-1.5c0-1.5.5-2 1.5-3S18 10.5 18 9c0-2.5-2-5-6-5z"/>
      <path d="M9 17v1a3 3 0 006 0v-1"/>
      <path d="M12 4v4"/>
      <path d="M8 8c1 0 2 1 4 1s3-1 4-1"/>
      <circle cx="12" cy="4" r="1.5" fill="#f97316" stroke="none"/>
    </svg>
  `;
  fab.style.cssText = `
    position: fixed;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: linear-gradient(135deg, #7c3aed, #ec4899);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 99999;
    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4);
    transition: transform 0.2s, box-shadow 0.2s;
  `;
  fab.addEventListener('mouseenter', () => {
    fab.style.transform = 'translateY(-50%) scale(1.1)';
    fab.style.boxShadow = '0 6px 16px rgba(124, 58, 237, 0.6)';
  });
  fab.addEventListener('mouseleave', () => {
    fab.style.transform = 'translateY(-50%) scale(1)';
    fab.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.4)';
  });
  fab.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
  });
  fab.title = 'T&C Engagement Advisor';
  document.body.appendChild(fab);
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

// Create floating button
setTimeout(createFloatingButton, 2000);

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
