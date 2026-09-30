/**
 * DOM matchers for React challenges, named and behaving like their jest-dom
 * counterparts, handed to the harness as host matchers (src/core/running/harness.ts).
 * Each returns both messages, so `.not` reads as well as the plain form.
 */

type Obj = Record<string, unknown>;

interface El {
  localName: string;
  ownerDocument: { documentElement: { contains(node: unknown): boolean }; activeElement: unknown };
  parentElement: El | null;
  outerHTML: string;
  textContent: string | null;
  style: { getPropertyValue(name: string): string };
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  closest(selector: string): El | null;
  contains(node: unknown): boolean;
  querySelectorAll(selector: string): Iterable<El>;
  childNodes: ArrayLike<{ nodeType: number }>;
}

export interface MatcherResult {
  pass: boolean;
  message: string;
  negatedMessage: string;
}

type Matcher = (actual: unknown, ...args: unknown[]) => MatcherResult;

function isElement(value: unknown): value is El {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { nodeType?: unknown }).nodeType === 1 &&
    typeof (value as El).getAttribute === 'function'
  );
}

function show(el: El): string {
  const html = el.outerHTML;
  const open = html.slice(0, html.indexOf('>') + 1) || html;
  return open.length > 120 ? `${open.slice(0, 117)}...` : open;
}

function quote(value: unknown): string {
  if (value instanceof RegExp) return String(value);
  return JSON.stringify(value) ?? String(value);
}

function needElement(name: string, actual: unknown): El {
  if (!isElement(actual)) {
    throw Object.assign(new Error(`${name} needs a DOM element, received ${String(actual)}`), {
      name: 'AssertionError',
      __assertion: true,
    });
  }
  return actual;
}

function normalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function matchesText(actual: string, expected: unknown): boolean {
  if (expected instanceof RegExp) return expected.test(actual);
  return actual.includes(String(expected));
}

function isDisabled(el: El): boolean {
  const control = ['button', 'input', 'select', 'textarea', 'optgroup', 'option', 'fieldset'];
  if (control.includes(el.localName) && el.hasAttribute('disabled')) return true;
  // A control inside a disabled fieldset is disabled too, except in its first legend.
  const fieldset = el.parentElement?.closest('fieldset[disabled]');
  if (fieldset && control.includes(el.localName)) {
    const legend = Array.from(fieldset.querySelectorAll('legend'))[0];
    return !(legend && legend.contains(el));
  }
  return false;
}

function isVisible(el: El): boolean {
  if (!el.ownerDocument.documentElement.contains(el)) return false;
  let child: El | null = null;
  for (let node: El | null = el; node; child = node, node = node.parentElement) {
    if (node.hasAttribute('hidden')) return false;
    const display = node.style.getPropertyValue('display');
    const visibility = node.style.getPropertyValue('visibility');
    const opacity = node.style.getPropertyValue('opacity');
    if (display === 'none' || visibility === 'hidden' || visibility === 'collapse') return false;
    if (opacity !== '' && Number(opacity) === 0) return false;
    if (
      node.localName === 'details' &&
      !node.hasAttribute('open') &&
      child &&
      child.localName !== 'summary'
    ) {
      return false;
    }
  }
  return true;
}

function valueOf(el: El): unknown {
  const record = el as unknown as Obj;
  if (el.localName === 'select') {
    const options = Array.from(el.querySelectorAll('option')).filter(
      (o) => (o as unknown as Obj).selected,
    );
    const values = options.map((o) => (o as unknown as Obj).value);
    return el.hasAttribute('multiple') ? values : (values[0] ?? '');
  }
  const type = el.getAttribute('type');
  if (el.localName === 'input' && (type === 'number' || type === 'range')) {
    const raw = String(record.value ?? '');
    return raw === '' ? null : Number(raw);
  }
  return record.value;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => item === b[i]);
  }
  return a === b;
}

export const DOM_MATCHERS: Record<string, Matcher> = {
  toBeInTheDocument(actual) {
    const pass = isElement(actual) && actual.ownerDocument.documentElement.contains(actual);
    const what = isElement(actual) ? show(actual) : String(actual);
    return {
      pass,
      message: `Expected ${what} to be in the document`,
      negatedMessage: `Expected ${what} not to be in the document`,
    };
  },
  toHaveTextContent(actual, expected) {
    const el = needElement('toHaveTextContent', actual);
    const text = normalise(el.textContent ?? '');
    return {
      pass: matchesText(text, expected),
      message: `Expected ${show(el)} to have text ${quote(expected)}, received ${quote(text)}`,
      negatedMessage: `Expected ${show(el)} not to have text ${quote(expected)}, received ${quote(text)}`,
    };
  },
  toHaveAttribute(actual, name, value) {
    const el = needElement('toHaveAttribute', actual);
    const attribute = el.getAttribute(String(name));
    const checkValue = value !== undefined;
    const pass = attribute !== null && (!checkValue || attribute === String(value));
    const wanted = checkValue ? `${String(name)}=${quote(value)}` : String(name);
    const got = attribute === null ? 'no such attribute' : `${String(name)}=${quote(attribute)}`;
    return {
      pass,
      message: `Expected ${show(el)} to have attribute ${wanted}, received ${got}`,
      negatedMessage: `Expected ${show(el)} not to have attribute ${wanted}`,
    };
  },
  toHaveValue(actual, expected) {
    const el = needElement('toHaveValue', actual);
    const value = valueOf(el);
    return {
      pass: sameValue(value, expected),
      message: `Expected ${show(el)} to have value ${quote(expected)}, received ${quote(value)}`,
      negatedMessage: `Expected ${show(el)} not to have value ${quote(expected)}`,
    };
  },
  toBeDisabled(actual) {
    const el = needElement('toBeDisabled', actual);
    return {
      pass: isDisabled(el),
      message: `Expected ${show(el)} to be disabled`,
      negatedMessage: `Expected ${show(el)} not to be disabled`,
    };
  },
  toBeEnabled(actual) {
    const el = needElement('toBeEnabled', actual);
    return {
      pass: !isDisabled(el),
      message: `Expected ${show(el)} to be enabled`,
      negatedMessage: `Expected ${show(el)} not to be enabled`,
    };
  },
  toBeChecked(actual) {
    const el = needElement('toBeChecked', actual);
    const role = el.getAttribute('role');
    const pass =
      el.localName === 'input'
        ? Boolean((el as unknown as Obj).checked)
        : role !== null && el.getAttribute('aria-checked') === 'true';
    return {
      pass,
      message: `Expected ${show(el)} to be checked`,
      negatedMessage: `Expected ${show(el)} not to be checked`,
    };
  },
  toHaveFocus(actual) {
    const el = needElement('toHaveFocus', actual);
    const focused = el.ownerDocument.activeElement;
    const now = isElement(focused) ? show(focused) : 'nothing';
    return {
      pass: focused === el,
      message: `Expected ${show(el)} to have focus, but focus is on ${now}`,
      negatedMessage: `Expected ${show(el)} not to have focus`,
    };
  },
  toBeVisible(actual) {
    const el = needElement('toBeVisible', actual);
    return {
      pass: isVisible(el),
      message: `Expected ${show(el)} to be visible`,
      negatedMessage: `Expected ${show(el)} not to be visible`,
    };
  },
  toHaveClass(actual, ...names) {
    const el = needElement('toHaveClass', actual);
    const classes = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
    const wanted = names.flatMap((n) => String(n).split(/\s+/)).filter(Boolean);
    const pass =
      wanted.length === 0 ? classes.length > 0 : wanted.every((n) => classes.includes(n));
    return {
      pass,
      message: `Expected ${show(el)} to have class ${quote(wanted.join(' '))}`,
      negatedMessage: `Expected ${show(el)} not to have class ${quote(wanted.join(' '))}`,
    };
  },
  toBeEmptyDOMElement(actual) {
    const el = needElement('toBeEmptyDOMElement', actual);
    // Comments do not count, as in jest-dom.
    const pass = Array.from(el.childNodes).every((node) => node.nodeType === 8);
    return {
      pass,
      message: `Expected ${show(el)} to be empty`,
      negatedMessage: `Expected ${show(el)} not to be empty`,
    };
  },
  toContainElement(actual, other) {
    const el = needElement('toContainElement', actual);
    const pass = isElement(other) && el.contains(other);
    const what = isElement(other) ? show(other) : String(other);
    return {
      pass,
      message: `Expected ${show(el)} to contain ${what}`,
      negatedMessage: `Expected ${show(el)} not to contain ${what}`,
    };
  },
};
