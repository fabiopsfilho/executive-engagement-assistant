/**
 * Minimal browser/chrome compatibility shim.
 *
 * Firefox exposes the promise-based `browser.*` namespace natively. This shim
 * simply guarantees that `browser` exists (aliasing `chrome` when needed) so the
 * same background/content/sidebar scripts run unchanged. It intentionally covers
 * only the small API surface this extension uses (runtime, storage, tabs,
 * sidebarAction). On Firefox the native `browser` is used as-is.
 */
(function () {
  if (typeof globalThis.browser === 'undefined' && typeof globalThis.chrome !== 'undefined') {
    // Chromium fallback: alias chrome -> browser. The callback-based chrome APIs
    // still work because we only await results where the API returns promises
    // (Firefox) and use callbacks/void elsewhere.
    globalThis.browser = globalThis.chrome;
  }
})();
