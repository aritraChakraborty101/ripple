/**
 * The why-trace: turning any number or event into the chain of causes behind it.
 *
 * Every value in the game can already say what changes it (modifiers carry
 * their source). This module follows those sources further:
 *
 *   stability 34
 *     <- factions' mood            (system modifier)
 *       <- industry satisfaction 30
 *         <- living costs           (system modifier)
 *           <- crude oil 162.83
 *             <- supply 35 a day against demand 80
 *               <- South Strait closed
 *                 <- "Corvan closes the South Strait" (event, day 213)
 *                   <- relations with Corvan -60, at the time   (recorded when it fired)
 *                     <- "Fishing dispute" (event, day 159)
 *
 * Live values are explained from the current state. Events are explained from
 * a snapshot taken the moment they fired (`FiringRecord`), because the world
 * that caused them has since moved on. Explaining never changes the game.
 */

import {
  effectiveStat,
  sameTarget,
  statBreakdown,
  type ModifierSource,
  type StatRef,
} from './modifiers';
import { evaluate, type Condition } from './rules';
import type { GameState } from './state';
import { marketDemand, marketSupply } from './systems/market';
import { MOOD_DIVISOR } from './systems/society';
import { isLinkOpen, sortedIds } from './world';

// ---------------------------------------------------------------------------
// Shapes

/** One cause of a stat's current value, and how much of the change it accounts for. */
export interface Contribution {
  /** In the stat's own units: -27 stability, +4500 cents of price. */
  readonly effect: number;
  /** For percentage modifiers, the percentage in basis points. */
  readonly percentBp?: number;
  /** A lasting change (no end date). */
  readonly permanent: boolean;
  /** The tick a temporary effect ends, or null. */
  readonly untilTick: number | null;
  readonly cause: WhyNode;
}

export interface StatWhy {
  readonly type: 'stat';
  readonly ref: StatRef;
  readonly value: number;
  /** Where the stat started (for prices, the normal price). */
  readonly normal: number;
  /** Largest effect first. */
  readonly contributions: readonly Contribution[];
  /** True when the explanation stopped early (depth limit or a loop). */
  readonly truncated?: boolean;
}

/** A country's stability moving with its factions' satisfaction. */
export interface MoodWhy {
  readonly type: 'mood';
  readonly country: string;
  readonly factions: readonly {
    readonly faction: string;
    /** Satisfaction now minus where it started. */
    readonly change: number;
    /** Resulting change in stability. */
    readonly effect: number;
    readonly cause: WhyNode;
  }[];
}

/** A faction's satisfaction falling with the prices it cares about. */
export interface PressureWhy {
  readonly type: 'pressure';
  readonly faction: string;
  readonly prices: readonly {
    readonly resource: string;
    /** How much this resource weighs on the faction, in basis points. */
    readonly weightBp: number;
    /** Percent above (or below) its normal price. */
    readonly percent: number;
    readonly cause: WhyNode;
  }[];
}

/** A market out of balance, and the routes that changed. */
export interface MarketWhy {
  readonly type: 'market';
  readonly resource: string;
  readonly supply: number;
  readonly demand: number;
  readonly routes: readonly {
    readonly link: string;
    /** Units per day now minus normal. */
    readonly delta: number;
    readonly cause: WhyNode;
  }[];
}

export interface ChokepointWhy {
  readonly type: 'chokepoint';
  readonly id: string;
  readonly open: boolean;
  readonly changedBy: WhyNode | null;
}

export interface FlagWhy {
  readonly type: 'flag';
  readonly flag: string;
  readonly setBy: WhyNode | null;
}

export type WhyNode =
  | StatWhy
  | MoodWhy
  | PressureWhy
  | MarketWhy
  | ChokepointWhy
  | FlagWhy
  /** An event that fired; expand it with `explainEvent`. */
  | { readonly type: 'event'; readonly event: string; readonly tick: number }
  /** An order the player signed. */
  | { readonly type: 'decision'; readonly decision: string; readonly tick: number }
  /** Part of the starting situation. */
  | { readonly type: 'start' }
  /** A mechanic with no further explanation. */
  | { readonly type: 'system'; readonly id: string };

/** What was true when an event fired, kept so it can be explained later. */
export interface FiringRecord {
  readonly event: string;
  readonly tick: number;
  /** Set when the event fired because something scheduled it. */
  readonly scheduledBy: ModifierSource | null;
  /** The trigger's conditions that held, explained at that moment. */
  readonly because: readonly WhyNode[];
}

/** A permanent change to a stat's base value, such as spending treasury. */
export interface Adjustment {
  readonly target: StatRef;
  readonly by: number;
  readonly source: ModifierSource;
}

/** Causal records the engine keeps while the game runs. Plain data, saved with the game. */
export interface Trace {
  readonly firings: readonly FiringRecord[];
  readonly adjustments: readonly Adjustment[];
  /** What last opened or closed each chokepoint. */
  readonly chokepointBy: Readonly<Record<string, ModifierSource>>;
  /** What set each flag that is currently set. */
  readonly flagBy: Readonly<Record<string, ModifierSource>>;
}

export const emptyTrace: Trace = { firings: [], adjustments: [], chokepointBy: {}, flagBy: {} };

/** How far a live explanation follows causes before stopping. */
export const MAX_DEPTH = 9;
/** How far the snapshot taken when an event fires goes. Older history is reached through event links. */
export const SNAPSHOT_DEPTH = 6;

// ---------------------------------------------------------------------------
// Explaining

const statKey = (ref: StatRef) => `${ref.kind}.${ref.id}.${ref.stat}`;

export function sourceNode(source: ModifierSource): WhyNode {
  switch (source.kind) {
    case 'event':
      return { type: 'event', event: source.id, tick: source.tick };
    case 'decision':
      return { type: 'decision', decision: source.id, tick: source.tick };
    case 'scenario':
      return { type: 'start' };
    case 'system':
      return { type: 'system', id: source.id };
  }
}

function adjustmentsOf(state: GameState, ref: StatRef): readonly Adjustment[] {
  return state.trace.adjustments.filter((a) => sameTarget(a.target, ref));
}

export function explainChokepoint(state: GameState, id: string): ChokepointWhy {
  const chokepoint = state.world.chokepoints[id];
  if (!chokepoint) throw new Error(`Unknown chokepoint "${id}"`);
  const by = state.trace.chokepointBy[id];
  return { type: 'chokepoint', id, open: chokepoint.open, changedBy: by ? sourceNode(by) : null };
}

function explainMarket(
  state: GameState,
  resource: string,
  depth: number,
  seen: ReadonlySet<string>,
): MarketWhy {
  const routes: { link: string; delta: number; cause: WhyNode }[] = [];
  for (const id of sortedIds(state.world.links)) {
    const link = state.world.links[id]!;
    if (link.resource !== resource) continue;
    const ref: StatRef = { kind: 'link', id, stat: 'capacity' };
    const adjusted = adjustmentsOf(state, ref).reduce((sum, a) => sum + a.by, 0);
    const normal = (link.stats.capacity ?? 0) - adjusted;
    const open = isLinkOpen(state.world, link);
    const now = open ? Math.max(0, effectiveStat(state, ref)) : 0;
    const delta = now - normal;
    if (delta === 0) continue;
    const closedAt = link.via.find((c) => state.world.chokepoints[c]?.open === false);
    const cause: WhyNode =
      !open && closedAt ? explainChokepoint(state, closedAt) : explainStat(state, ref, depth, seen);
    routes.push({ link: id, delta, cause });
  }
  routes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return {
    type: 'market',
    resource,
    supply: marketSupply(state, resource),
    demand: marketDemand(state, resource),
    routes,
  };
}

function explainSystem(
  state: GameState,
  id: string,
  ref: StatRef,
  depth: number,
  seen: ReadonlySet<string>,
): WhyNode {
  if (id === 'cost_of_living' && ref.kind === 'faction') {
    const faction = state.world.factions[ref.id]!;
    const prices: PressureWhy['prices'][number][] = [];
    for (const resource of sortedIds(faction.sensitivity)) {
      const def = state.world.resources[resource];
      if (!def) continue;
      const priceRef: StatRef = { kind: 'resource', id: resource, stat: 'price' };
      const price = effectiveStat(state, priceRef);
      const percent = Math.trunc(((price - def.basePrice) * 100) / def.basePrice);
      if (percent === 0) continue;
      prices.push({
        resource,
        weightBp: faction.sensitivity[resource] ?? 0,
        percent,
        cause: explainStat(state, priceRef, depth, seen),
      });
    }
    prices.sort((a, b) => Math.abs(b.percent * b.weightBp) - Math.abs(a.percent * a.weightBp));
    return { type: 'pressure', faction: ref.id, prices };
  }

  if (id === 'faction_mood' && ref.kind === 'country') {
    const factions: MoodWhy['factions'][number][] = [];
    for (const fid of sortedIds(state.world.factions)) {
      const faction = state.world.factions[fid]!;
      if (faction.country !== ref.id) continue;
      const satisfactionRef: StatRef = { kind: 'faction', id: fid, stat: 'satisfaction' };
      const change = effectiveStat(state, satisfactionRef) - (faction.stats.satisfaction ?? 50);
      if (change === 0) continue;
      factions.push({
        faction: fid,
        change,
        effect: Math.trunc((change * (faction.stats.power ?? 0)) / MOOD_DIVISOR),
        cause: explainStat(state, satisfactionRef, depth, seen),
      });
    }
    factions.sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));
    return { type: 'mood', country: ref.id, factions };
  }

  return { type: 'system', id };
}

/** Explain a stat's current value: where it started and every cause since. */
export function explainStat(
  state: GameState,
  ref: StatRef,
  depth: number = MAX_DEPTH,
  seen: ReadonlySet<string> = new Set(),
): StatWhy {
  const breakdown = statBreakdown(state, ref);
  const adjustments = adjustmentsOf(state, ref);
  const adjusted = adjustments.reduce((sum, a) => sum + a.by, 0);
  const resource =
    ref.kind === 'resource' && ref.stat === 'price' ? state.world.resources[ref.id] : undefined;
  const normal = resource ? resource.basePrice : breakdown.base - adjusted;

  const key = statKey(ref);
  if (depth <= 0 || seen.has(key)) {
    return {
      type: 'stat',
      ref,
      value: breakdown.value,
      normal,
      contributions: [],
      truncated: true,
    };
  }
  const next = new Set(seen).add(key);
  const contributions: Contribution[] = [];

  // Prices also move on their own as markets fall out of balance.
  if (resource) {
    const drift = breakdown.base - adjusted - resource.basePrice;
    if (drift !== 0) {
      contributions.push({
        effect: drift,
        permanent: false,
        untilTick: null,
        cause: explainMarket(state, ref.id, depth - 1, next),
      });
    }
  }

  for (const a of adjustments) {
    contributions.push({
      effect: a.by,
      permanent: true,
      untilTick: null,
      cause: sourceNode(a.source),
    });
  }

  const added =
    breakdown.base +
    breakdown.modifiers.filter((m) => m.op === 'add').reduce((sum, m) => sum + m.amount, 0);
  for (const m of breakdown.modifiers) {
    const effect = m.op === 'add' ? m.amount : Math.trunc((added * m.amount) / 10_000);
    const cause =
      m.source.kind === 'system'
        ? explainSystem(state, m.source.id, ref, depth - 1, next)
        : sourceNode(m.source);
    contributions.push({
      effect,
      ...(m.op === 'pct' ? { percentBp: m.amount } : {}),
      permanent: m.expiresAt === null,
      untilTick: m.expiresAt,
      cause,
    });
  }

  // Largest effect first; ties keep their order.
  contributions.sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));
  return { type: 'stat', ref, value: breakdown.value, normal, contributions };
}

/**
 * The conditions of a trigger that held, explained. Chance, dates and negated
 * conditions are not causes, and an open chokepoint is a precondition rather
 * than a cause, so they are left out.
 */
export function explainTrigger(
  state: GameState,
  condition: Condition,
  depth: number = SNAPSHOT_DEPTH,
): WhyNode[] {
  switch (condition.type) {
    case 'all':
      return condition.of.flatMap((c) => explainTrigger(state, c, depth));
    case 'any':
      return condition.of
        .filter((c) => evaluate(state, c).value)
        .flatMap((c) => explainTrigger(state, c, depth));
    case 'stat':
      return [explainStat(state, condition.target, depth)];
    case 'chokepoint':
      return condition.open ? [] : [explainChokepoint(state, condition.id)];
    case 'flag': {
      if (!condition.set) return [];
      const by = state.trace.flagBy[condition.flag];
      return [{ type: 'flag', flag: condition.flag, setBy: by ? sourceNode(by) : null }];
    }
    default:
      return [];
  }
}

/** Why an event fired, as recorded at the time. */
export function explainEvent(
  state: GameState,
  event: string,
  tick: number,
): FiringRecord | undefined {
  return state.trace.firings.find((f) => f.event === event && f.tick === tick);
}
