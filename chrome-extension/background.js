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
});
