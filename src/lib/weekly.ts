import { existsSync } from 'node:fs';
import path from 'node:path';
import { getCollection, getEntry } from 'astro:content';

export interface WeeklyIssue {
  number: number;
  slug: string;
  /** e.g. "AfterAI Weekly Vol.12" */
  title: string;
  /** Site-relative image path, e.g. "/img/weekly/ja/vol12-ja.jpg". */
  image: string;
  /** Site-relative page URL, e.g. "/weekly/vol12/". */
  url: string;
  hasTranscription: boolean;
}

/** Resolved from the project root: at build time this module is bundled elsewhere, so import.meta.url is useless here. */
const PUBLIC_DIR = path.join(process.cwd(), 'public');

/**
 * Japanese artwork lives in /img/weekly/ja/; issues that were only drawn in
 * English fall back to /img/weekly/en/ (mirrors the old onerror fallback).
 */
function resolveImage(slug: string): string {
  const ja = `/img/weekly/ja/${slug}-ja.jpg`;
  if (existsSync(path.join(PUBLIC_DIR, ja))) return ja;
  return `/img/weekly/en/${slug}-en.jpg`;
}

let cache: Promise<WeeklyIssue[]> | undefined;

/** All issues, newest first. */
export function getWeeklyIssues(): Promise<WeeklyIssue[]> {
  cache ??= (async () => {
    const [issues, transcriptions] = await Promise.all([
      getCollection('weekly'),
      getCollection('weeklyTranscriptions'),
    ]);
    const withTranscription = new Set(transcriptions.map((t) => t.id));
    return issues
      .map(({ data }) => ({
        number: data.number,
        slug: data.slug,
        title: `AfterAI Weekly Vol.${data.number}`,
        image: resolveImage(data.slug),
        url: `/weekly/${data.slug}/`,
        hasTranscription: withTranscription.has(data.slug),
      }))
      .sort((a, b) => b.number - a.number);
  })();
  return cache;
}

/** The newest issue. */
export async function getLatestIssue(): Promise<WeeklyIssue> {
  const [latest] = await getWeeklyIssues();
  if (!latest) throw new Error('No weekly issues found');
  return latest;
}

/** The transcription entry for an issue, or undefined when it has none. */
export function getTranscription(slug: string) {
  return getEntry('weeklyTranscriptions', slug);
}
