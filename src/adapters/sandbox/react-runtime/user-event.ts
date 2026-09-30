/**
 * A small `userEvent` for React challenges, with the call shapes of
 * @testing-library/user-event 14: `userEvent.setup()` and then `await user.click(el)`,
 * `user.type(el, 'text{Enter}')`, `user.keyboard('{ArrowDown}')`, `user.tab()` and so on.
 *
 * The real library drives selection ranges, clipboard and pointer state that the
 * worker DOM does not have, so this one plays the events a person causes, in the order
 * a browser sends them, with the default actions that component tests rely on: typing
 * edits the value, Tab moves focus, Enter submits a form or presses a button, Space
 * presses a button or ticks a box. Every event goes through Testing Library's
 * `eventWrapper`, which React Testing Library sets to `act`.
 */
import {
  ShimEvent,
  ShimInputEvent,
  ShimKeyboardEvent,
  ShimMouseEvent,
  ShimPointerEvent,
} from './events';

type Obj = Record<string, unknown>;

interface El {
  localName: string;
  ownerDocument: { activeElement: El | null; body: El };
  parentElement: El | null;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  closest(selector: string): El | null;
  querySelector(selector: string): El | null;
  querySelectorAll(selector: string): Iterable<El>;
  dispatchEvent(event: unknown): boolean;
  focus(): void;
  blur(): void;
  click(): void;
  isConnected: boolean;
  textContent: string | null;
}

export interface UserEventDeps {
  document: { activeElement: El | null; body: El };
  tabbable(): El[];
  /** Runs one dispatch the way Testing Library would, inside `act`. */
  wrapEvent<T>(dispatch: () => T): T;
  /** Lets timers, effects and promises settle between steps, outside `act`. */
  settle(): Promise<void>;
  /** Throws the first error a listener reported during the step. */
  rethrow(): void;
}

export interface TypeOptions {
  skipClick?: boolean;
  initialSelectionStart?: number;
  initialSelectionEnd?: number;
}

const KEY_CODES: Record<string, number> = {
  Backspace: 8,
  Tab: 9,
  Enter: 13,
  Shift: 16,
  Control: 17,
  Alt: 18,
  Escape: 27,
  ' ': 32,
  PageUp: 33,
  PageDown: 34,
  End: 35,
  Home: 36,
  ArrowLeft: 37,
  ArrowUp: 38,
  ArrowRight: 39,
  ArrowDown: 40,
  Delete: 46,
  Meta: 91,
};

const ALIASES: Record<string, string> = {
  Space: ' ',
  Esc: 'Escape',
  Up: 'ArrowUp',
  Down: 'ArrowDown',
  Left: 'ArrowLeft',
  Right: 'ArrowRight',
  Del: 'Delete',
  Ctrl: 'Control',
  Control: 'Control',
};

const MODIFIER_FIELDS: Record<string, string> = {
  Shift: 'shiftKey',
  Control: 'ctrlKey',
  Alt: 'altKey',
  Meta: 'metaKey',
};

interface KeyAction {
  key: string;
  /** `{Shift>}` holds a key down; `{/Shift}` lets it go. */
  release: boolean;
  hold: boolean;
}

/** Parses user-event's key syntax: text, `{Enter}`, `{Shift>}`, `{/Shift}`, `{{` for "{". */
export function parseKeys(text: string): KeyAction[] {
  const actions: KeyAction[] = [];
  let i = 0;
  while (i < text.length) {
    const char = text[i] as string;
    const next = text[i + 1];
    if ((char === '{' || char === '[') && next === char) {
      actions.push({ key: char, release: false, hold: false });
      i += 2;
      continue;
    }
    if (char === '{' || char === '[') {
      const close = text.indexOf(char === '{' ? '}' : ']', i);
      if (close === -1) throw new Error(`Expected a closing bracket for "${char}" in "${text}"`);
      let body = text.slice(i + 1, close);
      const release = body.startsWith('/');
      if (release) body = body.slice(1);
      const hold = body.endsWith('>');
      if (hold) body = body.slice(0, -1);
      const key = ALIASES[body] ?? (char === '[' ? codeToKey(body) : body);
      actions.push({ key, release, hold });
      i = close + 1;
      continue;
    }
    actions.push({ key: char, release: false, hold: false });
    i += 1;
  }
  return actions;
}

function codeToKey(code: string): string {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (code === 'Space') return ' ';
  return code.replace(/(Left|Right)$/, '');
}

function codeOf(key: string): string {
  if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`;
  if (/^\d$/.test(key)) return `Digit${key}`;
  if (key === ' ') return 'Space';
  return key;
}

function keyCodeOf(key: string): number {
  if (KEY_CODES[key] !== undefined) return KEY_CODES[key] as number;
  if (key.length === 1) return key.toUpperCase().charCodeAt(0);
  return 0;
}

function isTextField(el: El): boolean {
  if (el.localName === 'textarea') return true;
  if (el.localName !== 'input') return false;
  const type = (el.getAttribute('type') ?? 'text').toLowerCase();
  return ![
    'checkbox',
    'radio',
    'submit',
    'reset',
    'button',
    'image',
    'file',
    'hidden',
    'range',
    'color',
  ].includes(type);
}

function isEditable(el: El): boolean {
  return isTextField(el) && !el.hasAttribute('readonly') && !el.hasAttribute('disabled');
}

function isDisabled(el: El): boolean {
  return (
    ['input', 'select', 'textarea', 'button'].includes(el.localName) && el.hasAttribute('disabled')
  );
}

function isCheckable(el: El): boolean {
  const type = el.getAttribute('type');
  return el.localName === 'input' && (type === 'checkbox' || type === 'radio');
}

function isButtonLike(el: El): boolean {
  if (el.localName === 'button') return true;
  const type = el.getAttribute('type');
  return el.localName === 'input' && ['submit', 'reset', 'button', 'image'].includes(type ?? '');
}

function isFocusable(el: El): boolean {
  if (isDisabled(el)) return false;
  if (['input', 'select', 'textarea', 'button', 'summary'].includes(el.localName)) return true;
  if ((el.localName === 'a' || el.localName === 'area') && el.hasAttribute('href')) return true;
  if (el.hasAttribute('tabindex')) return true;
  const editable = el.getAttribute('contenteditable');
  return editable !== null && editable !== 'false';
}

/** The value setter of the prototype, past React's tracker on the instance. */
function setNativeValue(el: El, value: string): void {
  for (
    let proto = Object.getPrototypeOf(el) as object | null;
    proto;
    proto = Object.getPrototypeOf(proto) as object | null
  ) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descriptor?.set) {
      descriptor.set.call(el, value);
      return;
    }
  }
  (el as unknown as Obj).value = value;
}

function valueOf(el: El): string {
  return String((el as unknown as Obj).value ?? '');
}

function selectionOf(el: El): [number, number] {
  const record = el as unknown as { selectionStart: number | null; selectionEnd: number | null };
  const length = valueOf(el).length;
  return [record.selectionStart ?? length, record.selectionEnd ?? length];
}

function setSelection(el: El, start: number, end = start): void {
  (el as unknown as { setSelectionRange(s: number, e: number): void }).setSelectionRange(
    start,
    end,
  );
}

function assertElement(el: unknown, method: string): asserts el is El {
  if (!el || typeof (el as El).dispatchEvent !== 'function') {
    throw new TypeError(`userEvent.${method} needs an element, received ${String(el)}`);
  }
}

export interface UserEventApi {
  click(el: unknown): Promise<void>;
  dblClick(el: unknown): Promise<void>;
  hover(el: unknown): Promise<void>;
  unhover(el: unknown): Promise<void>;
  type(el: unknown, text: string, options?: TypeOptions): Promise<void>;
  clear(el: unknown): Promise<void>;
  keyboard(text: string): Promise<void>;
  tab(options?: { shift?: boolean }): Promise<void>;
  selectOptions(el: unknown, values: unknown): Promise<void>;
  deselectOptions(el: unknown, values: unknown): Promise<void>;
}

export function createUserEvent(deps: UserEventDeps): UserEventApi & { setup(): UserEventApi } {
  function makeUser(): UserEventApi {
    const held = new Set<string>();
    let hovered: El | null = null;

    const fire = (el: El, event: unknown): boolean => {
      const result = deps.wrapEvent(() => el.dispatchEvent(event));
      deps.rethrow();
      return result;
    };

    const modifiers = (): Obj => {
      const state: Obj = {};
      for (const [key, field] of Object.entries(MODIFIER_FIELDS)) state[field] = held.has(key);
      return state;
    };

    const mouse = (type: string, extra: Obj = {}): Obj => ({
      bubbles: !['mouseenter', 'mouseleave', 'pointerenter', 'pointerleave'].includes(type),
      cancelable: !['mouseenter', 'mouseleave', 'pointerenter', 'pointerleave'].includes(type),
      composed: true,
      ...modifiers(),
      ...extra,
    });

    const pointerEvent = (el: El, type: string, extra: Obj = {}): boolean =>
      fire(el, new ShimPointerEvent(type, mouse(type, extra)));
    const mouseEvent = (el: El, type: string, extra: Obj = {}): boolean =>
      fire(el, new ShimMouseEvent(type, mouse(type, extra)));

    function hoverOnto(el: El | null): void {
      if (hovered === el) return;
      const previous = hovered;
      hovered = el;
      if (previous && previous.isConnected) {
        pointerEvent(previous, 'pointerout', { relatedTarget: el });
        pointerEvent(previous, 'pointerleave', { relatedTarget: el });
        mouseEvent(previous, 'mouseout', { relatedTarget: el });
        mouseEvent(previous, 'mouseleave', { relatedTarget: el });
      }
      if (el) {
        pointerEvent(el, 'pointerover', { relatedTarget: previous });
        pointerEvent(el, 'pointerenter', { relatedTarget: previous });
        mouseEvent(el, 'mouseover', { relatedTarget: previous });
        mouseEvent(el, 'mouseenter', { relatedTarget: previous });
      }
    }

    function focusTarget(el: El): void {
      let target: El | null = el;
      while (target && !isFocusable(target)) target = target.parentElement;
      if (target) {
        if (deps.document.activeElement !== target) deps.wrapEvent(() => target?.focus());
      } else {
        const current = deps.document.activeElement;
        if (current && current !== deps.document.body) deps.wrapEvent(() => current.blur());
      }
      deps.rethrow();
    }

    function press(el: El, clickCount: number): void {
      hoverOnto(el);
      pointerEvent(el, 'pointermove');
      mouseEvent(el, 'mousemove');
      if (isDisabled(el)) return;
      pointerEvent(el, 'pointerdown', { buttons: 1 });
      if (mouseEvent(el, 'mousedown', { buttons: 1, detail: clickCount })) focusTarget(el);
      pointerEvent(el, 'pointerup');
      mouseEvent(el, 'mouseup', { detail: clickCount });
      mouseEvent(el, 'click', { detail: clickCount });
    }

    function editValue(
      el: El,
      next: string,
      caret: number,
      inputType: string,
      data: string | null,
    ): void {
      const init = { bubbles: true, cancelable: true, composed: true, inputType, data };
      if (!fire(el, new ShimInputEvent('beforeinput', init))) return;
      setNativeValue(el, next);
      setSelection(el, caret);
      fire(el, new ShimInputEvent('input', { ...init, cancelable: false }));
    }

    function insertText(el: El, text: string): void {
      const value = valueOf(el);
      const [start, end] = selectionOf(el);
      const maxLength = Number(el.getAttribute('maxlength') ?? Infinity);
      const room = Math.max(0, maxLength - (value.length - (end - start)));
      const typed = text.slice(0, room);
      if (typed.length === 0) return;
      editValue(
        el,
        value.slice(0, start) + typed + value.slice(end),
        start + typed.length,
        'insertText',
        typed,
      );
    }

    function deleteText(el: El, forward: boolean): void {
      const value = valueOf(el);
      let [start, end] = selectionOf(el);
      if (start === end) {
        if (forward) end = Math.min(value.length, end + 1);
        else start = Math.max(0, start - 1);
      }
      if (start === end) return;
      editValue(
        el,
        value.slice(0, start) + value.slice(end),
        start,
        forward ? 'deleteContentForward' : 'deleteContentBackward',
        null,
      );
    }

    function implicitSubmit(el: El): void {
      const form = el.closest('form');
      if (!form) return;
      const submitter = Array.from(form.querySelectorAll('button, input')).find(
        (candidate) =>
          !isDisabled(candidate) &&
          ((candidate.localName === 'button' &&
            ['', 'submit'].includes(candidate.getAttribute('type') ?? '')) ||
            (candidate.localName === 'input' &&
              ['submit', 'image'].includes(candidate.getAttribute('type') ?? ''))),
      );
      if (submitter) {
        deps.wrapEvent(() => submitter.click());
        deps.rethrow();
        return;
      }
      deps.wrapEvent(() => (form as unknown as { requestSubmit(): void }).requestSubmit());
      deps.rethrow();
    }

    function moveTab(backwards: boolean): void {
      const order = deps.tabbable();
      if (order.length === 0) return;
      const current = deps.document.activeElement;
      const at = current ? order.indexOf(current) : -1;
      let nextIndex: number;
      if (at === -1) nextIndex = backwards ? order.length - 1 : 0;
      else nextIndex = (at + (backwards ? -1 : 1) + order.length) % order.length;
      const next = order[nextIndex] as El;
      deps.wrapEvent(() => next.focus());
      deps.rethrow();
      if (isTextField(next)) {
        (next as unknown as { select(): void }).select();
      }
    }

    function keyDefault(target: El, key: string): void {
      const edit = isEditable(target);
      if (key === 'Tab') {
        moveTab(held.has('Shift'));
        return;
      }
      if (key.length === 1) {
        const keypress = new ShimKeyboardEvent('keypress', keyInit(key, key.charCodeAt(0)));
        if (!fire(target, keypress)) return;
        if (edit) insertText(target, key);
        return;
      }
      if (key === 'Enter') {
        const keypress = new ShimKeyboardEvent('keypress', keyInit(key, 13));
        if (!fire(target, keypress)) return;
        if (target.localName === 'textarea' && edit) insertText(target, '\n');
        else if (
          isButtonLike(target) ||
          (target.localName === 'a' && target.hasAttribute('href'))
        ) {
          deps.wrapEvent(() => target.click());
          deps.rethrow();
        } else if (target.localName === 'input' && !isCheckable(target)) implicitSubmit(target);
        return;
      }
      if (!edit) return;
      const [start, end] = selectionOf(target);
      const length = valueOf(target).length;
      if (key === 'Backspace') deleteText(target, false);
      else if (key === 'Delete') deleteText(target, true);
      else if (key === 'ArrowLeft')
        setSelection(target, start === end ? Math.max(0, start - 1) : start);
      else if (key === 'ArrowRight')
        setSelection(target, start === end ? Math.min(length, end + 1) : end);
      else if (key === 'Home') setSelection(target, 0);
      else if (key === 'End') setSelection(target, length);
    }

    function keyInit(key: string, charCode = 0): Obj {
      return {
        bubbles: true,
        cancelable: true,
        composed: true,
        key,
        code: codeOf(key),
        keyCode: charCode || keyCodeOf(key),
        which: charCode || keyCodeOf(key),
        charCode,
        ...modifiers(),
      };
    }

    function pressKey(action: KeyAction): void {
      const target = (): El => deps.document.activeElement ?? deps.document.body;
      if (action.release) {
        held.delete(action.key);
        fire(target(), new ShimKeyboardEvent('keyup', keyInit(action.key)));
        return;
      }
      const down = target();
      if (MODIFIER_FIELDS[action.key]) held.add(action.key);
      const allowed = fire(down, new ShimKeyboardEvent('keydown', keyInit(action.key)));
      if (allowed) keyDefault(down, action.key);
      if (action.hold) return;
      if (MODIFIER_FIELDS[action.key]) held.delete(action.key);
      const up = target();
      const releaseAllowed = fire(up, new ShimKeyboardEvent('keyup', keyInit(action.key)));
      // Space activates on release, as it does in browsers.
      if (
        releaseAllowed &&
        action.key === ' ' &&
        up === down &&
        (isButtonLike(up) || isCheckable(up))
      ) {
        deps.wrapEvent(() => up.click());
        deps.rethrow();
      }
    }

    function optionsFor(select: El, values: unknown): El[] {
      const wanted = Array.isArray(values) ? values : [values];
      const options = Array.from(select.querySelectorAll('option'));
      return wanted.map((value) => {
        const found = options.find(
          (option) =>
            option === value ||
            String((option as unknown as Obj).value) === String(value) ||
            (option.textContent ?? '').trim() === String(value),
        );
        if (!found)
          throw new Error(`No option with the value or text "${String(value)}" was found`);
        return found;
      });
    }

    function setSelected(select: El, values: unknown, on: boolean): void {
      if (isDisabled(select)) throw new Error('The select is disabled');
      const chosen = optionsFor(select, values);
      if (!select.hasAttribute('multiple') && chosen.length > 1) {
        throw new Error('Cannot select more than one option in a single select');
      }
      press(select, 1);
      for (const option of chosen) {
        (option as unknown as Obj).selected = on;
      }
      fire(select, new ShimInputEvent('input', { bubbles: true, composed: true }));
      fire(select, new ShimEvent('change', { bubbles: true }));
    }

    return {
      async click(el) {
        assertElement(el, 'click');
        press(el, 1);
        await deps.settle();
      },
      async dblClick(el) {
        assertElement(el, 'dblClick');
        press(el, 1);
        press(el, 2);
        mouseEvent(el, 'dblclick', { detail: 2 });
        await deps.settle();
      },
      async hover(el) {
        assertElement(el, 'hover');
        hoverOnto(el);
        pointerEvent(el, 'pointermove');
        mouseEvent(el, 'mousemove');
        await deps.settle();
      },
      async unhover(el) {
        assertElement(el, 'unhover');
        if (hovered === el) hoverOnto(null);
        await deps.settle();
      },
      async type(el, text, options = {}) {
        assertElement(el, 'type');
        if (!options.skipClick) press(el, 1);
        if (options.initialSelectionStart !== undefined && isTextField(el)) {
          setSelection(
            el,
            options.initialSelectionStart,
            options.initialSelectionEnd ?? options.initialSelectionStart,
          );
        } else if (isTextField(el) && !options.skipClick) {
          const length = valueOf(el).length;
          setSelection(el, length);
        }
        for (const action of parseKeys(text)) {
          pressKey(action);
          await deps.settle();
        }
      },
      async clear(el) {
        assertElement(el, 'clear');
        if (!isEditable(el)) throw new Error('clear() needs an editable text field');
        focusTarget(el);
        const value = valueOf(el);
        if (value === '') return;
        setSelection(el, 0, value.length);
        deleteText(el, false);
        await deps.settle();
      },
      async keyboard(text) {
        for (const action of parseKeys(text)) {
          pressKey(action);
          await deps.settle();
        }
      },
      async tab(options = {}) {
        if (options.shift) pressKey({ key: 'Shift', release: false, hold: true });
        pressKey({ key: 'Tab', release: false, hold: false });
        if (options.shift) pressKey({ key: 'Shift', release: true, hold: false });
        await deps.settle();
      },
      async selectOptions(el, values) {
        assertElement(el, 'selectOptions');
        setSelected(el, values, true);
        await deps.settle();
      },
      async deselectOptions(el, values) {
        assertElement(el, 'deselectOptions');
        setSelected(el, values, false);
        await deps.settle();
      },
    };
  }

  const direct = makeUser();
  return { ...direct, setup: () => makeUser() };
}
