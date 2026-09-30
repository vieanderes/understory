'use client';

import { useEffect, useRef } from 'react';
import { PARTY_LABEL, type Frame, type Party } from '@/core/labs/request-journey';
import { cn } from '@/lib/cn';

interface SequenceDiagramProps {
  parties: readonly Party[];
  frames: readonly Frame[];
  index: number;
}

/**
 * A typographic sequence diagram: one column per party, one row per message, hairline
 * arrows. Every row also reads as a sentence, so the list works without the drawing.
 */
export function SequenceDiagram({ parties, frames, index }: SequenceDiagramProps) {
  const region = useRef<HTMLDivElement>(null);
  const centre = (party: Party) => ((parties.indexOf(party) + 0.5) / parties.length) * 100;

  const rows = frames.slice(0, index + 1).flatMap((frame, at) =>
    frame.messages.map((message, i) => ({
      key: `${at}-${i}`,
      message,
      current: at === index,
      // A step's wait belongs to its last message: the reply that ends the waiting.
      costMs: i === frame.messages.length - 1 ? frame.costMs : 0,
    })),
  );

  // The newest message is the one that matters, so the log follows it.
  useEffect(() => {
    const el = region.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [index, frames]);

  return (
    <div
      ref={region}
      role="region"
      aria-label="Message log"
      tabIndex={0}
      className="max-h-60 overflow-y-auto"
    >
      <div
        className="bg-surface rule-b sticky top-0 z-10 grid pb-1"
        style={{ gridTemplateColumns: `repeat(${parties.length}, minmax(0, 1fr))` }}
      >
        {parties.map((party) => (
          <p key={party} className="t-label text-center">
            {PARTY_LABEL[party]}
          </p>
        ))}
      </div>
      <div className="relative">
        {parties.map((party) => (
          <div
            key={party}
            aria-hidden
            className="border-border absolute inset-y-0 border-l"
            style={{ left: `${centre(party)}%` }}
          />
        ))}
        {rows.length === 0 ? (
          <p className="text-muted relative py-2 text-center text-sm">
            <span className="bg-surface px-1">No messages yet.</span>
          </p>
        ) : (
          <ol className="relative flex flex-col py-1">
            {rows.map(({ key, message, current, costMs }) => {
              const from = centre(message.from);
              const to = centre(message.to);
              const left = Math.min(from, to);
              const right = Math.max(from, to);
              const local = message.from === message.to;
              // A label starts at the left end of its arrow while there is room to its right.
              const startsLeft = left <= 50;
              return (
                <li
                  key={key}
                  data-current={current || undefined}
                  className={cn(
                    'flex min-h-5 flex-col justify-center py-0.5',
                    current ? 'text-accent' : 'text-muted',
                  )}
                >
                  <p
                    className={cn('text-sm', !startsLeft && 'text-right')}
                    style={
                      startsLeft ? { paddingLeft: `${left}%` } : { paddingRight: `${100 - right}%` }
                    }
                  >
                    <span
                      className={cn(
                        'bg-surface px-0.5 font-mono',
                        current ? 'font-medium' : 'text-fg',
                      )}
                    >
                      <span className="sr-only">
                        {local
                          ? `${PARTY_LABEL[message.from]}: `
                          : `${PARTY_LABEL[message.from]} to ${PARTY_LABEL[message.to]}: `}
                      </span>
                      {message.label}
                      {costMs > 0 ? (
                        <span className="t-figure text-muted"> +{costMs} ms</span>
                      ) : null}
                    </span>
                  </p>
                  <svg aria-hidden className="block h-1 w-full overflow-visible" fill="none">
                    {local ? (
                      <svg x={`${from}%`} y="0" overflow="visible">
                        <rect x="-3" y="1" width="6" height="6" fill="currentColor" />
                      </svg>
                    ) : (
                      <>
                        <line
                          x1={`${from}%`}
                          x2={`${to}%`}
                          y1="4"
                          y2="4"
                          stroke="currentColor"
                          strokeWidth="1"
                        />
                        <svg x={`${to}%`} y="4" overflow="visible">
                          <path
                            d={to > from ? 'M-6 -3 L0 0 L-6 3' : 'M6 -3 L0 0 L6 3'}
                            stroke="currentColor"
                            strokeWidth="1"
                          />
                        </svg>
                      </>
                    )}
                  </svg>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
