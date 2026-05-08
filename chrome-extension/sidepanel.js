const APP_URL = 'https://v2-redesign.d3uctzirlcp4lr.amplifyapp.com';
let currentAccount = null;

function loadAccount(accountName) {
  if (accountName === currentAccount) return;
  currentAccount = accountName;

  document.getElementById('status').innerHTML =
    'Showing insights for: <span class="account-name">' + accountName + '</span>';

  const content = document.getElementById('content');
  content.innerHTML = '<iframe src="' + APP_URL + '?account=' + encodeURIComponent(accountName) + '" allow="clipboard-write"></iframe>';
}

// Listen for account updates and page captures from background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'UPDATE_ACCOUNT') {
    loadAccount(message.accountName);
  }
  if (message.type === 'PAGE_CONTENT') {
    // Pass captured content to the iframe app via postMessage
    const iframe = document.querySelector('iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        type: 'CAPTURED_CONTENT',
        text: message.text,
        url: message.url,
        title: message.title,
      }, '*');
    }
    // Show confirmation
    const msg = document.getElementById('captureMsg');
    msg.style.display = 'block';
    msg.textContent = '✓ Page content captured — regenerating insights...';
    setTimeout(() => { msg.style.display = 'none'; }, 4000);
  }
});

// Check if there's already a stored account
chrome.storage.local.get('currentAccount', (data) => {
  if (data.currentAccount) {
    loadAccount(data.currentAccount);
  }
});

// Request detection from content script
function requestDetection() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'REQUEST_ACCOUNT' }).catch(() => {
        // Content script not ready yet - ignore
      });
    }
  });
}

// Capture page content
function capturePageContent() {
  chrome.runtime.sendMessage({ type: 'CAPTURE_PAGE_REQUEST' });
}

// Auto-request detection when panel opens
setTimeout(requestDetection, 1000);

// Attach button clicks
document.getElementById('detectBtn').addEventListener('click', requestDetection);
document.getElementById('captureBtn').addEventListener('click', capturePageContent);
