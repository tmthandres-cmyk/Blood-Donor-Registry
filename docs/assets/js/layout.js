/* ==========================================================================
   layout.js - the persistent shell: header, navigation and footer
   The shell is built once in index.html; only the nav and flash are updated
   on route changes.
   ========================================================================== */
window.App = window.App || {};

(function (App) {
  'use strict';

  var CONFIG = {
    siteName: 'LifeLine Blood Donor Registry',
    bloodCenter: 'St. Michael Blood Center',
    municipality: 'City of Antipolo',
    tagline: 'One bag of blood can save three lives. Register in under two minutes.',
    description: 'LifeLine is the official online donor registry of the St. Michael Blood Center. Sign up once to be matched with patients who need your blood type, keep your donation history in one place, and let the blood bank see exactly how many units of each group are available in your community before an emergency happens.',
    officeHours: 'Monday - Saturday, 7:00 AM - 7:00 PM',
    hotline: '+63 917 555 0142',
    email: 'donors@stmichaelblood.org',
    address: 'St. Michael Blood Center, General Santos Ave, Antipolo City',
    pageSize: 8
  };

  var pendingFlash = null;

  function navLink(hash, label, active) {
    return '<a href="#' + App.UI.esc(hash) + '"' + (active ? ' class="is-active"' : '') + '>' +
           App.UI.esc(label) + '</a>';
  }

  function renderNav(active, user) {
    var host = document.getElementById('siteNav');
    var brandHost = document.getElementById('brandHost');
    var footerLinks = document.getElementById('footerLinks');
    if (!host) return;

    var esc = App.UI.esc;
    var html = '';

    if (!user) {
      html += '<div class="nav-links">' +
        navLink('/', 'Home', active === 'home') +
        navLink('/#services', 'Services', active === 'services') +
        navLink('/#compatibility', 'Compatibility', active === 'compatibility') +
        navLink('/#faq', 'FAQ', active === 'faq') +
        '</div>' +
        '<div class="nav-actions">' +
        '<a class="btn btn-ghost" href="#/login">Sign in</a>' +
        '<a class="btn btn-primary" href="#/register">Become a donor</a>' +
        '</div>';
    } else {
      var isAdmin = App.Store.isAdmin(user);
      html += '<div class="nav-links">' +
        navLink('/dashboard', 'Dashboard', active === 'dashboard') +
        navLink('/donors', isAdmin ? 'Donor Registry' : 'My Donor Record', active === 'donors') +
        navLink('/donations', isAdmin ? 'Donations' : 'My Donations', active === 'donations') +
        navLink('/requests', 'Blood Requests', active === 'requests') +
        (isAdmin ? navLink('/users', 'Accounts', active === 'users') : '') +
        '</div>' +
        '<div class="nav-actions">' +
        App.UI.userChip(user) +
        '<a class="btn btn-ghost btn-sm" href="#/data">Data</a>' +
        '<button class="btn btn-ghost btn-sm" type="button" data-signout>Sign out</button>' +
        '</div>';
    }

    host.innerHTML = html;
    host.hidden = false;

    var signout = host.querySelector('[data-signout]');
    if (signout) {
      signout.addEventListener('click', function () {
        App.Auth.logout();
        pendingFlash = { message: 'You have been signed out. Thank you.', type: 'success' };
        App.Router.go('/');
      });
    }

    if (brandHost) {
      brandHost.innerHTML = '<img class="brand-mark" src="assets/img/logo.svg" width="44" height="44" alt="">' +
        '<span class="brand-text"><strong>' + esc(CONFIG.siteName) + '</strong>' +
        '<small>' + esc(CONFIG.bloodCenter) + '</small></span>';
    }

    if (footerLinks) {
      footerLinks.innerHTML =
        '<li><a href="#/donors/new">Register a donor</a></li>' +
        '<li><a href="#/donations/new">Record a donation</a></li>' +
        '<li><a href="#/requests/new">Post a blood request</a></li>';
    }

    // A request-status button lives on the rows, so it is wired here once.
    host.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-request-status]') : null;
      if (btn) handleStatus(btn);
    });

    var yearEl = document.querySelector('[data-year]');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  }

  function handleStatus(btn) {
    var id = btn.getAttribute('data-request-status');
    var next = btn.getAttribute('data-next-status');
    var request = App.Store.requestById(id);
    if (!request) return;

    App.UI.confirmDialog({
      title: 'Update this request?',
      message: 'Mark ' + request.referenceNo + ' as "' + next + '"?',
      confirmLabel: 'Yes, update',
      danger: false
    }).then(function (ok) {
      if (!ok) return;
      request.status = next;
      request.updatedAt = new Date().toISOString();
      App.Store.putRequest(request);
      App.Store.logActivity('request.status', App.Auth.user().id,
        request.referenceNo + ' -> ' + next);
      App.Layout.setFlash('Request ' + request.referenceNo + ' is now marked as ' + next + '.', 'success');
      App.Router.resolve();
    });
  }

  function renderFlash(flash) {
    var host = document.getElementById('flashHost');
    if (!host) return;
    var data = flash || pendingFlash;
    pendingFlash = null;
    host.innerHTML = data ? App.UI.flashHtml(data.message, data.type) : '';
  }

  /** Queues a message for the next page render (e.g. after a successful save). */
  function setFlash(message, type) {
    pendingFlash = { message: message, type: type || 'success' };
  }

  function toggleMobileNav(force) {
    var panel = document.getElementById('siteNav');
    var toggle = document.querySelector('[data-nav-toggle]');
    if (!panel || !toggle) return;
    var open = typeof force === 'boolean' ? force : !panel.classList.contains('is-open');
    panel.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function closeMobileNav() { toggleMobileNav(false); }

  function wireShell() {
    var toggle = document.querySelector('[data-nav-toggle]');
    if (toggle) {
      toggle.addEventListener('click', function () { toggleMobileNav(); });
    }

    document.addEventListener('click', function (e) {
      var panel = document.getElementById('siteNav');
      if (!panel || !panel.classList.contains('is-open')) return;
      if (panel.contains(e.target) || (toggle && toggle.contains(e.target))) return;
      toggleMobileNav(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') toggleMobileNav(false);
    });

    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-dismiss-flash]') : null;
      if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
    });

    // Delegated confirmation: any link with data-confirm asks before acting.
    document.addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('[data-confirm]') : null;
      if (!el) return;
      if (!window.confirm(el.getAttribute('data-confirm'))) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
  }

  /** Honest notice about where the data actually lives. */
  function localOnlyNoteHtml() {
    if (!App.Store.isAvailable()) {
      return '<div class="storage-note is-danger"><strong>Your browser is blocking storage.</strong>' +
        'Nothing can be saved until you allow site data. Turn off private browsing, or allow ' +
        'site data for this site, then reload.</div>';
    }
    return '<div class="storage-note"><strong>This registry is stored in this browser only.</strong>' +
      'Because GitHub Pages hosts static files with no server, records live in this browser\'s ' +
      'localStorage. They are not shared with other devices, and clearing your browsing data will ' +
      'remove them. Use Export in Data tools to keep a backup.</div>';
  }

  App.Layout = {
    CONFIG: CONFIG,
    renderNav: renderNav,
    renderFlash: renderFlash,
    setFlash: setFlash,
    wireShell: wireShell,
    toggleMobileNav: toggleMobileNav,
    closeMobileNav: closeMobileNav,
    localOnlyNoteHtml: localOnlyNoteHtml
  };
})(window.App);