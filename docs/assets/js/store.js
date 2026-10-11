/* ==========================================================================
   store.js - the data layer
   --------------------------------------------------------------------------
   GitHub Pages serves static files only, so there is no database server. The
   registry is kept in localStorage and mirrored in memory, which makes reads
   synchronous and keeps the view code simple.

   Everything in App.Store is therefore *this browser's* copy. Two people on
   two devices do not see each other's records. The Export / Import tools in
   "Data tools" are the honest way to move records between devices.

   Password material never leaves Crypto: an account keeps only a salt, a
   derived key and the iteration count. No plain-text password is ever written.
   ========================================================================== */
window.App = window.App || {};

(function (App) {
  'use strict';

  var STORAGE_KEY = 'bdr.db.v1';
  var SCHEMA_VERSION = 1;

  // --------------------------------------------------------- domain data --
  var BLOOD_TYPES = [
    { value: 'O-',  label: 'O negative',   hint: 'Universal donor - can give red cells to every blood type' },
    { value: 'O+',  label: 'O positive',   hint: 'Can give to O+, A+, B+ and AB+' },
    { value: 'A-',  label: 'A negative',   hint: 'Can give to A-, A+, AB- and AB+' },
    { value: 'A+',  label: 'A positive',   hint: 'Can give to A+ and AB+' },
    { value: 'B-',  label: 'B negative',   hint: 'Can give to B-, B+, AB- and AB+' },
    { value: 'B+',  label: 'B positive',   hint: 'Can give to B+ and AB+' },
    { value: 'AB-', label: 'AB negative',  hint: 'Can receive red cells from every blood type' },
    { value: 'AB+', label: 'AB positive',  hint: 'Can receive red cells from every blood type' }
  ];

  // Row = donor group, column = recipient group.
  var COMPATIBILITY = {
    'O-':  ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
    'O+':  ['O+', 'A+', 'B+', 'AB+'],
    'A-':  ['A-', 'A+', 'AB-', 'AB+'],
    'A+':  ['A+', 'AB+'],
    'B-':  ['B-', 'B+', 'AB-', 'AB+'],
    'B+':  ['B+', 'AB+'],
    'AB-': ['AB-', 'AB+'],
    'AB+': ['AB+']
  };

  var DONOR_STATUSES = [
    { value: 'Active',       hint: 'Cleared and welcome to donate' },
    { value: 'Inactive',     hint: 'Temporarily not donating' },
    { value: 'Deferral',     hint: 'Temporarily deferred after screening' },
    { value: 'Disqualified', hint: 'No longer eligible to donate' }
  ];

  var DONATION_TYPES = [
    { value: 'Whole Blood', hint: 'The standard donation - about 450 ml of whole blood' },
    { value: 'Plasma',      hint: 'Apheresis donation of plasma only' },
    { value: 'Platelets',   hint: 'Apheresis donation of platelets only' }
  ];

  var DONATION_STATUSES = [
    { value: 'Completed', hint: 'Donation was carried out and units were collected' },
    { value: 'Pending',   hint: 'Booked but not yet done' },
    { value: 'Cancelled', hint: 'The appointment was cancelled' }
  ];

  var REQUEST_URGENCIES = [
    { value: 'Emergency', hint: 'Needed within 24 hours - life threatening' },
    { value: 'Urgent',    hint: 'Needed within 3 days' },
    { value: 'Routine',   hint: 'Needed within a week or more' }
  ];

  var REQUEST_STATUSES = [
    { value: 'Requested', hint: 'Waiting for the blood bank to match donors' },
    { value: 'Approved',  hint: 'Confirmed and donors have been alerted' },
    { value: 'Fulfilled', hint: 'Units were issued to the hospital' },
    { value: 'Cancelled', hint: 'The request was withdrawn' }
  ];

  var RULES = {
    minDonorAge: 18,
    maxDonorAge: 65,
    minWeightKg: 50,
    donateAfterDays: 90
  };

  var mirror = null;
  var saveError = '';

  // ---------------------------------------------------------------- store --
  function emptyDb() {
    return {
      meta: { schemaVersion: SCHEMA_VERSION, createdAt: new Date().toISOString() },
      users: [],
      donors: [],
      donations: [],
      requests: [],
      activityLog: [],
      counters: { donor: 0, donation: 0, request: 0 }
    };
  }

  function load() {
    if (mirror) return mirror;

    var raw = null;
    try { raw = window.localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }

    if (raw) {
      try {
        mirror = JSON.parse(raw);
        repair();
        return mirror;
      } catch (e) {
        console.warn('The saved registry was unreadable and has been reset.', e);
      }
    }

    mirror = emptyDb();
    save();
    return mirror;
  }

  function repair() {
    var fresh = emptyDb();
    Object.keys(fresh).forEach(function (key) {
      if (mirror[key] === undefined || mirror[key] === null) mirror[key] = fresh[key];
    });
    ['users', 'donors', 'donations', 'requests', 'activityLog'].forEach(function (key) {
      if (!Array.isArray(mirror[key])) mirror[key] = [];
    });
    if (typeof mirror.counters !== 'object' || mirror.counters === null) {
      mirror.counters = { donor: 0, donation: 0, request: 0 };
    }
    ['donor', 'donation', 'request'].forEach(function (key) {
      if (typeof mirror.counters[key] !== 'number') mirror.counters[key] = 0;
    });
  }

  function save() {
    try {
      var payload = JSON.stringify(mirror);
      window.localStorage.setItem(STORAGE_KEY, payload);
      // Verify the write actually landed: private browsing modes and full
      // quotas both report success while discarding the data.
      if (window.localStorage.getItem(STORAGE_KEY) !== payload) {
        throw new Error('write verification failed');
      }
      saveError = '';
      return true;
    } catch (e) {
      console.error('Could not save the registry', e);
      saveError = 'This browser is refusing to store data (private browsing, or storage is full).';
      return false;
    }
  }

  function isAvailable() {
    try {
      var probe = '__bdr_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return true;
    } catch (e) { return false; }
  }

  function storageError() { return saveError; }

  // ------------------------------------------------------------ counters --
  function nextReference(kind, prefix) {
    var data = load();
    data.counters[kind] = (data.counters[kind] || 0) + 1;
    save();
    return prefix + '-' + new Date().getFullYear() + '-' +
      String(data.counters[kind]).padStart(4, '0');
  }

  // ---------------------------------------------------------------- users --
  function allUsers() { return load().users.slice(); }

  function userById(id) {
    var list = load().users;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function userByEmail(email) {
    var needle = String(email || '').trim().toLowerCase();
    if (!needle) return null;
    var list = load().users;
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].email || '').toLowerCase() === needle) return list[i];
    }
    return null;
  }

  function putUser(user) {
    var data = load();
    var index = -1;
    for (var i = 0; i < data.users.length; i++) {
      if (data.users[i].id === user.id) { index = i; break; }
    }
    if (index >= 0) data.users[index] = user; else data.users.push(user);
    save();
    return user;
  }

  function deleteUser(id) {
    var data = load();
    var donor = donorByUserId(id);
    if (donor) {
      data.donations = data.donations.filter(function (d) { return d.donorId !== donor.id; });
      data.donors = data.donors.filter(function (d) { return d.id !== donor.id; });
    }
    data.users = data.users.filter(function (u) { return u.id !== id; });
    save();
  }

  function isAdmin(user) { return !!user && user.role === 'admin'; }

  function activeAdminCount() {
    return load().users.filter(function (u) {
      return u.role === 'admin' && u.active !== false;
    }).length;
  }

  // --------------------------------------------------------------- donors --
  function allDonors() { return load().donors.slice(); }

  function donorById(id) {
    var list = load().donors;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function donorByUserId(userId) {
    if (!userId) return null;
    var list = load().donors;
    for (var i = 0; i < list.length; i++) if (list[i].linkedUserId === userId) return list[i];
    return null;
  }

  function putDonor(donor) {
    var data = load();
    var index = -1;
    for (var i = 0; i < data.donors.length; i++) {
      if (data.donors[i].id === donor.id) { index = i; break; }
    }
    if (index >= 0) data.donors[index] = donor; else data.donors.push(donor);
    save();
    return donor;
  }

  function deleteDonor(id) {
    var data = load();
    data.donations = data.donations.filter(function (d) { return d.donorId !== id; });
    data.donors = data.donors.filter(function (d) { return d.id !== id; });
    save();
  }

  function donorsByBloodType(bloodType, eligibleOnly) {
    var matches = allDonors().filter(function (d) { return d.bloodType === bloodType; });
    if (eligibleOnly) {
      matches = matches.filter(function (d) { return App.Eligibility.test(d).eligible; });
    }
    return matches;
  }

  function eligibleDonorCount(bloodType) {
    return donorsByBloodType(bloodType, true).length;
  }

  // ----------------------------------------------------------- donations --
  function allDonations() { return load().donations.slice(); }

  function donationById(id) {
    var list = load().donations;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function donationsForDonor(donorId) {
    return allDonations().filter(function (d) { return d.donorId === donorId; });
  }

  function putDonation(donation) {
    var data = load();
    var index = -1;
    for (var i = 0; i < data.donations.length; i++) {
      if (data.donations[i].id === donation.id) { index = i; break; }
    }
    if (index >= 0) data.donations[index] = donation; else data.donations.push(donation);
    save();
    syncDonorFromDonations(donation.donorId);
    return donation;
  }

  function deleteDonation(id) {
    var existing = donationById(id);
    if (!existing) return;
    var data = load();
    data.donations = data.donations.filter(function (d) { return d.id !== id; });
    save();
    syncDonorFromDonations(existing.donorId);
  }

  /**
   * Recomputes totalDonations and lastDonationDate from the donation log so the
   * two can never drift apart. Called after any donation is added or removed.
   */
  function syncDonorFromDonations(donorId) {
    var donor = donorById(donorId);
    if (!donor) return null;

    var completed = donationsForDonor(donorId).filter(function (d) {
      return d.status === 'Completed';
    });

    donor.totalDonations = completed.length;

    if (completed.length > 0) {
      var latest = completed.reduce(function (acc, d) {
        var t = new Date(d.donationDate).getTime();
        return (!acc || t > acc.t) ? t : acc;
      }, 0);
      donor.lastDonationDate = latest ? new Date(latest).toISOString() : '';
    } else {
      donor.lastDonationDate = '';
    }

    donor.updatedAt = new Date().toISOString();
    return putDonor(donor);
  }

  // ------------------------------------------------------------ requests --
  function allRequests() { return load().requests.slice(); }

  function requestById(id) {
    var list = load().requests;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function putRequest(request) {
    var data = load();
    var index = -1;
    for (var i = 0; i < data.requests.length; i++) {
      if (data.requests[i].id === request.id) { index = i; break; }
    }
    if (index >= 0) data.requests[index] = request; else data.requests.push(request);
    save();
    return request;
  }

  function deleteRequest(id) {
    var data = load();
    data.requests = data.requests.filter(function (r) { return r.id !== id; });
    save();
  }

  // ---------------------------------------------------------------- stats --
  function donorStats() {
    var all = allDonors();
    var byType = {};
    BLOOD_TYPES.forEach(function (bt) { byType[bt.value] = 0; });

    var eligible = 0;
    var added = new Date(Date.now() - 30 * 86400000);
    var newThisMonth = 0;

    all.forEach(function (d) {
      if (byType[d.bloodType] !== undefined) byType[d.bloodType] += 1;
      if (App.Eligibility.test(d).eligible) eligible += 1;
      if (new Date(d.createdAt) > added) newThisMonth += 1;
    });

    return {
      total: all.length,
      active: all.filter(function (d) { return d.status === 'Active'; }).length,
      eligible: eligible,
      byType: byType,
      newThisMonth: newThisMonth
    };
  }

  function donationStats() {
    var all = allDonations();
    var done = all.filter(function (d) { return d.status === 'Completed'; });
    var thisYear = new Date().getFullYear();
    return {
      total: all.length,
      completed: done.length,
      pending: all.filter(function (d) { return d.status === 'Pending'; }).length,
      units: done.reduce(function (sum, d) { return sum + App.Eligibility.requiredUnits(d.donationType); }, 0),
      thisYear: done.filter(function (d) {
        return new Date(d.donationDate).getFullYear() === thisYear;
      }).length
    };
  }

  function requestStats() {
    var all = allRequests();
    var open = all.filter(function (r) {
      return r.status === 'Requested' || r.status === 'Approved';
    });
    return {
      total: all.length,
      open: open.length,
      emergency: open.filter(function (r) { return r.urgency === 'Emergency'; }).length,
      fulfilled: all.filter(function (r) { return r.status === 'Fulfilled'; }).length,
      unitsOutstanding: open.reduce(function (sum, r) { return sum + (Number(r.unitsNeeded) || 0); }, 0)
    };
  }

  // ------------------------------------------------------------ activity --
  function logActivity(action, actorId, detail) {
    var data = load();
    data.activityLog.unshift({
      id: App.Crypto.randomId('log'),
      actorId: actorId || '',
      action: action,
      detail: detail || '',
      createdAt: new Date().toISOString()
    });
    if (data.activityLog.length > 200) data.activityLog = data.activityLog.slice(0, 200);
    save();
  }

  function allActivity() { return load().activityLog.slice(); }

  // ------------------------------------------------------- export/import --
  function exportJson() {
    var data = load();
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      source: 'browser-localstorage',
      schemaVersion: SCHEMA_VERSION,
      users: data.users,
      donors: data.donors,
      donations: data.donations,
      requests: data.requests,
      activityLog: data.activityLog,
      counters: data.counters
    }, null, 2);
  }

  function importJson(text) {
    var parsed;
    try { parsed = JSON.parse(text); }
    catch (e) { throw new Error('That file is not valid JSON.'); }
    if (!parsed || typeof parsed !== 'object') throw new Error('That file is not a registry export.');
    if (!Array.isArray(parsed.users) || !Array.isArray(parsed.donors)) {
      throw new Error('That file is missing the users or donors list.');
    }

    var data = load();
    data.users = parsed.users;
    data.donors = parsed.donors;
    data.donations = Array.isArray(parsed.donations) ? parsed.donations : [];
    data.requests = Array.isArray(parsed.requests) ? parsed.requests : [];
    data.activityLog = Array.isArray(parsed.activityLog) ? parsed.activityLog : [];
    data.counters = parsed.counters || { donor: 0, donation: 0, request: 0 };
    save();

    return {
      users: data.users.length,
      donors: data.donors.length,
      donations: data.donations.length,
      requests: data.requests.length
    };
  }

  /** Clears records but keeps the accounts, so you keep your login. */
  function resetRecords() {
    var data = load();
    data.donors = [];
    data.donations = [];
    data.requests = [];
    data.activityLog = [];
    data.counters = { donor: 0, donation: 0, request: 0 };
    save();
  }

  /**
   * DESTROYS the registry: drops the in-memory mirror AND deletes the stored
   * copy. Named for what it does rather than something like clear(), because
   * calling the wrong one silently loses every donor record in the browser.
   * Use the Data tools "Reset" action, which confirms first, to trigger it.
   */
  function wipe() {
    mirror = null;
    try { window.localStorage.removeItem(STORAGE_KEY); } catch (e) { }
  }

  App.Store = {
    STORAGE_KEY: STORAGE_KEY,
    BLOOD_TYPES: BLOOD_TYPES,
    COMPATIBILITY: COMPATIBILITY,
    DONOR_STATUSES: DONOR_STATUSES,
    DONATION_TYPES: DONATION_TYPES,
    DONATION_STATUSES: DONATION_STATUSES,
    REQUEST_URGENCIES: REQUEST_URGENCIES,
    REQUEST_STATUSES: REQUEST_STATUSES,
    RULES: RULES,

    load: load,
    save: save,
    wipe: wipe,
    isAvailable: isAvailable,
    storageError: storageError,
    nextReference: nextReference,
    resetRecords: resetRecords,

    allUsers: allUsers,
    userById: userById,
    userByEmail: userByEmail,
    putUser: putUser,
    deleteUser: deleteUser,
    isAdmin: isAdmin,
    activeAdminCount: activeAdminCount,

    allDonors: allDonors,
    donorById: donorById,
    donorByUserId: donorByUserId,
    putDonor: putDonor,
    deleteDonor: deleteDonor,
    donorsByBloodType: donorsByBloodType,
    eligibleDonorCount: eligibleDonorCount,

    allDonations: allDonations,
    donationById: donationById,
    donationsForDonor: donationsForDonor,
    putDonation: putDonation,
    deleteDonation: deleteDonation,
    syncDonorFromDonations: syncDonorFromDonations,

    allRequests: allRequests,
    requestById: requestById,
    putRequest: putRequest,
    deleteRequest: deleteRequest,

    donorStats: donorStats,
    donationStats: donationStats,
    requestStats: requestStats,

    logActivity: logActivity,
    allActivity: allActivity,
    exportJson: exportJson,
    importJson: importJson
  };
})(window.App);