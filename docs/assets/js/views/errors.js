/* ==========================================================================
   views/errors.js - 403 / 404 / generic failure pages
   ========================================================================== */
window.App = window.App || {};

(function (App) {
  'use strict';

  function errorPage(opts) {
    var icons = { 403: '&#128274;', 404: '&#128269;', 500: '&#9888;' };
    return {
      title: opts.code + ' - ' + opts.heading,
      html: '<section class="container section">' +
        '<div class="error-panel">' +
          '<span class="error-code" aria-hidden="true">' + App.UI.esc(opts.code) + '</span>' +
          '<span class="error-icon" aria-hidden="true">' + (icons[opts.code] || icons[500]) + '</span>' +
          '<h1 class="error-heading">' + App.UI.esc(opts.heading) + '</h1>' +
          '<p class="error-text">' + App.UI.esc(opts.message) + '</p>' +
          '<div class="error-actions">' +
            '<a class="btn btn-primary" href="#/">Back to home page</a>' +
            '<a class="btn btn-outline" href="#/donors">Go to the registry</a>' +
          '</div>' +
        '</div></section>'
    };
  }

  function notFound() {
    return errorPage({
      code: 404,
      heading: 'We could not find that page',
      message: 'The link may be old or mistyped. Try starting from the home page.'
    });
  }

  function forbidden() {
    return errorPage({
      code: 403,
      heading: 'Administrator access only',
      message: 'This page is limited to blood bank administrators. Your account is registered as a donor, so you can only view and manage your own donor record and donation history.'
    });
  }

  App.Views = App.Views || {};
  App.Views.errorPage = errorPage;
  App.Views.notFound = notFound;
  App.Views.forbidden = forbidden;
})(window.App);