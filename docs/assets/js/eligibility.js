/* ==========================================================================
   eligibility.js - donor screening rules
   --------------------------------------------------------------------------
   Eligibility is *derived* from the donor's age, weight, last donation date
   and registry status, so a record can never drift out of sync with the
   clinical rules. Every blocking reason is reported separately so a donor is
   told exactly what is wrong rather than a bare pass/fail.
   ========================================================================== */
window.App = window.App || {};

(function (App) {
  'use strict';

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  /** Whole years since the date of birth. -1 when unknown or in the future. */
  function age(donor) {
    if (!donor || !donor.dateOfBirth) return -1;
    var dob = new Date(donor.dateOfBirth);
    if (isNaN(dob.getTime())) return -1;

    var today = new Date();
    var a = today.getFullYear() - dob.getFullYear();
    var m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) a -= 1;
    return dob > today ? -1 : a;
  }

  /** Whole days since the last completed donation. 999 when never donated. */
  function daysSinceLastDonation(donor) {
    if (!donor || !donor.lastDonationDate) return 999;
    var last = new Date(donor.lastDonationDate);
    if (isNaN(last.getTime())) return 999;
    var today = new Date();
    return Math.floor(
      (new Date(today.getFullYear(), today.getMonth(), today.getDate()) -
       new Date(last.getFullYear(), last.getMonth(), last.getDate())) / 86400000
    );
  }

  function nextEligibleDate(donor) {
    var interval = App.Store.RULES.donateAfterDays;
    var days = daysSinceLastDonation(donor);
    if (days >= interval) return new Date();

    var last = new Date(donor.lastDonationDate);
    if (isNaN(last.getTime())) return new Date();
    var next = new Date(last.getFullYear(), last.getMonth(), last.getDate());
    next.setDate(next.getDate() + interval);
    return next;
  }

  /**
   * Screens one donor. Returns:
   *   { eligible, blocking[], advisories[], age, weightKg, daysSince,
   *     intervalDays, nextDate }
   */
  function test(donor) {
    var rules = App.Store.RULES;
    var minAge = rules.minDonorAge;
    var maxAge = rules.maxDonorAge;
    var minWeight = rules.minWeightKg;
    var interval = rules.donateAfterDays;

    var blocking = [];
    var advisories = [];

    var years = age(donor);
    var weight = parseFloat(String(donor.weightKg).replace(/[^0-9.]/g, ''));
    if (isNaN(weight)) weight = 0;
    var days = daysSinceLastDonation(donor);

    // --- age ---------------------------------------------------------------
    if (years < 0) {
      blocking.push('A valid date of birth is required before screening.');
    } else if (years < minAge) {
      blocking.push('You must be at least ' + minAge + ' years old to donate. You can donate in ' +
        (minAge - years) + ' year(s), on your ' + minAge + 'th birthday.');
    } else if (years > maxAge) {
      blocking.push('The upper age limit for routine donation is ' + maxAge +
        ' years. Donors above this age may still donate by special arrangement with the blood bank.');
    }

    // --- weight -----------------------------------------------------------
    if (weight <= 0) {
      blocking.push('A body weight is required before screening.');
    } else if (weight < minWeight) {
      blocking.push('You must weigh at least ' + minWeight + ' kg. Please record your current weight.');
    }

    // --- registry status ---------------------------------------------------
    var status = donor.status;
    if (status === 'Disqualified') {
      blocking.push('This donor has been permanently disqualified by the blood bank.');
    } else if (status === 'Deferral') {
      blocking.push('This donor is currently deferred. Please contact the blood bank to review the deferral.');
    } else if (status === 'Inactive') {
      blocking.push('This donor is marked as inactive. Set the status back to Active once they wish to donate again.');
    } else if (status !== 'Active') {
      blocking.push('This donor record has an unknown status and must be reviewed by an administrator.');
    }

    // --- recovery interval --------------------------------------------------
    if (days < interval) {
      var next = nextEligibleDate(donor);
      blocking.push('Whole blood may be donated once every ' + interval + ' days. Your next donation is due on ' +
        formatDate(next) + ' (' + (interval - days) + ' day(s) from now).');
    }

    // --- blood group ---------------------------------------------------------
    var types = App.Store.BLOOD_TYPES.map(function (b) { return b.value; });
    if (types.indexOf(donor.bloodType) < 0) {
      blocking.push('A confirmed blood group is required before a donor can be matched to a patient.');
    }

    // --- advisories (do not block) ---------------------------------------------
    if (weight >= minWeight && weight < 55) {
      advisories.push('Close to the minimum weight - only one unit may be collected and the donor is screened more carefully.');
    }

    return {
      eligible: blocking.length === 0,
      blocking: blocking,
      advisories: advisories,
      age: years,
      weightKg: weight,
      daysSince: days,
      intervalDays: interval,
      nextDate: nextEligibleDate(donor)
    };
  }

  /** "12 Mar 2026", locale-independent so it never shows US ordering. */
  function formatDate(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return '-';
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return pad(date.getDate()) + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
  }

  /** How many whole-blood units a completed donation is worth. */
  function requiredUnits(donationType) {
    return donationType === 'Whole Blood' ? 1 : 0;
  }

  App.Eligibility = {
    age: age,
    daysSinceLastDonation: daysSinceLastDonation,
    nextEligibleDate: nextEligibleDate,
    test: test,
    requiredUnits: requiredUnits,
    formatDate: formatDate
  };
})(window.App);