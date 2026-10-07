import type { CompiledPlacementArea, PlacementPathRule } from '@/core/content/placement-schema';

/** A lesson as placement needs it: where it is, and what it teaches. */
export interface PlacementLesson {
  id: string;
  title: string;
  href: string;
  moduleId: string;
  concepts: string[];
}

/** A written path as placement needs it: its stages as lesson ids. */
export interface PlacementPath {
  id: string;
  name: string;
  stages: { title: string; why: string; lessonIds: string[] }[];
}

export interface PlacementData {
  areas: CompiledPlacementArea[];
  rules: PlacementPathRule[];
  paths: PlacementPath[];
  /** Every lesson, in course order. */
  lessons: PlacementLesson[];
  moduleTitles: Record<string, string>;
}

/** How each level reads on screen, 0 to 3. */
export const LEVEL_NAMES = ['New', 'Foundations', 'Working', 'Advanced'] as const;

export const levelName = (level: number): string => LEVEL_NAMES[level] ?? LEVEL_NAMES[0];
