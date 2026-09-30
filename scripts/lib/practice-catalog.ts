import type { CompiledLesson, CompiledStep } from '../../src/core/content/compiled';
import type { CatalogFile, CatalogLesson } from '../../src/core/practice/catalog-file';
import type { CatalogRecallCard, CatalogSkillItem } from '../../src/core/practice/catalog';
import { stableStringify, type Bundle } from './compile';

/** The scored item a step contributes. A lab without a checkpoint has nothing to score. */
function skillItem(lessonId: string, step: CompiledStep): CatalogSkillItem | null {
  if (step.type === 'prose') return null;
  if (step.type === 'lab') {
    if (!step.checkpoint) return null;
    return {
      lessonId,
      stepId: step.id,
      type: step.type,
      concept: step.concept,
      difficulty: step.checkpoint.difficulty,
    };
  }
  if (step.type === 'playground' || step.type === 'sql') {
    // A playground or sql step without checks is a sandbox: nothing to score, so nothing to practise.
    if (!step.checks || step.concept === undefined) return null;
    return {
      lessonId,
      stepId: step.id,
      type: step.type,
      concept: step.concept,
      difficulty: step.difficulty ?? 1,
    };
  }
  return {
    lessonId,
    stepId: step.id,
    type: step.type,
    concept: step.concept,
    difficulty: step.difficulty,
  };
}

/**
 * Derived from the finished bundle, never from the sources, so the index can not disagree
 * with the lesson files it points at.
 */
export function addPracticeCatalog(bundle: Bundle): void {
  const lessons: Record<string, CatalogLesson> = {};
  const skillItems: CatalogSkillItem[] = [];
  const recallCards: CatalogRecallCard[] = [];

  for (const courseModule of bundle.manifest.modules) {
    for (const entry of courseModule.lessons) {
      const json = bundle.files.get(entry.file);
      if (json === undefined) throw new Error(`The bundle has no file for lesson ${entry.id}.`);
      const lesson = JSON.parse(json) as CompiledLesson;
      lessons[entry.id] = {
        title: entry.title,
        moduleId: courseModule.id,
        moduleSlug: courseModule.slug,
        slug: entry.slug,
        level: entry.level,
        minutes: entry.minutes,
        concepts: entry.concepts,
        file: entry.file,
        ...(entry.solutionsFile === undefined ? {} : { solutionsFile: entry.solutionsFile }),
      };
      for (const step of lesson.steps) {
        const item = skillItem(entry.id, step);
        if (item) skillItems.push(item);
      }
      for (const card of lesson.recall) {
        recallCards.push({ lessonId: entry.id, cardId: card.id, concept: card.concept });
      }
    }
  }

  const modules = bundle.manifest.modules.map(({ id, number, slug, title }) => ({
    id,
    number,
    slug,
    title,
  }));
  const concepts = bundle.manifest.modules.flatMap((courseModule) =>
    courseModule.concepts.map((concept) => ({
      id: concept.id,
      moduleId: courseModule.id,
      title: concept.title,
      summary: concept.summary,
      ...(concept.confusableWith ? { confusableWith: concept.confusableWith } : {}),
    })),
  );

  const file: CatalogFile = {
    schema: 1,
    contentRev: bundle.manifest.contentRev,
    modules,
    concepts,
    lessons,
    skillItems,
    recallCards,
    parts: bundle.manifest.parts,
  };
  bundle.files.set('catalog.json', stableStringify(file));
}
