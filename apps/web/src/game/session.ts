/**
 * The running game in the browser: engine state plus everything the UI needs
 * around it (clock, dispatches, price history, a few tallies for the end
 * screen). React reads it through useSyncExternalStore; the animation loop
 * advances it.
 */

import {
  applyOrders,
  createGame,
  retune,
  type GameOptions,
  type TuningOverrides,
  effectiveStat,
  sortedIds,
  step,
  type EngineEvent,
  type GameState,
  type ScenarioDef,
} from '@ripple/engine';
import type { AdvisorTip } from '@ripple/content';
import { afterSigning, dismissTip, newAdvisor, updateAdvisor, type AdvisorState } from './advisor';
import { advanceClock, initialClock, stepSpeed, type ClockState, type Speed } from './clock';
import { brewing, brewingKey, REWARN_DAYS, type Brewing } from './intel';
import { dispatchesFor, initialNews, isAlert, type Dispatch, type NewsState } from './news';

/** Days of price history kept for sparklines. */
export const HISTORY_DAYS = 120;
/** The history key for the player's treasury (resource IDs never start with "$"). */
export const TREASURY_HISTORY = '$treasury';
/** Dispatches kept in the feed. */
export const MAX_DISPATCHES = 60;

export interface Tallies {
  /** Critical world events: strait closures, explosions, troop build-ups. */
  readonly crises: number;
  readonly ordersSigned: number;
  readonly ordersSucceeded: number;
  readonly ordersFailed: number;
}

export interface Session {
  readonly game: GameState;
  readonly clock: ClockState;
  readonly news: NewsState;
  /** Newest first. */
  readonly dispatches: readonly Dispatch[];
  /** Effective price per resource per day, oldest first, plus the treasury under `TREASURY_HISTORY`. */
  readonly history: Readonly<Record<string, readonly number[]>>;
  readonly tallies: Tallies;
  /** The player's treasury at the start, for the end-of-game summary. */
  readonly startTreasury: number;
  /** A critical world event the player has not dismissed yet, shown over the map. */
  readonly alert: Dispatch | null;
  /** Pause the clock automatically when a crisis breaks. */
  readonly autoPause: boolean;
  readonly advisor: AdvisorState;
  /** The day each intelligence warning was last given, so warnings are not repeated too often. */
  readonly warned: Readonly<Record<string, number>>;
}

function priceOf(game: GameState, resource: string): number {
  return effectiveStat(game, { kind: 'resource', id: resource, stat: 'price' });
}

function recordHistory(
  history: Session['history'],
  game: GameState,
): Readonly<Record<string, readonly number[]>> {
  const next: Record<string, readonly number[]> = {};
  const add = (key: string, value: number) => {
    const series = [...(history[key] ?? []), value];
    next[key] = series.length > HISTORY_DAYS ? series.slice(-HISTORY_DAYS) : series;
  };
  for (const id of sortedIds(game.world.resources)) add(id, priceOf(game, id));
  add(
    TREASURY_HISTORY,
    effectiveStat(game, { kind: 'country', id: game.rules.playerCountry, stat: 'treasury' }),
  );
  return next;
}

function tally(tallies: Tallies, game: GameState, events: readonly EngineEvent[]): Tallies {
  let { crises, ordersSigned, ordersSucceeded, ordersFailed } = tallies;
  for (const e of events) {
    if (e.kind === 'event_fired' && game.defs.events[e.event]?.severity === 'critical') crises += 1;
    const mine = 'by' in e && e.by === game.rules.playerCountry;
    // A computer country's critical move, such as closing the strait, is a crisis too.
    if (e.kind === 'decision_resolved' && !mine && e.success) {
      if (game.defs.decisions[e.decision]?.severity === 'critical') crises += 1;
    }
    if (e.kind === 'decision_issued' && mine) ordersSigned += 1;
    if (e.kind === 'decision_resolved' && mine) {
      if (e.success) ordersSucceeded += 1;
      else ordersFailed += 1;
    }
  }
  return { crises, ordersSigned, ordersSucceeded, ordersFailed };
}

/** Fold one batch of engine events (a day, or a signing) into the session. */
function absorb(
  session: Session,
  game: GameState,
  events: readonly EngineEvent[],
  tick?: number,
): Session {
  const { news, dispatches } = dispatchesFor(session.news, events, game, tick);
  const alert = [...dispatches].reverse().find(isAlert) ?? null;
  // The clock stops when the game ends, and on a crisis if the player asked for that.
  const stop = game.outcome !== null || (alert !== null && session.autoPause);
  return {
    ...session,
    game,
    news,
    dispatches: [...dispatches.reverse(), ...session.dispatches].slice(0, MAX_DISPATCHES),
    tallies: tally(session.tallies, game, events),
    alert: alert ?? session.alert,
    clock: stop && !session.clock.paused ? { ...session.clock, paused: true } : session.clock,
  };
}

export function newSession(
  scenario: ScenarioDef,
  seed: number,
  autoPause = true,
  tips: readonly AdvisorTip[] = [],
  options: GameOptions = {},
): Session {
  const game = createGame(scenario, seed, options);
  return {
    alert: null,
    autoPause,
    advisor: newAdvisor(tips),
    warned: {},
    game,
    clock: initialClock,
    news: initialNews,
    dispatches: [],
    history: recordHistory({}, game),
    tallies: { crises: 0, ordersSigned: 0, ordersSucceeded: 0, ordersFailed: 0 },
    startTreasury: effectiveStat(game, {
      kind: 'country',
      id: game.rules.playerCountry,
      stat: 'treasury',
    }),
  };
}

/** Simulate one day and collect its dispatches. */
function intelDispatch(game: GameState, b: Brewing): Dispatch {
  const name = game.world.countries[b.country]?.name ?? b.country;
  const imminent = b.score > b.inertia;
  return {
    id: `intel-${game.tick}-${brewingKey(b)}`,
    tick: Math.max(0, game.tick - 1),
    tag: 'Intelligence',
    severity: 'warning',
    headline: `${name} is weighing: ${b.name}`,
    detail: `${b.motive ? `Driven by ${b.motive}. ` : ''}${
      imminent ? 'It could happen any day.' : 'It is close to tipping over.'
    }`,
    source: 'intel',
    country: b.country,
    place: name,
  };
}

/** Warn about harmful moves that are close to happening, at most once per REWARN_DAYS each. */
function gatherIntel(session: Session): Session {
  const fresh = brewing(session.game).filter((b) => {
    const last = session.warned[brewingKey(b)];
    return last === undefined || session.game.tick - last >= REWARN_DAYS;
  });
  if (fresh.length === 0) return session;
  const warned = { ...session.warned };
  for (const b of fresh) warned[brewingKey(b)] = session.game.tick;
  const dispatches = fresh.map((b) => intelDispatch(session.game, b));
  return {
    ...session,
    warned,
    dispatches: [...dispatches, ...session.dispatches].slice(0, MAX_DISPATCHES),
  };
}

export function tickSession(session: Session): Session {
  const result = step(session.game, []);
  const next = absorb(session, result.state, result.events);
  return gatherIntel({
    ...next,
    history: recordHistory(session.history, result.state),
    advisor: updateAdvisor(next.advisor, result.state),
  });
}

/** Change the AI's knobs mid-game (the dev panel). The change is recorded in the game. */
export function retuneSession(session: Session, overrides: TuningOverrides): Session {
  return { ...session, game: retune(session.game, overrides) };
}

/** Advance by real elapsed time, simulating however many days are due. */
export function advanceSession(session: Session, elapsedMs: number): Session {
  if (session.game.outcome) return session;
  const { clock, ticks } = advanceClock(session.clock, elapsedMs);
  let next: Session = clock === session.clock ? session : { ...session, clock };
  // Stop early if a day paused the clock (game over, or a crisis with auto-pause).
  for (let i = 0; i < ticks && !next.game.outcome && !next.clock.paused; i += 1) {
    next = tickSession(next);
  }
  return next;
}

/**
 * Sign a decision now (aimed at `target`, for an order aimed at a country), even while paused: costs are paid at once and the
 * outcome is scheduled. Invalid orders change nothing (the UI checks first).
 */
export function issueDecision(session: Session, decision: string, target?: string): Session {
  const by = session.game.rules.playerCountry;
  const order = {
    kind: 'decide' as const,
    decision,
    by,
    ...(target !== undefined ? { target } : {}),
  };
  const result = applyOrders(session.game, [order]);
  if (result.events.every((e) => e.kind === 'order_rejected')) return session;
  const next = absorb(session, result.state, result.events, session.game.tick);
  return { ...next, advisor: afterSigning(next.advisor, decision, target) };
}

export function setPaused(session: Session, paused: boolean): Session {
  if (session.game.outcome) return session;
  return { ...session, clock: { ...session.clock, paused } };
}

export function setSpeed(session: Session, speed: Speed): Session {
  if (session.game.outcome) return session;
  return { ...session, clock: { ...session.clock, speed, paused: false } };
}

/** Changes speed without starting or stopping the clock. */
export function nudgeSpeed(session: Session, direction: 1 | -1): Session {
  const speed = stepSpeed(session.clock.speed, direction);
  if (speed === session.clock.speed) return session;
  return { ...session, clock: { ...session.clock, speed } };
}

export function dismissAlert(session: Session): Session {
  return session.alert ? { ...session, alert: null } : session;
}

export function setAutoPause(session: Session, autoPause: boolean): Session {
  return { ...session, autoPause };
}

export function dismissAdvice(session: Session): Session {
  const advisor = dismissTip(session.advisor);
  return advisor === session.advisor ? session : { ...session, advisor };
}
