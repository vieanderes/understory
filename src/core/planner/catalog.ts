import type { PlannerCourse, PlannerModule, PlannerPath } from './course';

/*
 * The course as Scout reads it while planning: every lesson on one line, grouped by part and
 * chapter, then the written paths as lesson ids. It is built on the server from the manifest
 * (never sent by the tab), so it is trusted, and it is cached as one prompt block.
 *
 * Lines are terse on purpose: 370 lessons have to fit in a prompt with room to talk.
 */

function chapterLines(mod: PlannerModule): string[] {
  const lines = [
    `### Chapter ${mod.number}: ${mod.title} (${mod.id})`,
    `${mod.summary} You can build: ${mod.youCanBuild}`,
  ];
  for (const l of mod.lessons) {
    const needs = l.prerequisites.length > 0 ? ` | needs ${l.prerequisites.join(', ')}` : '';
    lines.push(`- ${l.id} | ${l.title} | ${l.minutes} min | ${l.level} | ${l.objective}${needs}`);
  }
  return lines;
}

export function plannerCatalog(course: PlannerCourse, paths: readonly PlannerPath[]): string {
  const byId = new Map(course.modules.map((m) => [m.id, m]));
  const placed = new Set<string>();
  const out = [
    '# The course',
    'Each lesson: id | title | minutes | level | what the learner can do afterwards | needs (prerequisite ids, advice only).',
  ];
  for (const part of course.parts) {
    out.push('', `## Part: ${part.title} (${part.id})`, part.summary);
    for (const id of part.modules) {
      const mod = byId.get(id);
      if (!mod) continue;
      placed.add(id);
      out.push(...chapterLines(mod));
    }
  }
  const woven = course.modules.filter((m) => !placed.has(m.id));
  if (woven.length > 0) {
    out.push('', '## Chapters woven through the course');
    for (const mod of woven) out.push(...chapterLines(mod));
  }
  if (paths.length > 0) {
    out.push('', '# Written paths', 'Curated sequences. Reuse a stage when it fits the learner.');
    for (const path of paths) {
      out.push('', `## ${path.name} (${path.id})${path.promise ? `: ${path.promise}` : ''}`);
      for (const stage of path.stages) out.push(`- ${stage.title}: ${stage.lessonIds.join(', ')}`);
    }
  }
  return out.join('\n');
}
