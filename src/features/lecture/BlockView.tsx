import type { Rich } from '@/core/content/compiled';
import type { LectureBlock, WrongAnswer } from '@/core/lecture';
import { LessonFigure } from '@/features/lesson-player/figures/LessonFigure';
import { Code, Heading, Kicker, RichHtml, Solution, type Level } from './parts';

/*
 * One step of a lesson as reading. The question and its answer sit together; the reason
 * for the right answer comes first, then the answers people give by mistake, because a
 * named misconception is what stops you making it.
 */

const KICKER: Record<string, string> = {
  predict: 'Worked example · What does it print?',
  choice: 'Check your understanding',
  checkpoint: 'Check your understanding',
  trace: 'Trace it line by line',
  'fill-blank': 'Completed example',
  parsons: 'The program in order',
  'bug-hunt': 'Find the bug',
  'ai-review': 'Review the assistant’s code',
  code: 'Coding exercise',
  page: 'Page exercise',
  sql: 'SQL exercise',
  'model-answer': 'Explain it',
};

function Answer({ label, answer, why }: { label: string; answer: Rich; why: Rich }) {
  return (
    <div className="lecture-answer rule-t flex flex-col gap-1 pt-2">
      <p className="t-label text-fg">{label}</p>
      <RichHtml value={answer} className="font-medium" />
      <RichHtml value={why} />
    </div>
  );
}

function WrongAnswers({ wrong }: { wrong: readonly WrongAnswer[] }) {
  if (wrong.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <p className="t-label">Answers people give, and why they are wrong</p>
      <ul className="flex flex-col gap-2">
        {wrong.map((item, i) => (
          <li key={i} className="text-muted flex flex-col gap-0.5 text-sm">
            <RichHtml value={item.answer} inline className="text-fg" />
            <RichHtml value={item.why} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BlockView({ block, level }: { block: LectureBlock; level: Level }) {
  switch (block.kind) {
    case 'explanation':
      return (
        <div className="flex flex-col gap-3">
          <RichHtml value={block.body} className="lecture-prose" />
          {block.figure ? (
            <div className="lecture-figure">
              <LessonFigure id={block.figure.id} caption={block.figure.caption} />
            </div>
          ) : null}
        </div>
      );

    case 'question':
      return (
        <div className="lecture-block rule-t flex flex-col gap-2 pt-3">
          <Kicker>{KICKER[block.variant]}</Kicker>
          <Heading level={level} className="font-medium">
            <RichHtml value={block.question} inline />
          </Heading>
          {block.code ? <Code code={block.code} label="Code for this question" /> : null}
          <Answer label="Answer" answer={block.answer} why={block.why} />
          <WrongAnswers wrong={block.wrong} />
        </div>
      );

    case 'trace':
      return (
        <div className="lecture-block rule-t flex flex-col gap-2 pt-3">
          <Kicker>{KICKER.trace}</Kicker>
          <RichHtml value={block.prompt} />
          <Code code={block.code} label="Code to trace" />
          <div
            className="min-w-0 overflow-x-auto"
            tabIndex={0}
            role="region"
            aria-label="Trace table"
          >
            <table className="t-figure w-full text-sm">
              <thead>
                <tr className="rule-b">
                  <th scope="col" className="t-label py-1 pr-2 text-left">
                    Line
                  </th>
                  {block.columns.map((column) => (
                    <th key={column} scope="col" className="t-label py-1 pr-2 text-left">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, i) => (
                  <tr key={i} className="rule-b">
                    <td className="text-muted py-1 pr-2">{row.line}</td>
                    {row.values.map((value, j) => (
                      <td key={j} className="py-1 pr-2">
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );

    case 'completed':
      return (
        <div className="lecture-block rule-t flex flex-col gap-2 pt-3">
          <Kicker>{KICKER[block.variant]}</Kicker>
          <RichHtml value={block.prompt} />
          <Solution files={block.solution} label="Completed code" />
          {block.leftOut.length > 0 ? (
            <div className="flex flex-col gap-1">
              <p className="t-label">Lines that do not belong</p>
              <ul className="flex flex-col gap-2">
                {block.leftOut.map((item, i) => (
                  <li key={i} className="flex flex-col gap-1">
                    <Code code={item.code} label="A line that does not belong" />
                    <RichHtml value={item.why} className="text-muted text-sm" />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      );

    case 'bug':
      return (
        <div className="lecture-block rule-t flex flex-col gap-2 pt-3">
          <Kicker>{KICKER[block.variant]}</Kicker>
          {block.request ? (
            <p className="text-muted text-sm">
              <span className="t-label pr-1">Asked for</span>
              {block.request}
            </p>
          ) : null}
          <RichHtml value={block.prompt} />
          <Code
            code={block.code}
            marked={block.lines}
            label={`Code with the fault on line ${block.lines.join(' and ')}`}
          />
          <Answer
            label={`The fault · line ${block.lines.join(', ')}`}
            answer={block.answer}
            why={block.why}
          />
          {block.fix ? (
            <div className="flex flex-col gap-1">
              <p className="t-label text-fg">The fix</p>
              <Code code={block.fix} label="Fixed code" />
            </div>
          ) : null}
          <WrongAnswers wrong={block.wrong} />
        </div>
      );

    case 'exercise':
      return (
        <div className="lecture-block rule-t flex flex-col gap-2 pt-3">
          <Kicker>{KICKER[block.variant]}</Kicker>
          <RichHtml value={block.prompt} />
          {block.starter ? (
            <div className="flex flex-col gap-1">
              <p className="t-label">Starting point</p>
              <Code code={block.starter} label="Starter code" />
            </div>
          ) : null}
          {block.hints.length > 0 ? (
            <div className="flex flex-col gap-1">
              <p className="t-label">How to approach it</p>
              <ol className="flex list-decimal flex-col gap-1 pl-3">
                {block.hints.map((hint, i) => (
                  <li key={i}>
                    <RichHtml value={hint} />
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          {block.solution.length > 0 ? (
            <div className="lecture-answer rule-t flex flex-col gap-1 pt-2">
              <p className="t-label text-fg">Solution</p>
              <Solution files={block.solution} label="Solution" />
            </div>
          ) : null}
        </div>
      );

    case 'model-answer':
      return (
        <div className="lecture-block rule-t flex flex-col gap-2 pt-3">
          <Kicker>{KICKER['model-answer']}</Kicker>
          <RichHtml value={block.prompt} />
          <div className="lecture-answer rule-t flex flex-col gap-1 pt-2">
            <p className="t-label text-fg">Model answer</p>
            <RichHtml value={block.answer} />
          </div>
          {block.points.length > 0 ? (
            <div className="flex flex-col gap-1">
              <p className="t-label">A full answer covers</p>
              <ul className="flex list-disc flex-col gap-1 pl-3">
                {block.points.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      );
  }
}
