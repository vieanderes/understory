/*
 * The slice of compiled content `buildSession` needs. Kept as a small, independent
 * interface (docs/ARCHITECTURE.md, deliverable brief) so practice never depends on
 * the compiled content types in src/core/content or src/lib/content.
 */

export interface CatalogConcept {
  readonly id: string;
  readonly moduleId: string;
  readonly confusableWith?: readonly string[];
}

/** A scoreable exercise template: a lesson step the session can offer as practice. */
export interface CatalogSkillItem {
  readonly lessonId: string;
  readonly stepId: string;
  /** The content step type, used only to exclude `code-challenge` on phone. */
  readonly type: string;
  readonly concept: string;
  readonly difficulty: number; // 1..5, as in content/schema.ts
}

/** A fact (recall) card. */
export interface CatalogRecallCard {
  readonly lessonId: string;
  readonly cardId: string;
  readonly concept: string;
}

export interface Catalog {
  readonly concepts: readonly CatalogConcept[];
  readonly skillItems: readonly CatalogSkillItem[];
  readonly recallCards: readonly CatalogRecallCard[];
}
