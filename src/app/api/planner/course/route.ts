import { getPlannerCourse } from '@/lib/content';

/*
 * The course for Scout's path planner, built at build time like every page. Scout's panel
 * fetches it when plan mode opens, and the assistant routes read Scout's text of it from
 * here, so no server route has to read the content files at run time.
 */

export const dynamic = 'force-static';

export async function GET() {
  return Response.json(await getPlannerCourse());
}
