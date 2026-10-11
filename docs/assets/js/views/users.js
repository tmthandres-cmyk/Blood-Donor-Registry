/* ==========================================================================
   views/users.js - administrator-only account management
   ========================================================================== */
window.App = window.App || {};

(function (App) {
  'use strict';

  var esc = App.UI.esc;

  function userList(ctx) {
    var user = App.Auth.user();
    var search = (ctx.query.q || '').toLowerCase();
    var role = ctx.query.role || '';

    var all = App.Store.allUsers();

    if (search) {
      all = all.filter(function (u) {
        return String(u.name).toLowerCase().indexOf(search) >= 0 ||
               String(u.email).toLowerCase().indexOf(search) >= 0;
      });
    }
    if (role === 'admin' || role === 'donor') {
      all = all.filter(function (u) { return u.role === role; });
    }
    all.sort(function (a, b) {
      var r = (a.role === 'admin' ? 0 : 1) - (b.role === 'admin' ? 0 : 1);
      return r !== 0 ? r : String(a.name).localeCompare(String(b.name));
    });

    var page = App.Views.pageState(all.length, ctx.query.page);
    var slice = all.slice(page.offset, page.offset + App.Layout.CONFIG.pageSize);

    var qs = [];
    if (ctx.query.q) qs.push('q=' + encodeURIComponent(ctx.query.q));
    if (role) qs.push('role=' + encodeURIComponent(role));
    var baseQuery = qs.length ? '?' + qs.join('&') : '';

    var rows = slice.map(function (u) {
      var isSelf = u.id === user.id;
      var linked = App.Store.donorByUserId(u.id);
      var linkedHtml = linked
        ? '<a href="#/donors/' + encodeURIComponent(linked.id) + '">' + esc(linked.referenceNo) + '</a>'
        : '<span class="muted-text">None</span>';

      var actions;
      if (isSelf) {
        actions = '<span class="muted-text">This is you</span>';
      } else {
        var id = encodeURIComponent(u.id);
        var nextRole = u.role === 'admin' ? 'donor' : 'admin';
        actions = '<div class="row-actions">' +
          '<button class="btn btn-outline btn-sm" type="button" data-user-toggle="' + id +
            '" data-active="' + (u.active !== false) + '">' +
            (u.active === false ? 'Reactivate' : 'Deactivate') + '</button>' +
          '<button class="btn btn-outline btn-sm" type="button" data-user-role="' + id +
            '" data-next-role="' + nextRole + '">Make ' + (nextRole === 'admin' ? 'admin' : 'donor') +
            '</button>' +
          '<a class="btn btn-danger-outline btn-sm" href="#/users/' + id + '/delete"' +
            ' data-confirm="Delete the account for ' + esc(u.name) + '?">Delete</a></div>';
      }

      return '<tr>' +
        '<td><div class="user-cell">' + App.UI.avatar(u) +
          '<div><p class="user-name">' + esc(u.name) +
            (isSelf ? ' <span class="badge badge-info">You</span>' : '') + '</p>' +
          '<p class="user-email">' + esc(u.email) + '</p></div></div></td>' +
        '<td>' + App.UI.rolePill(u.role) + '</td>' +
        '<td>' + App.UI.badge(u.active === false ? 'Deactivated' : 'Active',
          App.UI.statusTone(u.active === false ? 'Inactive' : 'Active')) + '</td>' +
        '<td>' + linkedHtml + '</td>' +
        '<td>' + esc(u.lastLoginAt ? App.UI.formatDate(u.lastLoginAt) : 'Never') + '</td>' +
        '<td class="cell-actions">' + actions + '</td>' +
      '</tr>';
    }).join('');

    var tableHtml = rows
      ? '<div class="table-wrap"><table class="data-table"><thead><tr>' +
          '<th scope="col">Name</th><th scope="col">Role</th><th scope="col">Status</th>' +
          '<th scope="col">Donor record</th><th scope="col">Last sign in</th>' +
          '<th scope="col">Actions</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      : App.UI.emptyState({
          icon: '&#128101;', title: 'No accounts match',
          message: 'Try a different search term or role filter.'
        });

    var filterHtml =
      '<form class="filter-bar" data-filter-form>' +
        '<div class="filter-search">' +
          '<label class="visually-hidden" for="q">Search accounts</label>' +
          '<input class="field-input" type="search" id="q" name="q" value="' + esc(ctx.query.q || '') +
          '" placeholder="Search name or email">' +
        '</div>' +
        '<div class="filter-selects">' +
          App.UI.selectField('role', 'Role',
            [{ value: 'admin', label: 'Administrators' }, { value: 'donor', label: 'Donors' }],
            role, null, { placeholder: 'All roles' }) +
          '<button class="btn btn-primary" type="submit">Filter</button>' +
          '<a class="btn btn-ghost" href="#/users">Reset</a>' +
        '</div>' +
      '</form>';

    return {
      title: 'Accounts',
      nav: 'users',
      html:
        App.UI.pageIntro({
          eyebrow: 'Administration', heading: 'Accounts',
          sub: 'Administrators manage the whole registry. Donors can only view and manage their own record.',
          actions: '<a class="btn btn-primary" href="#/users/new">Create account</a>'
        }) +
        '<section class="card card-flush">' + filterHtml + tableHtml + '</section>' +
        App.UI.pagination(page.page, page.totalPages, '/users' + baseQuery),
      onMount: function (root) {
        App.Views.wireFilter(root);
        wireUserActions(root, user);
      }
    };
  }

  function wireUserActions(root, actor) {
    root.addEventListener('click', function (e) {
      var toggle = e.target.closest ? e.target.closest('[data-user-toggle]') : null;
      if (toggle) {
        var target = App.Store.userById(toggle.getAttribute('data-user-toggle'));
        if (!target) return;
        var wasActive = target.active !== false;
        App.UI.confirmDialog({
          title: wasActive ? 'Deactivate this account?' : 'Reactivate this account?',
          message: target.name + ' will be ' + (wasActive ? 'signed out and unable to sign in again' : 'able to sign in again') + '.',
          confirmLabel: wasActive ? 'Yes, deactivate' : 'Yes, reactivate',
          danger: wasActive
        }).then(function (ok) {
          if (!ok) return;
          target.active = wasActive ? false : true;
          target.updatedAt = new Date().toISOString();
          App.Store.putUser(target);
          App.Store.logActivity('user.toggle', actor.id,
            target.name + (wasActive ? ' deactivated' : ' reactivated'));
          App.Layout.setFlash(target.name + ' has been ' +
            (wasActive ? 'deactivated.' : 'reactivated.'), 'success');
          App.Router.resolve();
        });
        return;
      }

      var roleBtn = e.target.closest ? e.target.closest('[data-user-role]') : null;
      if (roleBtn) {
        var subject = App.Store.userById(roleBtn.getAttribute('data-user-role'));
        var next = roleBtn.getAttribute('data-next-role');
        if (!subject) return;

        if (next === 'donor' && subject.role === 'admin' && App.Store.activeAdminCount() <= 1) {
          App.Layout.setFlash('You cannot demote the last active administrator account.', 'error');
          App.Router.resolve();
          return;
        }
        App.UI.confirmDialog({
          title: 'Change access level?',
          message: subject.name + ' will become ' + (next === 'admin' ? 'an Administrator' : 'a Donor') + '.',
          confirmLabel: 'Yes, change',
          danger: false
        }).then(function (ok) {
          if (!ok) return;
          subject.role = next;
          subject.updatedAt = new Date().toISOString();
          App.Store.putUser(subject);
          App.Store.logActivity('user.role', actor.id, subject.name + ' is now ' + next);
          App.Layout.setFlash(subject.name + ' is now ' +
            (next === 'admin' ? 'Administrator' : 'Donor') + '.', 'success');
          App.Router.resolve();
        });
      }
    });
  }

  // ----------------------------------------------------------------- create --
  function userCreate(ctx) {
    var errors = ctx.data.errors || {};
    var v = ctx.data.values || { role: 'donor' };

    var roleOptions = [
      { value: 'donor', label: 'Donor - can only manage their own record' },
      { value: 'admin', label: 'Administrator - can manage the whole registry' }
    ];

    return {
      title: 'Create account',
      nav: 'users',
      html:
        App.UI.pageIntro({
          eyebrow: 'Administration', heading: 'Create an account',
          sub: 'Use this for staff who need an administrator login. Ordinary donors are created by registering on the public site.',
          actions: '<a class="btn btn-ghost" href="#/users">Back to accounts</a>'
        }) +
        '<div class="form-layout">' +
          '<section class="card card-form">' +
            App.UI.errorSummary(errors) +
            '<form class="form-stack" data-form="user" novalidate>' +
              App.UI.textField('name', 'Full name', v.name, errors,
                { required: true, autofocus: true, maxlength: 80 }) +
              App.UI.textField('email', 'Email address', v.email, errors,
                { required: true, type: 'email', hint: 'Must be unique across all accounts.' }) +
              App.UI.selectField('role', 'Access level', roleOptions, v.role, errors,
                { required: true, labelFn: function (r) { return r.label; } }) +
              App.UI.textField('password', 'Temporary password', '', errors,
                { required: true, type: 'password',
                  hint: 'At least 8 characters, with a letter, a number and a symbol.' }) +
              App.UI.textField('phone', 'Mobile number', v.phone, errors, { type: 'tel', placeholder: 'Optional' }) +
              App.UI.textField('address', 'Address', v.address, errors, { maxlength: 160, placeholder: 'Optional' }) +
              '<div class="form-actions">' +
                '<button class="btn btn-primary" type="submit">Create account</button>' +
                '<a class="btn btn-ghost" href="#/users">Cancel</a>' +
              '</div>' +
            '</form>' +
          '</section>' +
          '<aside class="card card-aside"><h2 class="aside-title">Access levels</h2>' +
            '<ul class="rule-list">' +
              '<li><strong>Donor</strong> - sees only their own donor record, donation history and blood requests.</li>' +
              '<li><strong>Administrator</strong> - full access to every donor, donation, request and account.</li>' +
            '</ul>' +
            '<p class="aside-note">The last active administrator cannot be deleted or demoted, so the registry can never be left unmanaged.</p>' +
          '</aside>' +
        '</div>',
      onMount: function (root) {
        var form = root.querySelector('[data-form="user"]');
        if (!form) return;
        App.Views.wireStrength(form);

        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var body = App.Views.readForm(form);
          var result = App.Validate.registration(body, 'register');

          if (['admin', 'donor'].indexOf(body.role) < 0) {
            result.errors.role = 'Please choose Donor or Administrator.';
          }
          var problem = App.Validate.passwordPolicy(body.password || '');
          if (problem) result.errors.password = problem;

          if (Object.keys(result.errors).length) {
            App.Router.resolve({ data: result });
            return;
          }

          App.UI.busy(true);
          App.Auth.createWithRole(body).then(function (created) {
            App.UI.busy(false);
            App.Layout.setFlash('Account created for ' + created.name + ' (' + created.email + ').', 'success');
            App.Router.go('/users');
          }).catch(function (error) {
            App.UI.busy(false);
            App.Router.resolve({ data: { errors: error.errors || { form: error.message }, values: body } });
          });
        });
      }
    };
  }

  // ----------------------------------------------------------------- delete --
  function userDelete(ctx) {
    var actor = App.Auth.user();
    var target = App.Store.userById(ctx.params.id);

    if (!target) {
      return App.Views.errorPage({
        code: 404, heading: 'Account not found',
        message: 'That account does not exist. It may already have been deleted.'
      });
    }
    if (target.id === actor.id) {
      return App.Views.errorPage({
        code: 403, heading: 'You cannot delete your own account',
        message: 'Ask another administrator to remove this account if it is genuinely no longer needed.'
      });
    }

    var linked = App.Store.donorByUserId(target.id);
    var donationCount = linked ? App.Store.donationsForDonor(linked.id).length : 0;
    var id = encodeURIComponent(target.id);

    var linkedHtml = linked
      ? 'This will also delete the donor record <strong>' + esc(linked.fullName) + '</strong> (' +
        esc(linked.referenceNo) + ') and its ' + donationCount + ' donation record(s).'
      : 'No donor record is linked, so nothing else will be removed.';

    return {
      title: 'Delete account',
      nav: 'users',
      html:
        App.UI.pageIntro({
          eyebrow: 'Administration', heading: 'Delete this account?',
          sub: 'Please check the details below before you continue. This cannot be undone.'
        }) +
        '<section class="card card-danger">' +
          '<div class="confirm-summary">' + App.UI.avatar(target) +
            '<div><p class="confirm-name">' + esc(target.name) + ' ' + App.UI.rolePill(target.role) + '</p>' +
            '<p class="confirm-meta">' + esc(target.email) + '</p></div>' +
          '</div>' +
          '<div class="alert alert-warning"><span class="alert-icon" aria-hidden="true">&#9888;</span>' +
            '<div><strong>Permanent deletion</strong><p class="alert-text">' + linkedHtml + '</p></div>' +
          '</div>' +
          '<div class="form-actions">' +
            '<button class="btn btn-danger" type="button" data-delete-user="' + esc(target.id) + '">' +
              'Yes, delete this account</button>' +
            '<a class="btn btn-ghost" href="#/users">Cancel, keep the account</a>' +
          '</div>' +
        '</section>',
      onMount: function (root) {
        var button = root.querySelector('[data-delete-user]');
        if (!button) return;
        button.addEventListener('click', function () {
          if (target.role === 'admin' && App.Store.activeAdminCount() <= 1) {
            App.Layout.setFlash('You cannot remove the last active administrator account.', 'error');
            App.Router.resolve();
            return;
          }
          App.UI.confirmDialog({
            title: 'Delete this account?',
            message: 'Delete the account for ' + target.name + '? This cannot be undone.',
            confirmLabel: 'Yes, delete'
          }).then(function (ok) {
            if (!ok) return;
            var name = target.name;
            App.Store.deleteUser(target.id);
            App.Store.logActivity('user.delete', actor.id,
              'Deleted account ' + name + (linked ? ' and its donor record' : ''));
            App.Layout.setFlash('Account for ' + name + ' deleted.', 'success');
            App.Router.go('/users');
          });
        });
      }
    };
  }

  App.Views = App.Views || {};
  App.Views.userList = userList;
  App.Views.userCreate = userCreate;
  App.Views.userDelete = userDelete;
})(window.App);