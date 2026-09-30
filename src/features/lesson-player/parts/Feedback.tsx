import { Check, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/cn';

interface FeedbackProps {
  verdict: 'right' | 'partly' | 'wrong';
  children: React.ReactNode;
  className?: string;
}

const TITLE = { right: 'Right', partly: 'Partly right', wrong: 'Not quite' } as const;

/**
 * The verdict and the reason. A right answer gets a short moment: the tick draws itself,
 * under 300 ms, and a lightbulb switches on for the rest. A wrong answer is a knowledge gap, not a failure, so it takes the accent that
 * marks gaps everywhere else, and a lightbulb instead of a cross: here is the idea you
 * were missing. role="status" makes a screen reader read it when it appears.
 */
export function Feedback({ verdict, children, className }: FeedbackProps) {
  const right = verdict === 'right';
  const Icon = right ? Check : Lightbulb;
  return (
    <div
      role="status"
      data-verdict={verdict}
      className={cn('step-in rule-t flex flex-col gap-1 pt-2', className)}
    >
      <p
        className={cn(
          'flex items-center gap-1 font-medium',
          right ? 'text-success' : 'text-accent',
        )}
      >
        <Icon
          aria-hidden
          size={20}
          strokeWidth={2}
          className={right ? 'verdict-draw' : 'verdict-idea'}
        />
        {TITLE[verdict]}
      </p>
      <div className="prose-measure text-base">{children}</div>
    </div>
  );
}
