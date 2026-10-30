/**
 * Ripples: where something just happened, so the map can show it before the
 * memo says it. Worked out by comparing the world before and after a day (or
 * a signing), plus that batch's dispatches. Purely presentational: nothing
 * here feeds back into the game.
 */

import { sortedIds, type GameState } from '@ripple/engine';
import type { Dispatch } from './news';

/** What a ripple means, in the palette's terms. */
export type RippleTone = 'threat' | 'friend' | 'you' | 'quiet';

export interface RipplePlace {
  readonly kind: 'country' | 'chokepoint';
  readonly id: string;
}

export interface Ripple {
  /** Unique within a session, so the map can key and retire each one. */
  readonly id: number;
  readonly at: RipplePlace;
  readonly tone: RippleTone;
}

export type RippleDraft = Omit<Ripple, 'id'>;

/** Ripples kept at once; older ones have long finished spreading. */
export const MAX_RIPPLES = 6;

/**
 * Where the world changed in a way worth seeing:
 * - a chokepoint closing (threat) or reopening (friend), from the world itself;
 * - a critical world event in a country (threat), a warning one (quiet);
 * - one of your orders aimed at a country taking effect there (you).
 * One ripple per place per batch, the most severe first.
 */
export function ripplesFor(
  before: GameState,
  after: GameState,
  dispatches: readonly Dispatch[],
): RippleDraft[] {
  const drafts: RippleDraft[] = [];
  const seen = new Set<string>();
  const add = (at: RipplePlace, tone: RippleTone) => {
    const key = `${at.kind}:${at.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    drafts.push({ at, tone });
  };

  for (const id of sortedIds(after.world.chokepoints)) {
    const was = before.world.chokepoints[id]?.open;
    const now = after.world.chokepoints[id]!.open;
    if (was !== undefined && was !== now)
      add({ kind: 'chokepoint', id }, now ? 'friend' : 'threat');
  }

  const ranked = [...dispatches].sort((a, b) => rank(a) - rank(b));
  for (const d of ranked) {
    if (!d.country || !after.world.countries[d.country]) continue;
    const at: RipplePlace = { kind: 'country', id: d.country };
    if (d.source === 'world' && d.severity === 'critical') add(at, 'threat');
    else if (d.source === 'world' && d.severity === 'warning') add(at, 'quiet');
    else if (d.source === 'order' && d.severity === 'info') add(at, 'you');
  }
  return drafts;
}

function rank(d: Dispatch): number {
  if (d.source === 'world' && d.severity === 'critical') return 0;
  if (d.source === 'order') return 1;
  return 2;
}

/** Add new ripples, numbered on from the newest, keeping the last MAX_RIPPLES. */
export function addRipples(
  ripples: readonly Ripple[],
  drafts: readonly RippleDraft[],
): readonly Ripple[] {
  if (drafts.length === 0) return ripples;
  let next = (ripples.at(-1)?.id ?? 0) + 1;
  const added = drafts.map((d) => ({ ...d, id: next++ }));
  return [...ripples, ...added].slice(-MAX_RIPPLES);
}
