import { describe, expect, it } from 'vitest';
import {
  assistantSystemPrompt,
  PLAN_OFFER,
  PLANNER_RULES,
  plannerPrompt,
  type AssistantContext,
} from '@/core/ports/assistant';

const base: AssistantContext = {
  taskTitle: 'Home',
  statement: '',
  language: '',
  code: '',
  output: '',
};

describe('assistant system prompts', () => {
  it('tutors the lesson on screen in tutor mode', () => {
    const prompt = assistantSystemPrompt({
      ...base,
      mode: 'tutor',
      taskTitle: 'Counting with a Map',
      statement: 'A Map removes the inner loop.',
    });
    expect(prompt).toContain('Lesson: Counting with a Map');
    expect(prompt).toContain('A Map removes the inner loop.');
  });

  it('guides around the app in guide mode, naming the page and what it offers', () => {
    const prompt = assistantSystemPrompt({
      ...base,
      mode: 'guide',
      taskTitle: 'Home',
      statement: 'Pick a goal and answer two questions.',
    });
    expect(prompt).toContain('Page: Home');
    expect(prompt).toContain('Pick a goal and answer two questions.');
    expect(prompt).toMatch(/where to start|which option/i);
    expect(prompt).not.toContain('Lesson:');
  });

  it('carries the app guide in guide mode and asks for direct, linked directions', () => {
    const prompt = assistantSystemPrompt({
      ...base,
      mode: 'guide',
      taskTitle: 'Settings',
      app: 'News /signal: the fourth tab on a phone.',
    });
    expect(prompt).toContain('News /signal: the fourth tab on a phone.');
    expect(prompt).toMatch(/on a phone/i);
    expect(prompt).toMatch(/\[News\]\(\/signal\)/);
    expect(prompt).toMatch(/never say you cannot see/i);
  });

  it('carries the app guide in tutor mode too, for questions about the app', () => {
    const prompt = assistantSystemPrompt({
      ...base,
      mode: 'tutor',
      taskTitle: 'Counting with a Map',
      app: 'Practice /practise: topics and a mixed session.',
    });
    expect(prompt).toContain('Practice /practise: topics and a mixed session.');
    expect(prompt).toContain('Lesson: Counting with a Map');
  });

  it('leaves the app guide out of the assessment', () => {
    const prompt = assistantSystemPrompt({ ...base, app: 'News /signal' });
    expect(prompt).not.toContain('News /signal');
  });

  it('carries the rules of the roles its entry picks (docs/SCOUT-ROLES.md)', () => {
    const lesson = assistantSystemPrompt({ ...base, mode: 'tutor', taskTitle: 'Closures' });
    expect(lesson).toMatch(/one-sentence answer/i);
    const stuck = assistantSystemPrompt({ ...base, mode: 'tutor', entry: 'stuck' });
    expect(stuck).toMatch(/one-sentence answer/i);
  });

  it('gives the assessment no study role, whatever entry the tab sends', () => {
    const prompt = assistantSystemPrompt({ ...base, entry: 'lesson' });
    expect(prompt).not.toMatch(/one-sentence answer/i);
  });

  it('keeps the assessment prompt as the default', () => {
    expect(assistantSystemPrompt(base)).toContain('online coding assessment');
  });

  it('plans a path with the blocks, the course and the learner, in two parts', () => {
    const context: AssistantContext = {
      ...base,
      mode: 'planner',
      planner: 'Today is 2026-10-06. Done: 12 lessons.',
      app: 'Learn /paths',
    };
    const { stable, learner } = plannerPrompt(context, '# The course');
    expect(stable).toContain(PLANNER_RULES);
    expect(stable).toContain('# The course');
    expect(stable).not.toContain('2026-10-06');
    expect(learner).toContain('Today is 2026-10-06.');
    expect(learner).toContain('Learn /paths');
    expect(PLANNER_RULES).toContain('```scout-ask');
    expect(PLANNER_RULES).toContain('Never assume a job or a role.');
    expect(assistantSystemPrompt(context, '# The course')).toBe(`${stable}\n\n${learner}`);
  });

  it('will not plan without the course', () => {
    const { stable, learner } = plannerPrompt({ ...base, mode: 'planner' });
    expect(stable).toContain('Do not draft a path without it.');
    expect(learner).toContain('(nothing known yet)');
  });

  it('offers the planner as a button in guide and tutor modes, never inside it or a test', () => {
    const guide = assistantSystemPrompt({ ...base, mode: 'guide' });
    const tutor = assistantSystemPrompt({ ...base, mode: 'tutor', app: 'Learn /paths' });
    expect(guide).toContain(PLAN_OFFER);
    expect(tutor).toContain(PLAN_OFFER);
    expect(PLAN_OFFER).toContain('```scout-plan');
    expect(assistantSystemPrompt({ ...base, mode: 'planner' }, '# The course')).not.toContain(
      '```scout-plan',
    );
    expect(assistantSystemPrompt(base)).not.toContain('scout-plan');
  });
});
