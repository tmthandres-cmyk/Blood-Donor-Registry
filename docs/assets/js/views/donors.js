/* ==========================================================================
   views/donors.js - the core entity: full Create / Read / Update / Delete
   --------------------------------------------------------------------------
   Access rules
     Administrator : full CRUD on every donor record
     Donor         : read own record, edit own contact details only
   ========================================================================== */
window.App = window.App || {};

(function (App) {
  'use strict';

  var esc = App.UI.esc;

  // ----------------------------------------------------------------- list --
  function donorList(ctx) {
    var user = App.Auth.user();
    if (!App.Store.isAdmin(user)) return donorListForSelf(user);

    var stats = App.Store.donorStats();
    var search = (ctx.query.q || '').toLowerCase();
    var type = ctx.query.type || '';
    var status = ctx.query.status || '';
    var sort = ctx.query.sort || 'name';

    var all = App.Store.allDonors();

    if (search) {
      all = all.filter(function (d) {
        return String(d.fullName).toLowerCase().indexOf(search) >= 0 ||
               String(d.referenceNo).toLowerCase().indexOf(search) >= 0 ||
               String(d.phone).indexOf(ctx.query.q) >= 0;
      });
    }
    if (App.Store.BLOOD_TYPES.some(function (b) { return b.value === type; })) {
      all = all.filter(function (d) { return d.bloodType === type; });
    }
    if (App.Store.DONOR_STATUSES.some(function (s) { return s.value === status; })) {
      all = all.filter(function (d) { return d.status === status; });
    }

    all.sort(function (a, b) {
      if (sort === 'recent') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sort === 'donation') return new Date(b.lastDonationDate || 0) - new Date(a.lastDonationDate || 0);
      return String(a.fullName).localeCompare(String(b.fullName));
    });

    var page = pageState(all.length, ctx.query.page);
    var slice = all.slice(page.offset, page.offset + App.Layout.CONFIG.pageSize);

    var qs = [];
    if (ctx.query.q) qs.push('q=' + encodeURIComponent(ctx.query.q));
    if (type) qs.push('type=' + encodeURIComponent(type));
    if (status) qs.push('status=' + encodeURIComponent(status));
    if (sort !== 'name') qs.push('sort=' + encodeURIComponent(sort));
    var baseQuery = qs.length ? '?' + qs.join('&') : '';

    var filterHtml =
      '<form class="filter-bar" data-filter-form>' +
        '<div class="filter-search">' +
          '<label class="visually-hidden" for="q">Search donors</label>' +
          '<input class="field-input" type="search" id="q" name="q" value="' + esc(ctx.query.q || '') +
          '" placeholder="Search name, reference or phone">' +
        '</div>' +
        '<div class="filter-selects">' +
          App.UI.selectField('type', 'Blood group', App.Store.BLOOD_TYPES, type,
            null, { placeholder: 'All groups', labelFn: function (b) { return b.value + ' - ' + b.label; } }) +
          App.UI.selectField('status', 'Status', App.Store.DONOR_STATUSES, status,
            null, { placeholder: 'All statuses', labelFn: function (s) { return s.value; } }) +
          '<div class="field"><label class="field-label" for="sort">Sort by</label>' +
            '<select class="field-input field-select" id="sort" name="sort">' +
              option('name', 'Name A-Z', sort) + option('recent', 'Newest first', sort) +
              option('donation', 'Last donation', sort) +
            '</select></div>' +
          '<button class="btn btn-primary" type="submit">Filter</button>' +
          '<a class="btn btn-ghost" href="#/donors">Reset</a>' +
        '</div>' +
      '</form>';

    var listHtml = slice.length
      ? slice.map(function (d) { return App.UI.donorRow(d, user); }).join('')
      : App.UI.emptyState({
          icon: '&#128269;',
          title: 'No donors match your filters',
          message: 'Try clearing the search box or choosing a different blood group and status.',
          action: '<a class="btn btn-outline" href="#/donors">Clear filters</a>'
        });

    var statRow = [
      App.UI.statTile('Registered donors', stats.total, 'brand'),
      App.UI.statTile('Eligible to donate', stats.eligible, 'success', 'Passes every screening rule'),
      App.UI.statTile('Active records', stats.active, 'info'),
      App.UI.statTile('Added this month', stats.newThisMonth, 'neutral')
    ].join('');

    return {
      title: 'Donor registry',
      nav: 'donors',
      html:
        App.UI.pageIntro({
          eyebrow: 'Registry',
          heading: 'Donor registry',
          sub: 'Every donor known to the blood center. Screening is recalculated automatically for each record.',
          actions: '<a class="btn btn-primary" href="#/donors/new">Add donor</a>'
        }) +
        '<div class="stat-row">' + statRow + '</div>' +
        '<section class="card card-flush">' + filterHtml +
          '<div class="row-list">' + listHtml + '</div>' +
        '</section>' +
        App.UI.pagination(page.page, page.totalPages, '/donors' + baseQuery),
      onMount: function (root) { wireFilter(root); }
    };
  }

  function donorListForSelf(user) {
    var mine = App.Store.donorByUserId(user.id);

    var intro = App.UI.pageIntro({
      eyebrow: 'My registry',
      heading: 'My donor record',
      sub: 'This is the donor profile linked to your account. Only you and blood bank administrators can see it.',
      actions: '<a class="btn btn-primary" href="#/donations/new">Record a donation</a>'
    });

    if (!mine) {
      return {
        title: 'My donor record',
        nav: 'donors',
        html: intro + '<section class="card">' + App.UI.emptyState({
          icon: '&#128137;',
          title: 'You have no donor profile yet',
          message: 'Add your blood group, date of birth and weight so the blood bank can screen you and alert you when your group is needed.',
          action: '<a class="btn btn-primary" href="#/donors/new">Create my donor profile</a>'
        }) + '</section>'
      };
    }

    var path = '#/donors/' + encodeURIComponent(mine.id);
    return {
      title: 'My donor record',
      nav: 'donors',
      html: intro +
        '<section class="card card-flush"><div class="row-list">' +
          App.UI.donorRow(mine, user) +
        '</div></section>' +
        '<section class="card"><h2 class="card-title">Quick actions</h2>' +
        '<div class="button-row">' +
          '<a class="btn btn-outline" href="' + path + '">View full profile</a>' +
          '<a class="btn btn-outline" href="' + path + '/edit">Edit my contact details</a>' +
          '<a class="btn btn-outline" href="#/donations">My donation history</a>' +
        '</div></section>'
    };
  }

  // ----------------------------------------------------------------- form --
  function donorForm(ctx) {
    var user = App.Auth.user();
    var isAdmin = App.Store.isAdmin(user);
    var id = ctx.params.id;
    var existing = id ? App.Store.donorById(id) : null;

    if (id && !existing) {
      return App.Views.errorPage({
        code: 404, heading: 'Donor not found',
        message: 'That donor record does not exist. It may have been deleted.'
      });
    }
    if (existing && !canEdit(existing, user)) {
      return App.Views.errorPage({
        code: 403, heading: 'This record is not yours to edit',
        message: 'You can only edit your own contact details. The clinical fields of this record must be changed by blood bank staff.'
      });
    }
    if (!existing && !isAdmin && App.Store.donorByUserId(user.id)) {
      App.Router.go('/donors', { replace: true });
      return null;
    }

    var errors = ctx.data.errors || {};
    var v = ctx.data.values || prefill(existing, user);

    var fieldHtml = isAdmin ? adminFields(v, errors) : donorFields(v, errors);

    var isEdit = !!existing;
    var title = isEdit ? 'Edit donor record' : (isAdmin ? 'Add a new donor' : 'Create my donor profile');
    var submit = isEdit ? 'Save changes' : (isAdmin ? 'Add donor to the registry' : 'Create my donor profile');
    var backPath = isEdit ? '#/donors/' + encodeURIComponent(id) : '#/donors';
    var action = isEdit ? '#/donors/' + encodeURIComponent(id) + '/edit' : '#/donors/new';

    return {
      title: title,
      nav: 'donors',
      html:
        App.UI.pageIntro({
          eyebrow: isEdit ? 'Registry' : 'New record',
          heading: title,
          sub: isEdit
            ? 'Update this donor. Changes are saved immediately and screening is recalculated.'
            : 'Add someone to the registry. Required fields are marked with an asterisk.',
          actions: '<a class="btn btn-ghost" href="' + backPath + '">Back</a>'
        }) +
        '<div class="form-layout">' +
          '<section class="card card-form">' +
            App.UI.errorSummary(errors) +
            '<form class="form-stack" data-form="donor" data-action="' + action + '" novalidate>' +
              fieldHtml +
              '<div class="form-actions">' +
                '<button class="btn btn-primary" type="submit">' + esc(submit) + '</button>' +
                '<a class="btn btn-ghost" href="' + backPath + '">Cancel</a>' +
              '</div>' +
            '</form>' +
          '</section>' +
          '<aside class="card card-aside">' +
            '<h2 class="aside-title">Screening rules</h2>' +
            '<ul class="rule-list">' +
              '<li>Age between <strong>18</strong> and <strong>65</strong>.</li>' +
              '<li>Weight of at least <strong>50 kg</strong>.</li>' +
              '<li>Whole blood may be donated once every <strong>90 days</strong>.</li>' +
              '<li>Status must be <strong>Active</strong>.</li>' +
            '</ul>' +
            '<p class="aside-note">These are checked automatically every time the record is opened, so you never have to work them out yourself.</p>' +
          '</aside>' +
        '</div>',
      onMount: function (root) { bindDonorForm(root, isEdit, isAdmin, user); }
    };
  }

  function adminFields(v, errors) {
    var genders = [{ value: 'Male' }, { value: 'Female' }, { value: 'Other' }];
    return (
      App.UI.textField('fullName', 'Full name', v.fullName, errors,
        { required: true, autofocus: true, maxlength: 80, placeholder: 'Juan Dela Cruz' }) +
      App.UI.selectField('bloodType', 'Blood group', App.Store.BLOOD_TYPES, v.bloodType, errors,
        { required: true, labelFn: function (b) { return b.value + '  -  ' + b.label; },
          hint: 'This is what patients are matched against, so it must be confirmed.' }) +
      App.UI.selectField('gender', 'Gender', genders, v.gender, errors, { required: true }) +
      App.UI.textField('dateOfBirth', 'Date of birth', v.dateOfBirth, errors,
        { required: true, type: 'date', hint: 'Used for age-based screening.' }) +
      App.UI.textField('weightKg', 'Weight (kg)', v.weightKg, errors,
        { required: true, placeholder: '65', hint: 'Donors must weigh at least 50 kg.' }) +
      App.UI.textField('phone', 'Mobile number', v.phone, errors,
        { required: true, type: 'tel', placeholder: '0917 555 0123' }) +
      App.UI.textField('email', 'Email address', v.email, errors, { type: 'email', placeholder: 'Optional' }) +
      App.UI.textField('address', 'Address / barangay', v.address, errors,
        { maxlength: 160, placeholder: 'Purok 5, Barangay San Isidro' }) +
      App.UI.selectField('status', 'Registry status', App.Store.DONOR_STATUSES, v.status, errors,
        { required: true, labelFn: function (s) { return s.value; },
          hint: 'Only Active donors can be matched to a patient.' }) +
      App.UI.textareaField('notes', 'Screening notes', v.notes, errors,
        { rows: 3, placeholder: 'Medical history, deferral reasons, mobile drive notes (optional)' })
    );
  }

  function donorFields(v, errors) {
    return (
      '<p class="form-note">You can keep your contact details up to date here. Your blood group, date ' +
      'of birth and weight can only be changed by blood bank staff, so the registry stays trustworthy.</p>' +
      App.UI.textField('phone', 'Mobile number', v.phone, errors,
        { required: true, type: 'tel', placeholder: '0917 555 0123',
          hint: 'The number the blood bank calls when your group is needed.' }) +
      App.UI.textField('email', 'Email address', v.email, errors, { type: 'email', placeholder: 'Optional' }) +
      App.UI.textField('address', 'Address / barangay', v.address, errors,
        { maxlength: 160, placeholder: 'Purok 5, Barangay San Isidro' }) +
      App.UI.textareaField('notes', 'Notes for the blood bank', v.notes, errors,
        { rows: 3, placeholder: 'Anything the blood bank should know (optional)' })
    );
  }

  function prefill(existing, user) {
    if (existing) {
      return {
        fullName: existing.fullName, bloodType: existing.bloodType, gender: existing.gender,
        dateOfBirth: existing.dateOfBirth, weightKg: existing.weightKg, phone: existing.phone,
        email: existing.email, address: existing.address, status: existing.status, notes: existing.notes
      };
    }
    return {
      fullName: user.name, bloodType: '', gender: '', dateOfBirth: '', weightKg: '',
      phone: user.phone, email: user.email, address: user.address, status: 'Active', notes: ''
    };
  }

  function bindDonorForm(root, isEdit, isAdmin, user) {
    var form = root.querySelector('[data-form="donor"]');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var body = App.Views.readForm(form);
      var result = App.Validate.donor(body, { isAdmin: isAdmin, partial: isEdit });

      if (!isAdmin && isEdit) {
        // A donor cannot rewrite their own clinical fields, so those keep the
        // values already on record whatever was posted.
        var stored = App.Store.donorById(App.Router.routeId('donors'));
        if (stored) {
          result.values.fullName = stored.fullName;
          result.values.bloodType = stored.bloodType;
          result.values.gender = stored.gender;
          result.values.dateOfBirth = stored.dateOfBirth;
          result.values.weightKg = stored.weightKg;
          result.values.status = stored.status;
        }
      }

      if (Object.keys(result.errors).length) {
        App.Router.resolve({ data: result });
        return;
      }

      var v = result.values;
      var now = new Date().toISOString();

      if (isEdit) {
        var donor = App.Store.donorById(App.Router.routeId('donors'));
        if (!donor) return App.Router.go('/donors');
        Object.keys(v).forEach(function (key) { donor[key] = v[key]; });
        donor.updatedAt = now;
        App.Store.putDonor(donor);
        App.Store.logActivity('donor.update', user.id, 'Updated ' + donor.referenceNo);
        App.Layout.setFlash('Donor ' + donor.referenceNo + ' has been updated.', 'success');
        return App.Router.go('/donors/' + encodeURIComponent(donor.id));
      }

      var record = {
        id: App.Crypto.randomId('don'),
        referenceNo: App.Store.nextReference('donor', 'BDR'),
        fullName: v.fullName,
        bloodType: v.bloodType,
        gender: v.gender,
        dateOfBirth: v.dateOfBirth,
        weightKg: v.weightKg,
        phone: v.phone,
        email: v.email,
        address: v.address,
        status: isAdmin ? v.status : 'Active',
        lastDonationDate: '',
        totalDonations: 0,
        notes: v.notes,
        linkedUserId: isAdmin ? '' : user.id,
        selfEditable: isAdmin ? 'false' : 'true',
        createdAt: now,
        updatedAt: now,
        createdBy: user.id
      };
      App.Store.putDonor(record);

      var check = App.Eligibility.test(record);
      App.Store.logActivity('donor.create', user.id,
        'Added ' + record.referenceNo + ' (' + record.fullName + ')' +
        (check.eligible ? '' : ' - not currently eligible: ' + check.blocking[0]));

      App.Layout.setFlash('Donor ' + record.referenceNo + ' has been added to the registry.', 'success');
      App.Router.go('/donors/' + encodeURIComponent(record.id));
    });
  }

  // --------------------------------------------------------------- detail --
  function donorDetail(ctx) {
    var user = App.Auth.user();
    var donor = App.Store.donorById(ctx.params.id);

    if (!donor) {
      return App.Views.errorPage({
        code: 404, heading: 'Donor not found',
        message: 'That donor record does not exist. It may have been deleted.'
      });
    }
    if (!canView(donor, user)) {
      return App.Views.errorPage({
        code: 403, heading: 'This record is not yours to view',
        message: 'Donor details are private. You can only open the record linked to your own account.'
      });
    }

    var check = App.Eligibility.test(donor);
    var donations = App.Store.donationsForDonor(donor.id).sort(function (a, b) {
      return new Date(b.donationDate) - new Date(a.donationDate);
    });

    var advisoryHtml = '';
    if (check.advisories.length) {
      advisoryHtml = '<div class="elig-panel elig-warn">' +
        '<span class="elig-icon" aria-hidden="true">&#9888;</span><div>' +
        '<p class="elig-title">Please note</p><ul class="elig-list">' +
        check.advisories.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') +
        '</ul></div></div>';
    }

    var canGive = (App.Store.COMPATIBILITY[donor.bloodType] || []);
    var giveChips = canGive.length
      ? canGive.map(function (t) { return App.UI.bloodBadge(t); }).join('')
      : '<span class="muted-text">Not recorded</span>';

    var receiveFrom = App.Store.BLOOD_TYPES
      .filter(function (b) { return (App.Store.COMPATIBILITY[b.value] || []).indexOf(donor.bloodType) >= 0; })
      .map(function (b) { return b.value; });
    var receiveChips = receiveFrom.length
      ? receiveFrom.map(function (t) { return App.UI.bloodBadge(t); }).join('')
      : '<span class="muted-text">Not recorded</span>';

    var lastText = donor.lastDonationDate
      ? App.UI.formatDate(donor.lastDonationDate) + ' (' + check.daysSince + ' day(s) ago)'
      : 'Has never donated';
    var nextText = check.eligible ? 'Eligible now' : App.Eligibility.formatDate(check.nextDate);

    var facts = App.UI.factsGrid([
      ['Blood group', donor.bloodType, 'raw'],
      ['Age', check.age >= 0 ? String(check.age) : 'Not recorded'],
      ['Gender', donor.gender],
      ['Weight', donor.weightKg + ' kg'],
      ['Registry status', donor.status, 'raw'],
      ['Total donations', String(donor.totalDonations || 0)],
      ['Last donation', lastText],
      ['Next donation due', nextText],
      ['Contact', donor.phone],
      ['Address', donor.address],
      ['Can donate to', giveChips, 'raw'],
      ['Can receive from', receiveChips, 'raw'],
      ['Reference', donor.referenceNo]
    ]);

    var path = '#/donors/' + encodeURIComponent(donor.id);
    var actions = '<a class="btn btn-outline" href="#/donations/new">Record a donation</a>';
    if (canEdit(donor, user)) {
      actions += '<a class="btn btn-primary" href="' + path + '/edit">Edit record</a>';
    }
    if (App.Store.isAdmin(user)) {
      actions += '<a class="btn btn-danger-outline" href="' + path +
                 '/delete">Delete donor</a>';
    }

    var historyHtml = donations.length
      ? donations.map(function (d) { return App.UI.donationRow(d, user); }).join('')
      : App.UI.emptyState({
          icon: '&#128137;', title: 'No donations recorded yet',
          message: 'When this donor gives blood, record it here to keep the history and the next-due date accurate.'
        });

    var notesHtml = donor.notes
      ? '<section class="card"><h2 class="card-title">Screening notes</h2>' +
        '<p class="prose">' + esc(donor.notes) + '</p></section>'
      : '';

    return {
      title: donor.fullName,
      nav: 'donors',
      html:
        App.UI.pageIntro({
          eyebrow: 'Donor profile',
          heading: donor.fullName,
          sub: 'Registry reference ' + donor.referenceNo + ' - added ' + App.UI.formatDate(donor.createdAt),
          actions: '<a class="btn btn-ghost" href="#/donors">Back to registry</a>'
        }) +
        App.UI.eligibilityPanel(donor) + advisoryHtml +
        '<section class="card"><h2 class="card-title">Donor details</h2>' + facts + '</section>' +
        notesHtml +
        '<section class="card">' +
          '<div class="card-head"><h2 class="card-title">Donation history</h2>' +
          '<span class="card-count">' + donations.length + ' record(s)</span></div>' +
          '<div class="row-list">' + historyHtml + '</div>' +
        '</section>' +
        '<section class="card"><h2 class="card-title">Actions</h2>' +
          '<div class="button-row">' + actions + '</div></section>'
    };
  }

  // --------------------------------------------------------------- delete --
  function donorDelete(ctx) {
    var user = App.Auth.user();

    if (!App.Store.isAdmin(user)) {
      return App.Views.errorPage({
        code: 403, heading: 'Administrator access only',
        message: 'Deleting a donor record permanently removes it and its donation history. Only blood bank administrators can do this.'
      });
    }

    var donor = App.Store.donorById(ctx.params.id);
    if (!donor) {
      return App.Views.errorPage({
        code: 404, heading: 'Donor not found',
        message: 'That donor record does not exist. It may already have been deleted.'
      });
    }

    var donationCount = App.Store.donationsForDonor(donor.id).length;
    var path = '#/donors/' + encodeURIComponent(donor.id);

    var warning = donationCount > 0
      ? '<div class="alert alert-warning"><span class="alert-icon" aria-hidden="true">&#9888;</span>' +
        '<div><strong>This will also delete ' + donationCount + ' donation record(s).</strong>' +
        '<p class="alert-text">Those records will be removed from this donor\'s history. This cannot be undone.</p>' +
        '</div></div>'
      : '';

    return {
      title: 'Delete donor',
      nav: 'donors',
      html:
        App.UI.pageIntro({
          eyebrow: 'Confirm deletion',
          heading: 'Delete this donor?',
          sub: 'Please check the details below before you continue. Deletion is permanent.'
        }) +
        '<section class="card card-danger">' +
          '<div class="confirm-summary">' + App.UI.bloodBadge(donor.bloodType) +
            '<div><p class="confirm-name">' + esc(donor.fullName) + '</p>' +
            '<p class="confirm-meta">Reference ' + esc(donor.referenceNo) + ' &middot; ' +
            esc(donor.phone) + ' &middot; ' + donationCount + ' donation record(s)</p></div>' +
          '</div>' + warning +
          '<div class="form-actions">' +
            '<button class="btn btn-danger" type="button" data-delete-donor="' +
              esc(donor.id) + '" data-confirm-extra="Delete ' + esc(donor.fullName) +
              '? This cannot be undone.">Yes, delete this donor</button>' +
            '<a class="btn btn-ghost" href="' + path + '">Cancel, keep the record</a>' +
          '</div>' +
        '</section>',
      onMount: function (root) { bindDonorDelete(root, donor); }
    };
  }

  function bindDonorDelete(root, donor) {
    var button = root.querySelector('[data-delete-donor]');
    if (!button) return;

    button.addEventListener('click', function () {
      App.UI.confirmDialog({
        title: 'Delete this donor?',
        message: 'Delete ' + donor.fullName + ' (' + donor.referenceNo + ')? ' +
                 'This permanently removes the record and its donation history.',
        confirmLabel: 'Yes, delete'
      }).then(function (ok) {
        if (!ok) return;
        var reference = donor.referenceNo;
        App.Store.deleteDonor(donor.id);
        App.Store.logActivity('donor.delete', App.Auth.user().id,
          'Deleted ' + reference + ' (' + donor.fullName + ')');
        App.Layout.setFlash('Donor ' + reference + ' has been removed from the registry.', 'success');
        App.Router.go('/donors');
      });
    });
  }

  // ------------------------------------------------------------- helpers --
  function canView(donor, user) {
    if (!donor || !user) return false;
    if (App.Store.isAdmin(user)) return true;
    return donor.linkedUserId === user.id;
  }

  function canEdit(donor, user) {
    if (!donor || !user) return false;
    if (App.Store.isAdmin(user)) return true;
    return donor.linkedUserId === user.id && donor.selfEditable === 'true';
  }

  function option(value, label, selected) {
    return '<option value="' + esc(value) + '"' + (selected === value ? ' selected' : '') + '>' +
           esc(label) + '</option>';
  }

  function pageState(total, rawPage) {
    var size = App.Layout.CONFIG.pageSize;
    var totalPages = Math.max(1, Math.ceil(total / size));
    var page = parseInt(rawPage, 10);
    if (!page || page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    return { page: page, totalPages: totalPages, offset: (page - 1) * size };
  }

  function wireFilter(root) {
    var form = root.querySelector('[data-filter-form]');
    if (!form) return;

    // Serialise the whole bar back into the hash so the view can be bookmarked.
    function apply() {
      var params = new URLSearchParams();
      var fields = form.querySelectorAll('input, select');
      Array.prototype.forEach.call(fields, function (el) {
        if (el.name && el.value) params.set(el.name, el.value);
      });
      App.Router.go('/donors?' + params.toString());
    }

    form.addEventListener('submit', function (e) { e.preventDefault(); apply(); });
    Array.prototype.forEach.call(form.querySelectorAll('select'), function (sel) {
      sel.addEventListener('change', apply);
    });
  }

  App.Views = App.Views || {};
  App.Views.donorList = donorList;
  App.Views.donorForm = donorForm;
  App.Views.donorDetail = donorDetail;
  App.Views.donorDelete = donorDelete;
  App.Views.canViewDonor = canView;
  App.Views.canEditDonor = canEdit;
  App.Views.pageState = pageState;
  App.Views.wireFilter = wireFilter;
})(window.App);