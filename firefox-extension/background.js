/* global browser */
// Firefox background (event page). Uses the promise-based `browser.*` namespace.

// Open the sidebar when the toolbar icon is clicked.
// (Firefox: sidebarAction.open() must be called from a user input handler — the
// action click qualifies.)
browser.action.onClicked.addListener(() => {
  if (browser.sidebarAction && browser.sidebarAction.open) {
    browser.sidebarAction.open().catch(() => {});
  }
});

// Relay messages between the content script and the sidebar.
browser.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'ACCOUNT_DETECTED') {
    browser.storage.local.set({ currentAccount: message.accountName });
    browser.runtime.sendMessage({ type: 'UPDATE_ACCOUNT', accountName: message.accountName }).catch(() => {});
  }

  if (message.type === 'OPEN_SIDE_PANEL') {
    // Firefox can't reliably open the sidebar outside a user gesture; the content
    // FAB click is a gesture, so attempt to open and fall back silently.
    if (browser.sidebarAction && browser.sidebarAction.open) {
      browser.sidebarAction.open().catch(() => {});
    }
  }

  if (message.type === 'CAPTURE_PAGE_REQUEST') {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0]) {
        browser.tabs.sendMessage(tabs[0].id, { type: 'CAPTURE_PAGE' }).catch(() => {});
      }
    });
  }

  if (message.type === 'PAGE_CAPTURED') {
    browser.runtime.sendMessage({
      type: 'PAGE_CONTENT',
      text: message.text,
      url: message.url,
      title: message.title,
    }).catch(() => {});
  }
});
