import { MAX_TREE_ROWS, PLAYGROUND_MESSAGE_SOURCE } from './protocol';

/**
 * The probe, as source text: a function expression
 * `(doc, win, checks, errors) => ProbeReport`.
 *
 * It is a string because two runtimes evaluate the very same bytes: the preview frame in
 * the learner's browser, and jsdom in the content gate (scripts/lib/playground-gate.ts).
 * It only gathers facts (counts, text, attributes, computed styles, the element tree);
 * judging them is `evaluateChecks`, in TypeScript, shared by both.
 *
 * ES2015 and the DOM only. Written with String.raw, so it contains no backtick and no
 * dollar-brace. Elements marked `data-understory` are the playground's own (the policy,
 * the probe, the CSS and JavaScript tabs) and are invisible to checks and to the tree.
 */
export const PROBE_SOURCE: string = String.raw`(function (doc, win, checks, errors) {
  'use strict';
  var MAX_ROWS = ${String(MAX_TREE_ROWS)};
  var MAX_TEXT = 40;
  var MAX_VALUE = 24;
  var MAX_ATTRS = 4;
  var MAX_FACT = 2000;

  function shorten(text, max) {
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
  }
  function squash(text) {
    return text.replace(/\s+/g, ' ').trim();
  }
  function ours(el) {
    return el.closest('[data-understory]') !== null;
  }

  function factsOf(check) {
    var found;
    try {
      found = doc.querySelectorAll(check.selector);
    } catch (e) {
      return { count: 0, invalid: true };
    }
    var matches = [];
    for (var i = 0; i < found.length; i += 1) if (!ours(found[i])) matches.push(found[i]);
    var facts = { count: matches.length };
    var first = matches[0];
    if (!first) return facts;
    if (check.text !== undefined) facts.text = (first.textContent || '').slice(0, MAX_FACT);
    if (check.attribute) {
      var value = first.getAttribute(check.attribute.name);
      facts.attribute = value === null ? null : value.slice(0, MAX_FACT);
    }
    if (check.style) {
      facts.style = String(
        win.getComputedStyle(first).getPropertyValue(check.style.property) || ''
      ).slice(0, MAX_FACT);
    }
    return facts;
  }

  var rows = [];
  var truncated = false;
  function walk(node, depth) {
    if (rows.length >= MAX_ROWS) {
      truncated = true;
      return;
    }
    if (node.nodeType === 1) {
      if (node.hasAttribute('data-understory')) return;
      var attrs = [];
      for (var i = 0; i < node.attributes.length && attrs.length < MAX_ATTRS; i += 1) {
        var attr = node.attributes[i];
        attrs.push({ name: shorten(attr.name, MAX_VALUE), value: shorten(attr.value, MAX_VALUE) });
      }
      rows.push({ depth: depth, kind: 'element', tag: shorten(node.localName, MAX_VALUE), attrs: attrs });
      for (var c = 0; c < node.childNodes.length; c += 1) walk(node.childNodes[c], depth + 1);
    } else if (node.nodeType === 3) {
      var text = squash(node.data);
      if (text !== '') rows.push({ depth: depth, kind: 'text', text: shorten(text, MAX_TEXT) });
    } else if (node.nodeType === 8) {
      rows.push({ depth: depth, kind: 'comment', text: shorten(squash(node.data), MAX_TEXT) });
    }
  }
  if (doc.documentElement) walk(doc.documentElement, 0);

  var facts = [];
  for (var k = 0; k < checks.length; k += 1) facts.push(factsOf(checks[k]));
  return { facts: facts, tree: rows, truncated: truncated, errors: errors.slice(0, 5) };
})`;

/**
 * Keeps links and forms from navigating the frame away from the page being built. A
 * handler the learner wrote still runs: only the browser's default action is stopped.
 */
export const NAVIGATION_GUARD = String.raw`document.addEventListener('click', function (event) {
    var link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (link && link.getAttribute('href').charAt(0) !== '#') event.preventDefault();
  }, true);
  document.addEventListener('submit', function (event) {
    event.preventDefault();
  }, true);`;

/** Stands for the line of the page where the JavaScript tab starts, until it is known. */
export const LINE_PLACEHOLDER = '"0000000"';

/**
 * The script the preview frame runs first. It collects errors, sends a report on load
 * and again, shortly after, whenever the page changes, and keeps links and forms from
 * navigating the frame away from the page being built.
 *
 * `checksJson` is already escaped for a script element. `LINE_PLACEHOLDER` is replaced
 * with the line where the learner's script starts, so an error names the learner's line.
 */
export function frameScript(nonce: string, checksJson: string): string {
  return String.raw`(function () {
  'use strict';
  var probe = ${PROBE_SOURCE};
  var checks = ${checksJson};
  var nonce = ${JSON.stringify(nonce)};
  var firstLine = parseInt(${LINE_PLACEHOLDER}, 10);
  var target = window.parent;
  var errors = [];
  var loaded = false;
  var timer = 0;
  function send() {
    timer = 0;
    var report;
    try {
      report = probe(document, window, checks, errors);
    } catch (e) {
      return;
    }
    target.postMessage({ source: ${JSON.stringify(PLAYGROUND_MESSAGE_SOURCE)}, nonce: nonce, report: report }, '*');
  }
  function later() {
    if (!loaded) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(send, 120);
  }
  window.addEventListener('error', function (event) {
    if (errors.length < 5) {
      var line = event.lineno ? event.lineno - firstLine + 1 : 0;
      errors.push(String(event.message).slice(0, 400) + (line > 0 ? ' (line ' + line + ')' : ''));
    }
    later();
  });
  ${NAVIGATION_GUARD}
  window.addEventListener('load', function () {
    loaded = true;
    send();
    new MutationObserver(later).observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true
    });
  });
})();`;
}
