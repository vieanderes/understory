import { CountUp } from '@/features/motion/CountUp';
import { cn } from '@/lib/cn';

interface FigureProps {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  /** Accent is reserved for a gap. Do not use it to make a number look important. */
  tone?: 'default' | 'gap';
  className?: string;
}

/**
 * A figure and its name. The number is the larger, higher-contrast half, set in the mono
 * face with tabular digits so it never shifts its neighbours as it grows.
 * Use inside a <dl>.
 */
export function Figure({ label, value, unit, note, tone = 'default', className }: FigureProps) {
  return (
    <div className={cn('rule-t pt-2', className)}>
      <dt className="t-label">{label}</dt>
      <dd className="pt-1">
        <CountUp
          value={value}
          className={cn('t-figure text-xl', tone === 'gap' && 'text-accent')}
        />
        {unit ? <span className="t-figure text-muted pl-1 text-sm">{unit}</span> : null}
        {note ? <p className="text-muted text-sm">{note}</p> : null}
      </dd>
    </div>
  );
}
