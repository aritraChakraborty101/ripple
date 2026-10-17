/**
 * Turns the engine's cause trees into words: a label for every node, its
 * children in order of importance, and the main chain from the root cause to
 * the thing being explained ("the chain in short").
 */

import {
  explainChokepoint,
  explainEvent,
  explainStat,
  relationId,
  sourceNode,
  type GameState,
  type StatRef,
  type WhyNode,
} from '@ripple/engine';
import { formatDate, formatPrice } from './format';

/** What the player asked about. */
export type WhyTarget =
  | { readonly kind: 'stat'; readonly ref: StatRef }
  | { readonly kind: 'event'; readonly event: string; readonly tick: number }
  | { readonly kind: 'chokepoint'; readonly id: string };

export function rootOf(game: GameState, target: WhyTarget): WhyNode {
  switch (target.kind) {
    case 'stat':
      return explainStat(game, target.ref);
    case 'event':
      return { type: 'event', event: target.event, tick: target.tick };
    case 'chokepoint':
      return explainChokepoint(game, target.id);
  }
}

// ---------------------------------------------------------------- Words

const MINUS = '−';

function signed(n: number, format: (abs: number) => string = String): string {
  if (n > 0) return `+${format(n)}`;
  if (n < 0) return `${MINUS}${format(-n)}`;
  return format(0);
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function possessive(name: string): string {
  return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

function countryName(game: GameState, id: string): string {
  return game.world.countries[id]?.name ?? id;
}

export function statLabel(game: GameState, ref: StatRef): string {
  const me = game.rules.playerCountry;
  switch (ref.kind) {
    case 'country': {
      const stat = ref.stat.charAt(0).toUpperCase() + ref.stat.slice(1);
      return ref.id === me ? stat : `${possessive(countryName(game, ref.id))} ${ref.stat}`;
    }
    case 'faction': {
      const faction = game.world.factions[ref.id];
      return `${possessive(faction?.name ?? ref.id)} ${ref.stat}`;
    }
    case 'resource':
      return `${game.world.resources[ref.id]?.name ?? ref.id} ${ref.stat}`;
    case 'relation': {
      const relation = game.world.relations[ref.id];
      if (!relation) return ref.id;
      if (relation.a === me || relation.b === me) {
        return `Relations with ${countryName(game, relation.a === me ? relation.b : relation.a)}`;
      }
      return `${countryName(game, relation.a)}–${countryName(game, relation.b)} relations`;
    }
    case 'link': {
      const link = game.world.links[ref.id];
      if (!link) return ref.id;
      const resource = game.world.resources[link.resource]?.name ?? link.resource;
      return `${resource} from ${countryName(game, link.from)} to ${countryName(game, link.to)}`;
    }
  }
}

export function formatStat(ref: StatRef, value: number): string {
  if (ref.kind === 'resource' && ref.stat === 'price') return formatPrice(value);
  if (ref.stat === 'treasury') return `${value} bn`;
  if (ref.kind === 'link') return `${value} a day`;
  if (ref.kind === 'relation') return signed(value);
  return String(value);
}

/** A change in the stat's units: "−27", "+45.00", "−20 bn". */
export function formatEffect(ref: StatRef, effect: number): string {
  if (ref.kind === 'resource' && ref.stat === 'price') return signed(effect, formatPrice);
  if (ref.stat === 'treasury') return `${signed(effect)} bn`;
  if (ref.kind === 'link') return `${signed(effect)} a day`;
  return signed(effect);
}

/** How a stat compares with where it started: "+123%" for prices, "from 61" otherwise. */
export function changeNote(ref: StatRef, value: number, normal: number): string | null {
  if (value === normal) return null;
  if (ref.kind === 'resource' && ref.stat === 'price') {
    return `${signed(Math.round(((value - normal) * 100) / normal))}%`;
  }
  return `from ${formatStat(ref, normal)}`;
}

export interface NodeText {
  readonly title: string;
  /** A date, for things that happened on a day. */
  readonly when?: string;
  /** A short note beside the title. */
  readonly note?: string;
}

export function describeNode(game: GameState, node: WhyNode): NodeText {
  switch (node.type) {
    case 'stat': {
      const note = changeNote(node.ref, node.value, node.normal);
      return {
        title: `${statLabel(game, node.ref)} ${formatStat(node.ref, node.value)}`,
        ...(note ? { note } : {}),
      };
    }
    case 'mood':
      return {
        title:
          node.country === game.rules.playerCountry
            ? 'How your factions feel'
            : `How ${possessive(countryName(game, node.country))} factions feel`,
      };
    case 'pressure': {
      const faction = game.world.factions[node.faction]?.name ?? node.faction;
      return { title: `Living costs for ${faction}` };
    }
    case 'market': {
      const name = game.world.resources[node.resource]?.name ?? node.resource;
      return { title: `${name} supply ${node.supply} a day, against demand of ${node.demand}` };
    }
    case 'chokepoint': {
      const name = game.world.chokepoints[node.id]?.name ?? node.id;
      return { title: `The ${name} ${node.open ? 'is open' : 'is closed'}` };
    }
    case 'flag': {
      const policy = Object.values(game.defs.decisions).find((d) => d.policyFlag === node.flag);
      return { title: policy ? `${policy.name}: in force` : node.flag.replaceAll('_', ' ') };
    }
    case 'event':
      return {
        title: game.defs.events[node.event]?.headline ?? node.event,
        when: formatDate(node.tick),
      };
    case 'decision':
      return {
        title: `You signed: ${game.defs.decisions[node.decision]?.name ?? node.decision}`,
        when: formatDate(node.tick),
      };
    case 'start':
      return { title: 'How things stood at the start' };
    case 'system':
      return { title: 'The way the world works' };
  }
}

// ---------------------------------------------------------------- Children

export interface WhyItem {
  readonly node: WhyNode;
  /** How much this cause moved its parent, already formatted. */
  readonly effect?: string;
  /** A short qualifier, such as "until 3 May" or "scheduled". */
  readonly note?: string;
}

function significance(node: WhyNode): number {
  return node.type === 'stat'
    ? Math.abs(node.value - node.normal) / Math.max(1, Math.abs(node.normal))
    : 0;
}

/** A node's causes, most important first. Events are expanded from their recorded snapshot. */
export function childrenOf(game: GameState, node: WhyNode): WhyItem[] {
  switch (node.type) {
    case 'stat':
      return node.contributions.map((c) => {
        // Moods, living costs and markets are recalculated every day, so they have no end date.
        const ongoing = ['mood', 'pressure', 'market', 'system'].includes(c.cause.type);
        const note = ongoing
          ? undefined
          : c.untilTick !== null
            ? `until ${formatDate(c.untilTick)}`
            : c.permanent
              ? 'lasting'
              : undefined;
        return {
          node: c.cause,
          effect: formatEffect(node.ref, c.effect),
          ...(note ? { note } : {}),
        };
      });
    case 'mood':
      return node.factions.map((f) => ({
        node: f.cause,
        effect: `${signed(f.effect)} stability`,
      }));
    case 'pressure':
      return node.prices.map((p) => ({
        node: p.cause,
        note: `weighs ${Math.round(p.weightBp / 100)}% on them`,
      }));
    case 'market':
      return node.routes.map((r) => ({ node: r.cause, effect: `${signed(r.delta)} a day` }));
    case 'chokepoint':
    case 'flag': {
      const by = node.type === 'chokepoint' ? node.changedBy : node.setBy;
      return by ? [{ node: by }] : [];
    }
    case 'event': {
      const record = explainEvent(game, node.event, node.tick);
      if (!record) return [];
      const items: WhyItem[] = [];
      if (record.scheduledBy)
        items.push({ node: sourceNode(record.scheduledBy), note: 'set this in motion' });
      const because = [...record.because].sort((a, b) => significance(b) - significance(a));
      for (const b of because) items.push({ node: b, note: 'at the time' });
      return items;
    }
    default:
      return [];
  }
}

// ---------------------------------------------------------------- Main chain

/** The indexes of the most important child at each step, from the root down. */
export function mainPath(game: GameState, root: WhyNode, maxSteps = 24): number[] {
  const path: number[] = [];
  let node = root;
  for (let i = 0; i < maxSteps; i += 1) {
    const children = childrenOf(game, node);
    if (children.length === 0) break;
    path.push(0);
    node = children[0]!.node;
  }
  return path;
}

/** The nodes along the main path, from the thing asked about down to its root cause. */
export function mainNodes(game: GameState, root: WhyNode): WhyNode[] {
  const nodes = [root];
  let node = root;
  for (const index of mainPath(game, root)) {
    node = childrenOf(game, node)[index]!.node;
    nodes.push(node);
  }
  return nodes;
}

/**
 * The chain in short: root cause first, the thing asked about last. Mechanics
 * that carry the story but do not tell it (moods, living costs, the open or
 * closed state of a strait when the event that closed it is shown) are left out.
 */
export function chainInShort(game: GameState, root: WhyNode): WhyNode[] {
  return mainNodes(game, root)
    .filter((n) => n.type !== 'mood' && n.type !== 'pressure' && n.type !== 'system')
    .filter((n) => !(n.type === 'chokepoint' && n.changedBy !== null))
    .reverse();
}

/** The question the panel answers. */
export function questionFor(game: GameState, target: WhyTarget): string {
  switch (target.kind) {
    case 'stat': {
      const { ref } = target;
      const value = formatStat(ref, explainStat(game, ref, 0).value);
      const label = statLabel(game, ref);
      if (ref.kind === 'relation') return `Why are ${lowerFirst(label)} at ${value}?`;
      const mine = ref.kind === 'country' && ref.id === game.rules.playerCountry;
      const article = ref.kind === 'resource' || (mine && ref.stat === 'treasury') ? 'the ' : '';
      return `Why is ${article}${mine || ref.kind === 'resource' ? lowerFirst(label) : label} at ${value}?`;
    }
    case 'event':
      return 'Why did this happen?';
    case 'chokepoint': {
      const chokepoint = game.world.chokepoints[target.id];
      return `Why is the ${chokepoint?.name ?? target.id} ${chokepoint?.open ? 'open' : 'closed'}?`;
    }
  }
}

/** Shorthand used by callers that have a country and want the relation with the player. */
export function relationRefWith(game: GameState, country: string): StatRef {
  return { kind: 'relation', id: relationId(game.rules.playerCountry, country), stat: 'value' };
}
