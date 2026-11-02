/**
 * The cabinet: the player's orders filed by ministry, and which of them can
 * be signed right now. Plain logic; components only render it.
 */

import {
  canIssue,
  isFor,
  targetsOf,
  type DecisionDef,
  type GameState,
  type Ministry,
} from '@ripple/engine';
import { isUndo, playerDecisions } from './describe';

export const MINISTRIES: readonly { id: Ministry; label: string; brief: string }[] = [
  { id: 'foreign', label: 'Foreign', brief: 'Envoys, aid and treaties' },
  { id: 'trade', label: 'Trade', brief: 'Deals, tariffs and sanctions' },
  { id: 'treasury', label: 'Treasury', brief: 'Taxes, spending and reserves' },
  { id: 'interior', label: 'Interior', brief: 'Keeping the country calm' },
  { id: 'intelligence', label: 'Intelligence', brief: 'Files, broadcasts and covert work' },
];

/** Orders with no ministry (a scenario that never filed them) go here. */
export const UNFILED: Ministry = 'interior';

export function ministryOf(def: DecisionDef): Ministry {
  return def.ministry ?? UNFILED;
}

/** The countries an order could be aimed at right now. Empty for orders not aimed at anyone. */
export function openTargets(game: GameState, def: DecisionDef): string[] {
  if (def.targets === undefined) return [];
  const me = game.rules.playerCountry;
  return targetsOf(game, def, me).filter(
    (t): t is string => t !== undefined && canIssue(game, def.id, me, t).ok,
  );
}

/** Whether the order can be signed now: at once, or at some country. */
export function canSign(game: GameState, def: DecisionDef): boolean {
  if (def.targets !== undefined) return openTargets(game, def).length > 0;
  return canIssue(game, def.id, game.rules.playerCountry).ok;
}

export interface CabinetFile {
  readonly ministry: (typeof MINISTRIES)[number];
  readonly orders: readonly DecisionDef[];
  /** How many of them can be signed now. */
  readonly ready: number;
}

/**
 * The player's orders by ministry. Undo templates (lift a tariff, end a deal)
 * are listed whenever they apply somewhere.
 */
export function cabinet(game: GameState): CabinetFile[] {
  const me = game.rules.playerCountry;
  const listed = new Set(playerDecisions(game).map((d) => d.id));
  const all = Object.keys(game.defs.decisions)
    .sort()
    .map((id) => game.defs.decisions[id]!)
    .filter((def) => isFor(game, def, me))
    .filter(
      (def) => listed.has(def.id) || (isUndo(game, def) && openTargets(game, def).length > 0),
    );
  return MINISTRIES.map((ministry) => {
    const orders = all.filter((def) => ministryOf(def) === ministry.id);
    return { ministry, orders, ready: orders.filter((def) => canSign(game, def)).length };
  });
}

/** Orders the player could sign right now, across the cabinet. */
export function readyCount(game: GameState): number {
  return cabinet(game).reduce((sum, file) => sum + file.ready, 0);
}
