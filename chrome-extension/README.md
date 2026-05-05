# AWS T&C Executive Engagement Advisor — Chrome Extension

A Chrome extension that integrates with Salesforce to provide AI-powered T&C engagement insights directly in your browser.

## How It Works

1. You browse Salesforce (`aws-crm.lightning.force.com`)
2. The extension detects which account you're viewing
3. Click the extension icon → a side panel opens with the full engagement experience for that account
4. Get Buzz, Now, Persona engagement, conversation starters — all powered by Bedrock AI

## Installation (Developer Mode)

1. Open Chrome → go to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top-right)
3. Click **"Load unpacked"**
4. Select this `chrome-extension` folder
5. The extension icon appears in your toolbar

## Usage

1. Go to `aws-crm.lightning.force.com`
2. Open any account page
3. Click the extension icon in your toolbar
4. The side panel opens with T&C engagement insights for that account

## Icons

You'll need to add icon files:
- `icons/icon16.png` (16x16)
- `icons/icon48.png` (48x48)
- `icons/icon128.png` (128x128)

You can use any AWS/T&C branded icon. For now, create simple placeholder PNGs.

## Notes

- The extension uses your existing Amplify app URL in an iframe
- It passes the account name as a URL parameter (`?account=CompanyName`)
- The app auto-selects that account and shows the engagement brief
- All AI features (Buzz, Now, Personas, Advisor) work the same as the standalone app
