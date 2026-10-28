import { DAYS_PER_MONTH } from '../calendar';
import type { EngineEvent } from '../events';
import { effectiveStat, setSystemModifier, type StatRef } from '../modifiers';
import type { Budget, GameState } from '../state';
import { isLinkOpen, setBaseStat, sortedIds } from '../world';
import type { ActivityWhy, BudgetWhy, DebtWhy, TradeWhy, WhyNode } from '../why';
import type { System } from './types';

/**
 * Money in the budget is counted in millions a month, so that small lines
 * (a 0.4 bn subsidy, a 10% rise in the grain bill) still register. The
 * treasury stays in whole billions; what does not make a whole billion is
 * carried to the next month.
 */
export const MILLIONS_PER_BN = 1_000;

/**
 * How trade turns into money: this many cents of goods moving every day is
 * worth one million a month. Tuned so Aldoria's normal oil bill is about
 * 8.3 bn a month.
 */
export const TRADE_CENTS_PER_MILLION = 35;

/** Tax revenue moves this many basis points per point of power-weighted faction satisfaction. */
export const ACTIVITY_BP_PER_POINT = 50;

/** Debt weighs on stability: this much at once, plus one point per this many bn of debt... */
export const DEBT_STABILITY_BASE = 3;
export const DEBT_BN_PER_STABILITY = 10;
/** ...up to this much. */
export const DEBT_STABILITY_MAX = 15;
/** And on influence, the same way at half the rate. */
export const DEBT_INFLUENCE_BASE = 2;
export const DEBT_BN_PER_INFLUENCE = 20;
export const DEBT_INFLUENCE_MAX = 10;

export type TradeLine = 'imports' | 'exports' | 'transit';

/** Which budget stat each system-kept line sits on. */
const LINE_STAT: Record<TradeLine | 'activity', 'revenue' | 'spending'> = {
  imports: 'spending',
  exports: 'revenue',
  transit: 'revenue',
  activity: 'revenue',
};

export const EMPTY_BUDGET: Budget = { accrued: 0, settled: 0, months: 0, lastMonth: null };

/** Only countries that declare a `revenue` stat keep a budget. */
export function hasBudget(state: GameState, country: string): boolean {
  return state.world.countries[country]?.stats.revenue !== undefined;
}

export function budgetOf(state: GameState, country: string): Budget {
  return state.budgets[country] ?? EMPTY_BUDGET;
}

const statRef = (country: string, stat: string): StatRef => ({
  kind: 'country',
  id: country,
  stat,
});

function price(state: GameState, resource: string): number {
  return effectiveStat(state, { kind: 'resource', id: resource, stat: 'price' });
}

/** Millions a month for `units` a day at `cents` each. */
function monthly(units: number, cents: number): number {
  return Math.trunc((units * cents) / TRADE_CENTS_PER_MILLION);
}

export interface TradeItem {
  readonly resource: string;
  /** Units a day. */
  readonly units: number;
  /** Millions a month. */
  readonly amount: number;
}

/**
 * One trade line for a country, resource by resource:
 *   - imports: everything it consumes, at the market price (shortages are bought dear elsewhere);
 *   - exports: what its open routes carry out, at the market price;
 *   - transit: a toll on what passes through chokepoints it holds.
 */
export function tradeItems(state: GameState, country: string, line: TradeLine): TradeItem[] {
  const units: Record<string, number> = {};
  const tollAmount: Record<string, number> = {};
  if (line === 'imports') {
    const demand = state.world.countries[country]?.demand ?? {};
    for (const resource of sortedIds(demand)) units[resource] = demand[resource] ?? 0;
  } else {
    for (const id of sortedIds(state.world.links)) {
      const link = state.world.links[id]!;
      if (!isLinkOpen(state.world, link)) continue;
      const carried = Math.max(0, effectiveStat(state, { kind: 'link', id, stat: 'capacity' }));
      if (carried === 0) continue;
      if (line === 'exports' && link.from === country) {
        units[link.resource] = (units[link.resource] ?? 0) + carried;
      }
      if (line === 'transit') {
        for (const c of link.via) {
          const chokepoint = state.world.chokepoints[c];
          if (chokepoint?.controlledBy !== country || !chokepoint.tollBp) continue;
          units[link.resource] = (units[link.resource] ?? 0) + carried;
          tollAmount[link.resource] =
            (tollAmount[link.resource] ?? 0) +
            Math.trunc(
              (monthly(carried, price(state, link.resource)) * chokepoint.tollBp) / 10_000,
            );
        }
      }
    }
  }
  const items: TradeItem[] = [];
  for (const resource of sortedIds(units)) {
    const u = units[resource]!;
    if (u === 0) continue;
    const amount =
      line === 'transit' ? (tollAmount[resource] ?? 0) : monthly(u, price(state, resource));
    items.push({ resource, units: u, amount });
  }
  return items;
}

function tradeTotal(state: GameState, country: string, line: TradeLine): number {
  return tradeItems(state, country, line).reduce((sum, i) => sum + i.amount, 0);
}

/** Power-weighted change in a country's factions' satisfaction since the start. */
function activityChange(state: GameState, country: string): number {
  let weighted = 0;
  let power = 0;
  for (const id of sortedIds(state.world.factions)) {
    const faction = state.world.factions[id]!;
    if (faction.country !== country) continue;
    const p = faction.stats.power ?? 0;
    const base = faction.stats.satisfaction ?? 50;
    weighted += (effectiveStat(state, { kind: 'faction', id, stat: 'satisfaction' }) - base) * p;
    power += p;
  }
  return power === 0 ? 0 : Math.trunc(weighted / power);
}

function activityAmount(state: GameState, country: string): number {
  const taxes = state.world.countries[country]?.stats.revenue ?? 0;
  return Math.trunc((taxes * activityChange(state, country) * ACTIVITY_BP_PER_POINT) / 10_000);
}

/** The amount a system modifier currently holds on a stat, or 0. */
function kept(state: GameState, systemId: string, target: StatRef): number {
  const m = state.modifiers.find(
    (x) =>
      x.source.kind === 'system' &&
      x.source.id === systemId &&
      x.target.kind === target.kind &&
      x.target.id === target.id &&
      x.target.stat === target.stat,
  );
  return m?.amount ?? 0;
}

/** The line the system would keep on a budget stat today. */
function freshLine(state: GameState, country: string, line: TradeLine | 'activity'): number {
  return line === 'activity' ? activityAmount(state, country) : tradeTotal(state, country, line);
}

/**
 * This month's rate: revenue minus spending, in millions a month. Trade lines
 * are recalculated from today's prices and routes, so the answer is right even
 * before the economy has run (on day 0, or right after an order).
 */
export function monthlyBalance(state: GameState, country: string): number {
  let balance =
    effectiveStat(state, statRef(country, 'revenue')) -
    effectiveStat(state, statRef(country, 'spending'));
  for (const line of ['imports', 'exports', 'transit', 'activity'] as const) {
    const ref = statRef(country, LINE_STAT[line]);
    const sign = LINE_STAT[line] === 'revenue' ? 1 : -1;
    balance += sign * (freshLine(state, country, line) - kept(state, line, ref));
  }
  return balance;
}

export function debtPenalty(debt: number, base: number, per: number, max: number): number {
  return debt <= 0 ? 0 : -Math.min(max, base + Math.trunc(debt / per));
}

/** A treasury as the scenario started it: no budget settled into it, no adjustments. */
function startingTreasury(state: GameState, country: string): number {
  const base = state.world.countries[country]?.stats.treasury ?? 0;
  return (
    base - sumAdjustments(state, statRef(country, 'treasury')) - budgetOf(state, country).settled
  );
}

/**
 * Money: every country with a budget earns and spends every day, and settles
 * the month into its treasury on the last day of each month.
 *
 *   1. Trade lines are system modifiers on `revenue` and `spending`, recalculated
 *      daily from prices and routes: imports, exports and transit tolls. Taxes
 *      follow the factions' mood ("activity").
 *   2. Each day accrues revenue minus spending; month end pays whole billions
 *      into the treasury and carries the rest.
 *   3. A treasury below zero is debt, which weighs on stability and influence.
 *
 * Policies add their own modifiers to `revenue` or `spending` (a tariff, a
 * subsidy), so they show up in the budget and the why-trace like any other line.
 */
export const economySystem: System = {
  name: 'economy',
  run(state) {
    let current = state;
    const events: EngineEvent[] = [];
    const monthEnd = (state.tick + 1) % DAYS_PER_MONTH === 0;

    for (const country of sortedIds(state.world.countries)) {
      if (!hasBudget(current, country)) continue;

      for (const line of ['imports', 'exports', 'transit'] as const) {
        current = setSystemModifier(
          current,
          line,
          statRef(country, LINE_STAT[line]),
          tradeTotal(current, country, line),
        );
      }
      current = setSystemModifier(
        current,
        'activity',
        statRef(country, 'revenue'),
        activityAmount(current, country),
      );

      const before = budgetOf(current, country);
      let budget: Budget = {
        ...before,
        accrued: before.accrued + monthlyBalance(current, country),
      };
      if (monthEnd) {
        const millions = Math.trunc(budget.accrued / DAYS_PER_MONTH);
        const bn = Math.trunc(millions / MILLIONS_PER_BN);
        budget = {
          accrued: budget.accrued - bn * MILLIONS_PER_BN * DAYS_PER_MONTH,
          settled: budget.settled + bn,
          months: budget.months + 1,
          lastMonth: millions,
        };
        if (bn !== 0) {
          const treasury = current.world.countries[country]!.stats.treasury ?? 0;
          current = {
            ...current,
            world: setBaseStat(current.world, 'country', country, 'treasury', treasury + bn),
          };
        }
        events.push({ kind: 'budget_settled', tick: state.tick, country, millions, bn });
      }
      current = { ...current, budgets: { ...current.budgets, [country]: budget } };

      const debt = -effectiveStat(current, statRef(country, 'treasury'));
      current = setSystemModifier(
        current,
        'fiscal_stress',
        statRef(country, 'stability'),
        debtPenalty(debt, DEBT_STABILITY_BASE, DEBT_BN_PER_STABILITY, DEBT_STABILITY_MAX),
      );
      current = setSystemModifier(
        current,
        'fiscal_stress',
        statRef(country, 'influence'),
        debtPenalty(debt, DEBT_INFLUENCE_BASE, DEBT_BN_PER_INFLUENCE, DEBT_INFLUENCE_MAX),
      );
    }

    return { state: current, events };
  },

  modifierIds: ['imports', 'exports', 'transit', 'activity', 'fiscal_stress'],

  /**
   * A treasury's normal is where it started. Spending and one-off gains are
   * adjustments the why-trace already lists; the budget is the drift on top.
   */
  normalOf(state, ref) {
    if (ref.kind !== 'country' || ref.stat !== 'treasury' || !hasBudget(state, ref.id)) {
      return undefined;
    }
    return startingTreasury(state, ref.id);
  },

  explain(state, request, context): WhyNode {
    const { ref } = request;
    const country = ref.id;

    if (request.kind === 'drift') {
      const budget = budgetOf(state, country);
      const why: BudgetWhy = {
        type: 'budget',
        country,
        settled: budget.settled,
        months: budget.months,
        revenue: context.explainStat(statRef(country, 'revenue')),
        spending: context.explainStat(statRef(country, 'spending')),
      };
      return why;
    }

    switch (request.id) {
      case 'imports':
      case 'exports':
      case 'transit': {
        const why: TradeWhy = {
          type: 'trade',
          country,
          line: request.id,
          items: tradeItems(state, country, request.id)
            .sort((a, b) => b.amount - a.amount)
            .map((item) => ({
              ...item,
              cause: context.explainStat({ kind: 'resource', id: item.resource, stat: 'price' }),
            })),
        };
        return why;
      }
      case 'activity': {
        const factions: ActivityWhy['factions'][number][] = [];
        for (const id of sortedIds(state.world.factions)) {
          const faction = state.world.factions[id]!;
          if (faction.country !== country) continue;
          const satisfactionRef = { kind: 'faction' as const, id, stat: 'satisfaction' };
          const change = effectiveStat(state, satisfactionRef) - (faction.stats.satisfaction ?? 50);
          if (change === 0) continue;
          factions.push({ faction: id, change, cause: context.explainStat(satisfactionRef) });
        }
        factions.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
        const why: ActivityWhy = {
          type: 'activity',
          country,
          percentBp: activityChange(state, country) * ACTIVITY_BP_PER_POINT,
          factions,
        };
        return why;
      }
      case 'fiscal_stress': {
        const treasury = context.explainStat(statRef(country, 'treasury'));
        const why: DebtWhy = {
          type: 'debt',
          country,
          debt: Math.max(0, -treasury.value),
          cause: treasury,
        };
        return why;
      }
      default:
        return { type: 'system', id: 'economy' };
    }
  },
};

function sumAdjustments(state: GameState, ref: StatRef): number {
  return state.trace.adjustments
    .filter(
      (a) => a.target.kind === ref.kind && a.target.id === ref.id && a.target.stat === ref.stat,
    )
    .reduce((sum, a) => sum + a.by, 0);
}
