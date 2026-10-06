'use client';

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  addMonths,
  editionInMonth,
  monthKey,
  monthWeeks,
  neighbours,
  stepEdition,
} from '@/core/news';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { formatMonthName, formatWeekdayLong } from './format';

interface EditionNavProps {
  /** Every edition date, newest first. */
  dates: string[];
  current: string;
  /** The week, month and archive links, which share the row on a wide screen. */
  children?: ReactNode;
}

const WEEKDAYS = [
  ['Mo', 'Monday'],
  ['Tu', 'Tuesday'],
  ['We', 'Wednesday'],
  ['Th', 'Thursday'],
  ['Fr', 'Friday'],
  ['Sa', 'Saturday'],
  ['Su', 'Sunday'],
] as const;

const square = 'w-5 px-0';
const iconButton =
  'text-muted hover:text-fg hover:bg-raised rounded-control transition-press inline-flex size-5 items-center justify-center active:scale-98 disabled:pointer-events-none disabled:text-faint';

/**
 * The day either side and a calendar of every edition, under the date title. The calendar
 * shows which days have an edition, which a native date input cannot.
 */
export function EditionNav({ dates, current, children }: EditionNavProps) {
  const { earlier, later } = neighbours(dates, current);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialogId = useId();

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  };

  // On the document: Safari does not focus a button on click, so after a tap Escape would
  // land on the body. A press outside closes it too.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    };
    const onDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  return (
    <div ref={root} className="relative flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <nav aria-label="Editions" className="flex items-center gap-0.5">
          {earlier ? (
            <Link
              href={`/signal/${earlier}`}
              aria-label={`Earlier edition, ${formatWeekdayLong(earlier)}`}
              title={`Earlier edition, ${formatWeekdayLong(earlier)}`}
              className={buttonClass('secondary', 'md', square)}
            >
              <ChevronLeft aria-hidden size={16} strokeWidth={2} />
            </Link>
          ) : (
            <button
              type="button"
              disabled
              aria-label="No earlier edition"
              className={buttonClass('secondary', 'md', square)}
            >
              <ChevronLeft aria-hidden size={16} strokeWidth={2} />
            </button>
          )}
          <button
            ref={trigger}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={open ? dialogId : undefined}
            onClick={() => setOpen((value) => !value)}
            className={buttonClass('secondary', 'md', open ? 'border-border-strong' : undefined)}
          >
            <CalendarDays aria-hidden size={16} strokeWidth={2} />
            Choose a day
            <ChevronDown
              aria-hidden
              size={16}
              strokeWidth={2}
              className={cn(
                'text-muted transition-transform duration-150 ease-out',
                open && 'rotate-180',
              )}
            />
          </button>
          {later ? (
            <Link
              href={`/signal/${later}`}
              aria-label={`Later edition, ${formatWeekdayLong(later)}`}
              title={`Later edition, ${formatWeekdayLong(later)}`}
              className={buttonClass('secondary', 'md', square)}
            >
              <ChevronRight aria-hidden size={16} strokeWidth={2} />
            </Link>
          ) : (
            <button
              type="button"
              disabled
              aria-label="No later edition"
              className={buttonClass('secondary', 'md', square)}
            >
              <ChevronRight aria-hidden size={16} strokeWidth={2} />
            </button>
          )}
        </nav>
        {children}
      </div>

      {open ? (
        <Calendar id={dialogId} dates={dates} current={current} onPick={() => close(false)} />
      ) : null}
    </div>
  );
}

function Calendar({
  id,
  dates,
  current,
  onPick,
}: {
  id: string;
  dates: string[];
  current: string;
  onPick: () => void;
}) {
  const [month, setMonth] = useState(() => monthKey(current));
  const [focus, setFocus] = useState(current);
  // Focus follows the keyboard, and lands on the shown day when the calendar opens.
  const moved = useRef(true);
  const grid = useRef<HTMLTableElement>(null);
  const monthId = useId();
  const enabled = useMemo(() => new Set(dates), [dates]);
  const latest = dates[0];
  const firstMonth = monthKey(dates.at(-1) ?? current);
  const lastMonth = monthKey(latest ?? current);
  const tabStop = monthKey(focus) === month ? focus : editionInMonth(dates, month, 'first');

  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    grid.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
  }, [focus, month]);

  const go = (target: string | undefined) => {
    if (target === undefined) return;
    moved.current = true;
    setFocus(target);
    setMonth(monthKey(target));
  };

  const turn = (by: number) => {
    const next = addMonths(month, by);
    setMonth(next);
    setFocus(editionInMonth(dates, next, focus) ?? focus);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    const from = tabStop ?? focus;
    const moves: Record<string, () => string | undefined> = {
      ArrowLeft: () => stepEdition(dates, from, -1),
      ArrowRight: () => stepEdition(dates, from, 1),
      ArrowUp: () => stepEdition(dates, from, -7),
      ArrowDown: () => stepEdition(dates, from, 7),
      Home: () => editionInMonth(dates, month, 'first'),
      End: () => editionInMonth(dates, month, 'last'),
      PageUp: () => editionInMonth(dates, addMonths(month, -1), from),
      PageDown: () => editionInMonth(dates, addMonths(month, 1), from),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    go(move());
  };

  return (
    <div
      id={id}
      role="dialog"
      aria-label="Choose a day"
      className="bg-surface rounded-panel border-border md:shadow-float step-in z-30 flex w-40 flex-col gap-1 self-start border p-2 md:absolute md:top-6 md:left-0 md:border-transparent"
    >
      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          aria-label="Earlier month"
          title="Earlier month"
          disabled={month <= firstMonth}
          onClick={() => turn(-1)}
          className={iconButton}
        >
          <ChevronLeft aria-hidden size={16} strokeWidth={2} />
        </button>
        <h2 id={monthId} aria-live="polite" className="text-sm font-medium">
          {formatMonthName(month)}
        </h2>
        <button
          type="button"
          aria-label="Later month"
          title="Later month"
          disabled={month >= lastMonth}
          onClick={() => turn(1)}
          className={iconButton}
        >
          <ChevronRight aria-hidden size={16} strokeWidth={2} />
        </button>
      </div>

      <table
        ref={grid}
        role="grid"
        aria-labelledby={monthId}
        onKeyDown={onKeyDown}
        className="border-collapse"
      >
        <thead>
          <tr>
            {WEEKDAYS.map(([short, long]) => (
              <th key={long} scope="col" abbr={long} className="t-label h-4 w-5 font-normal">
                {short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthWeeks(month).map((week, row) => (
            <tr key={week.find(Boolean) ?? row}>
              {week.map((day, col) => (
                <td key={day ?? `blank-${col}`} className="p-0 text-center">
                  {day === null ? null : enabled.has(day) ? (
                    <Link
                      href={`/signal/${day}`}
                      tabIndex={day === tabStop ? 0 : -1}
                      aria-current={day === current ? 'date' : undefined}
                      aria-label={`${formatWeekdayLong(day)}${day === latest ? ', latest edition' : ''}`}
                      onClick={onPick}
                      className={cn(
                        't-figure rounded-control transition-press inline-flex size-5 items-center justify-center border text-sm active:scale-98',
                        day === current ? 'border-fg' : 'hover:bg-raised border-transparent',
                        day === current || day === latest ? 'font-semibold' : 'font-medium',
                      )}
                    >
                      {Number(day.slice(8))}
                    </Link>
                  ) : (
                    <span
                      aria-disabled="true"
                      className="t-figure text-faint inline-flex size-5 items-center justify-center text-sm"
                    >
                      {Number(day.slice(8))}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {latest && current !== latest ? (
        <Link
          href={`/signal/${latest}`}
          onClick={onPick}
          className="rule-t text-muted hover:text-fg inline-flex h-5 items-center pt-1 text-sm font-medium underline underline-offset-4 transition-colors duration-150 ease-out"
        >
          Latest edition
        </Link>
      ) : null}
    </div>
  );
}
