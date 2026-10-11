/* ==========================================================================
   views/donations.js - donation history CRUD
   Every change re-syncs the donor's totals and next-due date.
   ========================================================================== */
window.App = window.App || {};

(function (App) {
  'use strict';

  var esc = App.UI.esc;

  function donationList(ctx) {
    var user = App.Auth.user();
    var isAdmin = App.Store.isAdmin(user);

    var scopeId = '';
    if (!isAdmin) {
      var mine = App.Store.donorByUserId(user.id);
      if (!mine) {
        return {
          title: 'My donations',
          nav: 'donations',
          html: App.UI.pageIntro({
              eyebrow: 'History', heading: 'My donations',
              sub: 'Every donation you have made will be listed here with the date, type and volume collected.'
            }) + '<section class="card">' + App.UI.emptyState({
              icon: '&#128137;', title: 'No donor profile yet',
              message: 'Create your donor profile first, then you will be able to record the donations you have already made.',
              action: '<a class="btn btn-primary" href="#/donors/new">Create my donor profile</a>'
            }) + '</section>'
        };
      }
      scopeId = mine.id;
    }

    var search = (ctx.query.q || '').toLowerCase();
    var type = ctx.query.type || '';

    var all = isAdmin ? App.Store.allDonations() : App.Store.donationsForDonor(scopeId);

    if (search) {
      all = all.filter(function (d) {
        return String(d.donorName).toLowerCase().indexOf(search) >= 0 ||
               String(d.referenceNo).toLowerCase().indexOf(search) >= 0 ||
               String(d.center).toLowerCase().indexOf(search) >= 0;
      });
    }
    if (App.Store.BLOOD_TYPES.some(function (b) { return b.value === type; })) {
      all = all.filter(function (d) { return d.bloodType === type; });
    }
    all.sort(function (a, b) { return new Date(b.donationDate) - new Date(a.donationDate); });

    var page = App.Views.pageState(all.length, ctx.query.page);
    var slice = all.slice(page.offset, page.offset + App.Layout.CONFIG.pageSize);
    var stats = App.Store.donationStats();

    var qs = [];
    if (ctx.query.q) qs.push('q=' + encodeURIComponent(ctx.query.q));
    if (type) qs.push('type=' + encodeURIComponent(type));
    var baseQuery = qs.length ? '?' + qs.join('&') : '';

    var filterHtml = isAdmin
      ? '<form class="filter-bar" data-filter-form>' +
          '<div class="filter-search">' +
            '<label class="visually-hidden" for="q">Search donations</label>' +
            '<input class="field-input" type="search" id="q" name="q" value="' + esc(ctx.query.q || '') +
            '" placeholder="Search donor, reference or centre">' +
          '</div>' +
          '<div class="filter-selects">' +
            App.UI.selectField('type', 'Blood group', App.Store.BLOOD_TYPES, type, null,
              { placeholder: 'All groups', labelFn: function (b) { return b.label; } }) +
            '<button class="btn btn-primary" type="submit">Filter</button>' +
            '<a class="btn btn-ghost" href="#/donations">Reset</a>' +
          '</div>' +
        '</form>'
      : '';

    var listHtml = slice.length
      ? slice.map(function (d) { return App.UI.donationRow(d, user); }).join('')
      : App.UI.emptyState({
          icon: '&#128137;', title: 'No donations found',
          message: 'Nothing matches these filters yet. Record a donation to start building the history.'
        });

    var statRow = [
      App.UI.statTile('Donation records', stats.total, 'brand'),
      App.UI.statTile('Completed', stats.completed, 'success'),
      App.UI.statTile('Pending', stats.pending, 'warning'),
      App.UI.statTile('Units this year', stats.thisYear, 'info')
    ].join('');

    var heading = isAdmin ? 'All donations' : 'My donations';

    return {
      title: heading,
      nav: 'donations',
      html:
        App.UI.pageIntro({
          eyebrow: 'History', heading: heading,
          sub: 'Each record is a single donation: the date, what was collected and how much. Totals and next-due dates are recalculated automatically.',
          actions: '<a class="btn btn-primary" href="#/donations/new">Record a donation</a>'
        }) +
        '<div class="stat-row">' + statRow + '</div>' +
        '<section class="card card-flush">' + filterHtml +
          '<div class="row-list">' + listHtml + '</div>' +
        '</section>' +
        App.UI.pagination(page.page, page.totalPages, '/donations' + baseQuery),
      onMount: function (root) { wireDonationFilter(root, '/donations'); }
    };
  }

  // ----------------------------------------------------------------- form --
  function donationForm(ctx) {
    var user = App.Auth.user();
    var isAdmin = App.Store.isAdmin(user);
    var id = ctx.params.id;
    var existing = id ? App.Store.donationById(id) : null;

    if (id && !existing) {
      return App.Views.errorPage({
        code: 404, heading: 'Donation not found',
        message: 'That donation record does not exist. It may have been deleted.'
      });
    }
    if (existing && !isAdmin && !canManage(existing, user)) {
      return App.Views.errorPage({
        code: 403, heading: 'This record is not yours',
        message: 'You can only view and manage the donation history linked to your own donor profile.'
      });
    }

    var v = prefill(existing, user);

    var donorFieldHtml;
    if (isAdmin) {
      donorFieldHtml = App.UI.selectField('donorId', 'Donor',
        App.Store.allDonors().sort(function (a, b) {
          return String(a.fullName).localeCompare(String(b.fullName));
        }).map(function (d) {
          return { value: d.id, label: d.fullName + '  -  ' + d.bloodType + '  -  ' + d.referenceNo };
        }),
        v.donorId, ctx.data.errors, {
          required: true,
          labelFn: function (item) { return item.label; },
          hint: 'The blood group is copied from the donor profile.'
        });
    } else {
      var mine = App.Store.donorByUserId(user.id);
      donorFieldHtml =
        '<div class="field"><span class="field-label">Donor</span>' +
        '<p class="field-static">' + esc(mine ? mine.fullName : 'Your profile') +
        (mine ? ' <span class="muted-text">(' + esc(mine.bloodType) + ')</span>' : '') + '</p>' +
        App.UI.hiddenField('donorId', mine ? mine.id : '') + '</div>';
    }

    var isEdit = !!existing;
    var title = isEdit ? 'Edit donation record' : 'Record a donation';
    var submit = isEdit ? 'Save changes' : 'Add to history';
    var action = isEdit ? '#/donations/' + encodeURIComponent(id) + '/edit' : '#/donations/new';

    return {
      title: title,
      nav: 'donations',
      html:
        App.UI.pageIntro({
          eyebrow: isEdit ? 'History' : 'New record',
          heading: title,
          sub: isEdit
            ? 'Correct a record in the donation log.'
            : 'Log a donation so the donor\'s total and next-due date stay accurate.',
          actions: '<a class="btn btn-ghost" href="#/donations">Back</a>'
        }) +
        '<div class="form-layout">' +
          '<section class="card card-form">' +
            App.UI.errorSummary(ctx.data.errors) +
            '<form class="form-stack" data-form="donation" novalidate>' +
              donorFieldHtml +
              App.UI.textField('donationDate', 'Donation date', v.donationDate, ctx.data.errors,
                { required: true, type: 'date' }) +
              App.UI.selectField('donationType', 'What was donated', App.Store.DONATION_TYPES,
                v.donationType, ctx.data.errors, {
                  required: true, labelFn: function (t) { return t.value + ' - ' + t.hint; }
                }) +
              App.UI.textField('volumeMl', 'Volume collected (ml)', v.volumeMl, ctx.data.errors,
                { required: true, hint: 'A standard whole blood donation is about 450 ml.' }) +
              App.UI.textField('center', 'Collection centre', v.center, ctx.data.errors,
                { maxlength: 120, placeholder: 'Where the blood was collected' }) +
              App.UI.selectField('status', 'Status', App.Store.DONATION_STATUSES,
                v.status, ctx.data.errors, { required: true, labelFn: function (s) { return s.value; } }) +
              App.UI.textareaField('notes', 'Notes', v.notes, ctx.data.errors,
                { rows: 3, placeholder: 'Reactions, deferral reasons (optional)' }) +
              '<div class="form-actions">' +
                '<button class="btn btn-primary" type="submit">' + esc(submit) + '</button>' +
                '<a class="btn btn-ghost" href="#/donations">Cancel</a>' +
              '</div>' +
            '</form>' +
          '</section>' +
          '<aside class="card card-aside">' +
            '<h2 class="aside-title">What happens when you save</h2>' +
            '<ul class="steps steps-plain">' +
              '<li>The record is added to the donor\'s history with a reference number.</li>' +
              '<li>The donor\'s <strong>total donations</strong> and <strong>last donation date</strong> are recalculated.</li>' +
              '<li>Their <strong>next donation due date</strong> is recomputed from the 90-day recovery rule.</li>' +
              '<li>If the donation falls outside the recovery window, screening says so.</li>' +
            '</ul>' +
          '</aside>' +
        '</div>',
      onMount: function (root) { bindDonationForm(root, existing, isAdmin, user); }
    };
  }

  function prefill(existing, user) {
    if (existing) {
      return {
        donorId: existing.donorId,
        donationDate: (existing.donationDate || '').slice(0, 10),
        donationType: existing.donationType,
        volumeMl: existing.volumeMl,
        center: existing.center,
        status: existing.status,
        notes: existing.notes
      };
    }
    var mine = user ? App.Store.donorByUserId(user.id) : null;
    return {
      donorId: mine ? mine.id : '',
      donationDate: App.Validate.todayIso(),
      donationType: 'Whole Blood',
      volumeMl: '450',
      center: App.Layout.CONFIG.bloodCenter,
      status: 'Completed',
      notes: ''
    };
  }

  function bindDonationForm(root, existing, isAdmin, user) {
    var form = root.querySelector('[data-form="donation"]');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var body = App.Views.readForm(form);

      if (!isAdmin) {
        var mine = App.Store.donorByUserId(user.id);
        if (!mine) {
          App.Router.resolve({ data: { errors: { donorId: 'Create your donor profile before recording a donation.' } } });
          return;
        }
        // Force the donor onto their own record, whatever was posted.
        body.donorId = mine.id;
      }

      var result = App.Validate.donation(body);
      if (Object.keys(result.errors).length) {
        App.Router.resolve({ data: result });
        return;
      }

      var v = result.values;
      var donor = App.Store.donorById(v.donorId);

      if (existing) {
        var oldDonorId = existing.donorId;
        Object.keys(v).forEach(function (key) {
          if (key === 'donorId') existing.donorId = donor.id; else existing[key] = v[key];
        });
        existing.donorName = donor.fullName;
        existing.bloodType = donor.bloodType;
        App.Store.putDonation(existing);
        App.Store.syncDonorFromDonations(oldDonorId);
        if (oldDonorId !== donor.id) App.Store.syncDonorFromDonations(donor.id);

        App.Store.logActivity('donation.update', user.id, 'Updated ' + existing.referenceNo);
        App.Layout.setFlash('Donation ' + existing.referenceNo + ' has been updated.', 'success');
        return App.Router.go('/donations');
      }

      var record = {
        id: App.Crypto.randomId('dnt'),
        referenceNo: App.Store.nextReference('donation', 'BDN'),
        donorId: donor.id,
        donorName: donor.fullName,
        bloodType: donor.bloodType,
        donationDate: v.donationDate,
        donationType: v.donationType,
        volumeMl: v.volumeMl,
        center: v.center,
        status: v.status,
        notes: v.notes,
        recordedBy: user.id,
        createdAt: new Date().toISOString()
      };
      App.Store.putDonation(record);
      App.Store.logActivity('donation.create', user.id,
        'Recorded ' + record.referenceNo + ' for ' + donor.fullName);

      App.Layout.setFlash('Donation ' + record.referenceNo + ' has been recorded. Thank you, ' +
        donor.fullName + '.', 'success');
      App.Router.go('/donations');
    });
  }

  // --------------------------------------------------------------- delete --
  function donationDelete(ctx) {
    var user = App.Auth.user();
    var existing = App.Store.donationById(ctx.params.id);

    if (!existing) {
      return App.Views.errorPage({
        code: 404, heading: 'Donation not found',
        message: 'That donation record does not exist. It may already have been deleted.'
      });
    }
    if (!canManage(existing, user)) {
      return App.Views.errorPage({
        code: 403, heading: 'This record is not yours',
        message: 'You can only manage the donation history linked to your own donor profile.'
      });
    }

    return {
      title: 'Delete donation',
      nav: 'donations',
      html:
        App.UI.pageIntro({
          eyebrow: 'Confirm deletion',
          heading: 'Delete this donation record?',
          sub: 'Please check the details below before you continue.'
        }) +
        '<section class="card card-danger">' +
          '<div class="confirm-summary">' + App.UI.bloodBadge(existing.bloodType) +
            '<div><p class="confirm-name">' + esc(existing.donorName) + '</p>' +
            '<p class="confirm-meta">' + esc(existing.referenceNo) + ' &middot; ' +
            esc(existing.donationType) + ' &middot; ' + esc(App.UI.formatDate(existing.donationDate)) +
            ' &middot; ' + esc(existing.volumeMl) + ' ml</p></div>' +
          '</div>' +
          '<div class="alert alert-warning"><span class="alert-icon" aria-hidden="true">&#9888;</span>' +
            '<div><strong>This will change the donor\'s totals.</strong>' +
            '<p class="alert-text">The total, last donation date and next due date are recalculated without this record.</p>' +
            '</div></div>' +
          '<div class="form-actions">' +
            '<button class="btn btn-danger" type="button" data-delete-donation="' + esc(existing.id) + '">' +
              'Yes, delete this record</button>' +
            '<a class="btn btn-ghost" href="#/donations">Cancel, keep the record</a>' +
          '</div>' +
        '</section>',
      onMount: function (root) {
        var button = root.querySelector('[data-delete-donation]');
        if (!button) return;
        button.addEventListener('click', function () {
          App.UI.confirmDialog({
            title: 'Delete this donation record?',
            message: 'Delete donation ' + existing.referenceNo + '? The donor\'s totals will be recalculated.',
            confirmLabel: 'Yes, delete'
          }).then(function (ok) {
            if (!ok) return;
            var reference = existing.referenceNo;
            App.Store.deleteDonation(existing.id);
            App.Store.logActivity('donation.delete', user.id, 'Deleted ' + reference);
            App.Layout.setFlash('Donation ' + reference + ' has been deleted.', 'success');
            App.Router.go('/donations');
          });
        });
      }
    };
  }

  // ------------------------------------------------------------- helpers --
  function canManage(donation, user) {
    if (!donation || !user) return false;
    if (App.Store.isAdmin(user)) return true;
    var donor = App.Store.donorById(donation.donorId);
    return !!donor && donor.linkedUserId === user.id;
  }

  function wireDonationFilter(root, path) {
    var form = root.querySelector('[data-filter-form]');
    if (!form) return;
    function apply() {
      var params = new URLSearchParams();
      Array.prototype.forEach.call(form.querySelectorAll('input, select'), function (el) {
        if (el.name && el.value) params.set(el.name, el.value);
      });
      App.Router.go(path + '?' + params.toString());
    }
    form.addEventListener('submit', function (e) { e.preventDefault(); apply(); });
    Array.prototype.forEach.call(form.querySelectorAll('select'), function (sel) {
      sel.addEventListener('change', apply);
    });
  }

  App.Views = App.Views || {};
  App.Views.donationList = donationList;
  App.Views.donationForm = donationForm;
  App.Views.donationDelete = donationDelete;
})(window.App);