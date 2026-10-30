import { useSyncExternalStore } from 'react';
import type { TuningOverrides } from '@ripple/engine';
import type { Speed } from './clock';
import { firstCrisis, firstCrisisGuide } from './scenario';
import {
  advanceSession,
  dismissAdvice,
  dismissAlert,
  issueDecision,
  nudgeSpeed,
  newSession,
  retuneSession,
  setAutoPause,
  setPaused,
  setSpeed,
  type Session,
} from './session';

/**
 * A new random seed per game. Randomness is fine here: the seed is chosen
 * outside the engine, and everything after it is deterministic.
 */
function freshSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

/** The seed from the address for the first game, then fresh ones. */
function takeSeed(): number {
  const seed = firstSeed ?? freshSeed();
  firstSeed = null;
  return seed;
}

/**
 * Options read from the address: `?dev` opens the AI dev panel, `?ai=aggressive`
 * picks a profile, `?seed=5` replays one world (the first game only).
 */
function readParams(): { dev: boolean; profile: string | null; seed: number | null } {
  if (typeof window === 'undefined') return { dev: false, profile: null, seed: null };
  const params = new URLSearchParams(window.location.search);
  const profile = params.get('ai');
  const known = profile !== null && firstCrisis.ai?.profiles[profile] !== undefined;
  const seed = Number(params.get('seed'));
  return {
    dev: params.has('dev'),
    profile: known ? profile : null,
    seed: params.has('seed') && Number.isInteger(seed) && seed >= 0 ? seed : null,
  };
}

const params = readParams();

/** Whether the AI dev panel is available (`?dev` in the address). */
export const devMode = params.dev;
/** The tuning profiles the scenario offers. */
export const aiProfiles: readonly string[] = Object.keys(firstCrisis.ai?.profiles ?? {}).sort();
let profile: string | null = params.profile;
let firstSeed: number | null = params.seed;
/** The profile the current game uses: the one chosen, or the scenario's default. */
export function currentProfile(): string {
  return profile ?? firstCrisis.ai?.defaultProfile ?? 'standard';
}

const start = (autoPause = true) =>
  newSession(
    firstCrisis,
    takeSeed(),
    autoPause,
    firstCrisisGuide.tips,
    profile ? { aiProfile: profile } : {},
  );

let session: Session = start();
const listeners = new Set<() => void>();

function update(next: Session): void {
  if (next === session) return;
  session = next;
  for (const listener of listeners) listener();
}

export const actions = {
  /** Resuming also clears the crisis banner: the player has seen it. */
  togglePause: () => {
    const resuming = session.clock.paused;
    const next = setPaused(session, !session.clock.paused);
    update(resuming ? dismissAlert(next) : next);
  },
  setSpeed: (speed: Speed) => update(dismissAlert(setSpeed(session, speed))),
  faster: () => update(nudgeSpeed(session, 1)),
  slower: () => update(nudgeSpeed(session, -1)),
  pause: () => update(setPaused(session, true)),
  issue: (decision: string, target?: string) => update(issueDecision(session, decision, target)),
  dismissAlert: () => update(dismissAlert(session)),
  dismissAdvice: () => update(dismissAdvice(session)),
  setAutoPause: (on: boolean) => update(setAutoPause(session, on)),
  newGame: () => update(start(session.autoPause)),
  /** Start a new game with another tuning profile (the dev panel). */
  newGameWithProfile: (name: string) => {
    profile = name;
    update(start(session.autoPause));
  },
  /** Change the AI's knobs for the rest of this game (the dev panel). */
  retune: (overrides: TuningOverrides) => update(retuneSession(session, overrides)),
};

let frame = 0;
let last = 0;

/** Start the real-time loop. Returns a function that stops it. */
export function startLoop(): () => void {
  const loop = (now: number) => {
    if (last !== 0) {
      const next = advanceSession(session, now - last);
      // Between days only the clock's carry changes; store it without re-rendering.
      if (next.game === session.game) session = next;
      else update(next);
    }
    last = now;
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);
  return () => {
    cancelAnimationFrame(frame);
    last = 0;
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSession(): Session {
  return useSyncExternalStore(subscribe, () => session);
}
