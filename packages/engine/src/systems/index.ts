import { decisionSystem } from './decisions';
import { marketSystem } from './market';
import { modifierExpirySystem } from './modifiers';
import { outcomeSystem } from './outcome';
import { societySystem } from './society';
import type { System } from './types';
import { worldEventSystem } from './world-events';

/**
 * The order systems run in every tick. Order is part of the simulation's
 * definition: expire old effects, resolve decisions, fire events, clear the
 * markets, let prices reach people, then judge the day.
 */
export const SYSTEMS: readonly System[] = [
  modifierExpirySystem,
  decisionSystem,
  worldEventSystem,
  marketSystem,
  societySystem,
  outcomeSystem,
];

export type { System, SystemResult } from './types';
export { marketSupply, marketDemand, targetPrice } from './market';
export { pricePressure } from './society';
