import { marketSystem } from './market';
import { modifierExpirySystem } from './modifiers';
import type { System } from './types';

/** The order systems run in every tick. Order is part of the simulation's definition. */
export const SYSTEMS: readonly System[] = [modifierExpirySystem, marketSystem];

export type { System, SystemResult } from './types';
export { marketSupply, marketDemand, targetPrice } from './market';
