/* ==========================================================================
   tests/__suite.js - a tiny assertion helper
   ========================================================================== */
window.Test = (function () {
  'use strict';

  var results = [];
  var only = null;

  function reset(filter) { results = []; only = filter || null; }

  function record(name, ok, detail) {
    results.push({ name: name, ok: !!ok, detail: detail || '' });
    return ok;
  }

  function test(name, fn) {
    if (only && name.indexOf(only) < 0) return;
    try {
      var outcome = fn();
      if (outcome && typeof outcome.then === 'function') {
        outcome.then(
          function () { record(name, true); },
          function (error) { record(name, false, error && error.message); }
        );
      } else {
        record(name, true);
      }
    } catch (error) {
      record(name, false, error && error.message);
    }
  }

  function assert(condition, message) {
    if (!condition) throw new Error(message || 'assertion failed');
  }

  function equal(actual, expected, message) {
    if (actual !== expected) {
      throw new Error((message || 'values differ') +
        ' - expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
    }
  }

  function summary() {
    var passed = results.filter(function (r) { return r.ok; }).length;
    var failed = results.filter(function (r) { return !r.ok; });
    return {
      total: results.length,
      passed: passed,
      failed: failed.length,
      failures: failed.map(function (r) { return r.name + ' :: ' + r.detail; }),
      all: results
    };
  }

  function print() {
    var s = summary();
    var lines = [];
    s.all.forEach(function (r) {
      lines.push((r.ok ? '  PASS  ' : '  FAIL  ') + r.name + (r.ok || !r.detail ? '' : '  -> ' + r.detail));
    });
    lines.push('');
    lines.push(s.failed === 0
      ? '   ALL ' + s.passed + ' CHECKS PASSED'
      : '   ' + s.passed + ' passed, ' + s.failed + ' FAILED');
    return lines.join('\n');
  }

  return { reset: reset, test: test, assert: assert, equal: equal, summary: summary, print: print };
})();