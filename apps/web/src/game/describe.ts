/** Plain-language descriptions of decisions, relations and moods for the UI. */

import type { DecisionDef, GameState } from '@ripple/engine';

/** The costs paid on signing, for example ["30 bn", "8 influence"]. */
export function describeCosts(state: GameState, def: DecisionDef): string[] {
  const me = state.rules.playerCountry;
  const parts: string[] = [];
  for (const cost of def.costs) {
    if (cost.type !== 'adjust' || cost.target.kind !== 'country' || cost.target.id !== me) continue;
    const amount = -cost.by;
    if (amount <= 0) continue;
    parts.push(cost.target.stat === 'treasury' ? `${amount} bn` : `${amount} ${cost.target.stat}`);
  }
  return parts;
}

export function durationLabel(days: number): string {
  if (days === 0) return 'Immediate';
  if (days === 1) return '1 day';
  if (days < 30) return `About ${days} days`;
  const months = Math.round(days / 30);
  return `About ${months} ${months === 1 ? 'month' : 'months'}`;
}

/** How likely an order is to succeed, as an advisor would put it. */
export function oddsLabel(bp: number): string | null {
  if (bp >= 10_000) return null;
  if (bp >= 8_000) return 'Likely';
  if (bp >= 6_000) return 'Good odds';
  if (bp >= 4_500) return 'About even';
  return 'Long shot';
}

export function relationLabel(value: number): string {
  if (value <= -40) return 'Hostile';
  if (value <= -15) return 'Tense';
  if (value < 0) return 'Cool';
  if (value < 25) return 'Cordial';
  return 'Friendly';
}

export type Tone = 'calm' | 'warning' | 'critical';

export function relationTone(value: number): Tone {
  if (value <= -35) return 'critical';
  if (value <= -15) return 'warning';
  return 'calm';
}

export function stabilityTone(value: number, ousting: number): Tone {
  if (value < ousting + 5) return 'critical';
  if (value < 40) return 'warning';
  return 'calm';
}
