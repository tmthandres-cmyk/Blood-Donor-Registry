/* ==========================================================================
   app.js - bootstrap
   --------------------------------------------------------------------------
   Wires the shell, seeds the demo data on first run, then starts the router.
   Load order in index.html matters: crypto -> store -> eligibility ->
   validate -> auth -> ui -> layout -> views -> seed -> router -> app.
   ========================================================================== */
window.App = window.App || {};

(function (App) {
  'use strict';

  function warnIfStorageBlocked() {
    if (App.Store.isAvailable()) return;
    var host = document.getElementById('flashHost');
    if (!host) return;
    host.innerHTML = App.UI.flashHtml(
      'This browser is blocking site data, so nothing can be saved. Turn off private ' +
      'browsing or allow site data for this page, then reload.', 'error');
  }

  function start() {
    App.Layout.wireShell();
    App.UI.wireModal();
    warnIfStorageBlocked();

    App.Seed.run()
      .then(function () { App.Router.start(); })
      .catch(function (error) {
        console.error('Startup failed', error);
        var outlet = document.getElementById('view');
        if (outlet) {
          outlet.setAttribute('aria-busy', 'false');
          outlet.innerHTML = '<section class="container section"><div class="error-panel">' +
            '<span class="error-icon" aria-hidden="true">&#9888;</span>' +
            '<h1 class="error-heading">The registry could not start</h1>' +
            '<p class="error-text">' + App.UI.esc(error.message || 'Please reload the page.') + '</p>' +
            '<div class="error-actions"><a class="btn btn-primary" href="#/">Back to home page</a></div>' +
            '</div></section>';
        }
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(window.App);