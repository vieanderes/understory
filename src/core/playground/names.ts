/*
 * The names a React playground page and its runtime file agree on. A module of its own,
 * with no imports, so the runtime build (scripts/build-sandbox.ts) takes nothing else
 * from core with it.
 */

/** The element a React playground renders into. The page gets one unless its HTML has it. */
export const REACT_ROOT_ID = 'root';

/** Set by the runtime file: React, react-dom, react-dom/client and the JSX runtime. */
export const REACT_RUNTIME_GLOBAL = '__understoryReact';

/** Set by the module script: the learner's file as a CommonJS factory. */
export const MODULE_GLOBAL = '__understoryModule';
