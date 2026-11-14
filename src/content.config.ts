import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

/** The list of AfterAI Weekly issues (number + slug), newest appended last. */
const weekly = defineCollection({
  loader: file('./src/content/weekly/issues.json'),
  schema: z.object({
    number: z.number().int().positive(),
    slug: z.string().regex(/^vol\d+$/),
    /** Issue date as handwritten in the top-right corner of the page, e.g. "2025-06-04". */
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /**
     * The issue's audio supplement (AfterAI Weekly), when it has one. The file itself is
     * public/audio/weekly/volN.m4a (made by scripts/weekly-audio.sh); size and length are read from it at build time.
     */
    audio: z
      .object({
        /** Publication date of the episode, e.g. "2026-11-18". Becomes the podcast feed's pubDate. */
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        /** Episode title; defaults to the issue title. */
        title: z.string().optional(),
        /** Show notes for podcast apps; defaults to a one-line description of the issue. */
        description: z.string().optional(),
        /**
         * Spotify episode ID (the part after open.spotify.com/episode/), added once Spotify has picked the
         * episode up from the feed. The issue page plays the episode in Spotify's widget; until the ID is
         * set the page shows no audio (the episode is still in the feed).
         */
        spotify: z
          .string()
          .regex(/^[A-Za-z0-9]{22}$/)
          .optional(),
      })
      .optional(),
  }),
});

/** Japanese transcriptions, one Markdown file per issue (`volN.md`). Only some issues have one. */
const weeklyTranscriptions = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/weekly/transcriptions' }),
  schema: z.object({}).passthrough(),
});

export const collections = { weekly, weeklyTranscriptions };
