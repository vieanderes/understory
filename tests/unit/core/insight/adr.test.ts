import { describe, expect, it } from 'vitest';
import {
  adrEntry,
  adrFileName,
  adrLog,
  adrLogMarkdown,
  adrMarkdown,
  milestoneMarkdown,
  type AdrEntry,
  type AdrPart,
} from '@/core/insight';
import {
  makeEvent,
  reduce,
  type EventType,
  type PayloadOf,
  type StoryEvent,
} from '@/core/progress';

let seq = 0;
function event<T extends EventType>(at: string, type: T, payload: PayloadOf<T>): StoryEvent {
  seq += 1;
  return makeEvent(
    {
      clock: { now: () => new Date(at) },
      ids: { next: () => `01900000-0000-7000-8000-${String(seq).padStart(12, '0')}` },
      deviceId: 'device',
      nextSeq: () => seq,
      contentRev: 'rev',
      localDate: at.slice(0, 10),
    },
    type,
    payload,
  );
}

const PARTS: AdrPart[] = [
  { id: 'firstcode', title: 'First code', capstone: { title: 'A reading list page' } },
  { id: 'jsts', title: 'JavaScript and TypeScript', capstone: { title: 'A command-line tool' } },
  { id: 'servers', title: 'Servers and data', capstone: { title: 'A booking API' } },
];

describe('adrLog', () => {
  it('lists the current record of each part in part order, numbered by the part', () => {
    const state = reduce([
      event('2026-09-20T10:00:00Z', 'capstone_adr_written', {
        partId: 'servers',
        title: 'Old title',
        decision: 'Old decision.',
      }),
      event('2026-09-18T10:00:00Z', 'capstone_adr_written', {
        partId: 'firstcode',
        title: 'Plain HTML first',
        decision: 'No framework.',
      }),
      event('2026-09-21T10:00:00Z', 'capstone_adr_written', {
        partId: 'servers',
        title: 'Keep sessions in the database',
        decision: 'A sessions table.',
      }),
      // A part no longer in the course is left out rather than guessed at.
      event('2026-09-21T11:00:00Z', 'capstone_adr_written', {
        partId: 'retired',
        title: 'Gone',
        decision: 'Gone.',
      }),
    ]);
    const log = adrLog(state, PARTS);
    expect(log.map((e) => [e.number, e.partId, e.adr.title])).toEqual([
      [1, 'firstcode', 'Plain HTML first'],
      [3, 'servers', 'Keep sessions in the database'],
    ]);
    expect(log[1]).toMatchObject({
      partTitle: 'Servers and data',
      capstoneTitle: 'A booking API',
      capstoneBuilt: false,
    });
  });

  it('says whether the capstone is marked built', () => {
    const state = reduce([
      event('2026-09-18T10:00:00Z', 'capstone_completed', { moduleId: 'firstcode' }),
      event('2026-09-18T10:05:00Z', 'capstone_adr_written', {
        partId: 'firstcode',
        title: 'Plain HTML first',
        decision: 'No framework.',
      }),
    ]);
    expect(adrLog(state, PARTS)[0]?.capstoneBuilt).toBe(true);
  });

  it('is empty when nothing is written', () => {
    expect(adrLog(reduce([]), PARTS)).toEqual([]);
  });
});

describe('adrEntry', () => {
  it('gives one part its record under the number it is given', () => {
    const state = reduce([
      event('2026-09-18T10:00:00Z', 'capstone_adr_written', {
        partId: 'jsts',
        title: 'Strict mode on',
        decision: 'Turn on strict.',
      }),
    ]);
    expect(adrEntry(state, PARTS[1] as AdrPart, 2)?.number).toBe(2);
    expect(adrEntry(state, PARTS[0] as AdrPart, 1)).toBeUndefined();
  });
});

const full: AdrEntry = {
  number: 3,
  partId: 'servers',
  partTitle: 'Servers and data',
  capstoneTitle: 'A booking API',
  capstoneBuilt: true,
  adr: {
    partId: 'servers',
    title: 'Keep sessions\nin the   database',
    context: 'Two processes serve requests.\n\nBoth must see a session.',
    decision: 'Sessions live in a table.',
    alternatives: '- A signed cookie.\n- A map in memory.',
    consequences: 'One query per request.\r\n',
    firstWrittenOn: '2026-09-19',
    updatedOn: '2026-09-21',
    revisions: 2,
  },
};

const brief: AdrEntry = {
  number: 1,
  partId: 'firstcode',
  partTitle: 'First code',
  capstoneTitle: 'A reading list page',
  capstoneBuilt: false,
  adr: {
    partId: 'firstcode',
    title: 'Plain HTML first',
    decision: 'No framework.',
    firstWrittenOn: '2026-09-18',
    updatedOn: '2026-09-18',
    revisions: 1,
  },
};

describe('adrMarkdown', () => {
  it('writes the standard sections, with the title on one line', () => {
    expect(adrMarkdown(full)).toBe(
      [
        '# ADR 0003: Keep sessions in the database',
        '',
        '- Status: Accepted',
        '- Date: 2026-09-21',
        '- Capstone: A booking API (Part 3, Servers and data)',
        '',
        '## Context',
        '',
        'Two processes serve requests.',
        '',
        'Both must see a session.',
        '',
        '## Decision',
        '',
        'Sessions live in a table.',
        '',
        '## Alternatives considered',
        '',
        '- A signed cookie.',
        '- A map in memory.',
        '',
        '## Consequences',
        '',
        'One query per request.',
        '',
      ].join('\n'),
    );
  });

  it('leaves out the sections that were not written', () => {
    const markdown = adrMarkdown(brief);
    expect(markdown).toContain('## Decision\n\nNo framework.\n');
    expect(markdown).not.toContain('## Context');
    expect(markdown).not.toContain('## Alternatives considered');
    expect(markdown).not.toContain('## Consequences');
  });

  it('can sit one level down inside another file', () => {
    const markdown = adrMarkdown(brief, 2);
    expect(markdown.startsWith('## ADR 0001: Plain HTML first\n')).toBe(true);
    expect(markdown).toContain('\n### Decision\n');
  });
});

describe('adrFileName', () => {
  it('numbers the file as adr-tools does', () => {
    expect(adrFileName(full)).toBe('adr-0003-servers.md');
  });
});

describe('adrLogMarkdown', () => {
  it('puts every record in one file, in order', () => {
    const markdown = adrLogMarkdown([brief, full], '2026-09-23');
    expect(markdown.startsWith('# Architecture decision records\n\n')).toBe(true);
    expect(markdown).toContain('2 decisions, one per capstone. Exported on 2026-09-23.');
    expect(markdown.indexOf('## ADR 0001')).toBeLessThan(markdown.indexOf('## ADR 0003'));
    expect(markdown).toContain('\n### Consequences\n');
    expect(markdown.endsWith('\n')).toBe(true);
    expect(markdown).not.toContain('\n\n\n');
  });

  it('says one decision in the singular, and none when empty', () => {
    expect(adrLogMarkdown([brief], '2026-09-23')).toContain('1 decision, one per capstone.');
    expect(adrLogMarkdown([], '2026-09-23')).toContain('No decision records yet.');
  });
});

describe('milestoneMarkdown with a decision record', () => {
  it('adds the part’s record under the capstone', () => {
    const markdown = milestoneMarkdown({
      title: 'Servers and data',
      summary: 'You can build an API.',
      date: '2026-09-23',
      canBuild: [],
      capstone: { title: 'A booking API', brief: 'Build it.' },
      concepts: [],
      notes: [],
      adr: full,
    });
    expect(markdown).toContain(
      'Build it.\n\n### ADR 0003: Keep sessions in the database\n\n- Status: Accepted',
    );
    expect(markdown).toContain('\n#### Decision\n\nSessions live in a table.\n');
    expect(markdown.indexOf('#### Consequences')).toBeLessThan(markdown.indexOf('## Concepts'));
  });
});
