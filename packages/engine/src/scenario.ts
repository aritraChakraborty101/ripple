/**
 * A scenario is the starting point of a game: the world as content authors
 * write it (lists of entities), the events and decisions available, and the
 * rules for this game. The content package validates scenarios from files;
 * the engine only needs this shape.
 */

import type { DecisionDef, EventDef } from './rules';
import {
  relationId,
  sortedIds,
  type Archetype,
  type Chokepoint,
  type Country,
  type Faction,
  type Link,
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
}

export interface LinkDef {
  readonly id: string;
  readonly resource: string;
  readonly from: string;
  readonly to: string;
  readonly capacity: number;
  readonly via: readonly string[];
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
  readonly chokepoints: readonly Chokepoint[];
  readonly relations: readonly RelationDef[];
  readonly events: readonly EventDef[];
  readonly decisions: readonly DecisionDef[];
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

export function buildWorld(def: ScenarioDef): World {
  const countries: Country[] = def.countries.map((c) => ({ ...c }));
  const resources: Resource[] = def.resources.map((r) => ({
    id: r.id,
    name: r.name,
    basePrice: r.basePrice,
    stats: { price: r.basePrice },
  }));
  const links: Link[] = def.links.map((l) => ({
    id: l.id,
    resource: l.resource,
    from: l.from,
    to: l.to,
    via: [...l.via],
    stats: { capacity: l.capacity },
  }));
  const countryRecord = byId('country', countries);
  return {
    countries: countryRecord,
    factions: byId('faction', def.factions),
    resources: byId('resource', resources),
    links: byId('link', links),
    chokepoints: byId('chokepoint', def.chokepoints),
    relations: buildRelations(countryRecord, def.relations),
  };
}
