/*
 * What a tsx challenge adds to content/harness.d.ts: DOM matchers on `expect`, and the
 * Testing Library helpers the React runtime also puts on the global object. Checked by
 * tsconfig.content-tsx.json only, which has the DOM library and React's types; the plain
 * content config leaves this file out.
 *
 * The implementation is src/adapters/sandbox/react-runtime/ (docs/SANDBOX.md).
 */

interface Matchers {
  /** The element is attached to the document. */
  toBeInTheDocument(): void;
  /** The text content, with whitespace collapsed, contains the string or matches the pattern. */
  toHaveTextContent(expected: string | RegExp): void;
  /** The attribute is present, and has this value when one is given. */
  toHaveAttribute(name: string, value?: string): void;
  /** The form value: a string, a number for number inputs, an array for a multiple select. */
  toHaveValue(expected: string | number | string[] | null): void;
  toBeDisabled(): void;
  toBeEnabled(): void;
  /** A checkbox or radio, or an element with a role and aria-checked="true". */
  toBeChecked(): void;
  /** The element is document.activeElement. */
  toHaveFocus(): void;
  /** Attached, and not hidden by `hidden`, inline display, visibility or opacity. */
  toBeVisible(): void;
  toHaveClass(...names: string[]): void;
  toBeEmptyDOMElement(): void;
  toContainElement(element: Element | null): void;
}

declare const render: typeof import('@testing-library/react').render;
declare const screen: typeof import('@testing-library/react').screen;
declare const within: typeof import('@testing-library/react').within;
declare const fireEvent: typeof import('@testing-library/react').fireEvent;
declare const waitFor: typeof import('@testing-library/react').waitFor;
declare const waitForElementToBeRemoved: typeof import('@testing-library/react').waitForElementToBeRemoved;
declare const act: typeof import('@testing-library/react').act;
declare const cleanup: typeof import('@testing-library/react').cleanup;
declare const userEvent: typeof import('@testing-library/user-event').default;
