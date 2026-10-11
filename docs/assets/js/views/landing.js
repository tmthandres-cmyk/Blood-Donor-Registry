/* ==========================================================================
   views/landing.js - the public landing page
   --------------------------------------------------------------------------
   No login required. Only aggregate registry figures are shown - never a
   donor's personal details.
   ========================================================================== */
window.App = window.App || {};

(function (App) {
  'use strict';

  var esc = App.UI.esc;

  function availabilityRows(stats) {
    var max = 1;
    App.Store.BLOOD_TYPES.forEach(function (b) {
      if (stats.byType[b.value] > max) max = stats.byType[b.value];
    });

    return App.Store.BLOOD_TYPES.map(function (b) {
      var count = stats.byType[b.value];
      var pct = Math.round((count / max) * 100);
      var tone = App.UI.bloodTypeTone(b.value);
      return '<div class="avail-row">' +
        App.UI.bloodBadge(b.value) +
        '<span class="avail-name">' + esc(b.label) + '</span>' +
        '<span class="avail-bar"><span class="avail-fill ' + tone + '" style="width:' + pct + '%"></span></span>' +
        '<span class="avail-count">' + esc(count + ' donor(s)') + '</span>' +
        '</div>';
    }).join('');
  }

  function landing() {
    var C = App.Layout.CONFIG;
    var stats = App.Store.donorStats();
    var donations = App.Store.donationStats();
    var requests = App.Store.requestStats();

    var services = [
      { icon: '&#128697;', title: 'Become a registered donor',
        text: 'Create a free account and your blood group, weight and date of birth are screened against the donation rules straight away. You will know immediately whether you are eligible.' },
      { icon: '&#128137;', title: 'Record every donation',
        text: 'Log whole blood, plasma and platelet donations in one place. The registry keeps a running total and always calculates when your next donation is due.' },
      { icon: '&#128220;', title: 'Post a blood request',
        text: 'Hospitals and clinics post what they need - group, number of units and how urgent. Open requests are visible immediately so donors can be alerted.' },
      { icon: '&#9873;', title: 'Learn who you can donate to',
        text: 'A plain-language compatibility chart explains exactly which recipients each blood group can help, with no medical jargon.' },
      { icon: '&#128269;', title: 'Automatic eligibility screening',
        text: 'Age, weight, recovery interval and registry status are checked on every record, so a donor is never called in when they are not actually able to give.' },
      { icon: '&#127968;', title: 'Community blood drives',
        text: 'See which groups the centre is short of, so you can plan when to come in and what is most needed.' }
    ];

    var serviceHtml = services.map(function (s) {
      return '<article class="service-card">' +
        '<span class="service-icon" aria-hidden="true">' + s.icon + '</span>' +
        '<h3 class="service-title">' + esc(s.title) + '</h3>' +
        '<p class="service-text">' + esc(s.text) + '</p></article>';
    }).join('');

    var steps = [
      ['Register online', 'Create your account with your name, email and a password. No paperwork, no queue at the office.'],
      ['Complete your donor profile', 'Add your blood group, date of birth, weight and contact number so we can screen and reach you.'],
      ['Get screened automatically', 'The system applies the age, weight and recovery-interval rules and tells you when you may next donate.'],
      ['Save a life', 'When a patient needs your group you are alerted, you donate at the centre, and the donation is recorded.']
    ];
    var stepsHtml = steps.map(function (s, i) {
      return '<li class="how-step"><span class="how-num" aria-hidden="true">' + (i + 1) + '</span>' +
        '<h3 class="how-title">' + esc(s[0]) + '</h3>' +
        '<p class="how-text">' + esc(s[1]) + '</p></li>';
    }).join('');

    var faqs = [
      ['Who can donate blood?',
       'Generally, healthy adults aged 18 to 65 who weigh at least 50 kg. You may donate whole blood once every 90 days.'],
      ['Do I have to be a medical professional to donate?',
       'No. Any healthy adult who passes the screening can donate. A short health questionnaire and a quick vital-sign check are taken at the centre before your blood is collected.'],
      ['Is my personal information visible to other donors?',
       'No. Your name, contact number and address are only visible to you and to authorised blood bank administrators. Other donors see anonymous totals only.'],
      ['Why can\'t I donate yet?',
       'The system screens every record against the donation rules. If you donated recently, your next due date is shown on your profile. If you are under 18, under 50 kg, or your record is deferred, the exact reason is listed on the same page.'],
      ['How long does a donation take?',
       'About 30 to 40 minutes from arrival. The actual collection is roughly 10 minutes, with time spent on screening, refreshments and rest afterwards.'],
      ['Can I donate if I am on medication?',
       'Many common medicines do not stop you donating. Certain treatments do, so always answer the health questionnaire honestly at the centre - a pharmacist will advise you.']
    ];
    var faqHtml = faqs.map(function (f) {
      return '<details class="faq-item"><summary class="faq-q">' + esc(f[0]) + '</summary>' +
             '<p class="faq-a">' + esc(f[1]) + '</p></details>';
    }).join('');

    var html =
      '<section class="hero">' +
        '<div class="container hero-grid">' +
          '<div class="hero-copy">' +
            '<p class="hero-eyebrow">' + esc(C.bloodCenter) + '</p>' +
            '<h1 class="hero-title">' + esc(C.siteName) + '</h1>' +
            '<p class="hero-tagline">' + esc(C.tagline) + '</p>' +
            '<p class="hero-desc">' + esc(C.description) + '</p>' +
            '<div class="hero-actions">' +
              '<a class="btn btn-primary btn-lg" href="#/register">Become a donor</a>' +
              '<a class="btn btn-outline btn-lg" href="#/login">Sign in</a>' +
              '<a class="btn btn-ghost btn-lg" href="#/#services">See what we do</a>' +
            '</div>' +
            '<ul class="hero-stats">' +
              '<li><strong>' + esc(stats.total) + '</strong><span>registered donors</span></li>' +
              '<li><strong>' + esc(stats.eligible) + '</strong><span>currently eligible</span></li>' +
              '<li><strong>' + esc(donations.units) + '</strong><span>units collected</span></li>' +
              '<li><strong>' + esc(requests.open) + '</strong><span>open requests</span></li>' +
            '</ul>' +
          '</div>' +
          '<div class="hero-art">' +
            '<img src="assets/img/hero-blood.svg" width="520" height="480" ' +
            'alt="Illustration of a blood donation bag filled with donated blood, a heartbeat heart, and floating blood group badges">' +
          '</div>' +
        '</div>' +
      '</section>' +

      '<section class="section section-alt" id="services">' +
        '<div class="container">' +
          App.UI.sectionHeading({
            eyebrow: 'What we offer',
            heading: 'Everything a donor and a hospital need',
            sub: 'One registry shared by the people who give blood and the people who request it, so matching happens faster.'
          }) +
          '<div class="service-grid">' + serviceHtml + '</div>' +
        '</div>' +
      '</section>' +

      '<section class="section" id="how-it-works">' +
        '<div class="container">' +
          App.UI.sectionHeading({ eyebrow: 'How it works', heading: 'Four steps from sign-up to donation', align: 'center' }) +
          '<ol class="how-steps how-grid">' + stepsHtml + '</ol>' +
          '<div class="section-cta"><a class="btn btn-primary btn-lg" href="#/register">Start registering now</a></div>' +
        '</div>' +
      '</section>' +

      '<section class="section section-alt" id="compatibility">' +
        '<div class="container">' +
          App.UI.sectionHeading({
            eyebrow: 'Blood groups',
            heading: 'Who can donate to whom',
            sub: 'Find your group on the left. Red cells follow these rules - a tick means that donor can give to that recipient.'
          }) +
          '<div class="compat-layout">' +
            '<div class="compat-main">' + App.UI.compatibilityTable() + '</div>' +
            '<aside class="compat-side">' +
              '<h3 class="compat-side-title">Donor numbers by group</h3>' +
              '<p class="compat-side-sub">Taken from this registry. Only totals are shown - never personal details.</p>' +
              '<div class="avail-list">' + availabilityRows(stats) + '</div>' +
              '<p class="compat-side-note">Groups with fewer donors are the hardest to match in an emergency. If you fall in one of them, please consider registering.</p>' +
            '</aside>' +
          '</div>' +
        '</div>' +
      '</section>' +

      '<section class="section" id="faq">' +
        '<div class="container container-narrow">' +
          App.UI.sectionHeading({ eyebrow: 'Questions', heading: 'Frequently asked questions', align: 'center' }) +
          '<div class="faq-list">' + faqHtml + '</div>' +
        '</div>' +
      '</section>' +

      '<section class="cta-band">' +
        '<div class="container cta-band-inner">' +
          '<div>' +
            '<h2 class="cta-title">One bag of blood can save three lives</h2>' +
            '<p class="cta-text">Registering takes two minutes. The next patient who needs your blood group may not be far away.</p>' +
          '</div>' +
          '<div class="cta-actions">' +
            '<a class="btn btn-light btn-lg" href="#/register">Create my account</a>' +
            '<p class="cta-phone">Or call the blood center: <strong>' + esc(C.hotline) + '</strong></p>' +
            '<p class="cta-hours">' + esc(C.officeHours) + '</p>' +
          '</div>' +
        '</div>' +
      '</section>';

    var view = { title: '', html: html, nav: 'home' };

    // Landing anchors (#services, #faq) need a scroll once the page is drawn.
    view.onMount = function () {
      var anchor = window.location.hash.indexOf('#/#') === 0
        ? window.location.hash.substring(3) : '';
      if (anchor) {
        var target = document.getElementById(anchor);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    view.keepScroll = true;
    return view;
  }

  App.Views = App.Views || {};
  App.Views.landing = landing;
})(window.App);