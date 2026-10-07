import * as z from '@/core/zod';

/*
 * Scout's structured replies while it plans a path with the learner (docs/ONLINE-TEST.md,
 * section 6, "Planning a path"). Scout runs on the learner's own Claude over three providers,
 * and the MCP `reply` tool carries text only, so structure travels as fenced JSON blocks
 * inside the Markdown: one provider-neutral protocol instead of three.
 *
 * The model's output is untrusted: every block is validated here, a block that fails is
 * dropped and the prose around it still reads, and lesson ids are checked against the
 * course later (draft.ts), never trusted as given.
 */

export const ASK_FENCE = 'scout-ask';
export const PATH_FENCE = 'scout-path';
/** Away from the planner: Scout offers to plan a path together, as a button. */
export const PLAN_FENCE = 'scout-plan';
export const SCOUT_FENCES: readonly string[] = [ASK_FENCE, PATH_FENCE];

const line = (max: number) => z.string().trim().min(1).max(max);

export const askBlockSchema = z.object({
  question: line(160),
  options: z.array(line(60)).min(2).max(8),
  multi: z.boolean().default(false),
});
export type AskBlock = z.infer<typeof askBlockSchema>;

export const MAX_STAGES = 12;
export const MAX_LESSONS = 200;

export const pathBlockSchema = z.object({
  name: line(80),
  alternatives: z.array(line(80)).max(3).default([]),
  summary: z.string().trim().max(400).default(''),
  minutesPerWeek: z.int().min(15).max(3000).optional(),
  deadline: z.iso.date().optional(),
  stages: z
    .array(
      z.object({
        title: line(80),
        why: z.string().trim().max(240).default(''),
        lessons: z.array(z.string().max(80)).max(MAX_LESSONS),
      }),
    )
    .min(1)
    .max(MAX_STAGES),
});
export type PathBlock = z.infer<typeof pathBlockSchema>;

export const planOfferSchema = z.object({
  /** What the learner said they want, in one line, to start the planner with. */
  brief: z.string().trim().max(300).default(''),
});
export type PlanOffer = z.infer<typeof planOfferSchema>;

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

export function parseAskBlock(body: string): AskBlock | null {
  const parsed = askBlockSchema.safeParse(parseJson(body));
  return parsed.success ? parsed.data : null;
}

/** An empty block is a plain offer, without a brief. */
export function parsePlanOffer(body: string): PlanOffer | null {
  const parsed = planOfferSchema.safeParse(body.trim() ? parseJson(body) : {});
  return parsed.success ? parsed.data : null;
}

export function parsePathBlock(body: string): PathBlock | null {
  const parsed = pathBlockSchema.safeParse(parseJson(body));
  return parsed.success ? parsed.data : null;
}

const FENCE = /```(scout-ask|scout-path)[^\n]*\n([\s\S]*?)```/g;

export interface ScoutBlocks {
  ask?: AskBlock;
  path?: PathBlock;
}

/** The last valid block of each kind in a reply: the one the learner can act on. */
export function scoutBlocks(text: string): ScoutBlocks {
  const found: ScoutBlocks = {};
  for (const [, fence, body = ''] of text.matchAll(FENCE)) {
    if (fence === ASK_FENCE) {
      const ask = parseAskBlock(body);
      if (ask) found.ask = ask;
    } else {
      const path = parsePathBlock(body);
      if (path) found.path = path;
    }
  }
  return found;
}
