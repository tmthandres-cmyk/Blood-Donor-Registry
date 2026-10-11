/* ==========================================================================
   router.js - hash routing and page guards
   --------------------------------------------------------------------------
   Hash routes (#/donors/abc123) are used because GitHub Pages serves only
   static files: there is no server to rewrite clean URLs, and hash routes work
   with zero configuration.

   Routes marked public can be opened by anyone. Every other route is
   "protected": an anonymous visitor is sent to the login page and returned to
   the page they wanted once they sign in.
   ========================================================================== */
window.App = window.App || {};

(function (App) {
  'use strict';

  var routes = [];
  var outlet = null;
  var lastMatch = null;

  function define(pattern, handler, options) {
    options = options || {};
    var keys = [];
    var source = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/:(\w+)/g, function (_, key) { keys.push(key); return '([^/]+)'; });
    routes.push({
      regex: new RegExp('^' + source + '/?$'),
      keys: keys,
      handler: handler,
      public: !!options.public,
      admin: !!options.admin
    });
  }

  function route() { return window.location.hash.replace(/^#/, '') || '/'; }

  function pathOf(hash) {
    var index = hash.indexOf('?');
    return index < 0 ? hash : hash.slice(0, index);
  }

  function parseQuery(hash) {
    var index = hash.indexOf('?');
    if (index < 0) return {};
    var out = {};
    hash.slice(index + 1).split('&').forEach(function (pair) {
      if (!pair) return;
      var eq = pair.indexOf('=');
      var key = decodeURIComponent(eq < 0 ? pair : pair.slice(0, eq));
      var value = eq < 0 ? '' : decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' '));
      out[key] = value;
    });
    return out;
  }

  function match(path) {
    for (var i = 0; i < routes.length; i++) {
      var found = path.match(routes[i].regex);
      if (!found) continue;
      var params = {};
      routes[i].keys.forEach(function (key, index) {
        params[key] = decodeURIComponent(found[index + 1] || '');
      });
      return { route: routes[i], params: params };
    }
    return null;
  }

  function go(hash, options) {
    options = options || {};
    if (options.replace) {
      var base = window.location.pathname + window.location.search;
      window.location.replace(base + '#' + hash);
    } else {
      window.location.hash = hash;
    }
  }

  /** The id captured by the most recent route match. */
  function routeId(prefix) {
    if (!lastMatch) return '';
    var path = pathOf(window.location.hash);
    var expected = '/' + prefix + '/';
    var index = path.indexOf(expected);
    if (index < 0) return '';
    return path.substring(index + expected.length).split('/')[0];
  }

  function render(view) {
    if (!outlet) outlet = document.getElementById('view');
    if (!outlet) return;

    outlet.innerHTML = view.html || '';
    outlet.setAttribute('aria-busy', 'false');
    document.title = view.title
      ? view.title + ' - ' + App.Layout.CONFIG.siteName
      : App.Layout.CONFIG.siteName;

    App.Layout.renderNav(view.nav || '', view.user !== undefined ? view.user : App.Auth.user());
    App.Layout.renderFlash(view.flash || null);

    if (typeof view.onMount === 'function') {
      try { view.onMount(outlet); } catch (e) { console.error(e); }
    }

    App.Layout.closeMobileNav();
    if (!view.keepScroll) window.scrollTo(0, 0);
  }

  function errorView(message) {
    return App.Views.errorPage({
      code: 500,
      heading: 'Something went wrong',
      message: message || 'This page could not be displayed. Please go back and try again.'
    });
  }

  /**
   * Renders the current hash.
   * `data` lets a form handler re-render itself with validation errors
   * without changing the URL.
   */
  function resolve(extra) {
    var hash = route();
    var path = pathOf(hash);
    var query = parseQuery(hash);
    var found = match(path);

    if (!found) {
      lastMatch = null;
      render(App.Views.notFound());
      return;
    }

    lastMatch = found;
    var user = App.Auth.user();

    // ---- guards --------------------------------------------------------
    if (!found.route.public && !user) {
      go('/login?next=' + encodeURIComponent(hash), { replace: true });
      return;
    }
    if (found.route.admin && !App.Store.isAdmin(user)) {
      render(App.Views.forbidden());
      return;
    }

    var ctx = {
      params: found.params,
      query: query,
      hash: hash,
      user: user,
      data: (extra && extra.data) || {}
    };

    try {
      var view = found.route.handler(ctx);
      if (view === null) return;   // the handler redirected
      render(view || { html: '', title: '', nav: '' });
    } catch (error) {
      console.error('Failed to render ' + path, error);
      render(errorView(error.message));
    }
  }

  function start() {
    outlet = document.getElementById('view');

    define('/', App.Views.landing, { public: true });
    define('/login', App.Views.login, { public: true });
    define('/register', App.Views.register, { public: true });

    define('/dashboard', App.Views.dashboard);
    define('/donors', App.Views.donorList);
    define('/donors/new', App.Views.donorForm);
    define('/donors/:id', App.Views.donorDetail);
    define('/donors/:id/edit', App.Views.donorForm);
    define('/donors/:id/delete', App.Views.donorDelete);
    define('/donations', App.Views.donationList);
    define('/donations/new', App.Views.donationForm);
    define('/donations/:id/edit', App.Views.donationForm);
    define('/donations/:id/delete', App.Views.donationDelete);
    define('/requests', App.Views.requestList);
    define('/requests/new', App.Views.requestForm);
    define('/requests/:id/edit', App.Views.requestForm);
    define('/requests/:id/delete', App.Views.requestDelete);
    define('/users', App.Views.userList, { admin: true });
    define('/users/new', App.Views.userCreate, { admin: true });
    define('/users/:id/delete', App.Views.userDelete, { admin: true });
    define('/profile', App.Views.profile);
    define('/profile/password', App.Views.changePassword);
    define('/data', App.Views.dataTools);

    window.addEventListener('hashchange', function () { resolve(); });
    resolve();
  }

  App.Router = {
    define: define,
    start: start,
    resolve: resolve,
    go: go,
    route: route,
    routeId: routeId,
    parseQuery: parseQuery,
    pathOf: pathOf,
    render: render
  };
})(window.App);