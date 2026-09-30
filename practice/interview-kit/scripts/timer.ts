/**
 * pnpm timer <minutes>
 *
 * A countdown for rehearsing under time. The checkpoints follow the four-hour build plan,
 * scaled to whatever length you pass, so `pnpm timer 90` gives a compressed version of the
 * same rhythm. Pass --fast to run a whole plan in seconds and see every checkpoint.
 */

interface Checkpoint {
  /** Fraction of the session at which this phase starts. */
  at: number;
  label: string;
}

// The four-hour plan, in minutes from the start. Scaling by fraction keeps the proportions.
const FOUR_HOUR_PLAN: ReadonlyArray<[number, string]> = [
  [0, 'Read the brief, ask questions, write assumptions and three must-haves'],
  [20, 'Skeleton: a thin path from UI through API to data, running'],
  [35, 'The core happy path end to end, committing often'],
  [135, 'Error, empty and loading states, validation, guardrails, a small eval set'],
  [170, 'Tests on the core logic'],
  [195, 'README with a diagram, trade-offs, next steps and how you used AI'],
  [220, 'Rehearse the demo, prepare a fallback, stop adding features'],
];

const PLAN: Checkpoint[] = FOUR_HOUR_PLAN.map(([minute, label]) => ({ at: minute / 240, label }));

const args = process.argv.slice(2);
const minutes = Number(args.find((arg) => !arg.startsWith('-')) ?? 240);
const fast = args.includes('--fast');

if (!Number.isFinite(minutes) || minutes <= 0) {
  console.error('Usage: pnpm timer <minutes> [--fast]   for example pnpm timer 240');
  process.exit(1);
}

const totalMs = minutes * 60_000;
// --fast squeezes the whole session into ten seconds, for checking the script itself.
const speed = fast ? totalMs / 10_000 : 1;

function clock(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function announce(checkpoint: Checkpoint, index: number): void {
  const startMs = checkpoint.at * totalMs;
  const next = PLAN[index + 1];
  const endMs = (next ? next.at : 1) * totalMs;
  process.stdout.write('\x07');
  console.log(`\n[${clock(startMs)} to ${clock(endMs)}] ${checkpoint.label}`);
}

console.log(`Session of ${minutes} minute${minutes === 1 ? '' : 's'}. Ctrl+C to stop.`);
const started = Date.now();
let announced = -1;

const tick = setInterval(
  () => {
    const elapsed = (Date.now() - started) * speed;
    const remaining = totalMs - elapsed;

    while (announced + 1 < PLAN.length && elapsed >= PLAN[announced + 1]!.at * totalMs) {
      announced += 1;
      announce(PLAN[announced]!, announced);
    }

    if (remaining <= 0) {
      clearInterval(tick);
      process.stdout.write('\x07');
      console.log('\nTime. Stop coding. Present what runs.');
      return;
    }

    if (process.stdout.isTTY) {
      process.stdout.write(`\r${clock(remaining)} left  `);
    }
  },
  fast ? 50 : 1000,
);
