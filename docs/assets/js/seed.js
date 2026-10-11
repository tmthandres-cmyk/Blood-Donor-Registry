/* ==========================================================================
   seed.js - first-run demo data
   --------------------------------------------------------------------------
   The two demo accounts and a realistic starter registry are created the
   first time the app is opened, so the dashboards have something to show.
   Passwords are hashed through the normal Crypto path - nothing is stored as
   text, including these.
   ========================================================================== */
window.App = window.App || {};

(function (App) {
  'use strict';

  var DONORS = [
    { fullName: 'Marco Santos',        bloodType: 'O+',  gender: 'Male',   dateOfBirth: '1996-04-12', weightKg: '72', phone: '0918 555 0177', address: 'Purok 7, Barangay San Isidro',    lastDays: 210, total: 4, link: 'donor' },
    { fullName: 'Angela Reyes',        bloodType: 'A-',  gender: 'Female', dateOfBirth: '1999-09-03', weightKg: '58', phone: '0917 555 0233', address: 'Mabini St., Antipolo City',         lastDays: 120, total: 2, link: '' },
    { fullName: 'Josefina Alonzo-Cruz',bloodType: 'B+',  gender: 'Female', dateOfBirth: '1978-11-21', weightKg: '64', phone: '0920 555 0311', address: 'Gen. Santos Ave., Antipolo City',   lastDays: 40,  total: 9, link: '' },
    { fullName: 'Ramon Dela Cruz',     bloodType: 'O-',  gender: 'Male',   dateOfBirth: '1991-02-15', weightKg: '81', phone: '0919 555 0442', address: 'Purok 2, Barangay Mambujan',         lastDays: 310, total: 12, link: '' },
    { fullName: 'Grace Lim',           bloodType: 'AB+', gender: 'Female', dateOfBirth: '1986-06-30', weightKg: '55', phone: '0916 555 0519', address: 'Sumulong Highway, Antipolo City',  lastDays: 160, total: 6, link: '' },
    { fullName: 'Pedro Bautista',      bloodType: 'A+',  gender: 'Male',   dateOfBirth: '2001-08-08', weightKg: '68', phone: '0915 555 0664', address: 'Purok 5, Barangay San Isidro',      lastDays: 95,  total: 1, link: '' },
    { fullName: 'Teresa Villanueva',   bloodType: 'B-',  gender: 'Female', dateOfBirth: '1994-01-25', weightKg: '61', phone: '0914 555 0730', address: 'Rizal St., Antipolo City',          lastDays: 82,  total: 3, link: '' },
    { fullName: 'Ricardo Mendoza Jr.', bloodType: 'O+',  gender: 'Male',   dateOfBirth: '1969-03-19', weightKg: '76', phone: '0913 555 0848', address: 'Purok 9, Barangay Caridad',          lastDays: 500, total: 22, link: '' },
    { fullName: 'Nina Ocampo',         bloodType: 'AB-', gender: 'Female', dateOfBirth: '1998-07-07', weightKg: '49', phone: '0912 555 0911', address: 'Katipunan Ave., Antipolo City',      lastDays: 79,  total: 2, link: '' },
    { fullName: 'Luis Gonzaga',        bloodType: 'B+',  gender: 'Male',   dateOfBirth: '2003-05-14', weightKg: '70', phone: '0911 555 1066', address: 'Purok 1, Barangay San Isidro',      lastDays: 30,  total: 1, link: '' },
    { fullName: 'Cristina Abad',       bloodType: 'A+',  gender: 'Female', dateOfBirth: '1983-12-02', weightKg: '66', phone: '0910 555 1122', address: 'M.L. Quezon St., Antipolo City',    lastDays: 260, total: 7, link: '' },
    { fullName: 'Rodel Fernandez',     bloodType: 'O-',  gender: 'Male',   dateOfBirth: '1993-09-27', weightKg: '74', phone: '0909 555 1255', address: 'Purok 4, Barangay Mambujan',         lastDays: 20,  total: 3, link: '' }
  ];

  var REQUESTS = [
    { requesterName: 'Dr. Rafael Aquino', bloodType: 'O-',  unitsNeeded: '3', urgency: 'Emergency', hospital: 'Antipolo General Hospital',  patientName: 'Maria S., 34, PPH', days: 1, status: 'Requested' },
    { requesterName: 'Dr. Liza Tan',     bloodType: 'A+',  unitsNeeded: '2', urgency: 'Urgent',    hospital: 'St. Michael Medical Center', patientName: 'Rico P., 61, surgical', days: 3, status: 'Approved' },
    { requesterName: 'Dr. Ben Soriano',  bloodType: 'B+',  unitsNeeded: '5', urgency: 'Routine',   hospital: 'Montalban Medical Center',   patientName: 'Group booking, chemo unit', days: 7, status: 'Requested' },
    { requesterName: 'Dr. Andrea Lim',   bloodType: 'AB+', unitsNeeded: '1', urgency: 'Emergency', hospital: 'Antipolo General Hospital',  patientName: 'Baby J., newborn',      days: 1, status: 'Fulfilled' }
  ];

  function daysAgo(n) {
    return new Date(Date.now() - n * 86400000).toISOString();
  }

  /** Creates the demo accounts. Safe to call on every load. */
  function ensureAccounts() {
    if (!App.Store.userByEmail('admin@stmichaelblood.org')) {
      return App.Auth.createWithRole({
        name: 'Dr. Elena Villanueva',
        email: 'admin@stmichaelblood.org',
        password: 'Admin@12345',
        role: 'admin',
        phone: '0917 555 0142',
        address: 'St. Michael Blood Center, Antipolo City'
      }).then(function () {
        return App.Auth.createWithRole({
          name: 'Marco Santos',
          email: 'donor@stmichaelblood.org',
          password: 'Donor@12345',
          role: 'donor',
          phone: '0918 555 0177',
          address: 'Purok 7, Barangay San Isidro'
        });
      });
    }
    return Promise.resolve();
  }

  function ensureRegistry() {
    if (App.Store.allDonors().length > 0) return;

    var donorUser = App.Store.userByEmail('donor@stmichaelblood.org');
    var adminUser = App.Store.userByEmail('admin@stmichaelblood.org');
    var adminId = adminUser ? adminUser.id : '';
    var types = ['Whole Blood', 'Whole Blood', 'Plasma', 'Platelets'];

    DONORS.forEach(function (s) {
      var linkedUserId = s.link && donorUser ? donorUser.id : '';
      var record = {
        id: App.Crypto.randomId('don'),
        referenceNo: App.Store.nextReference('donor', 'BDR'),
        fullName: s.fullName,
        bloodType: s.bloodType,
        gender: s.gender,
        dateOfBirth: s.dateOfBirth,
        weightKg: s.weightKg,
        phone: s.phone,
        email: '',
        address: s.address,
        status: 'Active',
        lastDonationDate: s.lastDays < 4000 ? daysAgo(s.lastDays) : '',
        totalDonations: s.total,
        notes: '',
        linkedUserId: linkedUserId,
        selfEditable: linkedUserId ? 'true' : 'false',
        createdAt: daysAgo(400),
        updatedAt: daysAgo(10),
        createdBy: adminId
      };
      App.Store.putDonor(record);

      var count = Math.min(s.total, 4);
      for (var i = 0; i < count; i++) {
        var offset = s.lastDays + (i * 95);
        if (offset > 3000) continue;
        App.Store.putDonation({
          id: App.Crypto.randomId('dnt'),
          referenceNo: App.Store.nextReference('donation', 'BDN'),
          donorId: record.id,
          donorName: s.fullName,
          bloodType: s.bloodType,
          donationDate: daysAgo(offset),
          donationType: types[i % types.length],
          volumeMl: '450',
          center: 'St. Michael Blood Center',
          status: 'Completed',
          notes: '',
          recordedBy: adminId,
          createdAt: daysAgo(offset)
        });
      }
    });

    REQUESTS.forEach(function (r) {
      App.Store.putRequest({
        id: App.Crypto.randomId('req'),
        referenceNo: App.Store.nextReference('request', 'BRS'),
        requesterName: r.requesterName,
        bloodType: r.bloodType,
        unitsNeeded: r.unitsNeeded,
        urgency: r.urgency,
        hospital: r.hospital,
        patientName: r.patientName,
        neededBy: new Date(Date.now() + r.days * 86400000).toISOString(),
        contact: '',
        status: r.status,
        notes: '',
        createdAt: daysAgo(2),
        updatedAt: daysAgo(1),
        createdBy: adminId
      });
    });
  }

  /** Runs on every start; only does work the very first time. */
  function run() {
    return ensureAccounts().then(ensureRegistry).then(function () {
      console.info('LifeLine Blood Donor Registry ready.',
        'Password hashing engine:', App.Crypto.engine().name);
    });
  }

  App.Seed = { run: run, DONORS: DONORS, REQUESTS: REQUESTS };
})(window.App);