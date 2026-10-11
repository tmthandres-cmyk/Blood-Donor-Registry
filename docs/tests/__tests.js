/* ==========================================================================
   tests/__tests.js - behavioural tests for the Blood Donor Registry

   Paste into the browser console on a running site, or run through the
   automated runner (tests/run.html) which loads the app first.

   Usage from the console:
       runTests()
   ========================================================================== */
window.runTests = function runTests(filter) {
  'use strict';

  var T = window.Test;
  T.reset(filter);
  var App = window.App;

  // ------------------------------------------------------------- domain --
  T.test('blood types are the eight groups', function () {
    T.equal(App.Store.BLOOD_TYPES.length, 8);
    T.equal(App.Store.BLOOD_TYPES[0].value, 'O-');
  });

  T.test('O negative is compatible with every group', function () {
    T.equal(App.Store.COMPATIBILITY['O-'].length, 8);
  });

  T.test('AB positive can only give to AB positive', function () {
    var gives = App.Store.COMPATIBILITY['AB+'];
    T.equal(gives.length, 1);
    T.equal(gives[0], 'AB+');
  });

  T.test('compatibility is symmetric in size', function () {
    var pairs = [['O-', 8], ['O+', 4], ['A-', 4], ['A+', 2], ['B-', 4], ['B+', 2], ['AB-', 2], ['AB+', 1]];
    pairs.forEach(function (p) {
      T.equal(App.Store.COMPATIBILITY[p[0]].length, p[1], p[0] + ' compatibility');
    });
  });

  // -------------------------------------------------------- eligibility --
  T.test('an adult of good weight with no history is eligible', function () {
    var check = App.Eligibility.test({
      bloodType: 'O+', dateOfBirth: '1995-06-15', weightKg: '70', status: 'Active', lastDonationDate: ''
    });
    T.assert(check.eligible, 'should be eligible: ' + check.blocking.join('; '));
  });

  T.test('a 16 year old is not eligible, and is told why', function () {
    var check = App.Eligibility.test({
      bloodType: 'O+', dateOfBirth: '2015-06-15', weightKg: '70', status: 'Active', lastDonationDate: ''
    });
    T.assert(!check.eligible);
    T.assert(check.blocking.join(' ').indexOf('18 years old') >= 0, 'mentions the minimum age');
  });

  T.test('a donor under 50 kg is not eligible', function () {
    var check = App.Eligibility.test({
      bloodType: 'O+', dateOfBirth: '1995-06-15', weightKg: '45', status: 'Active', lastDonationDate: ''
    });
    T.assert(!check.eligible);
    T.assert(check.blocking.join(' ').indexOf('50 kg') >= 0);
  });

  T.test('a donor inside the 90 day window is not eligible and gets a due date', function () {
    var check = App.Eligibility.test({
      bloodType: 'O+', dateOfBirth: '1995-06-15', weightKg: '70', status: 'Active',
      lastDonationDate: new Date(Date.now() - 30 * 86400000).toISOString()
    });
    T.assert(!check.eligible);
    T.assert(check.blocking.join(' ').indexOf('90 days') >= 0);
    T.assert(check.nextDate > new Date(), 'next date is in the future');
  });

  T.test('a donor past 90 days is eligible again', function () {
    var check = App.Eligibility.test({
      bloodType: 'O+', dateOfBirth: '1995-06-15', weightKg: '70', status: 'Active',
      lastDonationDate: new Date(Date.now() - 120 * 86400000).toISOString()
    });
    T.assert(check.eligible, check.blocking.join('; '));
  });

  T.test('a deferred donor is not eligible', function () {
    var check = App.Eligibility.test({
      bloodType: 'O+', dateOfBirth: '1995-06-15', weightKg: '70', status: 'Deferral', lastDonationDate: ''
    });
    T.assert(!check.eligible);
    T.assert(check.blocking.join(' ').toLowerCase().indexOf('deferred') >= 0);
  });

  T.test('a donor with no blood group is not eligible', function () {
    var check = App.Eligibility.test({
      bloodType: '', dateOfBirth: '1995-06-15', weightKg: '70', status: 'Active', lastDonationDate: ''
    });
    T.assert(!check.eligible);
    T.assert(check.blocking.join(' ').indexOf('blood group') >= 0);
  });

  T.test('age is calculated correctly around a birthday', function () {
    var now = new Date();
    var born = new Date(now.getFullYear() - 30, now.getMonth(), now.getDate());
    T.equal(App.Eligibility.age({ dateOfBirth: born.toISOString().slice(0, 10) }), 30);
  });

  // ---------------------------------------------------------- validation --
  T.test('registration rejects a short name', function () {
    var r = App.Validate.registration({ name: 'A', email: 'a@b.com' }, 'register');
    T.assert(r.errors.name, 'name error present');
  });

  T.test('registration rejects a malformed email', function () {
    var r = App.Validate.registration({ name: 'Test User', email: 'nope' }, 'register');
    T.assert(r.errors.email);
  });

  T.test('registration rejects a duplicate email', function () {
    var r = App.Validate.registration(
      { name: 'Test User', email: 'admin@stmichaelblood.org' }, 'register');
    T.assert(r.errors.email && /already exists/i.test(r.errors.email));
  });

  T.test('password policy requires length, letter, number and symbol', function () {
    T.assert(App.Validate.passwordPolicy('short'));
    T.assert(App.Validate.passwordPolicy('alllettersonly'));
    T.assert(App.Validate.passwordPolicy('Passw0rd'));
    T.equal(App.Validate.passwordPolicy('Passw0rd!'), null);
  });

  T.test('an impossible date is rejected rather than rolled over', function () {
    T.equal(App.Validate.parseDate('2026-02-31'), null);
    T.assert(App.Validate.parseDate('2026-02-28'));
  });

  T.test('a non-ISO date format is rejected', function () {
    T.equal(App.Validate.parseDate('15/06/1995'), null);
    T.equal(App.Validate.parseDate('June 15 1995'), null);
  });

  T.test('donor validation rejects every bad field at once', function () {
    var r = App.Validate.donor({
      fullName: 'X', bloodType: 'ZZ', gender: 'Alien',
      dateOfBirth: '05/06/1995', weightKg: 'abc', phone: '1', status: 'Bogus'
    }, { isAdmin: true });
    ['fullName', 'bloodType', 'gender', 'dateOfBirth', 'weightKg', 'phone', 'status']
      .forEach(function (f) {
        T.assert(r.errors[f], 'expected an error for ' + f);
      });
  });

  T.test('donor validation rejects a future date of birth', function () {
    var r = App.Validate.donor({
      fullName: 'Future Person', bloodType: 'O+', gender: 'Male',
      dateOfBirth: '2099-01-01', weightKg: '70', phone: '09170000000', status: 'Active'
    }, { isAdmin: true });
    T.assert(r.errors.dateOfBirth && /future/i.test(r.errors.dateOfBirth));
  });

  T.test('donation validation rejects a future date', function () {
    var donor = App.Store.allDonors()[0];
    var r = App.Validate.donation({
      donorId: donor.id, donationDate: '2099-01-01',
      donationType: 'Gold', volumeMl: '99999', status: 'Completed'
    });
    T.assert(r.errors.donationDate);
    T.assert(r.errors.donationType);
    T.assert(r.errors.volumeMl);
  });

  T.test('request validation rejects bad units, urgency and past date', function () {
    var r = App.Validate.request({
      requesterName: '', bloodType: 'Q+', unitsNeeded: '0',
      urgency: 'Whenever', hospital: '', neededBy: '2001-01-01'
    });
    T.assert(r.errors.requesterName);
    T.assert(r.errors.bloodType);
    T.assert(r.errors.unitsNeeded);
    T.assert(r.errors.urgency);
    T.assert(r.errors.hospital);
    T.assert(r.errors.neededBy);
  });

  T.test('request validation rejects fractional units', function () {
    var r = App.Validate.request({
      requesterName: 'Dr. Test', bloodType: 'O+', unitsNeeded: '2.5',
      urgency: 'Urgent', hospital: 'Test Hospital', neededBy: App.Validate.todayIso()
    });
    T.assert(r.errors.unitsNeeded && /whole number/i.test(r.errors.unitsNeeded));
  });

  // ------------------------------------------------------------- storage --
  T.test('the store seeds a usable demo registry', function () {
    T.assert(App.Store.allDonors().length >= 12, 'expected seeded donors');
    T.assert(App.Store.allUsers().length >= 2, 'expected seeded accounts');
    T.assert(App.Store.allRequests().length >= 4, 'expected seeded requests');
  });

  T.test('reference numbers are generated per year', function () {
    var ref = App.Store.nextReference('donor', 'BDR');
    T.assert(/^BDR-\d{4}-\d{4}$/.test(ref), 'unexpected format: ' + ref);
  });

  // ---------------------------------------------------------------- auth --
  T.test('passwords are never stored in plain text', function () {
    var users = App.Store.allUsers();
    users.forEach(function (u) {
      T.assert(u.passwordHash && u.passwordHash.length > 20, 'hash present for ' + u.email);
      T.assert(u.passwordSalt && u.passwordSalt.length > 10, 'salt present for ' + u.email);
      T.assert(u.passwordHash.indexOf('Admin@12345') < 0, 'hash is not the password');
      T.equal(u.password, undefined, 'no plain password column');
    });
  });

  T.test('the raw storage blob contains no seeded password', function () {
    var raw = window.localStorage.getItem(App.Store.STORAGE_KEY);
    T.assert(raw.indexOf('Admin@12345') < 0, 'seeded password must not be in storage');
    T.assert(raw.indexOf('Donor@12345') < 0, 'donor password must not be in storage');
  });

  return T.summary();
};