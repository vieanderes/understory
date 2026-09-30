/**
 * The React runtime for `language: tsx` code challenges (docs/SANDBOX.md, "React
 * challenges"). scripts/build-sandbox.ts bundles this file into
 * public/sandbox/react-runtime.v1.js. A run evaluates it before the harness, in the
 * sandbox worker in the browser and in the `node:vm` context of the CI gate.
 *
 * It gives the harness three things through its host contract:
 * - `__hostModules`: what `import ... from 'react'` and friends resolve to,
 * - `__hostMatchers`: jest-dom style matchers for `expect`,
 * - `__hostAfterEach`: unmounts what a test rendered and empties the document.
 * and it defines the Testing Library helpers as globals too, for tests that skip imports.
 */
import { dom, pendingErrors } from './install';
import * as React from 'react';
import * as JsxRuntime from 'react/jsx-runtime';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as TestingLibraryDom from '@testing-library/dom';
import * as TestingLibraryReact from '@testing-library/react';
import { tabbable } from './dom';
import { DOM_MATCHERS } from './matchers';
import { createUserEvent } from './user-event';

const host = globalThis as unknown as Record<string, unknown>;

/** Throws the first error a listener or React reported since the last check. */
function rethrow(): void {
  if (pendingErrors.length === 0) return;
  const [first] = pendingErrors;
  pendingErrors.length = 0;
  throw first;
}

TestingLibraryDom.configure({
  // No colours and a short tree: the message lands in a small test result panel.
  getElementError(message, container) {
    const tree = container
      ? TestingLibraryDom.prettyDOM(container as Element, 1500, { highlight: false })
      : '';
    const error = new Error([message, tree].filter(Boolean).join('\n\n'));
    error.name = 'TestingLibraryElementError';
    return error;
  },
});

const config = TestingLibraryDom.getConfig();

function wrapEvent<T>(dispatch: () => T): T {
  let result: T | undefined;
  config.eventWrapper(() => {
    result = dispatch();
  });
  return result as T;
}

const userEvent = createUserEvent({
  document: dom.document as never,
  tabbable: () => tabbable(dom.document) as never,
  wrapEvent,
  settle: () =>
    config.asyncWrapper(
      () => new Promise<void>((resolve) => setTimeout(resolve, 0)),
    ) as Promise<void>,
  rethrow,
});

type FireEvent = typeof TestingLibraryReact.fireEvent;

// Testing Library's fireEvent, plus the rethrow: an error thrown by a click handler
// fails the test that clicked, as it would in a browser test runner.
const fireEvent = ((element: Element, event: Event) => {
  const result = TestingLibraryReact.fireEvent(element, event);
  rethrow();
  return result;
}) as FireEvent;
for (const [name, fire] of Object.entries(TestingLibraryReact.fireEvent)) {
  if (typeof fire !== 'function') continue;
  (fireEvent as unknown as Record<string, unknown>)[name] = (...args: unknown[]) => {
    const result = (fire as (...a: unknown[]) => unknown)(...args);
    rethrow();
    return result;
  };
}

function render(...args: Parameters<typeof TestingLibraryReact.render>) {
  const result = TestingLibraryReact.render(...args);
  rethrow();
  return result;
}

const testingLibraryReact = { ...TestingLibraryReact, render, fireEvent };
const userEventModule = { ...userEvent, default: userEvent, userEvent };

host.__hostModules = {
  react: React,
  'react/jsx-runtime': JsxRuntime,
  'react/jsx-dev-runtime': JsxRuntime,
  'react-dom': ReactDOM,
  'react-dom/client': ReactDOMClient,
  '@testing-library/dom': { ...TestingLibraryDom, fireEvent },
  '@testing-library/react': testingLibraryReact,
  '@testing-library/user-event': userEventModule,
};

host.__hostMatchers = DOM_MATCHERS;

host.__hostAfterEach = () => {
  try {
    TestingLibraryReact.cleanup();
  } finally {
    dom.reset();
    pendingErrors.length = 0;
  }
};

const globals: Record<string, unknown> = {
  render,
  screen: TestingLibraryReact.screen,
  within: TestingLibraryReact.within,
  fireEvent,
  waitFor: TestingLibraryReact.waitFor,
  waitForElementToBeRemoved: TestingLibraryReact.waitForElementToBeRemoved,
  act: TestingLibraryReact.act,
  cleanup: TestingLibraryReact.cleanup,
  userEvent,
};
for (const [name, value] of Object.entries(globals)) {
  Object.defineProperty(host, name, { value, writable: true, configurable: true });
}
