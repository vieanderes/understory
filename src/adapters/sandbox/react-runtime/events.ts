/**
 * Event classes and a three-phase `dispatchEvent` for the linkedom document that React
 * challenges render into (docs/SANDBOX.md, "React challenges").
 *
 * linkedom dispatches without a capture phase, and the Event classes of a Web Worker are
 * native: their `target` is a read-only getter, so a JavaScript DOM cannot dispatch them.
 * These classes are plain objects with the fields that React, Testing Library and a
 * learner's handler read. Unknown init keys are copied onto the event, which is what a
 * `KeyboardEvent` or a `WheelEvent` needs from Testing Library's `fireEvent`.
 */

const NONE = 0;
const CAPTURING_PHASE = 1;
const AT_TARGET = 2;
const BUBBLING_PHASE = 3;

type Init = Record<string, unknown>;

export class ShimEvent {
  static readonly NONE = NONE;
  static readonly CAPTURING_PHASE = CAPTURING_PHASE;
  static readonly AT_TARGET = AT_TARGET;
  static readonly BUBBLING_PHASE = BUBBLING_PHASE;
  readonly NONE = NONE;
  readonly CAPTURING_PHASE = CAPTURING_PHASE;
  readonly AT_TARGET = AT_TARGET;
  readonly BUBBLING_PHASE = BUBBLING_PHASE;

  type: string;
  bubbles: boolean;
  cancelable: boolean;
  composed: boolean;
  defaultPrevented = false;
  eventPhase = NONE;
  target: unknown = null;
  currentTarget: unknown = null;
  isTrusted = false;
  cancelBubble = false;
  timeStamp = Date.now();
  /** @internal */ immediateStopped = false;
  /** @internal */ inPassiveListener = false;
  /** @internal */ path: unknown[] = [];

  constructor(type: string, init: Init = {}) {
    this.type = String(type);
    this.bubbles = Boolean(init.bubbles);
    this.cancelable = Boolean(init.cancelable);
    this.composed = Boolean(init.composed);
    copyUnknown(this, init);
  }

  get srcElement(): unknown {
    return this.target;
  }

  get returnValue(): boolean {
    return !this.defaultPrevented;
  }

  preventDefault(): void {
    if (this.cancelable && !this.inPassiveListener) this.defaultPrevented = true;
  }

  stopPropagation(): void {
    this.cancelBubble = true;
  }

  stopImmediatePropagation(): void {
    this.cancelBubble = true;
    this.immediateStopped = true;
  }

  composedPath(): unknown[] {
    return this.path.slice();
  }

  initEvent(type: string, bubbles = false, cancelable = false): void {
    this.type = String(type);
    this.bubbles = bubbles;
    this.cancelable = cancelable;
  }
}

const RESERVED = new Set(['bubbles', 'cancelable', 'composed', 'target']);

function copyUnknown(event: object, init: Init): void {
  for (const key of Object.keys(init)) {
    if (RESERVED.has(key) || key in event) continue;
    (event as Init)[key] = init[key];
  }
}

function assignDefaults(event: object, init: Init, defaults: Init): void {
  for (const key of Object.keys(defaults)) {
    (event as Init)[key] = key in init ? init[key] : defaults[key];
  }
}

const MODIFIERS: Record<string, string> = {
  Alt: 'altKey',
  Control: 'ctrlKey',
  Meta: 'metaKey',
  Shift: 'shiftKey',
};

function modifierState(event: object, key: string): boolean {
  const field = MODIFIERS[key];
  return field ? Boolean((event as Init)[field]) : false;
}

export class ShimUIEvent extends ShimEvent {
  constructor(type: string, init: Init = {}) {
    super(type, init);
    assignDefaults(this, init, { detail: 0, view: null });
  }
}

const MOUSE_DEFAULTS: Init = {
  screenX: 0,
  screenY: 0,
  clientX: 0,
  clientY: 0,
  pageX: 0,
  pageY: 0,
  offsetX: 0,
  offsetY: 0,
  movementX: 0,
  movementY: 0,
  button: 0,
  buttons: 0,
  relatedTarget: null,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
};

export class ShimMouseEvent extends ShimUIEvent {
  constructor(type: string, init: Init = {}) {
    super(type, init);
    assignDefaults(this, init, MOUSE_DEFAULTS);
  }

  getModifierState(key: string): boolean {
    return modifierState(this, key);
  }
}

export class ShimPointerEvent extends ShimMouseEvent {
  constructor(type: string, init: Init = {}) {
    super(type, init);
    assignDefaults(this, init, {
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      width: 1,
      height: 1,
      pressure: 0,
    });
  }
}

export class ShimKeyboardEvent extends ShimUIEvent {
  constructor(type: string, init: Init = {}) {
    super(type, init);
    assignDefaults(this, init, {
      key: '',
      code: '',
      location: 0,
      repeat: false,
      isComposing: false,
      charCode: 0,
      keyCode: 0,
      which: 0,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
    });
  }

  getModifierState(key: string): boolean {
    return modifierState(this, key);
  }
}

export class ShimFocusEvent extends ShimUIEvent {
  constructor(type: string, init: Init = {}) {
    super(type, init);
    assignDefaults(this, init, { relatedTarget: null });
  }
}

export class ShimInputEvent extends ShimUIEvent {
  constructor(type: string, init: Init = {}) {
    super(type, init);
    assignDefaults(this, init, {
      data: null,
      inputType: '',
      isComposing: false,
      dataTransfer: null,
    });
  }
}

export class ShimCustomEvent extends ShimEvent {
  constructor(type: string, init: Init = {}) {
    super(type, init);
    assignDefaults(this, init, { detail: null });
  }
}

export class ShimSubmitEvent extends ShimEvent {
  constructor(type: string, init: Init = {}) {
    super(type, init);
    assignDefaults(this, init, { submitter: null });
  }
}

/** Every event class a test or Testing Library may ask the window for, by name. */
export const EVENT_CLASSES: Record<string, typeof ShimEvent> = {
  Event: ShimEvent,
  UIEvent: ShimUIEvent,
  MouseEvent: ShimMouseEvent,
  PointerEvent: ShimPointerEvent,
  WheelEvent: ShimMouseEvent,
  DragEvent: ShimMouseEvent,
  KeyboardEvent: ShimKeyboardEvent,
  FocusEvent: ShimFocusEvent,
  InputEvent: ShimInputEvent,
  CompositionEvent: ShimUIEvent,
  TouchEvent: ShimUIEvent,
  CustomEvent: ShimCustomEvent,
  SubmitEvent: ShimSubmitEvent,
  ClipboardEvent: ShimEvent,
  AnimationEvent: ShimEvent,
  TransitionEvent: ShimEvent,
  ProgressEvent: ShimEvent,
  PopStateEvent: ShimEvent,
  PageTransitionEvent: ShimEvent,
  HashChangeEvent: ShimEvent,
  ErrorEvent: ShimEvent,
};

// ---- Listeners and dispatch -----------------------------------------------------------

type Listener = ((event: unknown) => unknown) | { handleEvent(event: unknown): unknown };

interface Entry {
  listener: Listener;
  capture: boolean;
  once: boolean;
  passive: boolean;
  removed: boolean;
}

interface ListenerOptions {
  capture?: boolean;
  once?: boolean;
  passive?: boolean;
  signal?: { aborted: boolean; addEventListener(type: 'abort', fn: () => void): void };
}

/** What a dispatch needs from an event. linkedom's own events fit too. */
interface Dispatchable {
  type: string;
  bubbles: boolean;
  cancelBubble: boolean;
  defaultPrevented: boolean;
  eventPhase: number;
  target: unknown;
  currentTarget: unknown;
  immediateStopped?: boolean;
  inPassiveListener?: boolean;
  path?: unknown[];
  _stopImmediatePropagationFlag?: boolean;
}

/**
 * Behaviour that runs around a click, as in a browser: a checkbox flips before the
 * listeners see the click and flips back when one of them cancels it.
 */
export interface Activation {
  before?(): void;
  after(): void;
  cancelled?(): void;
}

export interface DispatchHooks {
  /** An error thrown by a listener. Browsers report it and carry on with the others. */
  report(error: unknown): void;
  activation(event: Dispatchable, path: unknown[]): Activation | null;
}

interface WithParent {
  _getParent?: () => unknown;
}

const stores = new WeakMap<object, Map<string, Entry[]>>();

function listenersOf(target: object, type: string, create: boolean): Entry[] | undefined {
  let byType = stores.get(target);
  if (!byType) {
    if (!create) return undefined;
    byType = new Map();
    stores.set(target, byType);
  }
  let list = byType.get(type);
  if (!list && create) {
    list = [];
    byType.set(type, list);
  }
  return list;
}

function readOptions(options: unknown): Required<Omit<ListenerOptions, 'signal'>> & {
  signal?: ListenerOptions['signal'];
} {
  if (typeof options === 'boolean') {
    return { capture: options, once: false, passive: false };
  }
  const given = (options ?? {}) as ListenerOptions;
  return {
    capture: Boolean(given.capture),
    once: Boolean(given.once),
    passive: Boolean(given.passive),
    signal: given.signal,
  };
}

function invoke(
  node: object,
  event: Dispatchable,
  phase: number,
  hooks: DispatchHooks,
  which: 'capture' | 'bubble' | 'target',
): void {
  const list = listenersOf(node, event.type, false);
  if (!list || list.length === 0) return;
  const snapshot =
    which === 'target'
      ? [...list.filter((e) => e.capture), ...list.filter((e) => !e.capture)]
      : list.filter((e) => e.capture === (which === 'capture'));
  event.currentTarget = node;
  event.eventPhase = phase;
  for (const entry of snapshot) {
    if (entry.removed) continue;
    if (entry.once) removeEntry(list, entry);
    event.inPassiveListener = entry.passive;
    try {
      const { listener } = entry;
      if (typeof listener === 'function') listener.call(node, event);
      else listener.handleEvent(event);
    } catch (error) {
      hooks.report(error);
    }
    event.inPassiveListener = false;
    if (event.immediateStopped || event._stopImmediatePropagationFlag) break;
  }
}

function removeEntry(list: Entry[], entry: Entry): void {
  entry.removed = true;
  const at = list.indexOf(entry);
  if (at !== -1) list.splice(at, 1);
}

/** Replaces linkedom's listener methods on its EventTarget prototype. */
export function patchEventTarget(prototype: object, hooks: DispatchHooks): void {
  const methods = {
    addEventListener(this: object, type: string, listener: Listener | null, options?: unknown) {
      if (!listener) return;
      const { capture, once, passive, signal } = readOptions(options);
      if (signal?.aborted) return;
      const list = listenersOf(this, String(type), true) as Entry[];
      if (list.some((e) => e.listener === listener && e.capture === capture)) return;
      const entry: Entry = { listener, capture, once, passive, removed: false };
      list.push(entry);
      signal?.addEventListener('abort', () => removeEntry(list, entry));
    },
    removeEventListener(this: object, type: string, listener: Listener | null, options?: unknown) {
      const list = listenersOf(this, String(type), false);
      if (!list || !listener) return;
      const { capture } = readOptions(options);
      const entry = list.find((e) => e.listener === listener && e.capture === capture);
      if (entry) removeEntry(list, entry);
    },
    dispatchEvent(this: object, event: Dispatchable): boolean {
      const path: object[] = [this];
      for (
        let node = (this as WithParent)._getParent?.();
        node;
        node = (node as WithParent)._getParent?.()
      ) {
        path.push(node as object);
      }
      event.target = this;
      event.path = path;
      event.cancelBubble = false;
      const activation = hooks.activation(event, path);
      activation?.before?.();

      for (let i = path.length - 1; i > 0 && !event.cancelBubble; i -= 1) {
        invoke(path[i] as object, event, CAPTURING_PHASE, hooks, 'capture');
      }
      if (!event.cancelBubble) invoke(this, event, AT_TARGET, hooks, 'target');
      if (event.bubbles) {
        for (let i = 1; i < path.length && !event.cancelBubble; i += 1) {
          invoke(path[i] as object, event, BUBBLING_PHASE, hooks, 'bubble');
        }
      }
      event.eventPhase = NONE;
      event.currentTarget = null;

      if (activation) {
        if (event.defaultPrevented) activation.cancelled?.();
        else activation.after();
      }
      return !event.defaultPrevented;
    },
  };
  for (const [name, fn] of Object.entries(methods)) {
    Object.defineProperty(prototype, name, { value: fn, writable: true, configurable: true });
  }
}
