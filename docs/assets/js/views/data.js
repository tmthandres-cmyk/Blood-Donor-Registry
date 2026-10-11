/* ==========================================================================
   views/data.js - backup, restore and first-run seeding
   --------------------------------------------------------------------------
   Because the registry lives in this browser only, Export is the honest way to
   keep a backup or move records to another device.
   ========================================================================== */
window.App = window.App || {};

(function (App) {
  'use strict';

  var esc = App.UI.esc;

  function dataTools() {
    var stats = App.Store.donorStats();
    var users = App.Store.allUsers();
    var engine = App.Crypto.engine();

    var summary = [
      ['Accounts', users.length],
      ['Donors', stats.total],
      ['Donations', App.Store.donationStats().total],
      ['Blood requests', App.Store.requestStats().total]
    ];

    return {
      title: 'Data tools',
      nav: 'data',
      html:
        App.UI.pageIntro({
          eyebrow: 'Your data', heading: 'Data tools',
          sub: 'Export a backup, restore one, or start again from the demo data.'
        }) +
        App.Layout.localOnlyNoteHtml() +

        '<section class="card">' +
          '<h2 class="card-title">What is stored</h2>' +
          App.UI.factsGrid(summary.map(function (s) { return [s[0], String(s[1])]; }), true) +
          '<p class="card-sub" style="margin-top:1rem">Storage key: <code>' +
            esc(App.Store.STORAGE_KEY) + '</code></p>' +
        '</section>' +

        '<section class="card">' +
          '<h2 class="card-title">Export</h2>' +
          '<p class="card-sub">Downloads the whole registry as a JSON file. ' +
          'Keep this as a backup before clearing your browsing data.</p>' +
          '<div class="data-actions">' +
            '<button class="btn btn-primary" type="button" data-export>Download backup</button>' +
            '<button class="btn btn-outline" type="button" data-show-export>Show in this page</button>' +
          '</div>' +
          '<textarea class="data-output" data-export-output readonly ' +
            'style="display:none" aria-label="Registry export"></textarea>' +
        '</section>' +

        '<section class="card">' +
          '<h2 class="card-title">Import</h2>' +
          '<p class="card-sub">Restores a backup. This replaces the accounts, donors, donations and ' +
          'requests currently in this browser, so export first if you want to keep them.</p>' +
          '<div class="data-actions">' +
            '<input class="field-input" type="file" accept="application/json,.json" ' +
              'data-import-file style="max-width:360px">' +
          '</div>' +
        '</section>' +

        '<section class="card">' +
          '<h2 class="card-title">Start again</h2>' +
          '<p class="card-sub">Removes every donor, donation, request and log entry, and reloads the ' +
          'demo data. Your accounts and sign-in are kept. You will be signed out.</p>' +
          '<div class="data-actions">' +
            '<button class="btn btn-danger-outline" type="button" data-reset>Reset to demo data</button>' +
          '</div>' +
        '</section>' +

        '<section class="card">' +
          '<h2 class="card-title">Password security</h2>' +
          '<ul class="rule-list">' +
            '<li>Algorithm: <strong>' + esc(engine.algorithm) + '</strong></li>' +
            '<li>Iterations: <strong>' + esc(engine.iterations.toLocaleString()) + '</strong></li>' +
            '<li>Engine: <strong>' + esc(engine.name) + '</strong></li>' +
            '<li>Every account has its own random 16-byte salt.</li>' +
            '<li>Plain-text passwords are never written to storage.</li>' +
          '</ul>' +
          (engine.strong ? '' :
            '<p class="storage-note" style="margin-top:1rem">' + esc(engine.note || '') + '</p>') +
        '</section>',

      onMount: function (root) { wireDataTools(root); }
    };
  }

  function wireDataTools(root) {
    var output = root.querySelector('[data-export-output]');

    var exportBtn = root.querySelector('[data-export]');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        var json = App.Store.exportJson();
        var blob = new Blob([json], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = 'lifetime-blood-registry-' +
          new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        App.UI.toast('Backup downloaded.', 'success');
      });
    }

    var showBtn = root.querySelector('[data-show-export]');
    if (showBtn) {
      showBtn.addEventListener('click', function () {
        output.style.display = 'block';
        output.value = App.Store.exportJson();
        output.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }

    var fileInput = root.querySelector('[data-import-file]');
    if (fileInput) {
      fileInput.addEventListener('change', function () {
        var file = fileInput.files && fileInput.files[0];
        if (!file) return;

        var reader = new FileReader();
        reader.onload = function () {
          App.UI.confirmDialog({
            title: 'Replace the current registry?',
            message: 'Importing replaces everything in this browser with the contents of ' +
                     file.name + '. Export first if you want to keep the current records.',
            confirmLabel: 'Yes, import'
          }).then(function (ok) {
            if (!ok) { fileInput.value = ''; return; }
            try {
              var result = App.Store.importJson(String(reader.result));
              App.UI.toast('Imported ' + result.donors + ' donor(s) and ' +
                result.donations + ' donation(s).', 'success');
              fileInput.value = '';
              App.Layout.setFlash('Backup imported successfully.', 'success');
              App.Router.resolve();
            } catch (error) {
              App.UI.toast(error.message, 'error');
              fileInput.value = '';
            }
          });
        };
        reader.readAsText(file);
      });
    }

    var resetBtn = root.querySelector('[data-reset]');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        App.UI.confirmDialog({
          title: 'Reset to demo data?',
          message: 'Every donor, donation, blood request and log entry will be removed and the ' +
                   'demo data reloaded. Your accounts are kept and you will be signed out.',
          confirmLabel: 'Yes, reset'
        }).then(function (ok) {
          if (!ok) return;
          App.Auth.logout();
          App.Store.resetRecords();
          App.Store.wipe();
          App.UI.toast('The registry has been reset.', 'success');
          window.location.hash = '#/';
          window.location.reload();
        });
      });
    }
  }

  App.Views = App.Views || {};
  App.Views.dataTools = dataTools;
})(window.App);