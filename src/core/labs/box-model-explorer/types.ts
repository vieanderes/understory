/*
 * The box model explorer predicts what the browser will measure. The browser lays out a
 * real element; this engine holds the arithmetic from the specifications, and the view
 * puts the two side by side.
 */

export type BoxSizing = 'content-box' | 'border-box';
export type PaddingUnit = 'px' | 'percent';

export interface Size {
  width: number;
  height: number;
}

/** One block box with the same padding, border and margin on all four sides. */
export interface BoxInput {
  width: number;
  height: number;
  /** In `paddingUnit`: pixels, or a percentage of the containing block's width. */
  padding: number;
  paddingUnit: PaddingUnit;
  border: number;
  margin: number;
  boxSizing: BoxSizing;
  /** Inline size of the containing block. Percentage padding resolves against it. */
  containerWidth: number;
}

export interface BoxResult {
  /** Used padding in px, the same on all four sides. */
  padding: number;
  content: Size;
  paddingBox: Size;
  /** What `getBoundingClientRect()` reports. */
  borderBox: Size;
  marginBox: Size;
}

/**
 * How the parent of the two stacked blocks is built. `plain` is a block with no padding
 * and no border. `padding` and `border` put something between the parent's edge and its
 * first child. The last three make the parent establish a new formatting context.
 */
export type ParentKind = 'plain' | 'padding' | 'border' | 'flow-root' | 'flex' | 'grid';

/** Two blocks, A above B, inside one parent whose own margins are zero. */
export interface StackInput {
  marginTopA: number;
  marginBottomA: number;
  marginTopB: number;
  parent: ParentKind;
  /** Top padding of the parent when `parent` is `padding`. */
  parentPadding: number;
  /** Top border of the parent when `parent` is `border`. */
  parentBorder: number;
}

export interface StackResult {
  /** True when A's bottom margin and B's top margin adjoin and collapse. */
  siblingsCollapse: boolean;
  /** Distance from A's bottom border edge to B's top border edge. */
  gap: number;
  /** True when A's top margin collapses with the parent's and ends up outside it. */
  parentCollapses: boolean;
  /** Distance from the parent's top border edge to A's top border edge. */
  childOffset: number;
  /** Distance from the top of the stage to the parent's top border edge. */
  parentOffset: number;
}

export type ScenarioId =
  'profile-card' | 'percent-padding' | 'stacked-paragraphs' | 'flex-paragraphs';

interface ScenarioBase {
  id: ScenarioId;
  /** Short name for the scenario switch. */
  label: string;
  /** Asked before the first step, because predicting first is what makes the lab teach. */
  prompt: string;
}

export type Scenario =
  | (ScenarioBase & { kind: 'box'; box: BoxInput })
  | (ScenarioBase & { kind: 'stack'; stack: StackInput });

export type Focus =
  'setup' | 'content' | 'padding' | 'border' | 'margin' | 'siblings' | 'parent' | 'measured';

export interface ArithmeticLine {
  label: string;
  /** The sum as written on paper, for example "200 + 2 × 16". */
  expression: string;
  result: string;
}

/** One step of the explanation. The view is a pure function of one frame. */
export interface Frame {
  /** The layer of the diagram this step is about. It carries the accent. */
  focus: Focus;
  /** One sentence for the status line: what this step established. */
  status: string;
  /** Every line worked out so far, this step's last. */
  arithmetic: readonly ArithmeticLine[];
  /** True on the last frame only: the view may now show what the browser measured. */
  revealed: boolean;
}
