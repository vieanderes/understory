import { describe, expect, it } from 'vitest';
import { entryOf, ROLE_RULES, roleRules, scoutRoles, SCOUT_ENTRIES } from '@/core/scout';

describe('scoutRoles', () => {
  it('plans as the Advisor', () => {
    expect(scoutRoles('planner')).toEqual({ roles: ['advisor'], lead: 'advisor' });
  });

  it('reads the learner’s own work as the Editor only', () => {
    expect(scoutRoles('work')).toEqual({ roles: ['editor'], lead: 'editor' });
  });

  it('diagnoses as the Tutor after a wrong answer or a failing run', () => {
    expect(scoutRoles('stuck')).toEqual({ roles: ['tutor'], lead: 'tutor' });
  });

  it('leads with the Tutor in a lesson, with the Librarian and the Roommate beside it', () => {
    expect(scoutRoles('lesson')).toEqual({
      roles: ['tutor', 'librarian', 'roommate'],
      lead: 'tutor',
    });
  });

  it('keeps only the Librarian on other pages, with no lead', () => {
    expect(scoutRoles('page')).toEqual({ roles: ['librarian'] });
  });

  it('gives the assessment no role', () => {
    expect(scoutRoles('test')).toEqual({ roles: [] });
  });

  it('covers every entry', () => {
    for (const entry of SCOUT_ENTRIES) expect(scoutRoles(entry).roles).toBeDefined();
  });
});

describe('entryOf', () => {
  it('takes the entry the tab gave', () => {
    expect(entryOf({ mode: 'tutor', entry: 'stuck' })).toBe('stuck');
  });

  it('falls back to the mode', () => {
    expect(entryOf({ mode: 'tutor' })).toBe('lesson');
    expect(entryOf({ mode: 'guide' })).toBe('page');
    expect(entryOf({ mode: 'planner' })).toBe('planner');
    expect(entryOf({})).toBe('test');
  });

  it('never lets an entry give the assessment a study role', () => {
    expect(entryOf({ mode: 'test', entry: 'lesson' })).toBe('test');
    expect(entryOf({ entry: 'work' })).toBe('test');
  });
});

describe('roleRules', () => {
  it('carries the Tutor’s rules in a lesson', () => {
    const rules = roleRules('lesson');
    expect(rules).toMatch(/diagnose before you explain/i);
    expect(rules).toMatch(/hint/i);
  });

  it('carries the Editor’s rules and its block for the learner’s own work', () => {
    const rules = roleRules('work');
    expect(rules).toContain('```scout-review');
    expect(rules).toMatch(/never rewrite/i);
  });

  it('offers the Tutor, the Librarian and the Roommate in a lesson, leading with the Tutor', () => {
    const rules = roleRules('lesson');
    expect(rules).toContain('- Tutor: when');
    expect(rules).toContain('- Librarian: when');
    expect(rules).toContain('- Roommate: when the learner asks why something matters');
    expect(rules).toContain('When unsure, be the Tutor.');
    expect(rules).toMatch(/where the analogy breaks/);
  });

  it('is empty where no role has rules yet', () => {
    expect(roleRules('test')).toBe('');
  });

  it('names each role and when to take it when several have rules, leading with the lead', () => {
    const rules = roleRules('lesson', {
      ...ROLE_RULES,
      roommate: { when: 'they ask how an outsider sees it', rules: ['Name the field.'] },
    });
    expect(rules).toContain('- Tutor: when');
    expect(rules).toContain('- Roommate: when they ask how an outsider sees it.');
    expect(rules).toContain('When unsure, be the Tutor.');
    expect(rules).toContain('As the Roommate:\nName the field.');
  });

  it('names no lead when the entry has none', () => {
    const rules = roleRules('page', {
      librarian: { when: 'they ask what to read', rules: ['Recommend at most three.'] },
    });
    expect(rules).toBe('Recommend at most three.');
  });
});
