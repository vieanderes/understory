import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import {
  compiledLessonSchema,
  compiledPlacementSchema,
  manifestSchema,
} from '../../src/core/content/compiled-schema';
import { courseSchema, lessonSchema, moduleSchema } from '../../src/core/content/schema';

/*
 * JSON Schema for both sides of the pipeline, written to contracts/schemas and committed.
 * The authoring schemas give editors completion in lesson.yaml. The compiled schemas are
 * the contract the Swift Codable types are checked against.
 */

interface Contract {
  file: string;
  title: string;
  schema: z.ZodType;
  /** Authors write the input (defaults may be left out). Clients read the output. */
  io: 'input' | 'output';
}

const CONTRACTS: Contract[] = [
  { file: 'lesson.schema.json', title: 'Lesson (lesson.yaml)', schema: lessonSchema, io: 'input' },
  { file: 'module.schema.json', title: 'Module (module.yaml)', schema: moduleSchema, io: 'input' },
  { file: 'course.schema.json', title: 'Course (course.yaml)', schema: courseSchema, io: 'input' },
  { file: 'manifest.schema.json', title: 'Bundle manifest', schema: manifestSchema, io: 'output' },
  {
    file: 'compiled-placement.schema.json',
    title: 'Compiled placement',
    schema: compiledPlacementSchema,
    io: 'output',
  },
  {
    file: 'compiled-lesson.schema.json',
    title: 'Compiled lesson',
    schema: compiledLessonSchema,
    io: 'output',
  },
];

/** File name to JSON text. No timestamps, so an unchanged schema gives an unchanged file. */
export function jsonSchemas(): Map<string, string> {
  return new Map(
    CONTRACTS.map(({ file, title, schema, io }) => {
      const json = z.toJSONSchema(schema, { target: 'draft-2020-12', io, unrepresentable: 'any' });
      const { $schema, ...rest } = json;
      const document = { $schema, $id: `https://understory.dev/schemas/${file}`, title, ...rest };
      return [file, `${JSON.stringify(document, null, 2)}\n`];
    }),
  );
}

export function writeJsonSchemas(outDir: string): string[] {
  fs.mkdirSync(outDir, { recursive: true });
  const schemas = jsonSchemas();
  for (const [file, text] of schemas) fs.writeFileSync(path.join(outDir, file), text);
  return [...schemas.keys()];
}
