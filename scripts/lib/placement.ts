import { allModules } from '../../src/core/content/catalog';
import type { Issue, RawCatalog } from '../../src/core/content/catalog';
import type {
  CompiledPlacementArea,
  CompiledPlacementFile,
  CompiledPlacementItem,
  PlacementFile,
  PlacementItem,
  PlacementWorld,
} from '../../src/core/content/placement-schema';
import {
  assumedByLevel,
  checkPlacement,
  placementFileSchema,
} from '../../src/core/content/placement-schema';
import type { Choice, Language } from '../../src/core/content/schema';
import { ContentError, loadTracks, readYaml } from '../../src/lib/content/fs';
import { stableStringify, type Bundle } from './compile';
import { createRenderer, type Renderer } from './render';

/*
 * Placement, from `content/placement.yaml` to `placement.json` in the
 * bundle. It uses the same renderer as the lessons, so an item's code is highlighted at
 * build time and its markdown ships as `{md, html}`: the client needs neither a
 * highlighter nor a markdown parser (scripts/lib/compile.ts).
 */

/** Relative to `content/`, the way `readYaml` wants it. */
const PLACEMENT_FILE = 'placement.yaml';
export const PLACEMENT_PATH = `content/${PLACEMENT_FILE}`;
export const PLACEMENT_BUNDLE_FILE = 'placement.json';

export interface LoadedPlacement {
  file?: PlacementFile;
  issues: Issue[];
}

/** Reads and schema-checks the placement file. A problem is an issue, never a thrown error. */
export function loadPlacement(root?: string): LoadedPlacement {
  try {
    return { file: readYaml(PLACEMENT_FILE, placementFileSchema, root), issues: [] };
  } catch (error) {
    return {
      issues: [
        {
          severity: 'error',
          path: PLACEMENT_PATH,
          rule: error instanceof ContentError ? 'schema' : 'file-missing',
          message:
            error instanceof Error
              ? error.message.split('\n').slice(1).join('\n').trim() || error.message
              : String(error),
        },
      ],
    };
  }
}

/** The modules, parts and paths, as the semantic checks need them. */
export function placementWorld(catalog: RawCatalog, root?: string): PlacementWorld {
  return {
    modules: allModules(catalog).map((courseModule) => ({
      id: courseModule.data.id,
      concepts: courseModule.data.concepts.map((concept) => concept.id),
    })),
    lessons: allModules(catalog).flatMap((courseModule) =>
      courseModule.lessons.map((lesson) => ({
        moduleId: courseModule.data.id,
        concepts: lesson.data.concepts,
      })),
    ),
    parts: (catalog.course?.data.parts ?? []).map((part) => part.id),
    paths: Object.keys(loadTracks(root).tracks),
  };
}

/** Everything the validator and the build both want to say about placement. */
export function checkPlacementContent(catalog: RawCatalog, root?: string): Issue[] {
  const { file, issues } = loadPlacement(root);
  if (!file) return issues;
  return [...issues, ...checkPlacement(file, placementWorld(catalog, root), PLACEMENT_PATH)];
}

// ---------------------------------------------------------------------------
// Compiling
// ---------------------------------------------------------------------------

const rich = (md: string, render: Renderer) => ({ md, html: render.markdown(md) });

const compileChoices = (choices: readonly Choice[], render: Renderer) =>
  choices.map((choice) => ({
    ...choice,
    text: { md: choice.text, html: render.inline(choice.text) },
    feedback: rich(choice.feedback, render),
  }));

function compileItem(item: PlacementItem, render: Renderer): CompiledPlacementItem {
  switch (item.type) {
    case 'predict-output':
      return {
        ...item,
        codeHtml: render.code(item.code, item.language),
        question: rich(item.question, render),
        choices: compileChoices(item.choices, render),
      };
    case 'multiple-choice':
      return {
        ...item,
        ...(item.code === undefined
          ? {}
          : { codeHtml: render.code(item.code, item.language ?? 'text') }),
        question: rich(item.question, render),
        choices: compileChoices(item.choices, render),
      };
    case 'bug-hunt':
      return {
        ...item,
        codeHtml: render.code(item.code, item.language),
        prompt: rich(item.prompt, render),
        reasons: compileChoices(item.reasons, render),
        ...(item.fix === undefined ? {} : { fixHtml: render.code(item.fix, item.language) }),
      };
  }
}

export function compilePlacement(
  file: PlacementFile,
  render: Renderer,
  lessons: PlacementWorld['lessons'],
): CompiledPlacementFile {
  const areas: CompiledPlacementArea[] = file.areas.map((area) => {
    const assumed = assumedByLevel(area, lessons);
    return {
      id: area.id,
      title: area.title,
      ...(area.part === undefined ? {} : { part: area.part }),
      modules: [...area.modules],
      levels: area.levels.map((level, index) => ({
        level: level.level,
        concepts: assumed[index] ?? [],
        items: level.items.map((item) => compileItem(item, render)),
      })),
    };
  });
  return { schema: file.schema, areas, paths: file.paths.map((rule) => ({ ...rule })) };
}

/** Every language placement's own renderer has to load. */
export function placementLanguages(file: PlacementFile): Language[] {
  const found = new Set<Language>();
  for (const item of file.areas.flatMap((a) => a.levels.flatMap((l) => l.items))) {
    if (item.type === 'multiple-choice') {
      if (item.language) found.add(item.language);
    } else found.add(item.language);
  }
  return [...found].sort();
}

/**
 * Adds `placement.json` to the bundle. It carries its own renderer because placement
 * uses languages no lesson has to use.
 */
export async function addPlacement(
  bundle: Bundle,
  catalog: RawCatalog,
  root?: string,
): Promise<void> {
  const { file, issues } = loadPlacement(root);
  const world = placementWorld(catalog, root);
  const problems = [...issues, ...(file ? checkPlacement(file, world, PLACEMENT_PATH) : [])];
  const errors = problems.filter((problem) => problem.severity === 'error');
  if (!file || errors.length > 0) {
    throw new Error(
      `${PLACEMENT_PATH} is not valid, so the bundle was not written:\n  ${errors
        .map((error) => [error.where, error.message].filter(Boolean).join(': '))
        .join('\n  ')}`,
    );
  }
  const render = await createRenderer(placementLanguages(file));
  bundle.files.set(
    PLACEMENT_BUNDLE_FILE,
    stableStringify(compilePlacement(file, render, world.lessons)),
  );
}
