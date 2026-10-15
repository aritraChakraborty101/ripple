/**
 * A scenario is the starting point of a game: the world as content authors
 * write it (lists of entities) plus the rules for this game. The content
 * package validates scenarios from files; the engine only needs this shape.
 */

import type {
  Archetype,
  Chokepoint,
  Country,
  Faction,
  Link,
  Resource,
  Stats,
  World,
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

export interface ScenarioDef {
  readonly id: string;
  readonly name: string;
  readonly rules: ScenarioRules;
  readonly countries: readonly CountryDef[];
  readonly factions: readonly Faction[];
  readonly resources: readonly ResourceDef[];
  readonly links: readonly LinkDef[];
  readonly chokepoints: readonly Chokepoint[];
}

function byId<T extends { readonly id: string }>(
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
  return {
    countries: byId('country', countries),
    factions: byId('faction', def.factions),
    resources: byId('resource', resources),
    links: byId('link', links),
    chokepoints: byId('chokepoint', def.chokepoints),
  };
}
