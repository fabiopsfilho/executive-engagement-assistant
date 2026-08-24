/* global browser */
// Firefox sidebar logic. Mirrors the Chrome side panel: loads the standalone web
// app in an iframe with ?account=, and relays captured page content via postMessage.

const APP_URL = 'https://v2-redesign.d3uctzirlcp4lr.amplifyapp.com';
let currentAccount = null;

function loadAccount(accountName) {
  if (accountName === currentAccount) return;
  currentAccount = accountName;

  document.getElementById('status').innerHTML =
    'Showing insights for: <span class="account-name">' + accountName + '</span>';

  const content = document.getElementById('content');
  content.innerHTML =
    '<iframe src="' + APP_URL + '?account=' + encodeURIComponent(accountName) + '" allow="clipboard-write"></iframe>';
}

// Listen for account updates and page captures relayed by the background script.
browser.runtime.onMessage.addListener((message) => {
  if (message.type === 'UPDATE_ACCOUNT') {
    loadAccount(message.accountName);
  }
  if (message.type === 'PAGE_CONTENT') {
    const iframe = document.querySelector('iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        type: 'CAPTURED_CONTENT',
        text: message.text,
        url: message.url,
        title: message.title,
      }, '*');
    }
    const msg = document.getElementById('captureMsg');
    msg.style.display = 'block';
    msg.textContent = '\u2713 Page content captured \u2014 regenerating insights...';
    setTimeout(() => { msg.style.display = 'none'; }, 4000);
  }
});

// Restore any previously detected account.
browser.storage.local.get('currentAccount').then((data) => {
  if (data && data.currentAccount) {
    loadAccount(data.currentAccount);
  }
}).catch(() => {});

function requestDetection() {
  browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
    if (tabs[0]) {
      browser.tabs.sendMessage(tabs[0].id, { type: 'REQUEST_ACCOUNT' }).catch(() => {});
    }
  }).catch(() => {});
}

function capturePageContent() {
  browser.runtime.sendMessage({ type: 'CAPTURE_PAGE_REQUEST' }).catch(() => {});
}

setTimeout(requestDetection, 1000);

document.getElementById('detectBtn').addEventListener('click', requestDetection);
document.getElementById('captureBtn').addEventListener('click', capturePageContent);
