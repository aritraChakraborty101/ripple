/**
 * The world model: entities with open-ended stats.
 *
 * Stats are plain integer maps rather than fixed fields, so content can add
 * new stats (food_security, media_freedom, ...) without engine changes.
 * Everything is keyed by stable string IDs and iterated in sorted order.
 */

export type Stats = Readonly<Record<string, number>>;

export type Archetype =
  'industrial_importer' | 'resource_exporter' | 'transit_state' | 'rising_power';

export interface Country {
  readonly id: string;
  readonly name: string;
  readonly archetype: Archetype;
  readonly stats: Stats;
  /** Units of each resource this country imports per day. */
  readonly demand: Readonly<Record<string, number>>;
}

/**
 * A group inside a country with its own demands, such as industry or workers.
 * `stats.satisfaction` (0 to 100) and `stats.power` (how much it moves stability).
 */
export interface Faction {
  readonly id: string;
  readonly name: string;
  readonly country: string;
  readonly stats: Stats;
  /**
   * How much each resource's price weighs on this faction, in basis points
   * summing to at most 10000. Workers feel grain; industry feels oil and steel.
   */
  readonly sensitivity: Readonly<Record<string, number>>;
}

/**
 * How two countries regard each other, from -100 (hostile) to 100 (allied).
 * One entity per unordered pair, so modifiers and the why-trace work on it.
 */
export interface Relation {
  readonly id: string;
  readonly a: string;
  readonly b: string;
  /** `stats.value` is the relation score. */
  readonly stats: Stats;
}

/** The stable ID of the relation between two countries, in either order. */
export function relationId(a: string, b: string): string {
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}

/** A tradable commodity. `stats.price` is the market price in cents. */
export interface Resource {
  readonly id: string;
  readonly name: string;
  /** Price in cents when supply equals demand. */
  readonly basePrice: number;
  readonly stats: Stats;
}

/** A trade route carrying one resource. `stats.capacity` is units per day. */
export interface Link {
  readonly id: string;
  readonly resource: string;
  readonly from: string;
  readonly to: string;
  /** Chokepoints this route passes through; if any is closed, the route carries nothing. */
  readonly via: readonly string[];
  readonly stats: Stats;
}

/** A strait, canal or pass that a country can close. */
export interface Chokepoint {
  readonly id: string;
  readonly name: string;
  readonly controlledBy: string;
  readonly open: boolean;
  /** The toll its holder takes on goods passing through, in basis points of their value. */
  readonly tollBp?: number;
}

export interface World {
  readonly countries: Readonly<Record<string, Country>>;
  readonly factions: Readonly<Record<string, Faction>>;
  readonly resources: Readonly<Record<string, Resource>>;
  readonly links: Readonly<Record<string, Link>>;
  readonly chokepoints: Readonly<Record<string, Chokepoint>>;
  readonly relations: Readonly<Record<string, Relation>>;
}

/** Entity kinds that carry stats, and so can be targeted by modifiers. */
export type StatEntityKind = 'country' | 'faction' | 'resource' | 'link' | 'relation';

const COLLECTION: Record<StatEntityKind, keyof World> = {
  country: 'countries',
  faction: 'factions',
  resource: 'resources',
  link: 'links',
  relation: 'relations',
};

/** Keys of a record in a stable order. Never iterate entities any other way. */
export function sortedIds(record: Readonly<Record<string, unknown>>): string[] {
  return Object.keys(record).sort();
}

export function getStatEntity(
  world: World,
  kind: StatEntityKind,
  id: string,
): { readonly stats: Stats } {
  const collection = world[COLLECTION[kind]] as Readonly<Record<string, { readonly stats: Stats }>>;
  const entity = collection[id];
  if (!entity) {
    throw new Error(`Unknown ${kind} "${id}"`);
  }
  return entity;
}

/** Return a new world with one stat's base value replaced. */
export function setBaseStat(
  world: World,
  kind: StatEntityKind,
  id: string,
  stat: string,
  value: number,
): World {
  if (!Number.isInteger(value)) {
    throw new Error(`Stat values must be integers, got ${value} for ${kind}.${id}.${stat}`);
  }
  const key = COLLECTION[kind];
  const collection = world[key] as Readonly<Record<string, { readonly stats: Stats }>>;
  const entity = getStatEntity(world, kind, id);
  return {
    ...world,
    [key]: { ...collection, [id]: { ...entity, stats: { ...entity.stats, [stat]: value } } },
  };
}

/** True if a link can carry goods: every chokepoint it passes through is open. */
export function isLinkOpen(world: World, link: Link): boolean {
  return link.via.every((id) => world.chokepoints[id]?.open === true);
}
