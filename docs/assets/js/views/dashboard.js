/* ==========================================================================
   views/dashboard.js - role-aware dashboards plus profile and password pages
   ========================================================================== */
window.App = window.App || {};

(function (App) {
  'use strict';

  var esc = App.UI.esc;

  function openRequestsHtml(user, limit) {
    var open = App.Store.allRequests().filter(function (r) {
      return r.status === 'Requested' || r.status === 'Approved';
    }).sort(function (a, b) {
      return (({ Emergency: 0, Urgent: 1, Routine: 2 })[a.urgency] || 2) -
             (({ Emergency: 0, Urgent: 1, Routine: 2 })[b.urgency] || 2);
    }).slice(0, limit);

    if (!open.length) {
      return App.UI.emptyState({
        icon: '&#10003;', title: 'No open requests',
        message: 'Every blood request has been dealt with. New ones will appear here.'
      });
    }
    return open.map(function (r) { return App.UI.requestRow(r, user); }).join('');
  }

  // -------------------------------------------------------- admin version --
  function adminDashboard(user) {
    var stats = App.Store.donorStats();
    var donations = App.Store.donationStats();

    var coverageRows = App.Store.BLOOD_TYPES.map(function (b) {
      var count = stats.byType[b.value];
      var eligible = App.Store.eligibleDonorCount(b.value);
      var pct = count ? Math.round((eligible / count) * 100) : 0;
      var flag = eligible === 0 ? ' <span class="badge badge-danger">No donors</span>' : '';
      return '<div class="cov-row">' + App.UI.bloodBadge(b.value) +
        '<span class="cov-bar"><span class="cov-fill ' + App.UI.bloodTypeTone(b.value) +
        '" style="width:' + pct + '%"></span></span>' +
        '<span class="cov-count">' + esc(eligible + ' / ' + count + ' eligible') + flag + '</span></div>';
    }).join('');

    // Donors still inside their recovery window whose next donation falls due
    // within a fortnight. The guard must exclude donors who are ALREADY
    // eligible: for those, intervalDays - daysSince is negative, which would
    // print nonsense like "in -410 day(s)".
    var expiring = App.Store.allDonors().filter(function (d) {
      var s = App.Eligibility.test(d);
      if (s.eligible) return false;
      var remaining = s.intervalDays - s.daysSince;
      return remaining >= 0 && remaining <= 14;
    }).sort(function (a, b) {
      return new Date(a.lastDonationDate) - new Date(b.lastDonationDate);
    }).slice(0, 5);

    var expiringHtml = expiring.length
      ? '<div class="table-wrap"><table class="data-table"><thead><tr>' +
        '<th scope="col">Donor</th><th scope="col">Group</th>' +
        '<th scope="col">Last donation</th><th scope="col">Next due</th>' +
        '</tr></thead><tbody>' + expiring.map(function (d) {
          var s = App.Eligibility.test(d);
          var days = Math.round(s.intervalDays - s.daysSince);
          var label = days <= 0 ? 'due now' : 'in ' + days + ' day(s)';
          return '<tr>' +
            '<td><a href="#/donors/' + encodeURIComponent(d.id) + '">' + esc(d.fullName) + '</a></td>' +
            '<td>' + App.UI.bloodBadge(d.bloodType) + '</td>' +
            '<td>' + esc(App.UI.formatDate(d.lastDonationDate)) + '</td>' +
            '<td><span class="badge badge-info">' + esc(label) + '</span></td></tr>';
        }).join('') + '</tbody></table></div>'
      : App.UI.emptyState({
          icon: '&#128269;', title: 'Nobody becomes eligible in the next two weeks',
          message: 'Donors whose 90-day recovery window ends soon will appear here, ready for an invitation.'
        });

    var log = App.Store.allActivity().slice(0, 8);
    var logHtml = log.length
      ? '<ul class="log-list">' + log.map(function (entry) {
          var who = 'system';
          if (entry.actorId) {
            var actor = App.Store.userById(entry.actorId);
            if (actor) who = actor.name;
          }
          return '<li class="log-item"><span class="log-dot" aria-hidden="true"></span><div>' +
            '<p class="log-text">' + esc(entry.detail) + '</p>' +
            '<p class="log-meta">' + esc(who) + ' &middot; ' + esc(App.UI.formatDateTime(entry.createdAt)) +
            '</p></div></li>';
        }).join('') + '</ul>'
      : '<p class="muted-text">No activity recorded yet.</p>';

    var statRow = [
      App.UI.statTile('Registered donors', stats.total, 'brand'),
      App.UI.statTile('Eligible now', stats.eligible, 'success'),
      App.UI.statTile('Open requests', App.Store.requestStats().open, 'warning'),
      App.UI.statTile('Units collected', donations.units, 'info')
    ].join('');

    return {
      title: 'Dashboard',
      nav: 'dashboard',
      html:
        App.UI.pageIntro({
          eyebrow: 'Overview', heading: 'Blood bank dashboard',
          sub: 'Live figures from the registry: who is eligible, which groups are short, and what patients still need.',
          actions: '<a class="btn btn-primary" href="#/donors/new">Add donor</a>'
        }) +
        '<div class="stat-row">' + statRow + '</div>' +
        '<div class="dash-grid">' +
          '<section class="card">' +
            '<div class="card-head"><h2 class="card-title">Donor coverage by group</h2>' +
            '<a class="card-link" href="#/donors">Open registry</a></div>' +
            '<p class="card-sub">Eligible donors out of total registered, for each blood group.</p>' +
            '<div class="cov-list">' + coverageRows + '</div>' +
          '</section>' +
          '<section class="card">' +
            '<div class="card-head"><h2 class="card-title">Open blood requests</h2>' +
            '<a class="card-link" href="#/requests">See all</a></div>' +
            '<div class="row-list">' + openRequestsHtml(user, 5) + '</div>' +
          '</section>' +
        '</div>' +
        '<div class="dash-grid">' +
          '<section class="card">' +
            '<h2 class="card-title">Donors becoming eligible soon</h2>' +
            '<p class="card-sub">Their 90-day recovery window ends within two weeks - a good moment to send an invitation.</p>' +
            expiringHtml +
          '</section>' +
          '<section class="card"><h2 class="card-title">Recent activity</h2>' + logHtml + '</section>' +
        '</div>'
    };
  }

  // -------------------------------------------------------- donor version --
  function donorDashboard(user) {
    var mine = App.Store.donorByUserId(user.id);

    if (!mine) {
      return {
        title: 'Dashboard',
        nav: 'dashboard',
        html:
          App.UI.pageIntro({
            eyebrow: 'Welcome', heading: 'Hello, ' + user.name,
            sub: 'You are signed in as a donor. Complete your donor profile so the blood bank can screen you and alert you when your group is needed.'
          }) +
          '<section class="card">' + App.UI.emptyState({
            icon: '&#128137;', title: 'One step left',
            message: 'Your donor profile needs your blood group, date of birth and weight. It takes about a minute.',
            action: '<a class="btn btn-primary" href="#/donors/new">Create my donor profile</a>'
          }) + '</section>' +
          '<section class="card"><h2 class="card-title">Open blood requests</h2>' +
            '<div class="row-list">' + openRequestsHtml(user, 4) + '</div></section>'
      };
    }

    var check = App.Eligibility.test(mine);
    var path = '#/donors/' + encodeURIComponent(mine.id);
    var donations = App.Store.donationsForDonor(mine.id);

    var eligibilityHtml = check.eligible
      ? '<div class="elig-panel elig-ok"><span class="elig-icon" aria-hidden="true">&#10003;</span><div>' +
        '<p class="elig-title">You are cleared to donate</p>' +
        '<p class="elig-text">Your next donation is due <strong>now</strong>. Bring a valid ID and eat a light meal beforehand.</p>' +
        '</div></div>'
      : '<div class="elig-panel elig-blocked"><span class="elig-icon" aria-hidden="true">&#33;</span><div>' +
        '<p class="elig-title">You cannot donate right now</p><ul class="elig-list">' +
        check.blocking.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') +
        '</ul></div></div>';

    var matching = App.Store.allRequests().filter(function (r) {
      return r.bloodType === mine.bloodType &&
             (r.status === 'Requested' || r.status === 'Approved');
    });
    var matchHtml = matching.length
      ? matching.map(function (r) { return App.UI.requestRow(r, user); }).join('')
      : App.UI.emptyState({
          icon: '&#10003;', title: 'No open requests for your group',
          message: 'Nothing needs ' + mine.bloodType + ' right now. We will alert you the moment it does.'
        });

    var canGive = App.Store.COMPATIBILITY[mine.bloodType] || [];
    var chips = canGive.length
      ? canGive.map(function (t) { return App.UI.bloodBadge(t); }).join('')
      : '<span class="muted-text">Not recorded</span>';

    var recent = donations.sort(function (a, b) {
      return new Date(b.donationDate) - new Date(a.donationDate);
    }).slice(0, 4);
    var recentHtml = recent.length
      ? recent.map(function (d) { return App.UI.donationRow(d, user, { compact: true }); }).join('')
      : App.UI.emptyState({
          icon: '&#128137;', title: 'No donations recorded yet',
          message: 'Record the donations you have already made so your history is complete.'
        });

    var statRow = [
      App.UI.statTile('Total donations', mine.totalDonations || 0, 'brand'),
      App.UI.statTile('My blood group', mine.bloodType, 'danger'),
      App.UI.statTile('Days since last', check.daysSince, 'info'),
      App.UI.statTile('Next eligible', App.Eligibility.formatDate(check.nextDate), 'success')
    ].join('');

    return {
      title: 'Dashboard',
      nav: 'dashboard',
      html:
        App.UI.pageIntro({
          eyebrow: 'Dashboard', heading: 'Welcome back, ' + user.name,
          sub: 'Your donor record, your eligibility and the patients currently waiting for your blood group.',
          actions: '<a class="btn btn-primary" href="#/donations/new">Record a donation</a>'
        }) +
        eligibilityHtml +
        '<div class="stat-row">' + statRow + '</div>' +
        '<div class="dash-grid">' +
          '<section class="card"><h2 class="card-title">Your donor record</h2>' +
            App.UI.factsGrid([
              ['Reference', mine.referenceNo],
              ['Blood group', mine.bloodType, 'raw'],
              ['Status', mine.status, 'raw'],
              ['Can donate to', chips, 'raw']
            ], true) +
            '<div class="button-row">' +
              '<a class="btn btn-outline" href="' + path + '">View my profile</a>' +
              '<a class="btn btn-outline" href="' + path + '/edit">Edit my details</a>' +
            '</div>' +
          '</section>' +
          '<section class="card">' +
            '<div class="card-head"><h2 class="card-title">Matching your group</h2>' +
            '<span class="card-count">' + matching.length + ' open</span></div>' +
            '<div class="row-list">' + matchHtml + '</div>' +
          '</section>' +
        '</div>' +
        '<section class="card">' +
          '<div class="card-head"><h2 class="card-title">Recent donations</h2>' +
          '<a class="card-link" href="#/donations">See all</a></div>' +
          '<div class="row-list">' + recentHtml + '</div>' +
        '</section>'
    };
  }

  function dashboard() {
    var user = App.Auth.user();
    return App.Store.isAdmin(user) ? adminDashboard(user) : donorDashboard(user);
  }

  // -------------------------------------------------------------- profile --
  function profile(ctx) {
    var user = App.Auth.user();
    var errors = ctx.data.errors || {};
    var v = ctx.data.values || {
      name: user.name, email: user.email, phone: user.phone, address: user.address
    };

    var mine = App.Store.donorByUserId(user.id);
    var donorCard = '';
    if (mine) {
      donorCard = '<section class="card"><h2 class="card-title">Linked donor record</h2>' +
        App.UI.factsGrid([
          ['Reference', mine.referenceNo],
          ['Blood group', mine.bloodType, 'raw'],
          ['Eligibility', App.UI.eligibilityChip(mine), 'raw'],
          ['Total donations', String(mine.totalDonations || 0)]
        ], true) +
        '<div class="button-row"><a class="btn btn-outline" href="#/donors/' +
        encodeURIComponent(mine.id) + '">View donor profile</a></div></section>';
    }

    var engine = App.Crypto.engine();

    return {
      title: 'My profile',
      nav: '',
      html:
        App.UI.pageIntro({
          eyebrow: 'Account', heading: 'My profile',
          sub: 'Your sign-in details. Your blood group and clinical information live on the donor record, not here.',
          actions: '<a class="btn btn-outline" href="#/profile/password">Change password</a>'
        }) +
        '<div class="form-layout">' +
          '<section class="card card-form">' +
            App.UI.errorSummary(errors) +
            '<form class="form-stack" data-form="profile" novalidate>' +
              App.UI.textField('name', 'Full name', v.name, errors,
                { required: true, maxlength: 80 }) +
              App.UI.textField('email', 'Email address', v.email, errors,
                { required: true, type: 'email' }) +
              App.UI.textField('phone', 'Mobile number', v.phone, errors, { type: 'tel' }) +
              App.UI.textField('address', 'Address / barangay', v.address, errors, { maxlength: 160 }) +
              '<div class="form-actions">' +
                '<button class="btn btn-primary" type="submit">Save changes</button>' +
                '<a class="btn btn-ghost" href="#/dashboard">Cancel</a>' +
              '</div>' +
            '</form>' +
          '</section>' +
          '<aside class="card card-aside"><h2 class="aside-title">Account</h2>' +
            '<ul class="rule-list">' +
              '<li>Role: <strong>' + (App.Store.isAdmin(user) ? 'Administrator' : 'Donor') + '</strong></li>' +
              '<li>Member since ' + esc(App.UI.formatDate(user.createdAt)) + '</li>' +
              '<li>Last sign in: ' + esc(user.lastLoginAt ? App.UI.formatDateTime(user.lastLoginAt) : 'This is your first sign in.') + '</li>' +
            '</ul>' +
            (engine.strong ? '' :
              '<p class="aside-note"><strong>Note:</strong> ' + esc(engine.note || '') + '</p>') +
          '</aside>' +
        '</div>' + donorCard,
      onMount: function (root) {
        var form = root.querySelector('[data-form="profile"]');
        if (!form) return;
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var body = App.Views.readForm(form);
          var result = App.Validate.registration(body, 'profile', user.id);
          if (Object.keys(result.errors).length) {
            App.Router.resolve({ data: result });
            return;
          }
          user.name = result.values.name;
          user.email = result.values.email.toLowerCase();
          user.phone = result.values.phone;
          user.address = result.values.address;
          user.updatedAt = new Date().toISOString();
          App.Store.putUser(user);

          if (mine) {
            mine.phone = user.phone;
            mine.email = user.email;
            mine.address = user.address;
            App.Store.putDonor(mine);
          }

          App.Store.logActivity('profile.update', user.id, 'Updated own profile');
          App.Layout.setFlash('Your profile has been updated.', 'success');
          App.Router.go('/profile');
        });
      }
    };
  }

  // ------------------------------------------------------ change password --
  function changePassword(ctx) {
    var user = App.Auth.user();
    var errors = ctx.data.errors || {};
    var engine = App.Crypto.engine();

    return {
      title: 'Change password',
      nav: '',
      html:
        App.UI.pageIntro({
          eyebrow: 'Security', heading: 'Change your password',
          sub: 'Choose a new password you have not used before.',
          actions: '<a class="btn btn-ghost" href="#/profile">Back to profile</a>'
        }) +
        '<div class="form-layout">' +
          '<section class="card card-form">' +
            App.UI.errorSummary(errors) +
            '<form class="form-stack" data-form="password" novalidate>' +
              App.UI.textField('currentPassword', 'Current password', '', errors,
                { required: true, type: 'password', autofocus: true }) +
              App.UI.textField('newPassword', 'New password', '', errors,
                { required: true, type: 'password',
                  hint: 'At least 8 characters, with a letter, a number and a symbol.' }) +
              App.UI.textField('confirmPassword', 'Confirm new password', '', errors,
                { required: true, type: 'password' }) +
              '<div class="form-actions">' +
                '<button class="btn btn-primary" type="submit">Change password</button>' +
                '<a class="btn btn-ghost" href="#/profile">Cancel</a>' +
              '</div>' +
            '</form>' +
          '</section>' +
          '<aside class="card card-aside"><h2 class="aside-title">How your password is stored</h2>' +
            '<p class="aside-note">Your password is never saved as text. It is converted with ' +
            esc(engine.algorithm) + ' using a unique random salt and ' +
            esc(engine.iterations.toLocaleString()) + ' rounds, and only that result is written to storage. ' +
            'Nobody can read your password.</p></aside>' +
        '</div>',
      onMount: function (root) {
        var form = root.querySelector('[data-form="password"]');
        if (!form) return;
        App.Views.wireStrength(form);

        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var body = App.Views.readForm(form);
          var errors = {};

          var problem = App.Validate.passwordPolicy(body.newPassword || '');
          if (problem) errors.newPassword = problem;
          if (body.newPassword !== body.confirmPassword) {
            errors.confirmPassword = 'The two new passwords do not match. Please retype them.';
          }

          if (Object.keys(errors).length) {
            App.Router.resolve({ data: { errors: errors } });
            return;
          }

          App.UI.busy(true);
          App.Auth.changePassword(user.id, body.currentPassword, body.newPassword)
            .then(function () {
              App.UI.busy(false);
              App.Layout.setFlash('Your password has been changed.', 'success');
              App.Router.go('/profile');
            })
            .catch(function (error) {
              App.UI.busy(false);
              App.Router.resolve({ data: { errors: error.errors || { form: error.message } } });
            });
        });
      }
    };
  }

  App.Views = App.Views || {};
  App.Views.dashboard = dashboard;
  App.Views.profile = profile;
  App.Views.changePassword = changePassword;
})(window.App);