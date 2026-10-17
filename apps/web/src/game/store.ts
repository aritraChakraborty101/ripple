import { useSyncExternalStore } from 'react';
import type { Speed } from './clock';
import { firstCrisis, firstCrisisGuide } from './scenario';
import {
  advanceSession,
  dismissAdvice,
  dismissAlert,
  issueDecision,
  newSession,
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

const start = (autoPause = true) =>
  newSession(firstCrisis, freshSeed(), autoPause, firstCrisisGuide.tips);

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
  pause: () => update(setPaused(session, true)),
  issue: (decision: string) => update(issueDecision(session, decision)),
  dismissAlert: () => update(dismissAlert(session)),
  dismissAdvice: () => update(dismissAdvice(session)),
  setAutoPause: (on: boolean) => update(setAutoPause(session, on)),
  newGame: () => update(start(session.autoPause)),
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
