/**
 * A DOM for React challenges: linkedom plus the behaviour a component test leans on
 * and linkedom leaves out. It runs in a Web Worker in the browser and in a `node:vm`
 * context in the CI gate, so it may use nothing but ES built-ins and timers.
 *
 * What is added, and why:
 * - Events with a capture phase and click activation (events.ts).
 * - Focus: `focus()`, `blur()`, `document.activeElement`, focus and focusin events.
 * - Form state: `value`, `checked` and `selected` as properties apart from attributes,
 *   `select.options`, `label.control`, `labels`, `form.requestSubmit()`.
 * - `getComputedStyle`, from the inline `style` and the `hidden` attribute only. There
 *   is no layout and no style sheet: Testing Library needs `display` and `visibility`
 *   to tell what is hidden, and that is all this answers.
 * - No-op layout APIs (`getBoundingClientRect`, `scrollIntoView`, observers) so that
 *   ordinary component code does not crash.
 */
import { parseHTML } from 'linkedom';
import {
  EVENT_CLASSES,
  ShimEvent,
  ShimFocusEvent,
  ShimInputEvent,
  ShimMouseEvent,
  ShimSubmitEvent,
  patchEventTarget,
  type Activation,
} from './events';

type Obj = Record<string, unknown>;

/** The slice of linkedom's element that the patches below touch. */
interface El {
  localName: string;
  tagName: string;
  ownerDocument: Doc;
  parentElement: El | null;
  hidden?: boolean;
  disabled?: boolean;
  style: { getPropertyValue(name: string): string };
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  querySelectorAll(selector: string): Iterable<El>;
  closest(selector: string): El | null;
  contains(other: unknown): boolean;
  dispatchEvent(event: unknown): boolean;
  textContent: string | null;
  isConnected: boolean;
  focus(): void;
  click(): void;
}

interface Doc {
  body: El;
  documentElement: El;
  defaultView: Obj;
  getElementById(id: string): El | null;
  querySelectorAll(selector: string): Iterable<El>;
  createElement(name: string): El;
}

export interface DomInstallation {
  window: Obj;
  document: Doc;
  /** Empties the body and forgets focus. Called between tests. */
  reset(): void;
}

function define(prototype: object, name: string, descriptor: PropertyDescriptor): void {
  Object.defineProperty(prototype, name, { configurable: true, ...descriptor });
}

function protoOf(window: Obj, name: string): object {
  const ctor = window[name] as { prototype: object } | undefined;
  if (!ctor) throw new Error(`linkedom has no ${name}`);
  return ctor.prototype;
}

const INPUT_TYPES = new Set([
  'hidden',
  'text',
  'search',
  'tel',
  'url',
  'email',
  'password',
  'date',
  'month',
  'week',
  'time',
  'datetime-local',
  'number',
  'range',
  'color',
  'checkbox',
  'radio',
  'file',
  'submit',
  'image',
  'reset',
  'button',
]);
const FORM_CONTROLS = new Set(['input', 'select', 'textarea', 'button']);
const LABELABLE = new Set(['input', 'select', 'textarea', 'button', 'meter', 'output', 'progress']);

function isDisabled(el: El): boolean {
  return FORM_CONTROLS.has(el.localName) && el.hasAttribute('disabled');
}

function isFocusable(el: El): boolean {
  if (isDisabled(el)) return false;
  const tag = el.localName;
  if (tag === 'input') return el.getAttribute('type') !== 'hidden';
  if (FORM_CONTROLS.has(tag)) return true;
  if ((tag === 'a' || tag === 'area') && el.hasAttribute('href')) return true;
  if (tag === 'summary') return true;
  if (el.hasAttribute('tabindex')) return true;
  const editable = el.getAttribute('contenteditable');
  return editable !== null && editable !== 'false';
}

function isRendered(el: El): boolean {
  for (let node: El | null = el; node; node = node.parentElement) {
    if (node.hasAttribute('hidden')) return false;
    if (node.style.getPropertyValue('display') === 'none') return false;
  }
  return true;
}

function tabIndexOf(el: El): number {
  const raw = el.getAttribute('tabindex');
  if (raw !== null && /^-?\d+$/.test(raw.trim())) return Number(raw);
  return isFocusable(el) ? 0 : -1;
}

/** Elements that Tab visits, in the order a browser visits them. */
export function tabbable(document: Doc): El[] {
  const all = Array.from(document.querySelectorAll('*')).filter(
    (el) => isFocusable(el) && tabIndexOf(el) >= 0 && isRendered(el),
  );
  const positive = all.filter((el) => tabIndexOf(el) > 0);
  positive.sort((a, b) => tabIndexOf(a) - tabIndexOf(b));
  return [...positive, ...all.filter((el) => tabIndexOf(el) === 0)];
}

function isCheckable(el: El): boolean {
  if (el.localName !== 'input') return false;
  const type = el.getAttribute('type');
  return type === 'checkbox' || type === 'radio';
}

function isSubmitter(el: El): boolean {
  if (isDisabled(el)) return false;
  const type = (el.getAttribute('type') ?? '').toLowerCase();
  if (el.localName === 'button') return type === '' || type === 'submit';
  return el.localName === 'input' && (type === 'submit' || type === 'image');
}

export function installDom(host: Obj, report: (error: unknown) => void): DomInstallation {
  // The capture phase must be in place before linkedom binds any listener method.
  let current: Doc | null = null;
  const values = new WeakMap<El, string>();
  const checked = new WeakMap<El, boolean>();
  const selected = new WeakMap<El, boolean>();
  const selections = new WeakMap<El, [number, number]>();
  let active: El | null = null;

  const shimGlobals: Obj = {
    ...EVENT_CLASSES,
    getComputedStyle,
    requestAnimationFrame: (fn: (time: number) => void) =>
      setTimeout(() => fn(Date.now()), 16) as unknown as number,
    cancelAnimationFrame: (id: number) => clearTimeout(id),
    matchMedia: (query: string) => ({
      matches: false,
      media: String(query),
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
    ResizeObserver: InertObserver,
    IntersectionObserver: InertObserver,
    scrollTo: () => undefined,
    scrollBy: () => undefined,
    innerWidth: 1024,
    innerHeight: 768,
    devicePixelRatio: 1,
  };

  const { window: linkedomWindow } = parseHTML(
    '<!doctype html><html lang="en"><head><title>Sandbox</title></head><body></body></html>',
    shimGlobals,
  ) as unknown as { window: Obj };
  const window = linkedomWindow;
  const document = window.document as Doc;
  current = document;

  // linkedom has classes for these tags but does not register them, so a <label> or a
  // <form> is a bare HTMLElement. The patches below live on the specific classes.
  const htmlElementProto = protoOf(window, 'HTMLElement');
  const unregistered: Record<string, string> = {
    label: 'HTMLLabelElement',
    form: 'HTMLFormElement',
    fieldset: 'HTMLFieldSetElement',
    legend: 'HTMLLegendElement',
    li: 'HTMLLIElement',
    meter: 'HTMLMeterElement',
    output: 'HTMLOutputElement',
    progress: 'HTMLProgressElement',
    details: 'HTMLDetailsElement',
    div: 'HTMLDivElement',
    span: 'HTMLSpanElement',
    p: 'HTMLParagraphElement',
    ul: 'HTMLUListElement',
    ol: 'HTMLOListElement',
    dl: 'HTMLDListElement',
    table: 'HTMLTableElement',
    tr: 'HTMLTableRowElement',
    td: 'HTMLTableCellElement',
    th: 'HTMLTableCellElement',
    caption: 'HTMLTableCaptionElement',
    optgroup: 'HTMLOptGroupElement',
    pre: 'HTMLPreElement',
  };
  const documentProto = Object.getPrototypeOf(document) as {
    createElement(name: string, options?: unknown): El;
  };
  const createElement = documentProto.createElement;
  define(documentProto, 'createElement', {
    value(this: Doc, name: string, options?: unknown) {
      const created = createElement.call(this, name, options);
      const className = unregistered[String(created.localName)];
      const ctor = className ? (window[className] as { prototype: object } | undefined) : undefined;
      if (ctor && Object.getPrototypeOf(created) === htmlElementProto) {
        Object.setPrototypeOf(created, ctor.prototype);
      }
      return created;
    },
    writable: true,
  });
  // linkedom serialises nodes to arrays in toJSON, and pretty-format prefers toJSON to
  // its DOM printer, so failure messages would show arrays instead of markup.
  for (const name of [
    'Node',
    'Element',
    'HTMLElement',
    'Document',
    'DocumentFragment',
    'Text',
    'Comment',
    'CharacterData',
  ]) {
    for (
      let proto = (window[name] as { prototype?: object } | undefined)?.prototype;
      proto;
      proto = Object.getPrototypeOf(proto) as object
    ) {
      if (Object.prototype.hasOwnProperty.call(proto, 'toJSON')) delete (proto as Obj).toJSON;
    }
  }

  patchEventTarget(protoOf(window, 'EventTarget'), {
    report,
    activation: (event, path) => {
      if (event.type !== 'click' || !(event instanceof ShimMouseEvent)) return null;
      for (const node of path) {
        const found = activationFor(node as El);
        if (found) return found;
      }
      return null;
    },
  });
  // Creates the window's event target now, with the patched methods bound to it.
  void window.addEventListener;

  function getComputedStyle(el: El, pseudo?: string | null): Obj {
    const read = (name: string): string => {
      if (pseudo) return name === 'content' ? 'none' : '';
      const inline = el.style.getPropertyValue(name);
      if (name === 'display') {
        if (el.hasAttribute('hidden')) return 'none';
        return inline || 'block';
      }
      if (name === 'visibility') {
        if (inline) return inline;
        const parent = el.parentElement;
        return parent ? String(getComputedStyle(parent).visibility) : 'visible';
      }
      return inline;
    };
    return {
      display: read('display'),
      visibility: read('visibility'),
      getPropertyValue: read,
    };
  }

  // ---- Focus --------------------------------------------------------------------------

  function activeElement(): El {
    if (active && active.isConnected && document.documentElement.contains(active)) return active;
    active = null;
    return document.body;
  }

  function moveFocus(next: El | null): void {
    const previous = active && document.documentElement.contains(active) ? active : null;
    if (previous === next) return;
    active = next;
    if (previous) {
      previous.dispatchEvent(new ShimFocusEvent('blur', { relatedTarget: next }));
      previous.dispatchEvent(
        new ShimFocusEvent('focusout', { bubbles: true, relatedTarget: next }),
      );
    }
    if (next) {
      next.dispatchEvent(new ShimFocusEvent('focus', { relatedTarget: previous }));
      next.dispatchEvent(new ShimFocusEvent('focusin', { bubbles: true, relatedTarget: previous }));
    }
  }

  const htmlElement = protoOf(window, 'HTMLElement');
  define(htmlElement, 'focus', {
    value(this: El) {
      if (!isFocusable(this) || !this.isConnected) return;
      moveFocus(this);
    },
    writable: true,
  });
  define(htmlElement, 'blur', {
    value(this: El) {
      if (active === this) moveFocus(null);
    },
    writable: true,
  });
  define(htmlElement, 'click', {
    value(this: El) {
      if (isDisabled(this)) return;
      this.dispatchEvent(
        new ShimMouseEvent('click', { bubbles: true, cancelable: true, composed: true, detail: 1 }),
      );
    },
    writable: true,
  });
  define(htmlElement, 'tabIndex', {
    get(this: El) {
      return tabIndexOf(this);
    },
    set(this: El, value: number) {
      this.setAttribute('tabindex', String(value));
    },
  });
  define(htmlElement, 'innerText', {
    get(this: El) {
      return this.textContent ?? '';
    },
    set(this: El, value: string) {
      this.textContent = String(value);
    },
  });
  for (const name of ['scrollIntoView', 'scrollTo', 'scrollBy']) {
    define(htmlElement, name, { value: () => undefined, writable: true });
  }
  const element = protoOf(window, 'Element');
  define(element, 'getBoundingClientRect', {
    value: () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      toJSON: () => ({}),
    }),
    writable: true,
  });
  define(element, 'getClientRects', { value: () => [], writable: true });
  for (const name of [
    'offsetWidth',
    'offsetHeight',
    'offsetTop',
    'offsetLeft',
    'clientWidth',
    'clientHeight',
    'scrollWidth',
    'scrollHeight',
  ]) {
    define(htmlElement, name, { get: () => 0 });
  }
  for (const name of ['scrollTop', 'scrollLeft']) {
    define(htmlElement, name, { get: () => 0, set: () => undefined });
  }

  define(documentProto, 'activeElement', { get: activeElement });
  // React asks `'oninput' in document` once, at load, to choose native input events
  // over an old Internet Explorer fallback.
  for (const name of ['oninput', 'onbeforeinput', 'onfocusin', 'onfocusout']) {
    define(documentProto, name, { get: () => null, set: () => undefined });
  }
  define(documentProto, 'hasFocus', { value: () => true, writable: true });
  define(documentProto, 'createEvent', {
    value: (name: string) => {
      const Ctor = EVENT_CLASSES[String(name).replace(/s$/, '')] ?? ShimEvent;
      return new Ctor('');
    },
    writable: true,
  });

  // ---- Form state ---------------------------------------------------------------------

  const textValue = {
    get(this: El): string {
      if (values.has(this)) return values.get(this) as string;
      if (this.localName === 'textarea') return this.textContent ?? '';
      const attribute = this.getAttribute('value');
      if (attribute !== null) return attribute;
      return isCheckable(this) ? 'on' : '';
    },
    set(this: El, value: unknown): void {
      const text = value === null || value === undefined ? '' : String(value);
      values.set(this, text);
      selections.set(this, [text.length, text.length]);
    },
  };
  const input = protoOf(window, 'HTMLInputElement');
  const textarea = protoOf(window, 'HTMLTextAreaElement');
  for (const proto of [input, textarea]) {
    define(proto, 'value', textValue);
    define(proto, 'defaultValue', {
      get(this: El) {
        return this.localName === 'textarea'
          ? (this.textContent ?? '')
          : (this.getAttribute('value') ?? '');
      },
      set(this: El, value: string) {
        if (this.localName === 'textarea') this.textContent = String(value);
        else this.setAttribute('value', String(value));
      },
    });
    define(proto, 'selectionStart', {
      get(this: El) {
        return (selections.get(this) ?? [textValue.get.call(this).length])[0];
      },
      set(this: El, start: number) {
        const end = (selections.get(this) ?? [0, start])[1];
        selections.set(this, [start, Math.max(start, end)]);
      },
    });
    define(proto, 'selectionEnd', {
      get(this: El) {
        const length = textValue.get.call(this).length;
        return (selections.get(this) ?? [length, length])[1];
      },
      set(this: El, end: number) {
        const start = (selections.get(this) ?? [end, end])[0];
        selections.set(this, [Math.min(start, end), end]);
      },
    });
    define(proto, 'setSelectionRange', {
      value(this: El, start: number, end: number) {
        const length = textValue.get.call(this).length;
        const from = Math.max(0, Math.min(start, length));
        selections.set(this, [from, Math.max(from, Math.min(end, length))]);
      },
      writable: true,
    });
    define(proto, 'select', {
      value(this: El) {
        selections.set(this, [0, textValue.get.call(this).length]);
      },
      writable: true,
    });
  }
  // Reflects as a browser does: lower case, and "text" when missing or unknown. React
  // only treats an input as text when `type` says so.
  define(input, 'type', {
    get(this: El) {
      const raw = (this.getAttribute('type') ?? '').toLowerCase();
      return INPUT_TYPES.has(raw) ? raw : 'text';
    },
    set(this: El, value: string) {
      this.setAttribute('type', String(value));
    },
  });
  define(protoOf(window, 'HTMLButtonElement'), 'type', {
    get(this: El) {
      const raw = (this.getAttribute('type') ?? '').toLowerCase();
      return raw === 'button' || raw === 'reset' ? raw : 'submit';
    },
    set(this: El, value: string) {
      this.setAttribute('type', String(value));
    },
  });
  define(input, 'checked', {
    get(this: El) {
      return checked.has(this) ? checked.get(this) : this.hasAttribute('checked');
    },
    set(this: El, value: unknown) {
      setChecked(this, Boolean(value));
    },
  });
  define(input, 'defaultChecked', {
    get(this: El) {
      return this.hasAttribute('checked');
    },
    set(this: El, value: unknown) {
      if (value) this.setAttribute('checked', '');
      else this.removeAttribute('checked');
    },
  });
  for (const [name, attribute] of [
    ['required', 'required'],
    ['readOnly', 'readonly'],
    ['multiple', 'multiple'],
  ] as const) {
    for (const proto of [input, textarea, protoOf(window, 'HTMLSelectElement')]) {
      define(proto, name, {
        get(this: El) {
          return this.hasAttribute(attribute);
        },
        set(this: El, value: unknown) {
          if (value) this.setAttribute(attribute, '');
          else this.removeAttribute(attribute);
        },
      });
    }
  }

  function setChecked(el: El, value: boolean): void {
    checked.set(el, value);
    if (!value || el.getAttribute('type') !== 'radio') return;
    const name = el.getAttribute('name');
    if (!name) return;
    const scope = (el.closest('form') ?? el.ownerDocument) as unknown as Doc;
    for (const other of scope.querySelectorAll('input[type="radio"]')) {
      if (other !== el && other.getAttribute('name') === name) checked.set(other, false);
    }
  }

  const option = protoOf(window, 'HTMLOptionElement');
  define(option, 'value', {
    get(this: El) {
      return this.getAttribute('value') ?? (this.textContent ?? '').trim();
    },
    set(this: El, value: string) {
      this.setAttribute('value', String(value));
    },
  });
  define(option, 'label', {
    get(this: El) {
      return this.getAttribute('label') ?? (this.textContent ?? '').trim();
    },
  });
  define(option, 'text', {
    get(this: El) {
      return (this.textContent ?? '').trim();
    },
  });
  define(option, 'defaultSelected', {
    get(this: El) {
      return this.hasAttribute('selected');
    },
    set(this: El, value: unknown) {
      if (value) this.setAttribute('selected', '');
      else this.removeAttribute('selected');
    },
  });
  define(option, 'selected', {
    get(this: El) {
      if (selected.has(this)) return selected.get(this);
      const select = this.closest('select');
      if (!select) return this.hasAttribute('selected');
      return selectedOptions(select).includes(this);
    },
    set(this: El, value: unknown) {
      const select = this.closest('select');
      if (value && select && !select.hasAttribute('multiple')) {
        for (const other of optionsOf(select)) selected.set(other, false);
      }
      selected.set(this, Boolean(value));
    },
  });
  define(option, 'index', {
    get(this: El) {
      const select = this.closest('select');
      return select ? optionsOf(select).indexOf(this) : 0;
    },
  });

  function optionsOf(select: El): El[] {
    return Array.from(select.querySelectorAll('option'));
  }

  function selectedOptions(select: El): El[] {
    const options = optionsOf(select);
    const explicit = options.filter((o) =>
      selected.has(o) ? selected.get(o) : o.hasAttribute('selected'),
    );
    if (select.hasAttribute('multiple')) return explicit;
    if (explicit.length > 0) return [explicit[explicit.length - 1] as El];
    const first = options.find((o) => !o.hasAttribute('disabled'));
    return first ? [first] : [];
  }

  const select = protoOf(window, 'HTMLSelectElement');
  define(select, 'options', {
    get(this: El) {
      return optionsOf(this);
    },
  });
  define(select, 'selectedOptions', {
    get(this: El) {
      return selectedOptions(this);
    },
  });
  define(select, 'selectedIndex', {
    get(this: El) {
      const first = selectedOptions(this)[0];
      return first ? optionsOf(this).indexOf(first) : -1;
    },
    set(this: El, index: number) {
      optionsOf(this).forEach((o, i) => selected.set(o, i === index));
    },
  });
  define(select, 'value', {
    get(this: El) {
      const first = selectedOptions(this)[0] as unknown as Obj | undefined;
      return first ? String(first.value) : '';
    },
    set(this: El, value: unknown) {
      const wanted = String(value);
      let found = false;
      for (const o of optionsOf(this)) {
        const match: boolean = !found && String((o as unknown as Obj).value) === wanted;
        selected.set(o, match);
        found ||= match;
      }
    },
  });
  define(select, 'type', {
    get(this: El) {
      return this.hasAttribute('multiple') ? 'select-multiple' : 'select-one';
    },
  });

  define(protoOf(window, 'HTMLLabelElement'), 'control', {
    get(this: El) {
      const target = this.getAttribute('for');
      if (target !== null) {
        const found = this.ownerDocument.getElementById(target);
        return found && LABELABLE.has(found.localName) ? found : null;
      }
      for (const inner of this.querySelectorAll('*')) {
        if (LABELABLE.has(inner.localName)) return inner;
      }
      return null;
    },
  });
  for (const name of [
    'HTMLInputElement',
    'HTMLSelectElement',
    'HTMLTextAreaElement',
    'HTMLButtonElement',
    'HTMLMeterElement',
    'HTMLOutputElement',
    'HTMLProgressElement',
  ]) {
    define(protoOf(window, name), 'labels', {
      get(this: El) {
        if (this.localName === 'input' && this.getAttribute('type') === 'hidden') return null;
        return Array.from(this.ownerDocument.querySelectorAll('label')).filter(
          (label) => (label as unknown as Obj).control === this,
        );
      },
    });
  }

  const form = protoOf(window, 'HTMLFormElement');
  define(form, 'requestSubmit', {
    value(this: El, submitter?: El | null) {
      this.dispatchEvent(
        new ShimSubmitEvent('submit', {
          bubbles: true,
          cancelable: true,
          submitter: submitter ?? null,
        }),
      );
    },
    writable: true,
  });
  define(form, 'submit', { value: () => undefined, writable: true });
  define(form, 'reset', {
    value(this: El) {
      if (!this.dispatchEvent(new ShimEvent('reset', { bubbles: true, cancelable: true }))) return;
      for (const control of this.querySelectorAll('input, textarea, select, option')) {
        values.delete(control);
        checked.delete(control);
        selected.delete(control);
      }
    },
    writable: true,
  });
  define(form, 'elements', {
    get(this: El) {
      return Array.from(this.querySelectorAll('input, select, textarea, button'));
    },
  });

  // ---- Click activation ----------------------------------------------------------------

  function changed(el: El): void {
    el.dispatchEvent(new ShimInputEvent('input', { bubbles: true, composed: true }));
    el.dispatchEvent(new ShimEvent('change', { bubbles: true }));
  }

  function activationFor(el: El): Activation | null {
    if (!el || (el as unknown as { nodeType?: number }).nodeType !== 1) return null;
    if (isDisabled(el)) return null;
    if (isCheckable(el)) {
      const radio = el.getAttribute('type') === 'radio';
      const group = radio ? radioGroup(el) : [el];
      const before = group.map((r) => (r as unknown as Obj).checked as boolean);
      return {
        before: () => {
          if (radio) setChecked(el, true);
          else checked.set(el, !before[0]);
        },
        after: () => {
          if (!radio || !before[group.indexOf(el)]) changed(el);
        },
        cancelled: () => {
          group.forEach((r, i) => checked.set(r, before[i] as boolean));
        },
      };
    }
    if (isSubmitter(el)) {
      return {
        after: () => {
          const owner = el.closest('form') as unknown as { requestSubmit(s: El): void } | null;
          owner?.requestSubmit(el);
        },
      };
    }
    if (el.localName === 'label') {
      return {
        after: () => {
          const control = (el as unknown as Obj).control as El | null;
          if (!control || isDisabled(control)) return;
          if (isCheckable(control) || control.localName === 'button' || isSubmitter(control)) {
            control.click();
          } else control.focus();
        },
      };
    }
    if (el.localName === 'summary') {
      const details = el.parentElement;
      if (!details || details.localName !== 'details') return null;
      return {
        after: () => {
          if (details.hasAttribute('open')) details.removeAttribute('open');
          else details.setAttribute('open', '');
          details.dispatchEvent(new ShimEvent('toggle'));
        },
      };
    }
    if (el.localName === 'button' || el.localName === 'a') return { after: () => undefined };
    return null;
  }

  function radioGroup(el: El): El[] {
    const name = el.getAttribute('name');
    if (!name) return [el];
    const scope = (el.closest('form') ?? el.ownerDocument) as unknown as Doc;
    return Array.from(scope.querySelectorAll('input[type="radio"]')).filter(
      (other) => other.getAttribute('name') === name,
    );
  }

  // ---- Globals --------------------------------------------------------------------------

  const names = new Set<string>([
    ...Object.keys(shimGlobals),
    'Node',
    'Element',
    'HTMLElement',
    'SVGElement',
    'Text',
    'Comment',
    'DocumentFragment',
    'Document',
    'EventTarget',
    'NodeList',
    'HTMLCollection',
    'MutationObserver',
    'NodeFilter',
    'DOMParser',
  ]);
  for (const name of Object.keys(EVENT_CLASSES)) names.add(name);
  const htmlClassNames = [
    'Anchor',
    'Area',
    'Audio',
    'BR',
    'Base',
    'Body',
    'Button',
    'Canvas',
    'DList',
    'Data',
    'DataList',
    'Details',
    'Dialog',
    'Div',
    'Embed',
    'FieldSet',
    'Form',
    'Heading',
    'HR',
    'Head',
    'Html',
    'IFrame',
    'Image',
    'Input',
    'Label',
    'Legend',
    'LI',
    'Link',
    'Map',
    'Media',
    'Menu',
    'Meta',
    'Meter',
    'Mod',
    'OList',
    'Object',
    'OptGroup',
    'Option',
    'Output',
    'Paragraph',
    'Picture',
    'Pre',
    'Progress',
    'Quote',
    'Script',
    'Select',
    'Slot',
    'Source',
    'Span',
    'Style',
    'TableCaption',
    'TableCell',
    'Table',
    'TableRow',
    'Template',
    'TextArea',
    'Time',
    'Title',
    'Track',
    'UList',
    'Unknown',
    'Video',
  ];
  for (const name of htmlClassNames) names.add(`HTML${name}Element`);

  for (const name of names) {
    const value = window[name];
    if (value === undefined) continue;
    Object.defineProperty(host, name, { value, writable: true, configurable: true });
  }
  Object.defineProperty(host, 'window', { value: window, writable: true, configurable: true });
  Object.defineProperty(host, 'document', { value: document, writable: true, configurable: true });

  return {
    window,
    document,
    reset() {
      active = null;
      if (current) (current.body as unknown as { innerHTML: string }).innerHTML = '';
    },
  };
}

class InertObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): unknown[] {
    return [];
  }
}
