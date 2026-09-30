import type { CompiledCodeChallengeStep } from './compiled';
import type { CodeChallengeStep } from './schema';

/*
 * A code challenge with a twin is one challenge in two languages (docs/CONTENT-GUIDE.md,
 * "Twins"). The prompt, hints, id and scoring are shared, so a learner who solves it in
 * Python has solved the step. Everything that runs differs: the files, the runtime, the
 * type check, the packages and the locked lines.
 */

export type ChallengeLanguage = CompiledCodeChallengeStep['language'];

const LABELS: Readonly<Record<ChallengeLanguage, string>> = {
  js: 'JavaScript',
  ts: 'TypeScript',
  tsx: 'React',
  python: 'Python',
};

/** The name a learner knows the language by, for the switch and the lecture. */
export const languageLabel = (language: ChallengeLanguage): string => LABELS[language];

/** Where the twin's reference solution sits in the solutions file. */
export const twinSolutionKey = (stepId: string): string => `${stepId}:twin`;

/** The languages a step can be practised in, the main one first. */
export function challengeLanguages(step: CompiledCodeChallengeStep): ChallengeLanguage[] {
  return step.twin ? [step.language, step.twin.language] : [step.language];
}

/** The learner's preferred language where this step offers it, else the main language. */
export function chooseLanguage(
  step: CompiledCodeChallengeStep,
  preferred: string | null,
): ChallengeLanguage {
  const offered = challengeLanguages(step);
  return offered.find((language) => language === preferred) ?? step.language;
}

/**
 * The step as it runs in `language`: the twin's files swapped in, and nothing of the main
 * files' runtime left behind. The main language, or one the step lacks, returns the step.
 */
export function inLanguage(
  step: CompiledCodeChallengeStep,
  language: ChallengeLanguage,
): CompiledCodeChallengeStep {
  const { twin } = step;
  if (!twin || twin.language === step.language || language !== twin.language) return step;
  // Built from the shared fields only: hidden and performance tests belong to
  // assessments, which a twin never joins, and the main runtime settings are not its own.
  const { type, id, concept, difficulty, prompt, hints } = step;
  const shared = { type, id, concept, difficulty, prompt, hints };
  return {
    ...shared,
    language: twin.language,
    starterCode: twin.starterCode,
    starterHtml: twin.starterHtml,
    testsCode: twin.testsCode,
    ...(twin.typecheck ? { typecheck: true as const } : {}),
    ...(twin.packages === undefined ? {} : { packages: twin.packages }),
    ...(twin.editable === undefined ? {} : { editable: twin.editable }),
  };
}

/**
 * The authored step and its twin as a step of its own, so every file rule and the
 * solution gate read the twin exactly as they read the main files.
 */
export function challengeVariants(step: CodeChallengeStep): CodeChallengeStep[] {
  const { twin } = step;
  if (!twin) return [step];
  const { type, id, concept, difficulty, prompt, hints } = step;
  const shared = { type, id, concept, difficulty, prompt, hints };
  return [
    step,
    {
      ...shared,
      language: twin.language,
      starter: twin.starter,
      solution: twin.solution,
      tests: twin.tests,
      ...(twin.packages === undefined ? {} : { packages: twin.packages }),
      ...(twin.editable === undefined ? {} : { editable: twin.editable }),
    },
  ];
}
