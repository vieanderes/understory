import type { ComponentType } from 'react';

/*
 * A lab is a small deterministic simulator with a view. The engine is pure TypeScript in
 * src/core/labs/<id>/ (state in, state out, seeded randomness, unit tested); the view in
 * src/features/labs/<id>/ draws the engine's state and sends it commands. Because the
 * engine is pure, the same lab can later drive an incident (a preset failure to diagnose)
 * and can be ported to Swift against shared fixtures.
 */
export interface LabProps {
  /** Starting state from the lesson's `preset`. Each lab validates its own shape. */
  preset?: Record<string, unknown>;
  /** True inside a lesson step, where the lesson provides the heading and the intro. */
  embedded?: boolean;
}

export interface LabMeta {
  id: string;
  title: string;
  /** The question the lab lets you answer, in one sentence. */
  question: string;
  moduleId: string;
  load: () => Promise<{ default: ComponentType<LabProps> }>;
}
