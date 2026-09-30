import { allModules } from '../../src/core/content/catalog';
import type { Issue, RawCatalog } from '../../src/core/content/catalog';
import type {
  CompiledPlacementFile,
  CompiledPlacementItem,
  CompiledPlacementRung,
  PlacementFile,
  PlacementItem,
  PlacementWorld,
} from '../../src/core/content/placement-schema';
import { checkPlacement, placementFileSchema } from '../../src/core/content/placement-schema';
import type { Choice, Language } from '../../src/core/content/schema';
import { ContentError, readYaml } from '../../src/lib/content/fs';
import { stableStringify, type Bundle } from './compile';
import { createRenderer, type Renderer } from './render';

/*
 * The placement ladder, from `content/placement.yaml` to `placement.json` in the
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

/** Reads and schema-checks the ladder. A problem is an issue, never a thrown error. */
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

/** The modules and their concepts, as the semantic checks need them. */
export function placementWorld(catalog: RawCatalog): PlacementWorld {
  return {
    modules: allModules(catalog).map((courseModule) => ({
      id: courseModule.data.id,
      concepts: courseModule.data.concepts.map((concept) => concept.id),
    })),
  };
}

/** Everything the validator and the build both want to say about the ladder. */
export function checkPlacementContent(catalog: RawCatalog, root?: string): Issue[] {
  const { file, issues } = loadPlacement(root);
  if (!file) return issues;
  return [...issues, ...checkPlacement(file, placementWorld(catalog), PLACEMENT_PATH)];
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

export function compilePlacement(file: PlacementFile, render: Renderer): CompiledPlacementFile {
  const rungs: CompiledPlacementRung[] = file.rungs.map((rung) => ({
    rung: rung.rung,
    moduleBand: [...rung.moduleBand],
    concepts: [...rung.concepts],
    items: rung.items.map((item) => compileItem(item, render)),
  }));
  return { schema: file.schema, rungs };
}

/** Every language the ladder's own renderer has to load. */
export function placementLanguages(file: PlacementFile): Language[] {
  const found = new Set<Language>();
  for (const rung of file.rungs) {
    for (const item of rung.items) {
      if (item.type === 'multiple-choice') {
        if (item.language) found.add(item.language);
      } else found.add(item.language);
    }
  }
  return [...found].sort();
}

/**
 * Adds `placement.json` to the bundle. It carries its own renderer because the ladder
 * uses languages no lesson has to use.
 */
export async function addPlacement(
  bundle: Bundle,
  catalog: RawCatalog,
  root?: string,
): Promise<void> {
  const { file, issues } = loadPlacement(root);
  const problems = [
    ...issues,
    ...(file ? checkPlacement(file, placementWorld(catalog), PLACEMENT_PATH) : []),
  ];
  const errors = problems.filter((problem) => problem.severity === 'error');
  if (!file || errors.length > 0) {
    throw new Error(
      `${PLACEMENT_PATH} is not valid, so the bundle was not written:\n  ${errors
        .map((error) => [error.where, error.message].filter(Boolean).join(': '))
        .join('\n  ')}`,
    );
  }
  const render = await createRenderer(placementLanguages(file));
  bundle.files.set(PLACEMENT_BUNDLE_FILE, stableStringify(compilePlacement(file, render)));
}
