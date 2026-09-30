import { z } from 'zod';

/*
 * Lecture notes: the reading layer on top of a lesson. A lesson teaches one idea per screen
 * and asks as it goes; its notes are what a learner reads straight through, the night before
 * an interview or instead of the steps. They add what the steps leave out on purpose: the
 * big picture, the sentences to know by heart, depth, mistakes and interview answers.
 *
 * Optional per lesson. Without notes a lecture is built from the lesson alone
 * (src/core/lecture), so every lesson has a lecture from the day it is published.
 * Authoring rules: docs/LECTURE-BRIEF.md.
 */

const text = (hint: string) => z.string().trim().min(1, hint).describe(hint);

/** Markdown subset, as in lessons: paragraphs, emphasis, inline code, links, lists, fences. */
const markdown = (hint: string) => text(hint);

export const notesSectionSchema = z.strictObject({
  title: text('A heading that names the idea, as a noun phrase or a question.'),
  body: markdown('The explanation, with examples in fenced code where code helps.'),
});

export const interviewAnswerSchema = z.strictObject({
  question: text('A question an interviewer asks, in their words.'),
  answer: markdown('The answer to give: point first, then the reasoning, then a trade-off.'),
});

export const termSchema = z.strictObject({
  term: text('The term, as people write it.'),
  say: text('What people loosely say it is: the common shorthand or misconception.'),
  means: markdown('What it actually means, precisely, in one or two sentences.'),
});

/** `notes.yaml` beside `lesson.yaml`. */
export const lessonNotesSchema = z.strictObject({
  summary: markdown('The big picture: what it is, why it exists and when you reach for it.'),
  remember: z
    .array(markdown('One sentence to know by heart. It stands on its own.'))
    .min(3)
    .max(8)
    .describe('The sentences to know by heart, most important first.'),
  sections: z
    .array(notesSectionSchema)
    .min(1)
    .max(8)
    .describe('Depth the steps leave out, in reading order.'),
  pitfalls: z
    .array(markdown('A mistake people make, why it happens and the fix.'))
    .max(8)
    .optional(),
  interview: z
    .array(interviewAnswerSchema)
    .max(8)
    .optional()
    .describe('Questions an interviewer asks about this lesson, with the answer to give.'),
  terms: z
    .array(termSchema)
    .max(8)
    .optional()
    .describe('Terms the lesson uses: what people say, and what it actually means.'),
});

/** `content/capstones/<partId>.yaml`: the worked reference solution of a part's project. */
export const capstoneSolutionSchema = z.strictObject({
  summary: markdown('The shape of the solution in one paragraph: what gets built and how.'),
  remember: z
    .array(markdown('A decision or principle the solution rests on.'))
    .min(3)
    .max(10),
  sections: z
    .array(notesSectionSchema)
    .min(3)
    .max(16)
    .describe('The solution, step by step, with the code that matters.'),
  checklist: z
    .array(text('One thing a finished project has, checkable by looking.'))
    .min(3)
    .max(20)
    .describe('What a reviewer checks before calling the project done.'),
});

export type LessonNotes = z.infer<typeof lessonNotesSchema>;
export type NotesSection = z.infer<typeof notesSectionSchema>;
export type InterviewAnswer = z.infer<typeof interviewAnswerSchema>;
export type Term = z.infer<typeof termSchema>;
export type CapstoneSolution = z.infer<typeof capstoneSolutionSchema>;

export const NOTES_FILE = 'notes.yaml';
export const CAPSTONES_DIR = 'content/capstones';

/**
 * `content/tracks/<id>.yaml`: a fast track, a condensed reading plan across the course for one
 * goal, such as an interview loop or a language refresher. Each lesson in it shows as its key
 * idea, its remember list, its interview answers and its top mistakes (plus its depth sections
 * on a day marked `depth`), with a link to the full lecture. Guides close the track.
 */
export const fastTrackSchema = z.strictObject({
  title: text('The plan, as a noun phrase.'),
  name: text('The path in two or three words, for navigation and cards.').optional(),
  order: z.number().int().min(1).optional().describe('Where the path sits among the paths.'),
  promise: text('What you can do at the end, in one sentence.').optional(),
  outcomes: z
    .array(text('One thing you can do at the end, starting with a verb.'))
    .max(5)
    .default([])
    .describe('What the path leaves you able to do.'),
  decision: text('The one question that tells someone this path is for them.').optional(),
  readyWhen: z
    .array(text('A check you can run on yourself, starting with "You can".'))
    .max(6)
    .default([])
    .describe('How you know you are ready, checkable without the app.'),
  proof: z
    .strictObject({
      title: text('What you build or do to prove the path, as a noun phrase.'),
      evidence: z
        .array(text('One thing the proof contains, checkable by looking.'))
        .min(2)
        .max(6),
    })
    .optional()
    .describe('The piece of work that shows you finished the path.'),
  coverage: z
    .strictObject({
      covered: z.array(text('A topic the path covers in full.')).default([]),
      partial: z.array(text('A topic it only touches.')).default([]),
      outside: z.array(text('A topic people expect that it leaves out.')).default([]),
    })
    .optional()
    .describe('An honest boundary: what the path covers, touches and leaves out.'),
  summary: text('Who it is for and what it covers, in one or two sentences.'),
  method: z
    .array(text('One step of the routine for each lesson.'))
    .min(1)
    .max(6)
    .describe('How to work through one lesson.'),
  shapes: z
    .array(
      z.strictObject({
        label: text('The kind of round or question.'),
        text: text('How a strong answer is shaped, in one or two sentences.'),
      }),
    )
    .max(10)
    .default([]),
  days: z
    .array(
      z.strictObject({
        title: text('The stage, named for what it covers, for example "The method".'),
        why: text('Why this block matters, in one or two sentences.'),
        artifact: text('What you leave this stage with, as a noun phrase.').optional(),
        must: z.array(z.string()).min(1).describe('Lesson ids to read first.'),
        should: z.array(z.string()).default([]).describe('Lesson ids to read if time allows.'),
        capstone: z
          .string()
          .optional()
          .describe('A part id whose worked capstone solution closes the block.'),
        depth: z
          .boolean()
          .optional()
          .describe('Also print each lesson\'s depth sections, with their code.'),
      }),
    )
    .min(1),
  practice: z
    .array(
      z.strictObject({
        label: text('What to do, in a few words: "Sit the demo test".'),
        href: z.string().regex(/^\//, 'A path inside the app, starting with /'),
        text: text('Why and when, in one sentence.'),
      }),
    )
    .max(6)
    .default([])
    .describe('Practice outside the lessons, such as timed tests in the coding simulator.'),
  guides: z
    .array(z.string())
    .default([])
    .describe('Guide ids from content/guides, printed after the last day.'),
});

export type FastTrack = z.infer<typeof fastTrackSchema>;

export const TRACKS_DIR = 'content/tracks';

/**
 * `content/guides/<id>.yaml`: a standalone reading, such as side-by-side comparisons or a
 * syntax refresher, that a fast track closes with. Written to docs/LECTURE-BRIEF.md.
 */
export const guideSchema = z.strictObject({
  title: text('The guide, as a noun phrase.'),
  summary: markdown('What the guide gives the reader, in one short paragraph.'),
  sections: z
    .array(notesSectionSchema)
    .min(1)
    .max(60)
    .describe('The guide in reading order. Each section is one topic or one comparison.'),
});

export type Guide = z.infer<typeof guideSchema>;

export const GUIDES_DIR = 'content/guides';
