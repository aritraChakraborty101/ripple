import { createContext, useContext } from 'react';
import type { WhyTarget } from '../game/why';

/** Lets any component open the why-trace for a number, event or strait. */
export const WhyContext = createContext<(target: WhyTarget) => void>(() => {});

export function useWhy(): (target: WhyTarget) => void {
  return useContext(WhyContext);
}
