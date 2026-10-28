/**
 * The advisor: picks which tip, if any, to show. Tips come from the scenario's
 * advisor.yaml. Each appears once per game, one at a time, the first time its
 * condition holds and at least one of its suggested orders can be signed.
 *
 * Evaluating a tip never changes the game: tips cannot use chance, and the
 * state returned by `evaluate` is discarded.
 */

import type { AdvisorTip } from '@ripple/content';
import { canIssue, evaluate, type GameState } from '@ripple/engine';

export interface AdvisorState {
  readonly tips: readonly AdvisorTip[];
  /** IDs of tips already shown this game. */
  readonly shown: readonly string[];
  /** The tip on screen now. */
  readonly current: AdvisorTip | null;
}

export function newAdvisor(tips: readonly AdvisorTip[]): AdvisorState {
  return { tips, shown: [], current: null };
}

function qualifies(game: GameState, tip: AdvisorTip): boolean {
  if (!evaluate(game, tip.when).value) return false;
  if (tip.suggest.length === 0) return true;
  const me = game.rules.playerCountry;
  return tip.suggest.some((s) => canIssue(game, s.decision, me, s.target).ok);
}

/** Show the first qualifying tip not yet shown, unless one is already on screen. */
export function updateAdvisor(advisor: AdvisorState, game: GameState): AdvisorState {
  if (advisor.current || game.outcome) return advisor;
  const tip = advisor.tips.find((t) => !advisor.shown.includes(t.id) && qualifies(game, t));
  if (!tip) return advisor;
  return { ...advisor, current: tip, shown: [...advisor.shown, tip.id] };
}

export function dismissTip(advisor: AdvisorState): AdvisorState {
  return advisor.current ? { ...advisor, current: null } : advisor;
}

/** Acting on the advice (signing one of its orders, at its target) puts the tip away. */
export function afterSigning(
  advisor: AdvisorState,
  decision: string,
  target?: string,
): AdvisorState {
  const acted = advisor.current?.suggest.some(
    (s) => s.decision === decision && s.target === target,
  );
  return acted ? dismissTip(advisor) : advisor;
}
