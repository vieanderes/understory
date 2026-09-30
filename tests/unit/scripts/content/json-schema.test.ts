import { describe, expect, it } from 'vitest';
import { jsonSchemas } from '../../../../scripts/lib/json-schema';

interface JsonSchema {
  $schema?: string;
  $id?: string;
  title?: string;
  type?: string;
  required?: string[];
  properties?: Record<string, JsonSchema & { oneOf?: unknown[]; items?: JsonSchema & { oneOf?: unknown[] } }>;
  additionalProperties?: boolean;
}

const schemas = jsonSchemas();
const parsed = (file: string): JsonSchema => JSON.parse(schemas.get(file) ?? '{}') as JsonSchema;

describe('jsonSchemas', () => {
  it('emits the three authoring contracts and the three bundle contracts', () => {
    expect([...schemas.keys()].sort()).toEqual([
      'compiled-lesson.schema.json',
      'compiled-placement.schema.json',
      'course.schema.json',
      'lesson.schema.json',
      'manifest.schema.json',
      'module.schema.json',
    ]);
  });

  it.each([...schemas.keys()])('%s is a strict draft 2020-12 object schema', (file) => {
    const schema = parsed(file);
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$id).toContain(file);
    expect(schema.type).toBe('object');
    expect(schema.additionalProperties).toBe(false);
  });

  it('does not ask authors for fields that have a default', () => {
    expect(parsed('lesson.schema.json').required).not.toContain('prerequisites');
    expect(parsed('lesson.schema.json').required).toContain('steps');
  });

  it('describes every step type in the lesson contract', () => {
    expect(parsed('lesson.schema.json').properties?.steps?.items?.oneOf).toHaveLength(14);
    expect(parsed('compiled-lesson.schema.json').properties?.steps?.items?.oneOf).toHaveLength(14);
  });

  it('keeps the author hints as descriptions', () => {
    expect(schemas.get('lesson.schema.json')).toContain('Name the misconception');
  });

  it('gives the compiled lesson Rich fields and no file names', () => {
    const text = schemas.get('compiled-lesson.schema.json') ?? '';
    expect(text).toContain('"starterCode"');
    expect(text).toContain('"codeHtml"');
    // A challenge's solution file stays out of the lesson. A playground's finished HTML and
    // a sql step's solution query are the solutions that ship inside it
    // (docs/ARCHITECTURE.md): short, and needed offline to judge an answer.
    const described = [...text.matchAll(/"solution": \{\s*(?:"type": "string",\s*)?"description": "([^"]*)"/g)];
    expect(text.split('"solution"').length - 1).toBe(described.length);
    expect(
      described.every(
        (match) =>
          match[1]?.startsWith('The finished fields') || match[1]?.startsWith('SQL that gives'),
      ),
    ).toBe(true);
    expect(text).not.toContain('"tests"');
  });

  it('is deterministic and ends with a newline', () => {
    expect([...jsonSchemas()]).toEqual([...schemas]);
    for (const text of schemas.values()) expect(text.endsWith('}\n')).toBe(true);
  });
});
