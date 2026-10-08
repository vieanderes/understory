import { getScoutLibrary } from '@/lib/content';

/*
 * The course's references for Scout's Librarian, built at build time like every page. Scout's
 * panel fetches it when it opens and sends a slice with each question.
 */

export const dynamic = 'force-static';

export async function GET() {
  return Response.json(await getScoutLibrary());
}
