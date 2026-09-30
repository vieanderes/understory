/**
 * One action of a check, as source text: a function expression
 * `(doc, win, action) => MissedAction | null`, where the action is `{ click: selector }`
 * or `{ type: text, into: selector }`.
 *
 * Source text for the same reason as the probe (probe.ts): the preview frame and the
 * content gate's jsdom evaluate the very same bytes. It acts on the first match that is
 * not the playground's own, the way a learner's pointer would, and returns what it missed.
 *
 * Typing sets the value through the element prototype's own setter, then fires `input`.
 * React tracks the last value it set on a controlled field; assigning `el.value` directly
 * would update that tracker too, and React would see no change and skip `onChange`. The
 * frame script calls this once per character and lets React render in between, as a
 * keyboard would.
 */
export const ACTION_SOURCE: string = String.raw`(function (doc, win, action) {
  'use strict';
  function first(selector) {
    var found;
    try {
      found = doc.querySelectorAll(selector);
    } catch (e) {
      return { invalid: true };
    }
    for (var i = 0; i < found.length; i += 1) {
      if (found[i].closest('[data-understory]') === null) return { el: found[i] };
    }
    return {};
  }
  var kind = action.click !== undefined ? 'click' : 'type';
  var selector = kind === 'click' ? action.click : action.into;
  var target = first(selector);
  if (target.invalid) return { action: kind, selector: selector, invalid: true };
  var el = target.el;
  if (!el) return { action: kind, selector: selector };

  if (kind === 'click') {
    if (typeof el.click === 'function') el.click();
    else el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true, view: win }));
    return null;
  }

  var proto = el instanceof win.HTMLInputElement
    ? win.HTMLInputElement.prototype
    : el instanceof win.HTMLTextAreaElement
      ? win.HTMLTextAreaElement.prototype
      : null;
  if (proto === null) return { action: kind, selector: selector, notField: true };
  var setValue = Object.getOwnPropertyDescriptor(proto, 'value').set;
  if (doc.activeElement !== el) el.focus();
  var key = { key: action.type, bubbles: true, cancelable: true };
  el.dispatchEvent(new win.KeyboardEvent('keydown', key));
  setValue.call(el, el.value + action.type);
  el.dispatchEvent(new win.Event('input', { bubbles: true }));
  el.dispatchEvent(new win.KeyboardEvent('keyup', key));
  return null;
})`;
