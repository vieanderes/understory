import { DEFAULT_SELECTION, isoDateSchema, toIsoDate, type IsoDate } from '@/core/news';

/** The flags of `pnpm news`. Parsed by hand: four flags do not need a library. */
export interface CliOptions {
  date: IsoDate;
  dryRun: boolean;
  noLlm: boolean;
  max: number;
  help: boolean;
}

/** `--max` can lower the cost of a run, never raise the size of a day past this. */
const MAX_ITEMS_LIMIT = 20;

export const USAGE = `Usage: pnpm news [--date YYYY-MM-DD] [--dry-run] [--no-llm] [--max N]

  --date     The day to write. Defaults to today (UTC).
  --dry-run  Run the whole pipeline and print the day, but write nothing.
  --no-llm   Use extractive briefs even when ANTHROPIC_API_KEY is set.
  --max      Items in the day, 1 to ${MAX_ITEMS_LIMIT}. Defaults to ${DEFAULT_SELECTION.max}. Also caps model requests.

Environment: ANTHROPIC_API_KEY (optional), SIGNAL_MODEL (optional), NEWS_DATA_DIR (optional).`;

function valueOf(args: readonly string[], index: number, flag: string): string {
  const inline = args[index]?.split('=')[1];
  const value = inline ?? args[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`${flag} needs a value.`);
  return value;
}

export function parseArgs(args: readonly string[], now: Date): CliOptions {
  const options: CliOptions = {
    date: toIsoDate(now),
    dryRun: false,
    noLlm: false,
    max: DEFAULT_SELECTION.max,
    help: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? '';
    const flag = arg.split('=')[0];
    const consumesNext = !arg.includes('=');
    if (flag === '--dry-run') options.dryRun = true;
    else if (flag === '--no-llm') options.noLlm = true;
    else if (flag === '--help' || flag === '-h') options.help = true;
    else if (flag === '--date') {
      const date = isoDateSchema.safeParse(valueOf(args, index, '--date'));
      if (!date.success) throw new Error('--date must be written YYYY-MM-DD.');
      options.date = date.data;
      if (consumesNext) index += 1;
    } else if (flag === '--max') {
      const max = Number(valueOf(args, index, '--max'));
      if (!Number.isInteger(max) || max < 1 || max > MAX_ITEMS_LIMIT) {
        throw new Error(`--max must be a whole number from 1 to ${MAX_ITEMS_LIMIT}.`);
      }
      options.max = max;
      if (consumesNext) index += 1;
    } else throw new Error(`Unknown argument "${arg}".\n\n${USAGE}`);
  }
  return options;
}
