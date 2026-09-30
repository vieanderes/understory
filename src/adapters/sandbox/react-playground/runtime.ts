/*
 * The React of a React playground (docs/SANDBOX.md, "React in the playground"): the
 * browser builds of React 19 and react-dom, with nothing in between. The preview frame
 * runs this file as an inline script, then the learner's module, whose `require` hands
 * out these four modules (src/core/playground/react-page.ts).
 *
 * Built by scripts/build-sandbox.ts into public/sandbox/react-playground.v1.js.
 */
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as jsxRuntime from 'react/jsx-runtime';
import { REACT_RUNTIME_GLOBAL } from '@/core/playground/names';

Object.defineProperty(globalThis, REACT_RUNTIME_GLOBAL, {
  value: Object.freeze({ React, ReactDOM, ReactDOMClient, jsxRuntime }),
});
