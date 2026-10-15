import { useSyncExternalStore } from 'react';
import type { Speed } from './clock';
import { firstCrisis } from './scenario';
import {
  advanceSession,
  issueDecision,
  newSession,
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

let session: Session = newSession(firstCrisis, freshSeed());
const listeners = new Set<() => void>();

function update(next: Session): void {
  if (next === session) return;
  session = next;
  for (const listener of listeners) listener();
}

export const actions = {
  togglePause: () => update(setPaused(session, !session.clock.paused)),
  setSpeed: (speed: Speed) => update(setSpeed(session, speed)),
  issue: (decision: string) => update(issueDecision(session, decision)),
  newGame: () => update(newSession(firstCrisis, freshSeed())),
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
