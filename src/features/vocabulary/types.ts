import type { DrillWord } from '@/core/vocabulary';

/** A word as the dictionary lists it: enough to search, filter and show one line. */
export interface IndexWord {
  id: string;
  term: string;
  aka: string[];
  short: string;
  area: string;
  level: number;
}

export interface AreaInfo {
  id: string;
  title: string;
  words: number;
}

export const LEVEL_LABEL: Record<number, string> = {
  1: 'Everyday',
  2: 'Working',
  3: 'Deep cut',
};

/** The drill rules read a word's shape, not its text. */
export function drillShape(word: {
  id: string;
  area: string;
  level: number;
  exampleHtml?: string;
  twin?: string;
  related: readonly string[];
}): DrillWord {
  return {
    id: word.id,
    area: word.area,
    level: word.level,
    hasExample: word.exampleHtml !== undefined,
    ...(word.twin === undefined ? {} : { twin: word.twin }),
    related: word.related,
  };
}
