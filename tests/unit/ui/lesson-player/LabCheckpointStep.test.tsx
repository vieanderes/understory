import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { InlineMd } from '@/features/lesson-player/parts/InlineMd';
import { LabCheckpointStep } from '@/features/lesson-player/steps/LabCheckpointStep';
import { labStep, renderStep } from './fixtures';

describe('LabCheckpointStep', () => {
  it('mounts the lab host and asks the checkpoint question', () => {
    renderStep(LabCheckpointStep, labStep);
    expect(screen.getByText('Step through the loop.')).toBeInTheDocument();
    // The fixture names a lab this client does not have, so the host says so in words.
    expect(screen.getByText(/This lab is not part of this version/)).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('reports the lab answer, which the real grader accepts', async () => {
    const user = userEvent.setup();
    const view = renderStep(LabCheckpointStep, labStep);
    expect(view.submission()).toBeUndefined();
    await user.click(screen.getByRole('radio', { name: /Microtasks/ }));
    expect(view.submission()).toEqual({ type: 'lab', choiceIndex: 0 });
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(view.grade()?.correct).toBe(true);
    expect(screen.getByRole('status')).toHaveTextContent('Microtasks drain before the next task.');
  });

  it('hides which choice is right while a second try is on offer', async () => {
    const user = userEvent.setup();
    renderStep(LabCheckpointStep, labStep, { reveal: false });
    await user.click(screen.getByRole('radio', { name: /Tasks/ }));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByText('Your pick')).toBeInTheDocument();
    expect(screen.queryByText('Right')).not.toBeInTheDocument();
  });

  it('mounts a lab widget passed as a render prop', () => {
    render(
      <LabCheckpointStep
        step={labStep}
        phase="answering"
        reveal={false}
        seed={1}
        onSubmissionChange={() => {}}
        requestCheck={() => {}}
      >
        {({ lab }) => <p>Widget for {lab}</p>}
      </LabCheckpointStep>,
    );
    expect(screen.getByText('Widget for event-loop')).toBeInTheDocument();
    expect(screen.queryByText('Lab loads here')).not.toBeInTheDocument();
  });
});

describe('InlineMd', () => {
  it('turns backtick pairs into code and leaves a stray backtick alone', () => {
    const { container } = render(<InlineMd text="Use `Number` not `parse" />);
    expect(container.querySelectorAll('code')).toHaveLength(1);
    expect(container).toHaveTextContent('Use Number not `parse');
  });
});
