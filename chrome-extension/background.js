// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ACCOUNT_DETECTED') {
    // Store the detected account name
    chrome.storage.local.set({ currentAccount: message.accountName });
    // Update the side panel
    chrome.runtime.sendMessage({ type: 'UPDATE_ACCOUNT', accountName: message.accountName });
  }
  if (message.type === 'OPEN_SIDE_PANEL' && sender.tab) {
    chrome.sidePanel.open({ tabId: sender.tab.id });
  }
  if (message.type === 'CAPTURE_PAGE_REQUEST') {
    // Forward capture request to the active tab's content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'CAPTURE_PAGE' });
      }
    });
  }
  if (message.type === 'PAGE_CAPTURED') {
    // Forward captured content to the side panel
    chrome.runtime.sendMessage({ type: 'PAGE_CONTENT', text: message.text, url: message.url, title: message.title });
  }
});
