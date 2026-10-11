/* ==========================================================================
   views/auth.js - register, sign in and sign out
   ========================================================================== */
window.App = window.App || {};

(function (App) {
  'use strict';

  var esc = App.UI.esc;

  function demoBox() {
    return '<div class="demo-box">' +
      '<p class="demo-title">Demo accounts</p>' +
      '<p class="demo-text">Use either of these to explore the system. On the very first visit they are ' +
      'created for you.</p>' +
      '<ul class="demo-list">' +
        '<li><strong>Administrator</strong><br><code>admin@stmichaelblood.org</code> / <code>Admin@12345</code></li>' +
        '<li><strong>Donor</strong><br><code>donor@stmichaelblood.org</code> / <code>Donor@12345</code></li>' +
      '</ul></div>';
  }

  // ------------------------------------------------------------- register --
  function register(ctx) {
    if (App.Auth.user()) {
      App.Router.go('/dashboard', { replace: true });
      return null;
    }

    var errors = ctx.data.errors || {};
    var v = ctx.data.values || {};
    var csrf = '';   // no server round trip, so no CSRF token is needed

    var html =
      App.UI.pageIntro({
        eyebrow: 'Join the registry',
        heading: 'Create your donor account',
        sub: 'It takes about two minutes. Once you are registered, the blood bank can match you with patients who need your blood group and you can keep your donation history in one place.'
      }) +
      '<div class="auth-grid">' +
        '<section class="card card-form">' +
          App.UI.errorSummary(errors) +
          '<form class="form-stack" data-form="register" novalidate>' +
            App.UI.textField('name', 'Full name', v.name, errors,
              { required: true, autofocus: true, maxlength: 80, placeholder: 'Juan Dela Cruz',
                hint: 'Exactly as it appears on your ID.' }) +
            App.UI.textField('email', 'Email address', v.email, errors,
              { required: true, type: 'email', placeholder: 'juan@example.com',
                hint: 'Used to sign in. Never shown to other donors.' }) +
            App.UI.textField('phone', 'Mobile number', v.phone, errors,
              { type: 'tel', placeholder: '0917 555 0123',
                hint: 'The blood bank calls this number to alert you. Optional.' }) +
            App.UI.textField('address', 'Address / barangay', v.address, errors,
              { maxlength: 160, placeholder: 'Purok 5, Barangay San Isidro',
                hint: 'Optional. Helps us plan mobile blood drives.' }) +
            App.UI.textField('password', 'Password', '', errors,
              { required: true, type: 'password', dataStrength: true,
                hint: 'At least 8 characters, with a letter, a number and a symbol.' }) +
            '<div class="form-actions">' +
              '<button class="btn btn-primary" type="submit">Create my account</button>' +
              '<a class="btn btn-ghost" href="#/login">I already have an account</a>' +
            '</div>' +
          '</form>' +
        '</section>' +
        '<aside class="card card-aside">' +
          '<h2 class="aside-title">What happens next</h2>' +
          '<ol class="steps steps-plain">' +
            '<li><strong>Your account is created</strong> with the role <em>Donor</em>. You can sign in straight away.</li>' +
            '<li><strong>You complete your donor profile</strong> with blood group, date of birth and weight.</li>' +
            '<li><strong>We screen you automatically</strong> against the donation rules every time your profile is opened.</li>' +
            '<li><strong>You get alerted</strong> when a patient needs your blood group.</li>' +
          '</ol>' +
          '<p class="aside-note">Blood bank administrators see the whole registry so they can match donors to patients. Other donors never see your details.</p>' +
        '</aside>' +
      '</div>';

    return {
      title: 'Create your donor account',
      html: html,
      nav: 'home',
      onMount: function (root) { bindRegister(root); }
    };
  }

  function bindRegister(root) {
    var form = root.querySelector('[data-form="register"]');
    if (!form) return;
    wireStrength(form);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var body = readForm(form);

      var result = App.Validate.registration(body, 'register');
      var problem = App.Validate.passwordPolicy(body.password || '');
      if (problem) result.errors.password = problem;

      if (Object.keys(result.errors).length) {
        App.Router.resolve({ data: result });
        return;
      }

      App.UI.busy(true);
      App.Auth.register(body).then(function (user) {
        App.UI.busy(false);
        return App.Auth.login(user.email, body.password);
      }).then(function (user) {
        App.UI.busy(false);
        App.Layout.setFlash('Welcome, ' + user.name + '. Your donor account is ready.', 'success');
        App.Router.go('/dashboard');
      }).catch(function (error) {
        App.UI.busy(false);
        var errors = error.errors || { form: error.message };
        App.Router.resolve({ data: { errors: errors, values: body } });
      });
    });
  }

  // --------------------------------------------------------------- login --
  function login(ctx) {
    if (App.Auth.user()) {
      App.Router.go('/dashboard', { replace: true });
      return null;
    }

    var errors = ctx.data.errors || {};
    var v = ctx.data.values || {};
    var next = ctx.query.next ? decodeURIComponent(ctx.query.next) : '/dashboard';

    // Only same-site hash routes are honoured, so ?next= cannot become an
    // open redirect to another site.
    if (next.charAt(0) !== '/' || next.charAt(1) === '/') next = '/dashboard';

    var html =
      App.UI.pageIntro({
        eyebrow: 'Welcome back',
        heading: 'Sign in to your account',
        sub: 'Manage your donor profile, keep track of your donations and see which patients are waiting for your blood group.'
      }) +
      '<div class="auth-grid">' +
        '<section class="card card-form">' +
          App.UI.errorSummary(errors) +
          '<form class="form-stack" data-form="login" novalidate>' +
            App.UI.hiddenField('next', next) +
            App.UI.textField('email', 'Email address', v.email, errors,
              { required: true, type: 'email', autofocus: true, placeholder: 'you@example.com' }) +
            App.UI.textField('password', 'Password', '', errors,
              { required: true, type: 'password' }) +
            '<div class="form-actions">' +
              '<button class="btn btn-primary" type="submit">Sign in</button>' +
              '<a class="btn btn-ghost" href="#/register">Create an account</a>' +
            '</div>' +
          '</form>' +
        '</section>' +
        '<aside class="card card-aside">' +
          demoBox() +
          '<p class="aside-note">Passwords are stored as PBKDF2 salted hashes using ' +
          esc(App.Crypto.engine().algorithm) + ' at ' +
          esc(App.Crypto.engine().iterations.toLocaleString()) + ' rounds. ' +
          'The plain-text password is never written anywhere.</p>' +
        '</aside>' +
      '</div>';

    return {
      title: 'Sign in',
      html: html,
      nav: 'home',
      onMount: function (root) { bindLogin(root, next); }
    };
  }

  function bindLogin(root, next) {
    var form = root.querySelector('[data-form="login"]');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var body = readForm(form);
      var result = App.Validate.login(body);

      if (Object.keys(result.errors).length) {
        App.Router.resolve({ data: { errors: result.errors, values: { email: body.email } } });
        return;
      }

      App.UI.busy(true);
      App.Auth.login(body.email, body.password).then(function (user) {
        App.UI.busy(false);
        App.Layout.setFlash('Welcome back, ' + user.name + '.', 'success');
        App.Router.go(next);
      }).catch(function (error) {
        App.UI.busy(false);
        App.Router.resolve({ data: { errors: { form: error.message }, values: { email: body.email } } });
      });
    });
  }

  // ------------------------------------------------------------- helpers --
  /** Reads every named control in a form into a plain object. */
  function readForm(form) {
    var body = {};
    var fields = form.querySelectorAll('input, select, textarea');
    Array.prototype.forEach.call(fields, function (el) {
      if (!el.name) return;
      if (el.type === 'checkbox') {
        body[el.name] = el.checked;
      } else {
        body[el.name] = el.value;
      }
    });
    return body;
  }

  /** Live strength meter under a password field. */
  function wireStrength(form) {
    var input = form.querySelector('input[name="password"]');
    if (!input) return;
    var field = input.closest('.field');
    if (!field || field.querySelector('[data-strength]')) return;

    var hint = document.createElement('p');
    hint.className = 'field-hint';
    hint.setAttribute('data-strength', '');
    hint.textContent = 'Minimum 8 characters with a letter, a number and a symbol.';
    var error = field.querySelector('.field-error');
    if (error) field.insertBefore(hint, error); else field.appendChild(hint);

    input.addEventListener('input', function () {
      var val = input.value;
      if (!val) {
        hint.textContent = 'Minimum 8 characters with a letter, a number and a symbol.';
        hint.style.color = '';
        return;
      }
      var score = 0;
      if (val.length >= 8) score++;
      if (/[A-Za-z]/.test(val)) score++;
      if (/[0-9]/.test(val)) score++;
      if (/[^A-Za-z0-9]/.test(val)) score++;

      var labels = [
        'Too short - at least 8 characters needed.',
        'Weak - add a number or a symbol.',
        'Getting there - add a symbol.',
        'Good - add a symbol for extra strength.',
        'Strong password.'
      ];
      hint.textContent = labels[score];
      hint.style.color = score === 4 ? '#057a55' : '';
    });
  }

  App.Views = App.Views || {};
  App.Views.register = register;
  App.Views.login = login;
  App.Views.readForm = readForm;
  App.Views.wireStrength = wireStrength;
})(window.App);