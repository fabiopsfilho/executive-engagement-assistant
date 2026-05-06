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
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" width="32" height="32">
      <circle cx="32" cy="32" r="30" fill="#1e1b4b" stroke="url(#bgFab)" stroke-width="2"/>
      <defs><linearGradient id="bgFab" x1="0" y1="0" x2="64" y2="64"><stop offset="0%" stop-color="#a78bfa"/><stop offset="100%" stop-color="#f472b6"/></linearGradient></defs>
      <path d="M20 28c-2-4 0-10 6-12s10 1 12 5" stroke="#a78bfa" stroke-width="2.5" stroke-linecap="round" fill="none"/>
      <path d="M44 28c2-4 0-10-6-12s-10 1-12 5" stroke="#f472b6" stroke-width="2.5" stroke-linecap="round" fill="none"/>
      <path d="M18 34c-1-2 0-6 4-7" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" fill="none"/>
      <path d="M46 34c1-2 0-6-4-7" stroke="#f472b6" stroke-width="2" stroke-linecap="round" fill="none"/>
      <line x1="32" y1="21" x2="32" y2="48" stroke="#c4b5fd" stroke-width="2" stroke-linecap="round"/>
      <circle cx="32" cy="20" r="2.5" fill="#f472b6" opacity="0.9"/>
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
