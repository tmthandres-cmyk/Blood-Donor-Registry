/* ==========================================================================
   validate.js - field-level input validation
   --------------------------------------------------------------------------
   Every rule returns a sentence a non-technical person can act on. The same
   rules are used by the tests, so the UI and the test suite cannot drift.
   ========================================================================== */
window.App = window.App || {};

(function (App) {
  'use strict';

  function text(body, name) {
    var v = body[name];
    return typeof v === 'string' ? v.trim() : '';
  }

  function isEmail(value) {
    if (!value) return false;
    if (value.length > 190) return false;
    return /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(value);
  }

  function isPhone(value) {
    if (!value) return true;             // optional
    var digits = value.replace(/[^0-9]/g, '');
    return digits.length >= 7 && digits.length <= 15;
  }

  /** Returns an error message, or null when the password is acceptable. */
  function passwordPolicy(password) {
    if (!password) return 'Please choose a password.';
    if (password.length < 8) return 'Your password must be at least 8 characters long.';
    if (password.length > 128) return 'Your password is too long (maximum 128 characters).';
    if (!/[A-Za-z]/.test(password)) return 'Your password must contain at least one letter.';
    if (!/[0-9]/.test(password)) return 'Your password must contain at least one number.';
    if (!/[^A-Za-z0-9]/.test(password)) {
      return 'Your password must contain at least one special character (for example ! @ # %).';
    }
    return null;
  }

  /** Strict yyyy-MM-dd. Returns a Date, or null when the text is not valid. */
  function parseDate(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    // Rejects 2026-02-31, which Date would silently roll over into March.
    if (d.getFullYear() !== Number(m[1]) ||
        d.getMonth() !== Number(m[2]) - 1 ||
        d.getDate() !== Number(m[3])) return null;
    return d;
  }

  function todayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
           '-' + String(d.getDate()).padStart(2, '0');
  }

  function parseNumber(value) {
    if (!value) return null;
    var cleaned = String(value).replace(/[^0-9.]/g, '');
    if (!cleaned) return null;
    var n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  }

  function startOfToday() {
    var d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  // ---------------------------------------------------------------- users --
  function registration(body, mode, currentUserId) {
    var errors = {};
    var values = {
      name: text(body, 'name'),
      email: text(body, 'email'),
      phone: text(body, 'phone'),
      address: text(body, 'address')
    };

    if (!values.name) {
      errors.name = 'Please enter your full name.';
    } else if (values.name.length < 2) {
      errors.name = 'Your name must be at least 2 characters long.';
    } else if (values.name.length > 80) {
      errors.name = 'Your name must be 80 characters or fewer.';
    } else if (!/^[\p{L}' .\-]+$/u.test(values.name)) {
      errors.name = 'Your name may only contain letters, spaces, apostrophes, periods and hyphens.';
    }

    if (!values.email) {
      errors.email = 'Please enter your email address.';
    } else if (!isEmail(values.email)) {
      errors.email = 'That does not look like a valid email address. Example: juan@example.com';
    } else {
      var existing = App.Store.userByEmail(values.email);
      if (mode === 'register' && existing) {
        errors.email = 'An account with this email address already exists. Please sign in instead.';
      }
      if (mode === 'profile' && existing && existing.id !== currentUserId) {
        errors.email = 'That email address is already used by another account.';
      }
    }

    if (values.phone && !isPhone(values.phone)) {
      errors.phone = 'Please enter a valid phone number (7 to 15 digits), or leave it blank.';
    }
    if (values.address.length > 160) {
      errors.address = 'Your address must be 160 characters or fewer.';
    }

    return { errors: errors, values: values };
  }

  function login(body) {
    var errors = {};
    var values = {
      email: text(body, 'email'),
      password: typeof body.password === 'string' ? body.password : ''
    };
    if (!values.email) errors.email = 'Please enter your email address.';
    if (!values.password) errors.password = 'Please enter your password.';
    return { errors: errors, values: values };
  }

  // --------------------------------------------------------------- donors --
  function donor(body, opts) {
    opts = opts || {};
    var isAdmin = !!opts.isAdmin;
    var types = App.Store.BLOOD_TYPES.map(function (b) { return b.value; });
    var statuses = App.Store.DONOR_STATUSES.map(function (s) { return s.value; });

    var errors = {};
    var values = {
      fullName: text(body, 'fullName'),
      bloodType: text(body, 'bloodType'),
      gender: text(body, 'gender'),
      dateOfBirth: text(body, 'dateOfBirth'),
      weightKg: text(body, 'weightKg'),
      phone: text(body, 'phone'),
      email: text(body, 'email'),
      address: text(body, 'address'),
      status: text(body, 'status'),
      notes: text(body, 'notes')
    };

    if (!values.fullName) {
      errors.fullName = 'Please enter the donor\'s full name.';
    } else if (values.fullName.length < 2) {
      errors.fullName = 'The name must be at least 2 characters long.';
    } else if (values.fullName.length > 80) {
      errors.fullName = 'The name must be 80 characters or fewer.';
    } else if (!/^[\p{L}' .\-]+$/u.test(values.fullName)) {
      errors.fullName = 'The name may only contain letters, spaces, apostrophes, periods and hyphens.';
    }

    if (!values.bloodType) {
      errors.bloodType = 'Please choose the donor\'s blood group.';
    } else if (types.indexOf(values.bloodType) < 0) {
      errors.bloodType = 'Please choose a blood group from the list provided.';
    }

    if (!values.gender) {
      errors.gender = 'Please choose a gender.';
    } else if (['Male', 'Female', 'Other'].indexOf(values.gender) < 0) {
      errors.gender = 'Please choose Male, Female or Other.';
    }

    if (!values.dateOfBirth) {
      errors.dateOfBirth = 'Please enter the donor\'s date of birth (YYYY-MM-DD).';
    } else {
      var dob = parseDate(values.dateOfBirth);
      if (!dob) {
        errors.dateOfBirth = 'Please enter the date as YYYY-MM-DD. Example: 1996-04-12';
      } else if (dob > new Date()) {
        errors.dateOfBirth = 'The date of birth cannot be in the future.';
      } else if (dob < new Date(new Date().getFullYear() - 100, 0, 1)) {
        errors.dateOfBirth = 'Please check the date of birth - that is more than 100 years ago.';
      }
    }

    if (!values.weightKg) {
      errors.weightKg = 'Please enter the donor\'s weight in kilograms.';
    } else {
      var weight = parseNumber(values.weightKg);
      if (weight === null) {
        errors.weightKg = 'Please enter weight as a number, for example 65.';
      } else if (weight < 20 || weight > 250) {
        errors.weightKg = 'Please enter a weight between 20 and 250 kilograms.';
      }
    }

    if (!values.phone) {
      errors.phone = 'A contact number is required so the blood bank can reach the donor.';
    } else if (!isPhone(values.phone)) {
      errors.phone = 'Please enter a valid phone number (7 to 15 digits).';
    }

    if (values.email && !isEmail(values.email)) {
      errors.email = 'That does not look like a valid email address, or you can leave it blank.';
    }

    if (values.address.length > 160) {
      errors.address = 'The address must be 160 characters or fewer.';
    }

    if (body.status !== undefined) {
      if (!values.status) {
        errors.status = 'Please choose a registry status.';
      } else if (statuses.indexOf(values.status) < 0) {
        errors.status = 'Please choose a status from the list provided.';
      }
    } else if (isAdmin && !opts.partial) {
      errors.status = 'Please choose a registry status.';
    }

    if (values.notes.length > 1000) {
      errors.notes = 'Notes must be 1,000 characters or fewer.';
    }

    return { errors: errors, values: values };
  }

  // ------------------------------------------------------------ donations --
  function donation(body) {
    var types = App.Store.DONATION_TYPES.map(function (t) { return t.value; });
    var statuses = App.Store.DONATION_STATUSES.map(function (s) { return s.value; });

    var errors = {};
    var values = {
      donorId: text(body, 'donorId'),
      donationDate: text(body, 'donationDate'),
      donationType: text(body, 'donationType'),
      volumeMl: text(body, 'volumeMl'),
      center: text(body, 'center'),
      status: text(body, 'status'),
      notes: text(body, 'notes')
    };

    if (!values.donorId) {
      errors.donorId = 'Please choose the donor this donation belongs to.';
    } else if (!App.Store.donorById(values.donorId)) {
      errors.donorId = 'That donor could not be found in the registry.';
    }

    if (!values.donationDate) {
      errors.donationDate = 'Please enter the donation date (YYYY-MM-DD).';
    } else {
      var when = parseDate(values.donationDate);
      if (!when) {
        errors.donationDate = 'Please enter the date as YYYY-MM-DD. Example: 2026-03-14';
      } else if (when > startOfToday()) {
        errors.donationDate = 'A donation cannot be dated in the future.';
      } else if (when < new Date(new Date().getFullYear() - 40, 0, 1)) {
        errors.donationDate = 'Please check the date - that is more than 40 years ago.';
      }
    }

    if (!values.donationType) {
      errors.donationType = 'Please choose what was donated.';
    } else if (types.indexOf(values.donationType) < 0) {
      errors.donationType = 'Please choose Whole Blood, Plasma or Platelets.';
    }

    if (!values.volumeMl) {
      errors.volumeMl = 'Please enter the volume collected in millilitres.';
    } else {
      var volume = parseNumber(values.volumeMl);
      if (volume === null) {
        errors.volumeMl = 'Please enter the volume as a number, for example 450.';
      } else if (volume < 50 || volume > 700) {
        errors.volumeMl = 'Please enter a volume between 50 and 700 millilitres.';
      }
    }

    if (values.center.length > 120) {
      errors.center = 'The collection centre must be 120 characters or fewer.';
    }

    if (body.status !== undefined) {
      if (!values.status) {
        errors.status = 'Please choose a donation status.';
      } else if (statuses.indexOf(values.status) < 0) {
        errors.status = 'Please choose Completed, Pending or Cancelled.';
      }
    }

    if (values.notes.length > 500) {
      errors.notes = 'Notes must be 500 characters or fewer.';
    }

    return { errors: errors, values: values };
  }

  // ------------------------------------------------------------- requests --
  function request(body) {
    var types = App.Store.BLOOD_TYPES.map(function (b) { return b.value; });
    var urgencies = App.Store.REQUEST_URGENCIES.map(function (u) { return u.value; });
    var statuses = App.Store.REQUEST_STATUSES.map(function (s) { return s.value; });

    var errors = {};
    var values = {
      requesterName: text(body, 'requesterName'),
      bloodType: text(body, 'bloodType'),
      unitsNeeded: text(body, 'unitsNeeded'),
      urgency: text(body, 'urgency'),
      hospital: text(body, 'hospital'),
      patientName: text(body, 'patientName'),
      neededBy: text(body, 'neededBy'),
      contact: text(body, 'contact'),
      notes: text(body, 'notes'),
      status: text(body, 'status')
    };

    if (!values.requesterName) {
      errors.requesterName = 'Please enter the name of the doctor or nurse making the request.';
    } else if (values.requesterName.length < 2) {
      errors.requesterName = 'The requester name must be at least 2 characters long.';
    } else if (values.requesterName.length > 80) {
      errors.requesterName = 'The requester name must be 80 characters or fewer.';
    }

    if (!values.bloodType) {
      errors.bloodType = 'Please choose the blood group that is needed.';
    } else if (types.indexOf(values.bloodType) < 0) {
      errors.bloodType = 'Please choose a blood group from the list provided.';
    }

    if (!values.unitsNeeded) {
      errors.unitsNeeded = 'Please enter how many units are needed.';
    } else {
      var units = parseNumber(values.unitsNeeded);
      if (units === null) {
        errors.unitsNeeded = 'Please enter a whole number, for example 2.';
      } else if (units < 1 || units > 50) {
        errors.unitsNeeded = 'A request must be between 1 and 50 units.';
      } else if (Math.floor(units) !== units) {
        errors.unitsNeeded = 'Units must be a whole number. Please remove the decimal part.';
      }
    }

    if (!values.urgency) {
      errors.urgency = 'Please choose how urgent the request is.';
    } else if (urgencies.indexOf(values.urgency) < 0) {
      errors.urgency = 'Please choose Emergency, Urgent or Routine.';
    }

    if (!values.hospital) {
      errors.hospital = 'Please enter the hospital or blood bank that needs the blood.';
    } else if (values.hospital.length > 120) {
      errors.hospital = 'The hospital name must be 120 characters or fewer.';
    }

    if (values.patientName.length > 120) {
      errors.patientName = 'The patient reference must be 120 characters or fewer.';
    }

    if (!values.neededBy) {
      errors.neededBy = 'Please enter the date the blood is needed by.';
    } else {
      var needed = parseDate(values.neededBy);
      if (!needed) {
        errors.neededBy = 'Please enter the date as YYYY-MM-DD. Example: 2026-04-01';
      } else if (needed < new Date(startOfToday().getTime() - 86400000)) {
        errors.neededBy = 'The needed-by date is in the past. Please check the date.';
      } else if (needed > new Date(startOfToday().getTime() + 366 * 86400000)) {
        errors.neededBy = 'Please enter a date within the next year.';
      }
    }

    if (values.contact && !isPhone(values.contact)) {
      errors.contact = 'Please enter a valid contact number (7 to 15 digits), or leave it blank.';
    }

    if (body.status !== undefined) {
      if (!values.status) {
        errors.status = 'Please choose a request status.';
      } else if (statuses.indexOf(values.status) < 0) {
        errors.status = 'Please choose Requested, Approved, Fulfilled or Cancelled.';
      }
    }

    if (values.notes.length > 1000) {
      errors.notes = 'Notes must be 1,000 characters or fewer.';
    }

    return { errors: errors, values: values };
  }

  App.Validate = {
    isEmail: isEmail,
    isPhone: isPhone,
    passwordPolicy: passwordPolicy,
    parseDate: parseDate,
    parseNumber: parseNumber,
    todayIso: todayIso,
    registration: registration,
    login: login,
    donor: donor,
    donation: donation,
    request: request
  };
})(window.App);