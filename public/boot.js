// Loaded as a plain file rather than inlined in index.html so the
// Content-Security-Policy in vercel.json can forbid inline scripts outright.
// Not a module and not bundled: it has to run even when the bundle cannot.
// Capture anything that goes wrong before or during boot, so a failure
// shows a message and an escape hatch rather than a black screen.
window.__linguaBootError = null;
function showBootFallback(detail) {
  var el = document.getElementById('boot-fallback');
  if (!el || el.classList.contains('visible')) return;
  el.classList.add('visible');
  if (detail) {
    document.getElementById('boot-error').textContent = String(detail);
  }
}
window.addEventListener('error', function (e) {
  window.__linguaBootError = (e && (e.error && e.error.stack || e.message)) || 'script error';
  showBootFallback(window.__linguaBootError);
});
window.addEventListener('unhandledrejection', function (e) {
  window.__linguaBootError = (e && e.reason && (e.reason.stack || e.reason.message)) || 'promise rejection';
  showBootFallback(window.__linguaBootError);
});

// Chrome can offer its install prompt before the app bundle has loaded and
// started listening; keep it for src/ui/installState.ts to pick up.
window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  window.__installPrompt = e;
});

// Unregister every service worker and delete every cache, then reload
// from the network. This is the cure for a shell cached from a login
// wall or a half-broken deploy.
window.__linguaReset = async function () {
  try {
    if ('serviceWorker' in navigator) {
      var regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(function (r) { return r.unregister(); }));
    }
    if (window.caches) {
      var keys = await caches.keys();
      await Promise.all(keys.map(function (k) { return caches.delete(k); }));
    }
  } catch (err) {
    /* best effort — reload regardless */
  }
  location.replace(location.pathname + '?reset=' + Date.now());
};

// If React hasn't mounted after a few seconds, something is wrong.
setTimeout(function () {
  var root = document.getElementById('root');
  if (root && root.childElementCount === 0) {
    showBootFallback(window.__linguaBootError || 'The app bundle did not mount within 8 seconds.');
  }
}, 8000);

// Wired here rather than with an onclick attribute, which the CSP also blocks.
// The button is above this script in the page, so it already exists.
var resetButton = document.getElementById('boot-reset');
if (resetButton) resetButton.addEventListener('click', function () { window.__linguaReset(); });
