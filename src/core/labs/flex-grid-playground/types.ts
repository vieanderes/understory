/*
 * The flex and grid playground predicts what the browser will measure. The browser lays
 * out a real flex or grid container; this engine holds the arithmetic of the two layout
 * algorithms, and the view puts prediction and measurement side by side.
 *
 * The engine never sizes content. Where the real algorithm asks for a content size (the
 * automatic minimum of a flex item, the content of an `auto` track), the caller passes it
 * in as a number. The view measures that number in the browser.
 */

export interface FlexItem {
  /** Name used in the explanation, for example "Product name". */
  label: string;
  /** What the item shows on the stage. */
  text: string;
  grow: number;
  shrink: number;
  /** `flex-basis` in px. */
  basis: number;
  /** `min-width` in px, or `auto`: the content-based minimum of CSS Flexbox 1 section 4.5. */
  minWidth: number | 'auto';
  /** The item's min-content width in px. Read only when `minWidth` is `auto`. */
  minContent?: number;
  /**
   * Horizontal padding plus border in px, under `box-sizing: border-box`. `flex-basis`
   * and `min-width` include it; the content box inside never goes below zero. Absent is 0.
   */
  edges?: number;
}

export type FlexMode = 'grow' | 'shrink';

/** One pass of the loop in section 9.7, step 4. */
export interface FlexRound {
  /** Container minus gaps, minus frozen items' sizes, minus unfrozen items' base sizes. */
  freeSpace: number;
  /** Sum of the grow factors, or of shrink factor × base size, over the unfrozen items. */
  factorSum: number;
  /** Signed change per item in this round. Zero for a frozen item. */
  shares: readonly number[];
  /** Size per item after the shares, before clamping. */
  tentative: readonly number[];
  /** Items whose tentative size fell below their minimum. They freeze at the minimum. */
  clamped: readonly number[];
}

export interface FlexResult {
  mode: FlexMode;
  /** Container width minus the gaps. */
  available: number;
  /** Used minimum per item: `min-width`, or the min-content width when it is `auto`. */
  mins: readonly number[];
  /** Outer flex base size: `flex-basis`, but never narrower than the item's own edges. */
  bases: readonly number[];
  /** Inner flex base size, the content box. Shrinking is weighed by this (section 9.7, 4c). */
  innerBases: readonly number[];
  /** Base size clamped by the minimum: the hypothetical main size. */
  hypothetical: readonly number[];
  sumHypothetical: number;
  /** Items frozen before the loop: factor zero, or lifted by their minimum while shrinking. */
  frozenAtStart: readonly number[];
  initialFreeSpace: number;
  rounds: readonly FlexRound[];
  /** Final main sizes in px. */
  sizes: readonly number[];
}

export type Track =
  | { kind: 'px'; size: number }
  | { kind: 'fr'; fr: number }
  /** `content` is the max-content width of what sits in the track. The caller measures it. */
  | { kind: 'auto'; content?: number }
  | { kind: 'minmax'; min: number; max: number; maxUnit: 'px' | 'fr' }
  | {
      kind: 'repeat';
      mode: 'auto-fill' | 'auto-fit';
      min: number;
      max: number;
      maxUnit: 'px' | 'fr';
    };

export interface ResolvedTrack {
  size: number;
  /** Index into the declared track list. Every repetition points at the `repeat` entry. */
  source: number;
  /** An empty `auto-fit` repetition: zero wide, and its gap is gone too. */
  collapsed: boolean;
}

export interface TrackResult {
  tracks: readonly ResolvedTrack[];
  /** How many times the `repeat()` entry was repeated, when there is one. */
  repetitions: number | null;
  /** The size one repetition is counted at: the definite max, else the min. */
  repeatUnit: number | null;
  /** Gaps between tracks that are not collapsed. */
  gapTotal: number;
  /** Sum of px, auto and minmax minimum sizes: what is resolved before any sharing. */
  fixedTotal: number;
  /** Extra given to `minmax(px, px)` tracks, up to their maximum, before `fr` sees anything. */
  maximised: number;
  /** What the flexible tracks share. Null when there are none. */
  leftover: number | null;
  /** The leftover minus the flexible tracks that kept their larger minimum instead. */
  frPool: number | null;
  /** Sum of the flex factors that share the pool. A sum below 1 counts as 1. */
  flexSum: number | null;
  /** The size of 1fr. Null when there are no flexible tracks. */
  frSize: number | null;
  /** Free space that `auto` tracks split equally at the end (justify-content: normal). */
  stretched: number;
}

export type ScenarioId = 'grow-row' | 'shrink-row' | 'long-text' | 'fr-columns' | 'few-items';

interface ScenarioBase {
  id: ScenarioId;
  label: string;
  /** Asked before the first step, because predicting first is what makes the lab teach. */
  prompt: string;
  containerWidth: number;
  gap: number;
}

export type FlexScenario = ScenarioBase & { kind: 'flex'; items: readonly FlexItem[] };
export type GridScenario = ScenarioBase & {
  kind: 'grid';
  tracks: readonly Track[];
  /** Grid items, placed one per column in order. */
  itemCount: number;
};
export type Scenario = FlexScenario | GridScenario;

export type Focus =
  | 'setup'
  | 'base'
  | 'free-space'
  | 'shares'
  | 'clamp'
  | 'repeat'
  | 'fixed'
  | 'maximise'
  | 'fr'
  | 'stretch'
  | 'measured';

export interface ArithmeticLine {
  label: string;
  expression: string;
  result: string;
}

/** One step of the explanation. The view is a pure function of one frame. */
export interface Frame {
  focus: Focus;
  /** One sentence for the status line: what this step established. */
  status: string;
  /** Every line worked out so far, this step's last. */
  arithmetic: readonly ArithmeticLine[];
  /** Items or tracks this step is about. They carry the accent on the stage. */
  active: readonly number[];
  /** True on the last frame only: the view may now show what the browser measured. */
  revealed: boolean;
}
