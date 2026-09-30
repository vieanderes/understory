import type { Callback, Scenario } from './types';

/*
 * Five programs around an online seat booking, from the plain case to the
 * one that surprises experienced engineers. The sources of the first three are real
 * JavaScript: tests/unit/core/labs/event-loop-stepper/node-equivalence.test.ts pins the
 * engine's output to what Node printed for exactly these strings.
 */

export const SCENARIO_IDS = [
  'classic',
  'microtask-chain',
  'async-await',
  'blocked-click',
  'frame-order',
] as const;

export type ScenarioId = (typeof SCENARIO_IDS)[number];

export const DEFAULT_SCENARIO_ID: ScenarioId = 'classic';

/** The one number of a scenario that the learner may change. */
export interface ScenarioParam {
  label: string;
  unit: string;
  options: readonly number[];
  default: number;
}

export interface ScenarioDef {
  id: ScenarioId;
  title: string;
  param: ScenarioParam;
  build: (value: number) => Scenario;
}

/** The 1-based line of the first source line that contains `needle`. */
export function lineOf(lines: readonly string[], needle: string): number {
  const index = lines.findIndex((line) => line.includes(needle));
  if (index < 0) throw new Error(`No source line contains "${needle}"`);
  return index + 1;
}

function classic(delayMs: number): Scenario {
  const lines = [
    "console.log('checkout opened');",
    '',
    'setTimeout(function expireHold() {',
    "  console.log('timeout: hold expired');",
    `}, ${delayMs});`,
    '',
    'Promise.resolve().then(function confirmSeat() {',
    "  console.log('microtask: seat confirmed');",
    '});',
    '',
    "console.log('script finished');",
  ];
  const at = (needle: string) => lineOf(lines, needle);
  return {
    id: 'classic',
    title: 'Classic order',
    prompt: 'Before you step: four lines log. In what order?',
    source: lines.join('\n'),
    entry: { callback: 'main', label: 'script', source: 'script' },
    callbacks: [
      {
        id: 'main',
        label: 'script',
        line: 1,
        ops: [
          { kind: 'log', text: 'checkout opened', line: at('checkout opened') },
          { kind: 'setTimeout', callback: 'expireHold', delayMs, line: at('setTimeout(') },
          { kind: 'promiseThen', callback: 'confirmSeat', line: at('Promise.resolve()') },
          { kind: 'log', text: 'script finished', line: at('script finished') },
        ],
      },
      {
        id: 'expireHold',
        label: 'expireHold',
        line: at('function expireHold'),
        ops: [{ kind: 'log', text: 'timeout: hold expired', line: at('timeout: hold expired') }],
      },
      {
        id: 'confirmSeat',
        label: 'confirmSeat',
        line: at('function confirmSeat'),
        ops: [
          { kind: 'log', text: 'microtask: seat confirmed', line: at('microtask: seat confirmed') },
        ],
      },
    ],
  };
}

function microtaskChain(length: number): Scenario {
  const lines = [
    'setTimeout(function releaseSeats() {',
    "  console.log('timeout: release unpaid seats');",
    '}, 0);',
    '',
    'let checked = 0;',
    'function checkNextOrder() {',
    '  checked += 1;',
    "  console.log('microtask: check order ' + checked);",
    `  if (checked < ${length}) queueMicrotask(checkNextOrder);`,
    '}',
    'queueMicrotask(checkNextOrder);',
    '',
    "console.log('script finished');",
  ];
  const at = (needle: string) => lineOf(lines, needle);
  // The DSL has no loops: the recursion is unrolled into one callback per run.
  const checks: Callback[] = Array.from({ length }, (_, i) => ({
    id: `check${i + 1}`,
    label: 'checkNextOrder',
    line: at('function checkNextOrder'),
    ops: [
      { kind: 'log', text: `microtask: check order ${i + 1}`, line: at('microtask: check order') },
      ...(i + 1 < length
        ? [
            {
              kind: 'queueMicrotask',
              callback: `check${i + 2}`,
              line: at('if (checked <'),
            } as const,
          ]
        : []),
    ],
  }));
  return {
    id: 'microtask-chain',
    title: 'Microtasks queue microtasks',
    prompt: 'Before you step: the timer has 0 ms. How many orders are checked before it fires?',
    source: lines.join('\n'),
    entry: { callback: 'main', label: 'script', source: 'script' },
    callbacks: [
      {
        id: 'main',
        label: 'script',
        line: 1,
        ops: [
          { kind: 'setTimeout', callback: 'releaseSeats', delayMs: 0, line: at('setTimeout(') },
          {
            kind: 'queueMicrotask',
            callback: 'check1',
            line: at('queueMicrotask(checkNextOrder);'),
          },
          { kind: 'log', text: 'script finished', line: at('script finished') },
        ],
      },
      {
        id: 'releaseSeats',
        label: 'releaseSeats',
        line: at('function releaseSeats'),
        ops: [
          {
            kind: 'log',
            text: 'timeout: release unpaid seats',
            line: at('timeout: release unpaid seats'),
          },
        ],
      },
      ...checks,
    ],
  };
}

function asyncAwait(awaits: number): Scenario {
  const steps = ['hold: seat reserved', 'hold: payment taken', 'hold: ticket issued'].slice(
    0,
    awaits,
  );
  const lines = [
    "const ready = Promise.resolve('B12');",
    '',
    'async function holdSeat() {',
    "  console.log('hold: start');",
    ...steps.flatMap((text, i) => [`  await ready; // hop ${i + 1}`, `  console.log('${text}');`]),
    '}',
    '',
    'async function sendReceipt() {',
    "  console.log('receipt: start');",
    '  await ready; // one hop',
    "  console.log('receipt: sent');",
    '}',
    '',
    'holdSeat();',
    'sendReceipt();',
    "console.log('script finished');",
  ];
  const at = (needle: string) => lineOf(lines, needle);
  const hold: Callback[] = [
    {
      id: 'holdSeat',
      label: 'holdSeat',
      line: at('async function holdSeat'),
      ops: [
        { kind: 'log', text: 'hold: start', line: at('hold: start') },
        { kind: 'awaitResolved', continuation: 'holdSeat1', line: at('// hop 1') },
      ],
    },
    ...steps.map((text, i): Callback => ({
      id: `holdSeat${i + 1}`,
      label: 'holdSeat (resumed)',
      line: at(`// hop ${i + 1}`),
      ops: [
        { kind: 'log', text, line: at(text) },
        ...(i + 1 < steps.length
          ? [
              {
                kind: 'awaitResolved',
                continuation: `holdSeat${i + 2}`,
                line: at(`// hop ${i + 2}`),
              } as const,
            ]
          : []),
      ],
    })),
  ];
  return {
    id: 'async-await',
    title: 'Two async functions',
    prompt: 'Before you step: does holdSeat finish before sendReceipt starts?',
    source: lines.join('\n'),
    entry: { callback: 'main', label: 'script', source: 'script' },
    callbacks: [
      {
        id: 'main',
        label: 'script',
        line: 1,
        ops: [
          { kind: 'call', callback: 'holdSeat', line: at('holdSeat();') },
          { kind: 'call', callback: 'sendReceipt', line: at('sendReceipt();') },
          { kind: 'log', text: 'script finished', line: at('script finished') },
        ],
      },
      ...hold,
      {
        id: 'sendReceipt',
        label: 'sendReceipt',
        line: at('async function sendReceipt'),
        ops: [
          { kind: 'log', text: 'receipt: start', line: at('receipt: start') },
          { kind: 'awaitResolved', continuation: 'sendReceipt1', line: at('// one hop') },
        ],
      },
      {
        id: 'sendReceipt1',
        label: 'sendReceipt (resumed)',
        line: at('// one hop'),
        ops: [{ kind: 'log', text: 'receipt: sent', line: at('receipt: sent') }],
      },
    ],
  };
}

function blockedClick(blockMs: number): Scenario {
  const lines = [
    "buyButton.addEventListener('click', function onBuy() {",
    "  buyButton.textContent = 'Buying';",
    '',
    '  setTimeout(function showSpinner() {',
    "    console.log('timeout: spinner shown');",
    '  }, 0);',
    '',
    "  fetch('/api/hold').then(function onHeld() {",
    "    console.log('response: seat held');",
    '  });',
    '',
    `  priceEverySeat(); // synchronous, ${blockMs} ms`,
    "  console.log('handler finished');",
    '});',
  ];
  const at = (needle: string) => lineOf(lines, needle);
  return {
    id: 'blocked-click',
    title: 'A blocked Buy button',
    prompt: 'Before you step: when does the button show "Buying"? The response takes 40 ms.',
    source: lines.join('\n'),
    entry: { callback: 'onBuy', label: 'click: onBuy', source: 'event' },
    callbacks: [
      {
        id: 'onBuy',
        label: 'onBuy',
        line: 1,
        ops: [
          { kind: 'domWrite', text: 'button reads "Buying"', line: at('textContent') },
          { kind: 'setTimeout', callback: 'showSpinner', delayMs: 0, line: at('setTimeout(') },
          { kind: 'fetchResolve', callback: 'onHeld', afterMs: 40, line: at('fetch(') },
          { kind: 'blockFor', ms: blockMs, line: at('priceEverySeat') },
          { kind: 'log', text: 'handler finished', line: at('handler finished') },
        ],
      },
      {
        id: 'showSpinner',
        label: 'showSpinner',
        line: at('function showSpinner'),
        ops: [{ kind: 'log', text: 'timeout: spinner shown', line: at('spinner shown') }],
      },
      {
        id: 'onHeld',
        label: 'onHeld',
        line: at('function onHeld'),
        ops: [{ kind: 'log', text: 'response: seat held', line: at('seat held') }],
      },
    ],
  };
}

function frameOrder(delayMs: number): Scenario {
  const lines = [
    'setTimeout(function onTimeout() {',
    "  console.log('timeout');",
    `}, ${delayMs});`,
    '',
    'requestAnimationFrame(function onFrame() {',
    "  console.log('frame: move the queue banner');",
    "  banner.style.transform = 'translateX(0)';",
    '  Promise.resolve().then(function afterMove() {',
    "    console.log('microtask inside the frame');",
    '  });',
    '});',
    '',
    'Promise.resolve().then(function onResolved() {',
    "  console.log('microtask');",
    '});',
    '',
    "console.log('script finished');",
  ];
  const at = (needle: string) => lineOf(lines, needle);
  return {
    id: 'frame-order',
    title: 'Frame, timer, microtask',
    prompt: 'Before you step: which logs first, the timer or the animation frame?',
    source: lines.join('\n'),
    entry: { callback: 'main', label: 'script', source: 'script' },
    callbacks: [
      {
        id: 'main',
        label: 'script',
        line: 1,
        ops: [
          { kind: 'setTimeout', callback: 'onTimeout', delayMs, line: at('setTimeout(') },
          {
            kind: 'requestAnimationFrame',
            callback: 'onFrame',
            line: at('requestAnimationFrame('),
          },
          { kind: 'promiseThen', callback: 'onResolved', line: at('function onResolved') },
          { kind: 'log', text: 'script finished', line: at('script finished') },
        ],
      },
      {
        id: 'onTimeout',
        label: 'onTimeout',
        line: at('function onTimeout'),
        ops: [{ kind: 'log', text: 'timeout', line: at("log('timeout')") }],
      },
      {
        id: 'onFrame',
        label: 'onFrame',
        line: at('function onFrame'),
        ops: [
          { kind: 'log', text: 'frame: move the queue banner', line: at('frame: move') },
          { kind: 'domWrite', text: 'banner slides in', line: at('banner.style') },
          { kind: 'promiseThen', callback: 'afterMove', line: at('function afterMove') },
        ],
      },
      {
        id: 'afterMove',
        label: 'afterMove',
        line: at('function afterMove'),
        ops: [{ kind: 'log', text: 'microtask inside the frame', line: at('inside the frame') }],
      },
      {
        id: 'onResolved',
        label: 'onResolved',
        line: at('function onResolved'),
        ops: [{ kind: 'log', text: 'microtask', line: at("log('microtask')") }],
      },
    ],
  };
}

export const SCENARIOS: readonly ScenarioDef[] = [
  {
    id: 'classic',
    title: 'Classic order',
    param: { label: 'Timer delay', unit: 'ms', options: [0, 10], default: 0 },
    build: classic,
  },
  {
    id: 'microtask-chain',
    title: 'Microtasks queue microtasks',
    param: { label: 'Chain length', unit: 'microtasks', options: [1, 3, 6], default: 3 },
    build: microtaskChain,
  },
  {
    id: 'async-await',
    title: 'Two async functions',
    param: { label: 'Awaits in holdSeat', unit: 'awaits', options: [1, 2, 3], default: 2 },
    build: asyncAwait,
  },
  {
    id: 'blocked-click',
    title: 'A blocked Buy button',
    param: { label: 'Blocking work', unit: 'ms', options: [0, 40, 120], default: 120 },
    build: blockedClick,
  },
  {
    id: 'frame-order',
    title: 'Frame, timer, microtask',
    param: { label: 'Timer delay', unit: 'ms', options: [0, 20], default: 0 },
    build: frameOrder,
  },
];

/** Builds a scenario. A value that is not one of the param's options falls back to the default. */
export function buildScenario(id: ScenarioId, value?: number): Scenario {
  const def = SCENARIOS.find((s) => s.id === id)!;
  const chosen =
    value !== undefined && def.param.options.includes(value) ? value : def.param.default;
  return def.build(chosen);
}
