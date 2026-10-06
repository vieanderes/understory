import { cn } from '@/lib/cn';

/**
 * The reading geometry of a step.
 *
 * With code, the question is a header row across the whole width, and below it the two
 * columns start on one line: the code on the left, the answers on the right, so the code
 * card and the first answer share a top edge. On a phone it is one column in the same
 * order: question, code, answers, read as one thing (no split attention).
 *
 * `split` sets the balance. `code` (7 and 5) is for a step whose work happens in the code,
 * such as picking the line at fault; `even` (6 and 6) for one whose work happens in the
 * answers, such as a choice or a trace table, where a short snippet would otherwise leave
 * a wide empty card beside cramped answers.
 *
 * Without code: one reading column, the question first.
 */
export function StepLayout({
  question,
  code,
  split = 'code',
  children,
}: {
  question?: React.ReactNode;
  code?: React.ReactNode;
  split?: 'code' | 'even';
  children: React.ReactNode;
}) {
  if (!code) {
    return (
      <div className="flex max-w-3xl flex-col gap-3">
        {question}
        {children}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {question ? <div className="max-w-3xl">{question}</div> : null}
      <div className="grid grid-cols-4 items-start gap-x-4 gap-y-3 md:grid-cols-12">
        <div
          className={cn(
            'col-span-4 min-w-0 md:sticky md:top-10',
            split === 'even' ? 'md:col-span-6' : 'md:col-span-7',
          )}
        >
          {/* The code stays in view while the learner works through the answers. */}
          {code}
        </div>
        <div
          className={cn(
            'col-span-4 flex min-w-0 flex-col gap-3',
            split === 'even' ? 'md:col-span-6' : 'md:col-span-5',
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
