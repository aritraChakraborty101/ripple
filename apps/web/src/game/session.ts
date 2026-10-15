/**
 * The running game in the browser: engine state plus everything the UI needs
 * around it (clock, dispatches, price history). React reads it through
 * useSyncExternalStore; the animation loop advances it.
 */

import {
  createGame,
  effectiveStat,
  setChokepointOpen,
  sortedIds,
  step,
  type GameState,
  type ScenarioDef,
} from '@ripple/engine';
import { advanceClock, initialClock, type ClockState, type Speed } from './clock';
import { customDispatch, dispatchesFor, initialNews, type Dispatch, type NewsState } from './news';

/** Days of price history kept for sparklines. */
export const HISTORY_DAYS = 120;
/** Dispatches kept in the feed. */
export const MAX_DISPATCHES = 50;

export interface Session {
  readonly game: GameState;
  readonly clock: ClockState;
  readonly news: NewsState;
  /** Newest first. */
  readonly dispatches: readonly Dispatch[];
  /** Effective price per resource per day, oldest first. */
  readonly history: Readonly<Record<string, readonly number[]>>;
}

function priceOf(game: GameState, resource: string): number {
  return effectiveStat(game, { kind: 'resource', id: resource, stat: 'price' });
}

function recordHistory(
  history: Session['history'],
  game: GameState,
): Readonly<Record<string, readonly number[]>> {
  const next: Record<string, readonly number[]> = {};
  for (const id of sortedIds(game.world.resources)) {
    const series = [...(history[id] ?? []), priceOf(game, id)];
    next[id] = series.length > HISTORY_DAYS ? series.slice(-HISTORY_DAYS) : series;
  }
  return next;
}

export function newSession(scenario: ScenarioDef, seed: number): Session {
  const game = createGame(scenario, seed);
  return {
    game,
    clock: initialClock,
    news: initialNews,
    dispatches: [],
    history: recordHistory({}, game),
  };
}

/** Simulate one day and collect its dispatches. */
export function tickSession(session: Session): Session {
  const result = step(session.game, []);
  const { news, dispatches } = dispatchesFor(session.news, result.events, result.state);
  return {
    ...session,
    game: result.state,
    news,
    dispatches: [...dispatches.reverse(), ...session.dispatches].slice(0, MAX_DISPATCHES),
    history: recordHistory(session.history, result.state),
  };
}

/** Advance by real elapsed time, simulating however many days are due. */
export function advanceSession(session: Session, elapsedMs: number): Session {
  const { clock, ticks } = advanceClock(session.clock, elapsedMs);
  let next: Session = clock === session.clock ? session : { ...session, clock };
  for (let i = 0; i < ticks; i += 1) {
    next = tickSession(next);
  }
  return next;
}

export function setPaused(session: Session, paused: boolean): Session {
  return { ...session, clock: { ...session.clock, paused } };
}

export function setSpeed(session: Session, speed: Speed): Session {
  return { ...session, clock: { ...session.clock, speed, paused: false } };
}

/**
 * Developer tool, temporary: open or close a chokepoint directly. Once events
 * and decisions exist, the controlling country will do this inside the game.
 */
export function devSetChokepoint(session: Session, id: string, open: boolean): Session {
  const chokepoint = session.game.world.chokepoints[id];
  if (!chokepoint || chokepoint.open === open) return session;
  const controller = session.game.world.countries[chokepoint.controlledBy];
  const tag = controller?.name ?? 'World';
  const { news, dispatch } = customDispatch(session.news, {
    tick: session.game.tick,
    tag,
    severity: open ? 'info' : 'critical',
    headline: open
      ? `${tag} reopens the ${chokepoint.name}`
      : `${tag} closes the ${chokepoint.name}`,
    detail: open
      ? 'Shipping through it resumes.'
      : 'Trade routes through it carry nothing until it reopens.',
  });
  return {
    ...session,
    game: setChokepointOpen(session.game, id, open),
    news,
    dispatches: [dispatch, ...session.dispatches].slice(0, MAX_DISPATCHES),
  };
}
