import { beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetPlannerCourse, plannerCourseText } from '@/adapters/assistant/server/planner-course';

const ORIGIN = 'https://understory.example';

beforeEach(() => forgetPlannerCourse());

describe('the planner course on the server', () => {
  it('reads the static file from its own origin and keeps it for a while', async () => {
    let now = 0;
    const fetcher = vi.fn(async () => Response.json({ catalog: 'COURSE' }));
    expect(await plannerCourseText(`${ORIGIN}/api/assistant`, fetcher, () => now)).toBe('COURSE');
    expect(fetcher).toHaveBeenCalledWith(`${ORIGIN}/api/planner/course`);
    now = 60_000;
    await plannerCourseText(`${ORIGIN}/api/assistant`, fetcher, () => now);
    expect(fetcher).toHaveBeenCalledTimes(1);
    now = 11 * 60_000;
    await plannerCourseText(`${ORIGIN}/api/assistant`, fetcher, () => now);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('falls back to what it had, or nothing, when the file cannot be read', async () => {
    let now = 0;
    const ok = async () => Response.json({ catalog: 'OLD' });
    await plannerCourseText(ORIGIN, ok, () => now);
    now = 20 * 60_000;
    expect(
      await plannerCourseText(
        ORIGIN,
        async () => new Response('', { status: 500 }),
        () => now,
      ),
    ).toBe('OLD');
    expect(
      await plannerCourseText(
        ORIGIN,
        async () => Promise.reject(new Error('offline')),
        () => now,
      ),
    ).toBe('OLD');
    forgetPlannerCourse();
    expect(await plannerCourseText(ORIGIN, async () => Response.json({ nope: 1 }))).toBeUndefined();
    expect(
      await plannerCourseText(ORIGIN, async () => Promise.reject(new Error('offline'))),
    ).toBeUndefined();
  });
});
