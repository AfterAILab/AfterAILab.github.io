import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

/** The list of 週刊 AfterAI issues (number + slug), newest appended last. */
const weekly = defineCollection({
  loader: file('./src/content/weekly/issues.json'),
  schema: z.object({
    number: z.number().int().positive(),
    slug: z.string().regex(/^vol\d+$/),
    /** Issue date as handwritten in the top-right corner of the page, e.g. "2025-06-04". */
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
});

/** Japanese transcriptions, one Markdown file per issue (`volN.md`). Only some issues have one. */
const weeklyTranscriptions = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/weekly/transcriptions' }),
  schema: z.object({}).passthrough(),
});

export const collections = { weekly, weeklyTranscriptions };
