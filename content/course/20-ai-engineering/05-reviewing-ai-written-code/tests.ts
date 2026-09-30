import { unknownImports } from './solution';

const allowed = ['zod', 'pg', '@anthropic-ai/sdk'];

test('known packages raise nothing', () => {
  expect(unknownImports([{ name: 'z', from: 'zod' }, { name: 'pg', from: 'pg' }], allowed)).toEqual([]);
});

test('an unknown package is reported', () => {
  expect(unknownImports([{ name: 'fmt', from: 'money-format-pro' }], allowed)).toEqual(['money-format-pro']);
});

test('relative and node: imports are never packages', () => {
  const imports = [{ name: 'db', from: './db' }, { name: 'fs', from: 'node:fs' }];
  expect(unknownImports(imports, allowed)).toEqual([]);
});

test('a sub-path counts as its package', () => {
  expect(unknownImports([{ name: 'x', from: 'zod/v4' }, { name: 'y', from: 'lodash/get' }], allowed)).toEqual(['lodash']);
});

test('a scoped package keeps its scope', () => {
  const imports = [{ name: 'a', from: '@anthropic-ai/sdk/helpers/zod' }, { name: 'b', from: '@acme/utils' }];
  expect(unknownImports(imports, allowed)).toEqual(['@acme/utils']);
});

test('each unknown package is listed once, sorted', () => {
  const imports = [{ name: 'a', from: 'yaml' }, { name: 'b', from: 'chalk' }, { name: 'c', from: 'yaml/parse' }];
  expect(unknownImports(imports, allowed)).toEqual(['chalk', 'yaml']);
});
