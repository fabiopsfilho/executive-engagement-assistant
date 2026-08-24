# AWS T&C Executive Engagement Advisor — Firefox Extension

The Firefox build of the engagement advisor. Same experience as the Chrome
extension, adapted to Firefox's extension APIs (it uses the **sidebar** instead
of Chrome's side panel, and the promise-based `browser.*` namespace).

## How it works

1. You browse Salesforce (`aws-crm.lightning.force.com`).
2. The content script detects which account you're viewing.
3. Click the toolbar icon (or the floating brain button on the page) to open the
   sidebar — it shows the full engagement experience for that account.
4. Get Buzz, Now, personas, slides, agenda — all powered by Bedrock AI.

The sidebar loads the same standalone web app in an iframe and passes the account
name as a URL parameter (`?account=CompanyName`), so every AI feature works
identically to the Chrome extension and the standalone site.

## Install (temporary / developer)

1. Open Firefox → go to `about:debugging#/runtime/this-firefox`
2. Click **"Load Temporary Add-on…"**
3. Select the `manifest.json` file inside this `firefox-extension` folder
4. The toolbar icon appears. Open a Salesforce account, then click the icon to
   open the sidebar.

> Temporary add-ons are removed when Firefox restarts. For a persistent install,
> the extension needs to be signed and packaged via
> [addons.mozilla.org](https://addons.mozilla.org) (AMO) or installed through an
> enterprise policy.

## Notes on Firefox differences

- **Sidebar, not side panel.** Firefox uses `sidebar_action`; Chrome uses
  `sidePanel`. Firefox requires a user gesture (the toolbar/FAB click) to open the
  sidebar programmatically — both are wired up.
- **`browser.*` namespace.** A tiny `browser-polyfill.js` shim aliases `chrome`
  to `browser` where needed so the scripts stay compatible.
- **Background is an event page** (`background.scripts`) rather than a service
  worker.

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 manifest with `sidebar_action` + Gecko settings |
| `config.js` | **Single place to set the web app URL** the extension embeds |
| `browser-polyfill.js` | Minimal `browser`/`chrome` compatibility shim |
| `background.js` | Opens the sidebar, relays messages |
| `content.js` | Detects the Salesforce account, captures page text, shows the FAB |
| `sidebar.html` / `sidebar.js` | The sidebar UI hosting the web app iframe |
| `icons/` | Toolbar icons |

## Standalone alternative

You don't need the extension at all. The same experience is available directly at
the web app — open it and pick (or type) any customer name. See the main project
README for the standalone browser interface.
