/* ==========================================================================
   auth.js - accounts, sessions and access rules
   --------------------------------------------------------------------------
   IMPORTANT - read this before assuming the login is real security.
   GitHub Pages hosts static files only, so there is no server to check a
   password against. This module hashes passwords properly (PBKDF2, salted,
   150,000 rounds, never stored as text) but the verification happens in the
   browser, and the hashed records live in localStorage. That is adequate for
   a demonstration or coursework submission; it is NOT a substitute for
   server-side authentication, and anyone with dev tools can read the store.

   A production version would delegate to a real identity provider.
   ========================================================================== */
window.App = window.App || {};

(function (App) {
  'use strict';

  var SESSION_KEY = 'bdr.session.v1';
  var SESSION_HOURS = 8;

  var currentUser = null;

  // ------------------------------------------------------------- sessions --
  function saveSession(userId) {
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        userId: userId,
        expiresAt: new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString()
      }));
    } catch (e) { /* storage blocked - the session will not survive a reload */ }
  }

  function loadSession() {
    try {
      var raw = window.sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.userId) return null;
      if (new Date(parsed.expiresAt).getTime() <= Date.now()) return null;
      return parsed;
    } catch (e) { return null; }
  }

  function clearSession() {
    try { window.sessionStorage.removeItem(SESSION_KEY); } catch (e) { }
  }

  /** Re-reads the signed-in account from the store, or null. */
  function user() {
    if (currentUser) return currentUser;
    var session = loadSession();
    if (!session) return null;
    var found = App.Store.userById(session.userId);
    if (!found) { clearSession(); return null; }
    if (found.active === false) { clearSession(); return null; }
    currentUser = found;
    return currentUser;
  }

  function isAdmin() { return App.Store.isAdmin(user()); }

  function initials(name) {
    if (!name) return '?';
    var parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    var first = parts[0];
    var last = parts.length > 1 ? parts[parts.length - 1] : first;
    return (first.charAt(0) + last.charAt(0)).toUpperCase();
  }

  // --------------------------------------------------------------- create --
  /**
   * Registers an account. Resolves with the created user, or rejects with an
   * Error carrying a `.errors` map so the form can show it inline.
   */
  function register(opts) {
    var email = String(opts.email).trim().toLowerCase();

    if (App.Store.userByEmail(email)) {
      var dup = new Error('An account with this email address already exists. Please sign in instead.');
      dup.errors = { email: dup.message };
      return Promise.reject(dup);
    }

    return App.Crypto.hashPassword(opts.password).then(function (record) {
      var user = {
        id: App.Crypto.randomId('usr'),
        name: String(opts.name).trim(),
        email: email,
        // Self-registration can only ever create a donor. An administrator is
        // granted in the Accounts page, so nobody can make themselves an admin.
        role: 'donor',
        phone: opts.phone || '',
        address: opts.address || '',
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: '',
        passwordSalt: record.salt,
        passwordHash: record.hash,
        passwordIterations: record.iterations,
        passwordAlgorithm: record.algorithm
      };
      App.Store.putUser(user);
      App.Store.logActivity('register', user.id, 'Created a donor account');
      return user;
    });
  }

  /**
   * Creates an account with an explicit role. Administrators use this from the
   * Accounts page.
   */
  function createWithRole(opts) {
    var email = String(opts.email).trim().toLowerCase();

    if (App.Store.userByEmail(email)) {
      var dup = new Error('An account with this email address already exists. Please sign in instead.');
      dup.errors = { email: dup.message };
      return Promise.reject(dup);
    }

    return App.Crypto.hashPassword(opts.password).then(function (record) {
      var user = {
        id: App.Crypto.randomId('usr'),
        name: String(opts.name).trim(),
        email: email,
        role: opts.role === 'admin' ? 'admin' : 'donor',
        phone: opts.phone || '',
        address: opts.address || '',
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: '',
        passwordSalt: record.salt,
        passwordHash: record.hash,
        passwordIterations: record.iterations,
        passwordAlgorithm: record.algorithm
      };
      App.Store.putUser(user);
      App.Store.logActivity('user.create', '', 'Created a ' + user.role + ' account for ' + user.name);
      return user;
    });
  }

  // ---------------------------------------------------------------- login --
  /**
   * Signs in. Rejects with a generic message on every failure so the form
   * cannot be used to discover which email addresses have accounts.
   */
  function login(email, password) {
    var generic = new Error('That email address and password do not match. Please check them and try again.');

    var found = App.Store.userByEmail(email);
    if (!found) {
      // Still do the work, so a missing account takes about the same time as a
      // wrong password and cannot be detected by timing.
      if (App.Crypto.randomBytes) App.Crypto.randomBytes(16);
      return Promise.reject(generic);
    }

    return App.Crypto.verifyPassword(password, found).then(function (ok) {
      if (!ok) throw generic;
      if (found.active === false) {
        var inactive = new Error('This account has been deactivated. Please contact the blood bank office to restore it.');
        inactive.errors = {};
        throw inactive;
      }

      currentUser = found;
      found.lastLoginAt = new Date().toISOString();
      App.Store.putUser(found);
      saveSession(found.id);
      App.Store.logActivity('login', found.id, 'Signed in as ' + found.role);
      return found;
    });
  }

  function logout() {
    clearSession();
    currentUser = null;
  }

  // ------------------------------------------------------------- password --
  /** Changes the signed-in account's password. Invalidates other sessions. */
  function changePassword(userId, currentPassword, newPassword) {
    var found = App.Store.userById(userId);
    if (!found) return Promise.reject(new Error('That account could not be found.'));

    return App.Crypto.verifyPassword(currentPassword, found).then(function (ok) {
      if (!ok) {
        var e = new Error('That is not your current password. Please check it and try again.');
        e.errors = { currentPassword: e.message };
        throw e;
      }
      if (newPassword === currentPassword) {
        var same = new Error('Your new password must be different from your current one.');
        same.errors = { newPassword: same.message };
        throw same;
      }
      return App.Crypto.hashPassword(newPassword).then(function (record) {
        found.passwordSalt = record.salt;
        found.passwordHash = record.hash;
        found.passwordIterations = record.iterations;
        found.updatedAt = new Date().toISOString();
        App.Store.putUser(found);
        currentUser = found;
        App.Store.logActivity('password.change', userId, 'Changed own password');
        return found;
      });
    });
  }

  /** Administrator password reset. Signs the account out everywhere. */
  function resetPassword(userId, newPassword) {
    var found = App.Store.userById(userId);
    if (!found) return Promise.reject(new Error('That account could not be found.'));

    return App.Crypto.hashPassword(newPassword).then(function (record) {
      found.passwordSalt = record.salt;
      found.passwordHash = record.hash;
      found.passwordIterations = record.iterations;
      found.updatedAt = new Date().toISOString();
      App.Store.putUser(found);
      if (currentUser && currentUser.id === userId) currentUser = null;
      return found;
    });
  }

  App.Auth = {
    user: user,
    isAdmin: isAdmin,
    initials: initials,
    register: register,
    createWithRole: createWithRole,
    login: login,
    logout: logout,
    changePassword: changePassword,
    resetPassword: resetPassword,
    SESSION_HOURS: SESSION_HOURS
  };
})(window.App);