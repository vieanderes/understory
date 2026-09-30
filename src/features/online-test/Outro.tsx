'use client';

import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { saveSurvey, type Survey } from './attempt-store';
import { Mark } from './Mark';

interface OutroProps {
  attemptId: string;
  onDone: () => void;
  onAgain: () => void;
}

/**
 * After submit, as on the platform: "Your test has ended", then a one-minute survey or
 * Skip, then the results. Here the survey feeds the report, where it sits beside the score.
 */
export function Outro({ attemptId, onDone, onAgain }: OutroProps) {
  const [surveying, setSurveying] = useState(false);
  const [survey, setSurvey] = useState<Survey>({});
  const commentId = useId();

  return (
    <div className="bg-bg text-fg min-h-dvh">
      <header className="rule-b bg-surface">
        <div className="frame flex h-7 items-center gap-2">
          <Mark />
          <p className="font-medium">Online test</p>
        </div>
      </header>
      <main id="content" className="frame flex max-w-2xl flex-col gap-3 py-6">
        <h1 className="t-section">Your test has ended</h1>
        {surveying ? (
          <form
            className="bg-surface border-border rounded-panel flex flex-col gap-3 border p-3"
            onSubmit={(event) => {
              event.preventDefault();
              saveSurvey(attemptId, survey);
              onDone();
            }}
          >
            <Segmented
              label="How was the test overall?"
              value={survey.rating === undefined ? null : String(survey.rating)}
              onChange={(value) => setSurvey({ ...survey, rating: Number(value) })}
              options={['1', '2', '3', '4', '5'].map((v) => ({ value: v, label: v }))}
            />
            <Segmented
              label="How hard were the tasks for the time?"
              value={survey.difficulty ?? null}
              onChange={(difficulty) => setSurvey({ ...survey, difficulty })}
              options={[
                { value: 'easy', label: 'Easy' },
                { value: 'right', label: 'About right' },
                { value: 'hard', label: 'Hard' },
              ]}
            />
            <div className="flex flex-col gap-1">
              <label htmlFor={commentId} className="t-label">
                What would you do differently next time?
              </label>
              <textarea
                id={commentId}
                rows={3}
                value={survey.comment ?? ''}
                onChange={(event) => setSurvey({ ...survey, comment: event.target.value })}
                className="bg-surface border-border rounded-control border p-1"
              />
            </div>
            <div className="flex gap-1">
              <Button type="submit" variant="primary">
                Send and see results
              </Button>
              <Button variant="quiet" onClick={onDone}>
                Skip
              </Button>
            </div>
          </form>
        ) : (
          <>
            <p className="text-muted text-lg">
              Thank you. Your solutions have been evaluated. Take one minute to note how it went: it
              goes into your report.
            </p>
            <div className="flex flex-wrap gap-1">
              <Button variant="primary" onClick={() => setSurveying(true)}>
                Take the 1-minute survey
              </Button>
              <Button variant="secondary" onClick={onDone}>
                Skip
              </Button>
              <Button variant="quiet" onClick={onAgain}>
                Sit this test again
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
