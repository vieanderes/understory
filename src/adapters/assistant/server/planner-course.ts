/*
 * Scout's text of the course, for the planner prompt. It is built at build time and served
 * as a static file by /api/planner/course, so the assistant routes read it from their own
 * origin instead of the content files, which a serverless function does not carry.
 *
 * Kept per origin for a while: the course changes only with a deploy.
 */

export const PLANNER_COURSE_PATH = '/api/planner/course';
const KEEP_MS = 10 * 60 * 1000;

type Fetch = (url: string) => Promise<Response>;

const kept = new Map<string, { at: number; text: string }>();

export async function plannerCourseText(
  origin: string,
  fetcher: Fetch = (url) => fetch(url),
  now: () => number = Date.now,
): Promise<string | undefined> {
  const hit = kept.get(origin);
  if (hit && now() - hit.at < KEEP_MS) return hit.text;
  try {
    const response = await fetcher(new URL(PLANNER_COURSE_PATH, origin).toString());
    if (!response.ok) return hit?.text;
    const body = (await response.json()) as { catalog?: unknown };
    if (typeof body.catalog !== 'string') return hit?.text;
    kept.set(origin, { at: now(), text: body.catalog });
    return body.catalog;
  } catch {
    // Planning without the course would invent lessons; the prompt says to call it unknown.
    return hit?.text;
  }
}

export function forgetPlannerCourse() {
  kept.clear();
}
