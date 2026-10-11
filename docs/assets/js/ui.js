/* ==========================================================================
   ui.js - escaping, formatting and reusable HTML components
   --------------------------------------------------------------------------
   Everything user supplied goes through esc() before it reaches innerHTML,
   which is what stops a donor name containing a script tag from executing.
   ========================================================================== */
window.App = window.App || {};

(function (App) {
  'use strict';

  var ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, function (ch) { return ESCAPES[ch]; });
  }

  // ---------------------------------------------------------- formatting --
  function formatDate(iso) {
    if (!iso) return '-';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return App.Eligibility.formatDate(d);
  }

  function formatDateTime(iso) {
    if (!iso) return '-';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    var h = d.getHours();
    var m = String(d.getMinutes()).padStart(2, '0');
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return App.Eligibility.formatDate(d) + ', ' + h + ':' + m + ' ' + ampm;
  }

  function truncate(text, limit) {
    var value = String(text || '');
    return value.length > limit ? value.slice(0, limit).replace(/\s+$/, '') + '…' : value;
  }

  function bloodTypeTone(bloodType) {
    var order = ['bt-one', 'bt-two', 'bt-three', 'bt-four', 'bt-five', 'bt-six', 'bt-seven', 'bt-eight'];
    var index = App.Store.BLOOD_TYPES.map(function (b) { return b.value; }).indexOf(bloodType);
    return index < 0 ? 'bt-none' : order[index];
  }

  function statusTone(status) {
    switch (status) {
      case 'Active':      return 'success';
      case 'Completed':   return 'success';
      case 'Fulfilled':   return 'success';
      case 'Approved':    return 'info';
      case 'Pending':     return 'info';
      case 'Requested':   return 'warning';
      case 'Routine':     return 'muted';
      case 'Inactive':    return 'muted';
      case 'Cancelled':   return 'muted';
      case 'Deferral':    return 'warning';
      case 'Urgent':      return 'warning';
      case 'Disqualified':return 'danger';
      case 'Emergency':   return 'danger';
      default:            return 'neutral';
    }
  }

  function donationTypeTone(type) {
    switch (type) {
      case 'Whole Blood': return 'dt-whole';
      case 'Plasma':      return 'dt-plasma';
      case 'Platelets':   return 'dt-platelets';
      default:            return 'dt-none';
    }
  }

  function bloodTypeLabel(value) {
    var found = App.Store.BLOOD_TYPES.filter(function (b) { return b.value === value; })[0];
    return found ? found.label : String(value || '');
  }

  // ------------------------------------------------------------ components --
  function badge(text, tone) {
    return '<span class="badge badge-' + esc(tone) + '">' + esc(text) + '</span>';
  }

  function bloodBadge(bloodType) {
    return '<span class="bt-badge ' + bloodTypeTone(bloodType) + '">' + esc(bloodType) + '</span>';
  }

  function rolePill(role) {
    var admin = role === 'admin';
    return '<span class="role-pill ' + (admin ? 'role-admin' : 'role-donor') + '">' +
           (admin ? 'Administrator' : 'Donor') + '</span>';
  }

  function avatar(user) {
    if (!user) return '';
    var tone = App.Store.isAdmin(user) ? 'avatar-admin' : 'avatar-donor';
    return '<span class="avatar ' + tone + '">' + esc(App.Auth.initials(user.name)) + '</span>';
  }

  function userChip(user) {
    if (!user) return '';
    return '<div class="user-chip">' + avatar(user) +
           '<span class="user-chip-text"><strong>' + esc(user.name) + '</strong>' +
           rolePill(user.role) + '</span></div>';
  }

  function pageIntro(opts) {
    var html = '<div class="page-intro">';
    if (opts.eyebrow) html += '<p class="page-eyebrow">' + esc(opts.eyebrow) + '</p>';
    html += '<h1 class="page-title">' + esc(opts.heading) + '</h1>';
    if (opts.sub) html += '<p class="page-sub">' + esc(opts.sub) + '</p>';
    if (opts.actions) html += '<div class="page-actions">' + opts.actions + '</div>';
    return html + '</div>';
  }

  function sectionHeading(opts) {
    var align = opts.align === 'center' ? ' section-head-center' : '';
    var html = '<div class="section-head' + align + '">';
    if (opts.eyebrow) html += '<p class="section-eyebrow">' + esc(opts.eyebrow) + '</p>';
    html += '<h2 class="section-title">' + esc(opts.heading) + '</h2>';
    if (opts.sub) html += '<p class="section-sub">' + esc(opts.sub) + '</p>';
    return html + '</div>';
  }

  function statTile(label, value, tone, hint) {
    var html = '<div class="stat-tile stat-' + esc(tone || 'brand') + '">' +
               '<p class="stat-value">' + esc(value) + '</p>' +
               '<p class="stat-label">' + esc(label) + '</p>';
    if (hint) html += '<p class="stat-hint">' + esc(hint) + '</p>';
    return html + '</div>';
  }

  function flashHtml(message, tone) {
    if (!message) return '';
    var icons = { success: '&#10003;', error: '&#33;', warning: '&#9888;', info: '&#8505;' };
    var icon = icons[tone] || icons.info;
    var dismiss = tone === 'success'
      ? '<button class="flash-close" type="button" data-dismiss-flash aria-label="Dismiss">&times;</button>' : '';
    return '<div class="flash flash-' + esc(tone) + '" role="status" data-flash>' +
           '<span class="flash-icon" aria-hidden="true">' + icon + '</span>' +
           '<p class="flash-text">' + esc(message) + '</p>' + dismiss + '</div>';
  }

  function errorSummary(errors) {
    var keys = Object.keys(errors || {});
    if (!keys.length) return '';
    var items = keys.map(function (k) { return '<li>' + esc(errors[k]) + '</li>'; }).join('');
    return '<div class="alert alert-error" role="alert">' +
           '<span class="alert-icon" aria-hidden="true">&#9888;</span><div>' +
           '<strong>Please fix the following before continuing:</strong>' +
           '<ul class="alert-list">' + items + '</ul></div></div>';
  }

  function fieldError(errors, field) {
    if (!errors || !errors[field]) return '';
    return '<p class="field-error" data-field-error="' + esc(field) + '">' + esc(errors[field]) + '</p>';
  }

  function invalidClass(errors, field) {
    return (errors && errors[field]) ? ' is-invalid' : '';
  }

  function emptyState(opts) {
    var action = opts.action ? '<div class="empty-action">' + opts.action + '</div>' : '';
    return '<div class="empty-state"><span class="empty-icon" aria-hidden="true">' +
           (opts.icon || '&#128269;') + '</span>' +
           '<h2 class="empty-title">' + esc(opts.title) + '</h2>' +
           '<p class="empty-text">' + esc(opts.message) + '</p>' + action + '</div>';
  }

  function selectOptions(items, selected, placeholder, labelFn) {
    var html = placeholder ? '<option value="">' + esc(placeholder) + '</option>' : '';
    items.forEach(function (item) {
      var value = item.value !== undefined ? item.value : item;
      var label = labelFn ? labelFn(item) : value;
      var sel = String(value) === String(selected) ? ' selected' : '';
      html += '<option value="' + esc(value) + '"' + sel + '>' + esc(label) + '</option>';
    });
    return html;
  }

  // --------------------------------------------------------------- fields --
  function field(name, label, control, errors, hint, required) {
    var req = required ? ' <span class="req" aria-hidden="true">*</span>' : '';
    var hintHtml = hint ? '<p class="field-hint">' + esc(hint) + '</p>' : '';
    return '<div class="field' + invalidClass(errors, name) + '">' +
           '<label class="field-label" for="' + esc(name) + '">' + esc(label) + req + '</label>' +
           control + hintHtml + fieldError(errors, name) + '</div>';
  }

  function textField(name, label, value, errors, opts) {
    opts = opts || {};
    var attrs = ' id="' + esc(name) + '" name="' + esc(name) + '" type="' + esc(opts.type || 'text') +
                '" value="' + esc(value || '') + '"';
    if (opts.placeholder) attrs += ' placeholder="' + esc(opts.placeholder) + '"';
    if (opts.required) attrs += ' required';
    if (opts.maxlength) attrs += ' maxlength="' + opts.maxlength + '"';
    if (opts.autofocus) attrs += ' autofocus';
    return field(name, label, '<input class="field-input"' + attrs + '>', errors, opts.hint, opts.required);
  }

  function textareaField(name, label, value, errors, opts) {
    opts = opts || {};
    var attrs = ' id="' + esc(name) + '" name="' + esc(name) + '" rows="' + (opts.rows || 4) + '"';
    if (opts.placeholder) attrs += ' placeholder="' + esc(opts.placeholder) + '"';
    if (opts.required) attrs += ' required';
    return field(name, label, '<textarea class="field-input field-textarea"' + attrs + '>' +
           esc(value || '') + '</textarea>', errors, opts.hint, opts.required);
  }

  function selectField(name, label, items, value, errors, opts) {
    opts = opts || {};
    var attrs = ' id="' + esc(name) + '" name="' + esc(name) + '"';
    if (opts.required) attrs += ' required';
    var control = '<select class="field-input field-select"' + attrs + '>' +
      selectOptions(items, value, opts.placeholder === null ? null : (opts.placeholder || 'Please choose'),
                    opts.labelFn) + '</select>';
    return field(name, label, control, errors, opts.hint, opts.required);
  }

  function hiddenField(name, value) {
    return '<input type="hidden" name="' + esc(name) + '" value="' + esc(value || '') + '">';
  }

  // ----------------------------------------------------------------- rows --
  function eligibilityChip(donor) {
    var check = App.Eligibility.test(donor);
    if (check.eligible) {
      return '<span class="badge badge-success" title="Meets every screening rule">Eligible</span>';
    }
    return '<span class="badge badge-muted" title="' + esc(check.blocking[0] || '') + '">Not eligible</span>';
  }

  function donorRow(donor, viewer) {
    var isAdmin = App.Store.isAdmin(viewer);
    var last = donor.lastDonationDate ? formatDate(donor.lastDonationDate) : 'Never donated';
    var path = '#/donors/' + encodeURIComponent(donor.id);

    var meta = [
      metaItem('Reference', donor.referenceNo),
      metaItem('Age', App.Eligibility.age(donor)),
      metaItem('Weight', donor.weightKg + ' kg'),
      metaItem('Last donation', last),
      metaItem('Total', (donor.totalDonations || 0) + ' time(s)')
    ];
    if (isAdmin) {
      meta.push(metaItem('Contact', donor.phone));
      meta.push(metaItem('Area', truncate(donor.address, 60)));
    }

    var notes = '';
    if (isAdmin && donor.notes) {
      notes = '<p class="row-note"><span class="meta-label">Note</span> ' +
              esc(truncate(donor.notes, 130)) + '</p>';
    }

    return '<article class="row-card" data-blood="' + bloodTypeTone(donor.bloodType) + '">' +
      '<div class="row-main">' +
        '<div class="row-badges">' + bloodBadge(donor.bloodType) +
          badge(donor.status, statusTone(donor.status)) + eligibilityChip(donor) + '</div>' +
        '<h2 class="row-title"><a href="' + path + '">' + esc(donor.fullName) + '</a></h2>' +
        '<div class="row-meta">' + meta.join('') + '</div>' + notes +
      '</div>' +
      '<div class="row-side"><a class="btn btn-outline btn-sm" href="' + path + '">View profile</a></div>' +
    '</article>';
  }

  function donationRow(donation, viewer, opts) {
    opts = opts || {};
    var isAdmin = App.Store.isAdmin(viewer);
    var units = App.Eligibility.requiredUnits(donation.donationType);
    var parent = App.Store.donorById(donation.donorId);
    var canManage = App.Store.isAdmin(viewer) || (parent && parent.linkedUserId === viewer.id);

    var meta = [
      metaItem('Reference', donation.referenceNo),
      metaItem('Date', formatDate(donation.donationDate)),
      metaItem('Volume', donation.volumeMl + ' ml'),
      metaItem('Units', String(units))
    ];
    if (!opts.compact) {
      meta.push('<span class="meta-item"><span class="meta-label">Donor</span> ' +
        '<a href="#/donors/' + encodeURIComponent(donation.donorId) + '">' +
        esc(donation.donorName) + '</a></span>');
      meta.push(metaItem('Centre', donation.center));
    }

    var actions = '';
    if (!opts.compact && canManage) {
      var id = encodeURIComponent(donation.id);
      actions = '<a class="btn btn-outline btn-sm" href="#/donations/' + id + '/edit">Edit</a>' +
        '<a class="btn btn-danger-outline btn-sm" href="#/donations/' + id +
        '/delete" data-confirm="Delete this donation record?">Delete</a>';
    }

    var notes = '';
    if (isAdmin && donation.notes) {
      notes = '<p class="row-note"><span class="meta-label">Note</span> ' +
              esc(truncate(donation.notes, 120)) + '</p>';
    }

    return '<article class="row-card" data-donation-row>' +
      '<div class="row-main">' +
        '<div class="row-badges">' + bloodBadge(donation.bloodType) +
          '<span class="badge ' + donationTypeTone(donation.donationType) + '">' +
          esc(donation.donationType) + '</span>' +
          badge(donation.status, statusTone(donation.status)) + '</div>' +
        '<h2 class="row-title">Donation ' + esc(donation.referenceNo) + '</h2>' +
        '<div class="row-meta">' + meta.join('') + '</div>' + notes +
      '</div>' +
      '<div class="row-side">' + actions + '</div>' +
    '</article>';
  }

  function requestRow(request, viewer) {
    var isOpen = request.status === 'Requested' || request.status === 'Approved';
    var matches = App.Store.eligibleDonorCount(request.bloodType);

    var meta = [
      metaItem('Reference', request.referenceNo),
      metaItem('Units', String(request.unitsNeeded)),
      metaItem('Needed by', formatDate(request.neededBy)),
      metaItem('Requested by', request.requesterName)
    ];
    if (isOpen) {
      meta.push('<span class="meta-item"><span class="meta-label">Matches</span> ' +
        '<span class="match-count">' + esc(matches + ' eligible donor' + (matches === 1 ? '' : 's')) +
        '</span></span>');
    }

    var notes = '';
    if (request.notes) {
      notes = '<p class="row-note"><span class="meta-label">Note</span> ' +
              esc(truncate(request.notes, 140)) + '</p>';
    }

    var canManage = App.Store.isAdmin(viewer) || request.createdBy === viewer.id;
    var actions = '';
    if (canManage) {
      var id = encodeURIComponent(request.id);
      actions = '<div class="row-actions">' +
        '<a class="btn btn-outline btn-sm" href="#/requests/' + id + '/edit">Edit</a>';
      if (isOpen) {
        var next = request.status === 'Requested' ? 'Approved' : 'Fulfilled';
        var label = request.status === 'Requested' ? 'Approve' : 'Mark fulfilled';
        actions += '<button class="btn btn-primary btn-sm" type="button" data-request-status="' +
          id + '" data-next-status="' + next + '">' + label + '</button>';
      }
      actions += '<a class="btn btn-danger-outline btn-sm" href="#/requests/' + id +
        '/delete" data-confirm="Delete this blood request?">Delete</a></div>';
    }

    return '<article class="row-card" data-request-row>' +
      '<div class="row-main">' +
        '<div class="row-badges">' + bloodBadge(request.bloodType) +
          badge(request.urgency, statusTone(request.urgency)) +
          badge(request.status, statusTone(request.status)) + '</div>' +
        '<h2 class="row-title">' + esc(request.unitsNeeded) + ' unit(s) of ' + esc(request.bloodType) +
          ' for ' + esc(request.hospital) + '</h2>' +
        '<div class="row-meta">' + meta.join('') + '</div>' + notes +
      '</div>' +
      '<div class="row-side">' + actions + '</div>' +
    '</article>';
  }

  function metaItem(label, value) {
    return '<span class="meta-item"><span class="meta-label">' + esc(label) + '</span> ' +
           esc(value) + '</span>';
  }

  function factsGrid(pairs, compact) {
    var cells = pairs.map(function (p) {
      return '<div class="fact"><span class="fact-label">' + esc(p[0]) + '</span>' +
             '<span class="fact-value">' + (p[2] === 'raw' ? p[1] : esc(p[1])) + '</span></div>';
    }).join('');
    return '<div class="facts-grid' + (compact ? ' facts-grid-compact' : '') + '">' + cells + '</div>';
  }

  function eligibilityPanel(donor) {
    var check = App.Eligibility.test(donor);
    if (check.eligible) {
      return '<div class="elig-panel elig-ok">' +
        '<span class="elig-icon" aria-hidden="true">&#10003;</span><div>' +
        '<p class="elig-title">Cleared to donate</p>' +
        '<p class="elig-text">This donor meets every screening rule: age ' + check.age + ', ' +
        check.weightKg + ' kg, and last donated ' + check.daysSince + ' day(s) ago.</p>' +
        '</div></div>';
    }
    var items = check.blocking.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('');
    return '<div class="elig-panel elig-blocked">' +
      '<span class="elig-icon" aria-hidden="true">&#33;</span><div>' +
      '<p class="elig-title">Not currently eligible</p>' +
      '<ul class="elig-list">' + items + '</ul></div></div>';
  }

  function compatibilityTable() {
    var types = App.Store.BLOOD_TYPES.map(function (b) { return b.value; });
    var comp = App.Store.COMPATIBILITY;
    var html = '<div class="compat-wrap"><table class="compat-table">' +
      '<caption class="visually-hidden">Which blood groups can donate to which</caption><thead><tr>' +
      '<th scope="col">Donor \\ To</th>';
    types.forEach(function (t) {
      html += '<th scope="col">' + bloodBadge(t) + '</th>';
    });
    html += '</tr></thead><tbody>';
    types.forEach(function (donor) {
      html += '<tr><th scope="row">' + bloodBadge(donor) + '</th>';
      types.forEach(function (target) {
        var ok = comp[donor].indexOf(target) >= 0;
        var mark = ok ? '&#10003;' : '&mdash;';
        var label = (ok ? 'can donate to ' : 'cannot donate to ') + target;
        html += '<td class="' + (ok ? 'compat-yes' : 'compat-no') + '">' +
                '<span aria-hidden="true">' + mark + '</span>' +
                '<span class="visually-hidden">' + esc(label) + '</span></td>';
      });
      html += '</tr>';
    });
    return html + '</tbody></table></div>';
  }

  function pagination(page, totalPages, baseHash) {
    if (totalPages <= 1) return '';
    var sep = baseHash.indexOf('?') >= 0 ? '&' : '?';
    var items = '';
    for (var i = 1; i <= totalPages; i++) {
      items += i === page
        ? '<li class="page-item is-current"><span aria-current="page">' + i + '</span></li>'
        : '<li class="page-item"><a href="#' + esc(baseHash + sep + 'page=' + i) + '">' + i + '</a></li>';
    }
    var prev = page <= 1
      ? '<span aria-disabled="true">&larr; Previous</span>'
      : '<a href="#' + esc(baseHash + sep + 'page=' + (page - 1)) + '" rel="prev">&larr; Previous</a>';
    var next = page >= totalPages
      ? '<span aria-disabled="true">Next &rarr;</span>'
      : '<a href="#' + esc(baseHash + sep + 'page=' + (page + 1)) + '" rel="next">Next &rarr;</a>';

    return '<nav class="pagination" aria-label="Pagination"><ul>' +
           '<li class="page-item' + (page <= 1 ? ' is-disabled' : '') + '">' + prev + '</li>' +
           items +
           '<li class="page-item' + (page >= totalPages ? ' is-disabled' : '') + '">' + next + '</li>' +
           '</ul></nav>';
  }

  // ----------------------------------------------------------------- modal --
  var modalEl = null;
  var modalResolve = null;

  function initModal() { modalEl = document.getElementById('confirmModal'); }

  /** Confirmation dialog. Resolves true when confirmed. */
  function confirmDialog(opts) {
    if (!modalEl) initModal();
    if (!modalEl) return Promise.resolve(window.confirm(opts.message));

    modalEl.querySelector('[data-modal-title]').textContent = opts.title || 'Please confirm';
    modalEl.querySelector('[data-modal-text]').textContent = opts.message || '';
    var cancelBtn = modalEl.querySelector('[data-modal-cancel]');
    var okBtn = modalEl.querySelector('[data-modal-ok]');
    okBtn.textContent = opts.confirmLabel || 'Yes, delete';
    okBtn.className = 'btn ' + (opts.danger === false ? 'btn-primary' : 'btn-danger');
    cancelBtn.textContent = opts.cancelLabel || 'Cancel';
    modalEl.hidden = false;
    okBtn.focus();

    return new Promise(function (resolve) { modalResolve = resolve; });
  }

  function closeModal(result) {
    if (modalEl) modalEl.hidden = true;
    var resolve = modalResolve;
    modalResolve = null;
    if (resolve) resolve(result);
  }

  function wireModal() {
    initModal();
    if (!modalEl) return;
    modalEl.querySelector('[data-modal-ok]').addEventListener('click', function () { closeModal(true); });
    modalEl.querySelector('[data-modal-cancel]').addEventListener('click', function () { closeModal(false); });
    modalEl.querySelector('[data-modal-backdrop]').addEventListener('click', function () { closeModal(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modalEl && !modalEl.hidden) closeModal(false);
    });
  }

  // ----------------------------------------------------------------- busy --
  function busy(show) {
    var el = document.getElementById('busyOverlay');
    if (el) el.hidden = !show;
  }

  function toast(message, tone) {
    var host = document.getElementById('toastHost');
    if (!host) return;
    var el = document.createElement('div');
    el.className = 'flash flash-' + (tone || 'info');
    el.setAttribute('data-flash', '');
    el.setAttribute('role', 'status');
    var p = document.createElement('p');
    p.className = 'flash-text';
    p.textContent = message;
    el.appendChild(p);
    host.appendChild(el);
    window.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 4500);
  }

  App.UI = {
    esc: esc,
    formatDate: formatDate,
    formatDateTime: formatDateTime,
    truncate: truncate,
    bloodTypeTone: bloodTypeTone,
    statusTone: statusTone,
    donationTypeTone: donationTypeTone,
    bloodTypeLabel: bloodTypeLabel,
    badge: badge,
    bloodBadge: bloodBadge,
    rolePill: rolePill,
    avatar: avatar,
    userChip: userChip,
    pageIntro: pageIntro,
    sectionHeading: sectionHeading,
    statTile: statTile,
    flashHtml: flashHtml,
    errorSummary: errorSummary,
    fieldError: fieldError,
    invalidClass: invalidClass,
    emptyState: emptyState,
    selectOptions: selectOptions,
    field: field,
    textField: textField,
    textareaField: textareaField,
    selectField: selectField,
    hiddenField: hiddenField,
    metaItem: metaItem,
    factsGrid: factsGrid,
    eligibilityChip: eligibilityChip,
    eligibilityPanel: eligibilityPanel,
    compatibilityTable: compatibilityTable,
    donorRow: donorRow,
    donationRow: donationRow,
    requestRow: requestRow,
    pagination: pagination,
    confirmDialog: confirmDialog,
    wireModal: wireModal,
    busy: busy,
    toast: toast
  };
})(window.App);