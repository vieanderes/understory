import { describe, expect, it } from 'vitest';
import { assistantSystemPrompt, type AssistantContext } from '@/core/ports/assistant';

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

  it('keeps the assessment prompt as the default', () => {
    expect(assistantSystemPrompt(base)).toContain('online coding assessment');
  });
});
