/**
 * A scenario is the starting point of a game: the world as content authors
 * write it (lists of entities), the events and decisions available, and the
 * rules for this game. The content package validates scenarios from files;
 * the engine only needs this shape.
 */

import type { Personality } from './ai/types';
import type { TuningOverrides } from './ai/tuning';
import type { DecisionDef, EventDef } from './rules';
import {
  demandStat,
  relationId,
  shortageStat,
  stockStat,
  sortedIds,
  type Archetype,
  type Chokepoint,
  type Country,
  type Faction,
  type Link,
  type Plant,
  type Relation,
  type Resource,
  type Stats,
  type World,
} from './world';

export interface ScenarioRules {
  /** The country the player leads. */
  readonly playerCountry: string;
  /** Game length in in-game years (360 ticks each). */
  readonly lengthYears: number;
  /** The leader is ousted if this stat stays below the threshold for this many ticks. */
  readonly ousting: {
    readonly stat: string;
    readonly below: number;
    readonly forTicks: number;
  };
}

export interface CountryDef {
  readonly id: string;
  readonly name: string;
  readonly archetype: Archetype;
  readonly stats: Stats;
  readonly demand: Readonly<Record<string, number>>;
}

export type FactionDef = Faction;

export interface ResourceDef {
  readonly id: string;
  readonly name: string;
  readonly basePrice: number;
  /** Makes it a stocked resource: held in stocks, shipped with delays, priced by what is on hand. */
  readonly stocked?: { readonly coverDays: number };
}

export interface LinkDef {
  readonly id: string;
  readonly resource: string;
  readonly from: string;
  readonly to: string;
  readonly capacity: number;
  readonly via: readonly string[];
  /** Days in transit, for stocked resources. Missing: 0. */
  readonly days?: number;
}

export interface PlantDef {
  readonly id: string;
  readonly name: string;
  readonly country: string;
  readonly input?: string;
  readonly output: string;
  /** Units a day. */
  readonly capacity: number;
}

/** Starting relation between two countries. Pairs not listed start at 0. */
export interface RelationDef {
  readonly between: readonly [string, string];
  readonly value: number;
}

export interface ScenarioDef {
  readonly id: string;
  readonly name: string;
  readonly rules: ScenarioRules;
  readonly countries: readonly CountryDef[];
  readonly factions: readonly FactionDef[];
  readonly resources: readonly ResourceDef[];
  readonly links: readonly LinkDef[];
  /** Wells and refineries for stocked resources. */
  readonly plants?: readonly PlantDef[];
  readonly chokepoints: readonly Chokepoint[];
  readonly relations: readonly RelationDef[];
  readonly events: readonly EventDef[];
  readonly decisions: readonly DecisionDef[];
  /** Computer countries' personalities and tuning profiles. Missing: no country acts on its own. */
  readonly ai?: ScenarioAi;
}

export interface ScenarioAi {
  readonly personalities: Readonly<Record<string, Personality>>;
  /** Named sets of tuning knobs, such as "passive" or "aggressive". */
  readonly profiles: Readonly<Record<string, TuningOverrides>>;
  /** The profile a game uses unless told otherwise. */
  readonly defaultProfile: string;
}

export function byId<T extends { readonly id: string }>(
  kind: string,
  items: readonly T[],
): Record<string, T> {
  const out: Record<string, T> = {};
  for (const item of items) {
    if (out[item.id]) {
      throw new Error(`Duplicate ${kind} id "${item.id}"`);
    }
    out[item.id] = item;
  }
  return out;
}

function buildRelations(
  countries: Readonly<Record<string, Country>>,
  defs: readonly RelationDef[],
): Record<string, Relation> {
  const relations: Record<string, Relation> = {};
  const ids = sortedIds(countries);
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const a = ids[i]!;
      const b = ids[j]!;
      const id = relationId(a, b);
      relations[id] = { id, a, b, stats: { value: 0 } };
    }
  }
  for (const def of defs) {
    const [a, b] = def.between;
    const relation = relations[relationId(a, b)];
    if (!relation || a === b) {
      throw new Error(`Invalid relation between "${a}" and "${b}"`);
    }
    relations[relation.id] = { ...relation, stats: { value: def.value } };
  }
  return relations;
}

/**
 * A country's normal stock of a stocked resource: `coverDays` of its own daily
 * use, which is what it consumes plus what its plants use up.
 */
function normalStockOf(
  def: ScenarioDef,
  country: CountryDef,
  resource: string,
  coverDays: number,
): number {
  let use = country.demand[resource] ?? 0;
  for (const plant of def.plants ?? []) {
    if (plant.country === country.id && plant.input === resource) use += plant.capacity;
  }
  return use * coverDays;
}

export function buildWorld(def: ScenarioDef): World {
  const stocked = def.resources.filter((r) => r.stocked !== undefined);
  const stockedIds = new Set(stocked.map((r) => r.id));
  // Demand and stocks live in stats too (`demand_oil`, `stock_fuel`), so modifiers and effects can change them.
  const countries: Country[] = def.countries.map((c) => {
    const extra: Record<string, number> = {};
    for (const [resource, units] of Object.entries(c.demand)) extra[demandStat(resource)] = units;
    const normalStock: Record<string, number> = {};
    for (const r of stocked) {
      const normal = normalStockOf(def, c, r.id, r.stocked!.coverDays);
      normalStock[r.id] = normal;
      extra[stockStat(r.id)] = normal;
      extra[shortageStat(r.id)] = 0;
    }
    return { ...c, stats: { ...c.stats, ...extra }, normalStock };
  });
  const resources: Resource[] = def.resources.map((r) => {
    const base = { id: r.id, name: r.name, basePrice: r.basePrice, stats: { price: r.basePrice } };
    if (!r.stocked) return base;
    // Normal holdings: every country's normal stock, plus a full pipeline at sea.
    let normalSupply = countries.reduce((sum, c) => sum + (c.normalStock[r.id] ?? 0), 0);
    for (const l of def.links) {
      if (l.resource === r.id) normalSupply += l.capacity * (l.days ?? 0);
    }
    return { ...base, stocked: { coverDays: r.stocked.coverDays, normalSupply } };
  });
  const links: Link[] = def.links.map((l) => ({
    id: l.id,
    resource: l.resource,
    from: l.from,
    to: l.to,
    via: [...l.via],
    days: l.days ?? 0,
    // Stocked routes record what they sent each day; at the start, a full day's load.
    stats: stockedIds.has(l.resource)
      ? { capacity: l.capacity, shipped: l.capacity }
      : { capacity: l.capacity },
  }));
  const plants: Plant[] = (def.plants ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    country: p.country,
    ...(p.input !== undefined ? { input: p.input } : {}),
    output: p.output,
    stats: { capacity: p.capacity },
  }));
  const countryRecord = byId('country', countries);
  return {
    countries: countryRecord,
    factions: byId('faction', def.factions),
    resources: byId('resource', resources),
    links: byId('link', links),
    plants: byId('plant', plants),
    chokepoints: byId('chokepoint', def.chokepoints),
    relations: buildRelations(countryRecord, def.relations),
    embargoes: [],
  };
}
