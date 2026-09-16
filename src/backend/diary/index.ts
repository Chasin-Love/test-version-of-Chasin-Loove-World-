/**
 * PLANETARY DIARY LINKAGE ENGINE
 * 
 * In this universe, the diary lives inside the planets.
 * Every planet in a stellar system corresponds to a CosmicBody carrying
 * a specific philosophical meaning (memory, idea, person, dream, project,
 * moment, unresolved, chapter).
 * 
 * This module connects planetary bodies to the temporal diary records,
 * supporting chronological playback, streak calculation, and search across
 * stellar worlds.
 */

import type { CosmicBody, DiaryEntry, Meaning } from '../types';
import { sanitizeDiaryHtml } from '../storage/sanitizeHtml';
import { computeStreak } from '../storage/metrics';

export interface PlanetDiaryView {
  planet: CosmicBody;
  entries: DiaryEntry[];
  latestEntry: DiaryEntry | null;
  wordCountTotal: number;
  streakDays: number;
  meaning: Meaning | null;
}

/**
 * Resolves all diary entries belonging to a given planetary body
 */
export function getEntriesForPlanet(planetId: string, allEntries: DiaryEntry[]): DiaryEntry[] {
  return allEntries
    .filter((e) => e.planetId === planetId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Creates a comprehensive diagnostic view of a planet's living diary
 */
export function buildPlanetDiaryView(planet: CosmicBody, allEntries: DiaryEntry[]): PlanetDiaryView {
  const entries = getEntriesForPlanet(planet.id, allEntries);
  const latestEntry = entries[0] ?? null;
  
  let wordCountTotal = 0;
  for (const e of entries) {
    const text = (e.body || '').replace(/<[^>]*>/g, ' ');
    wordCountTotal += text.trim().split(/\s+/).filter(Boolean).length;
  }

  const streakDays = computeStreak(entries);

  return {
    planet,
    entries,
    latestEntry,
    wordCountTotal,
    streakDays,
    meaning: planet.meaning,
  };
}

/**
 * Searches diary entries across all planets in a stellar system
 */
export function searchPlanetaryDiaries(
  query: string,
  entries: DiaryEntry[],
  bodies: CosmicBody[]
): { entry: DiaryEntry; planet: CosmicBody | null }[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const planetMap = new Map<string, CosmicBody>();
  for (const b of bodies) {
    planetMap.set(b.id, b);
  }

  return entries
    .filter((e) => {
      const titleMatch = (e.title || '').toLowerCase().includes(q);
      const bodyMatch = (e.body || '').toLowerCase().includes(q);
      const tagMatch = (e.tags || []).some((t) => t.toLowerCase().includes(q));
      return titleMatch || bodyMatch || tagMatch;
    })
    .map((e) => ({
      entry: e,
      planet: e.planetId ? planetMap.get(e.planetId) ?? null : null,
    }));
}

export { sanitizeDiaryHtml, computeStreak };
