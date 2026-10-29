import { decisionSystem } from './decisions';
import { economySystem } from './economy';
import { marketSystem } from './market';
import { modifierExpirySystem } from './modifiers';
import { outcomeSystem } from './outcome';
import { societySystem } from './society';
import type { System } from './types';
import { worldEventSystem } from './world-events';

/**
 * The order systems run in every tick. Order is part of the simulation's
 * definition: expire old effects, resolve decisions, fire events, clear the
 * markets, let prices reach people, settle the budget, then judge the day.
 */
export const SYSTEMS: readonly System[] = [
  modifierExpirySystem,
  decisionSystem,
  worldEventSystem,
  marketSystem,
  societySystem,
  economySystem,
  outcomeSystem,
];

export type { System, SystemResult } from './types';
export { demandOf, marketSupply, marketDemand, targetPrice } from './market';
export { pricePressure } from './society';
export {
  budgetOf,
  hasBudget,
  monthlyBalance,
  tradeItems,
  tariffStat,
  TRADE_LINES,
  MILLIONS_PER_BN,
  TRADE_CENTS_PER_MILLION,
  type TradeItem,
  type TradeLine,
} from './economy';
