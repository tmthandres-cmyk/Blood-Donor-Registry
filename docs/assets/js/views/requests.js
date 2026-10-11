/* ==========================================================================
   views/requests.js - blood requests: full Create / Read / Update / Delete
   Each request shows how many eligible donors of that group exist, so it is
   obvious whether the need can actually be covered.
   ========================================================================== */
window.App = window.App || {};

(function (App) {
  'use strict';

  var esc = App.UI.esc;

  var URGENCY_ORDER = { Emergency: 0, Urgent: 1, Routine: 2 };
  var STATUS_ORDER = { Requested: 0, Approved: 1, Fulfilled: 2, Cancelled: 3 };

  function requestList(ctx) {
    var user = App.Auth.user();
    var status = ctx.query.status || '';
    var type = ctx.query.type || '';
    var search = (ctx.query.q || '').toLowerCase();

    var all = App.Store.allRequests();

    if (search) {
      all = all.filter(function (r) {
        return String(r.hospital).toLowerCase().indexOf(search) >= 0 ||
               String(r.requesterName).toLowerCase().indexOf(search) >= 0 ||
               String(r.referenceNo).toLowerCase().indexOf(search) >= 0;
      });
    }
    if (App.Store.BLOOD_TYPES.some(function (b) { return b.value === type; })) {
      all = all.filter(function (r) { return r.bloodType === type; });
    }
    if (App.Store.REQUEST_STATUSES.some(function (s) { return s.value === status; })) {
      all = all.filter(function (r) { return r.status === status; });
      all.sort(function (a, b) { return new Date(a.neededBy) - new Date(b.neededBy); });
    } else if (!status) {
      // Default: live work first, most urgent first.
      all.sort(function (a, b) {
        var s = (STATUS_ORDER[a.status] || 3) - (STATUS_ORDER[b.status] || 3);
        if (s !== 0) return s;
        return (URGENCY_ORDER[a.urgency] || 2) - (URGENCY_ORDER[b.urgency] || 2);
      });
    }

    var page = App.Views.pageState(all.length, ctx.query.page);
    var slice = all.slice(page.offset, page.offset + App.Layout.CONFIG.pageSize);
    var stats = App.Store.requestStats();

    var qs = [];
    if (ctx.query.q) qs.push('q=' + encodeURIComponent(ctx.query.q));
    if (type) qs.push('type=' + encodeURIComponent(type));
    if (status) qs.push('status=' + encodeURIComponent(status));
    var baseQuery = qs.length ? '?' + qs.join('&') : '';

    var filterHtml =
      '<form class="filter-bar" data-filter-form>' +
        '<div class="filter-search">' +
          '<label class="visually-hidden" for="q">Search requests</label>' +
          '<input class="field-input" type="search" id="q" name="q" value="' + esc(ctx.query.q || '') +
          '" placeholder="Search hospital, requester or reference">' +
        '</div>' +
        '<div class="filter-selects">' +
          App.UI.selectField('type', 'Blood group', App.Store.BLOOD_TYPES, type, null,
            { placeholder: 'All groups', labelFn: function (b) { return b.label; } }) +
          App.UI.selectField('status', 'Status', App.Store.REQUEST_STATUSES, status, null,
            { placeholder: 'All statuses', labelFn: function (s) { return s.value; } }) +
          '<button class="btn btn-primary" type="submit">Filter</button>' +
          '<a class="btn btn-ghost" href="#/requests">Reset</a>' +
        '</div>' +
      '</form>';

    var listHtml = slice.length
      ? slice.map(function (r) { return App.UI.requestRow(r, user); }).join('')
      : App.UI.emptyState({
          icon: '&#128220;', title: 'No blood requests found',
          message: 'Nothing matches these filters. Post a request so donors of that group can be alerted.'
        });

    var statRow = [
      App.UI.statTile('All requests', stats.total, 'brand'),
      App.UI.statTile('Open', stats.open, 'info'),
      App.UI.statTile('Emergency', stats.emergency, 'danger', 'Still waiting for donors'),
      App.UI.statTile('Units outstanding', stats.unitsOutstanding, 'warning')
    ].join('');

    return {
      title: 'Blood requests',
      nav: 'requests',
      html:
        App.UI.pageIntro({
          eyebrow: 'Matching', heading: 'Blood requests',
          sub: 'Every request shows how many eligible donors of that blood group are in the registry, so you can see at a glance what can actually be covered.',
          actions: '<a class="btn btn-primary" href="#/requests/new">Post a blood request</a>'
        }) +
        '<div class="stat-row">' + statRow + '</div>' +
        '<section class="card card-flush">' + filterHtml +
          '<div class="row-list">' + listHtml + '</div>' +
        '</section>' +
        App.UI.pagination(page.page, page.totalPages, '/requests' + baseQuery),
      onMount: function (root) { wireRequestFilter(root); }
    };
  }

  // ----------------------------------------------------------------- form --
  function requestForm(ctx) {
    var user = App.Auth.user();
    var id = ctx.params.id;
    var existing = id ? App.Store.requestById(id) : null;

    if (id && !existing) {
      return App.Views.errorPage({
        code: 404, heading: 'Request not found',
        message: 'That blood request does not exist. It may have been deleted.'
      });
    }

    var v = prefill(existing, user);
    var isEdit = !!existing;
    var title = isEdit ? 'Edit blood request' : 'Post a blood request';
    var submit = isEdit ? 'Save changes' : 'Post this request';
    var action = isEdit ? '#/requests/' + encodeURIComponent(id) + '/edit' : '#/requests/new';

    var coverage = coveragePanel(v.bloodType);

    return {
      title: title,
      nav: 'requests',
      html:
        App.UI.pageIntro({
          eyebrow: isEdit ? 'Matching' : 'Urgent need',
          heading: title,
          sub: isEdit
            ? 'Update what the hospital needs or how far along the request is.'
            : 'Tell the registry what is needed and by when. The blood bank will match eligible donors.',
          actions: '<a class="btn btn-ghost" href="#/requests">Back</a>'
        }) +
        '<div class="form-layout">' +
          '<section class="card card-form">' +
            App.UI.errorSummary(ctx.data.errors) +
            '<form class="form-stack" data-form="request" novalidate>' +
              App.UI.textField('requesterName', 'Requesting doctor or nurse', v.requesterName, ctx.data.errors,
                { required: true, autofocus: true, maxlength: 80, placeholder: 'Dr. Juan Dela Cruz' }) +
              App.UI.textField('hospital', 'Hospital / blood bank', v.hospital, ctx.data.errors,
                { required: true, maxlength: 120, placeholder: 'Antipolo General Hospital' }) +
              App.UI.selectField('bloodType', 'Blood group needed', App.Store.BLOOD_TYPES, v.bloodType,
                ctx.data.errors, {
                  required: true, labelFn: function (b) { return b.value + '  -  ' + b.label; },
                  hint: 'Changing this updates the donor coverage panel.'
                }) +
              App.UI.textField('unitsNeeded', 'Units needed', v.unitsNeeded, ctx.data.errors,
                { required: true, placeholder: '2', hint: 'One unit is roughly 450 ml.' }) +
              App.UI.selectField('urgency', 'How urgent is it', App.Store.REQUEST_URGENCIES, v.urgency,
                ctx.data.errors, { required: true, labelFn: function (u) { return u.value + ' - ' + u.hint; } }) +
              App.UI.textField('neededBy', 'Needed by', v.neededBy, ctx.data.errors,
                { required: true, type: 'date' }) +
              App.UI.textField('patientName', 'Patient reference', v.patientName, ctx.data.errors,
                { maxlength: 120, placeholder: 'Maria S., 34, PPH',
                  hint: 'A short reference only - please do not enter full patient names.' }) +
              App.UI.textField('contact', 'Contact number', v.contact, ctx.data.errors,
                { type: 'tel', placeholder: '0917 555 0123' }) +
              App.UI.selectField('status', 'Status', App.Store.REQUEST_STATUSES, v.status, ctx.data.errors,
                { required: true, labelFn: function (s) { return s.value; } }) +
              App.UI.textareaField('notes', 'Notes', v.notes, ctx.data.errors,
                { rows: 3, placeholder: 'Clinical context the blood bank should know (optional)' }) +
              '<div class="form-actions">' +
                '<button class="btn btn-primary" type="submit">' + esc(submit) + '</button>' +
                '<a class="btn btn-ghost" href="#/requests">Cancel</a>' +
              '</div>' +
            '</form>' +
          '</section>' +
          '<aside class="card card-aside" data-coverage-panel>' + coverage + '</aside>' +
        '</div>',
      onMount: function (root) { bindRequestForm(root, existing, user); }
    };
  }

  function prefill(existing, user) {
    if (existing) {
      return {
        requesterName: existing.requesterName, bloodType: existing.bloodType,
        unitsNeeded: existing.unitsNeeded, urgency: existing.urgency,
        hospital: existing.hospital, patientName: existing.patientName,
        neededBy: (existing.neededBy || '').slice(0, 10), contact: existing.contact,
        status: existing.status, notes: existing.notes
      };
    }
    var d = new Date(Date.now() + 3 * 86400000);
    return {
      requesterName: user.name, bloodType: '', unitsNeeded: '1', urgency: '',
      hospital: '', patientName: '',
      neededBy: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
                '-' + String(d.getDate()).padStart(2, '0'),
      contact: user.phone, status: 'Requested', notes: ''
    };
  }

  function coveragePanel(bloodType) {
    if (!App.Store.BLOOD_TYPES.some(function (b) { return b.value === bloodType; })) {
      return '<h2 class="aside-title">Donor coverage</h2>' +
        '<p class="aside-note" data-coverage-note>Choose a blood group and this panel shows how many ' +
        'eligible donors are available to cover it right now.</p>' +
        '<ul class="rule-list">' +
          '<li>Only donors marked <strong>Active</strong> are counted.</li>' +
          '<li>Donors inside their 90-day recovery window are not counted.</li>' +
          '<li>Counts are registry figures, not stock in the blood bank.</li>' +
        '</ul>';
    }

    var total = App.Store.donorsByBloodType(bloodType).length;
    var eligible = App.Store.donorsByBloodType(bloodType, true).length;
    var level = eligible >= 5 ? 'good' : (eligible >= 2 ? 'fair' : 'thin');
    var levelText = level === 'good' ? 'Good cover' : (level === 'fair' ? 'Partial cover' : 'Limited cover');

    return '<h2 class="aside-title">Donor coverage</h2>' +
      '<p class="coverage-head" data-coverage-head>' + App.UI.bloodBadge(bloodType) +
        '<span class="coverage-verdict cov-' + level + '" data-coverage-verdict>' + esc(levelText) + '</span>' +
      '</p>' +
      '<p class="aside-note" data-coverage-note>' + eligible + ' eligible donor(s) out of ' + total +
        ' registered with this group.</p>' +
      '<ul class="rule-list">' +
        '<li>Eligible now: <strong data-coverage-eligible>' + eligible + '</strong></li>' +
        '<li>Recovering or deferred: <strong data-coverage-other>' + (total - eligible) + '</strong></li>' +
      '</ul>' +
      '<p class="aside-note">Counts come from the registry and do not include units already held in the blood bank.</p>';
  }

  function bindRequestForm(root, existing, user) {
    var form = root.querySelector('[data-form="request"]');
    if (!form) return;

    // Live donor coverage as the group changes.
    var select = form.querySelector('[name="bloodType"]');
    var panel = root.querySelector('[data-coverage-panel]');
    if (select && panel) {
      select.addEventListener('change', function () {
        panel.innerHTML = coveragePanel(select.value);
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var body = App.Views.readForm(form);
      var result = App.Validate.request(body);

      if (Object.keys(result.errors).length) {
        App.Router.resolve({ data: result });
        return;
      }

      var v = result.values;
      var now = new Date().toISOString();

      if (existing) {
        Object.keys(v).forEach(function (key) { existing[key] = v[key]; });
        existing.updatedAt = now;
        App.Store.putRequest(existing);
        App.Store.logActivity('request.update', user.id, 'Updated ' + existing.referenceNo);
        App.Layout.setFlash('Blood request ' + existing.referenceNo + ' has been updated.', 'success');
        return App.Router.go('/requests');
      }

      var record = {
        id: App.Crypto.randomId('req'),
        referenceNo: App.Store.nextReference('request', 'BRS'),
        requesterName: v.requesterName,
        bloodType: v.bloodType,
        unitsNeeded: v.unitsNeeded,
        urgency: v.urgency,
        hospital: v.hospital,
        patientName: v.patientName,
        neededBy: v.neededBy,
        contact: v.contact,
        status: v.status,
        notes: v.notes,
        createdAt: now,
        updatedAt: now,
        createdBy: user.id
      };
      App.Store.putRequest(record);
      App.Store.logActivity('request.create', user.id,
        'Posted ' + record.referenceNo + ' - ' + record.unitsNeeded + ' unit(s) of ' + record.bloodType);

      App.Layout.setFlash('Blood request ' + record.referenceNo + ' has been posted to the registry.', 'success');
      App.Router.go('/requests');
    });
  }

  // --------------------------------------------------------------- delete --
  function requestDelete(ctx) {
    var user = App.Auth.user();
    var existing = App.Store.requestById(ctx.params.id);

    if (!existing) {
      return App.Views.errorPage({
        code: 404, heading: 'Request not found',
        message: 'That blood request does not exist. It may already have been deleted.'
      });
    }

    return {
      title: 'Delete blood request',
      nav: 'requests',
      html:
        App.UI.pageIntro({
          eyebrow: 'Confirm deletion',
          heading: 'Delete this blood request?',
          sub: 'Please check the details below before you continue.'
        }) +
        '<section class="card card-danger">' +
          '<div class="confirm-summary">' + App.UI.bloodBadge(existing.bloodType) +
            '<div><p class="confirm-name">' + esc(existing.unitsNeeded) + ' unit(s) for ' +
            esc(existing.hospital) + '</p>' +
            '<p class="confirm-meta">' + esc(existing.referenceNo) + ' &middot; ' +
            esc(existing.urgency) + ' &middot; needed by ' +
            esc(App.UI.formatDate(existing.neededBy)) + '</p></div>' +
          '</div>' +
          '<div class="alert alert-warning"><span class="alert-icon" aria-hidden="true">&#9888;</span>' +
            '<div><strong>This request will stop being visible to donors.</strong>' +
            '<p class="alert-text">If the need is still real, cancel and post a fresh request instead.</p></div>' +
          '</div>' +
          '<div class="form-actions">' +
            '<button class="btn btn-danger" type="button" data-delete-request="' + esc(existing.id) + '">' +
              'Yes, delete this request</button>' +
            '<a class="btn btn-ghost" href="#/requests">Cancel, keep the request</a>' +
          '</div>' +
        '</section>',
      onMount: function (root) {
        var button = root.querySelector('[data-delete-request]');
        if (!button) return;
        button.addEventListener('click', function () {
          App.UI.confirmDialog({
            title: 'Delete this blood request?',
            message: 'Delete blood request ' + existing.referenceNo + '?',
            confirmLabel: 'Yes, delete'
          }).then(function (ok) {
            if (!ok) return;
            var reference = existing.referenceNo;
            App.Store.deleteRequest(existing.id);
            App.Store.logActivity('request.delete', user.id, 'Deleted ' + reference);
            App.Layout.setFlash('Blood request ' + reference + ' has been removed.', 'success');
            App.Router.go('/requests');
          });
        });
      }
    };
  }

  function wireRequestFilter(root) {
    var form = root.querySelector('[data-filter-form]');
    if (!form) return;
    function apply() {
      var params = new URLSearchParams();
      Array.prototype.forEach.call(form.querySelectorAll('input, select'), function (el) {
        if (el.name && el.value) params.set(el.name, el.value);
      });
      App.Router.go('/requests?' + params.toString());
    }
    form.addEventListener('submit', function (e) { e.preventDefault(); apply(); });
    Array.prototype.forEach.call(form.querySelectorAll('select'), function (sel) {
      sel.addEventListener('change', apply);
    });
  }

  App.Views = App.Views || {};
  App.Views.requestList = requestList;
  App.Views.requestForm = requestForm;
  App.Views.requestDelete = requestDelete;
})(window.App);