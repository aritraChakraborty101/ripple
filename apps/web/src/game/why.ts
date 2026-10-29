/**
 * Turns the engine's cause trees into words: a label for every node, its
 * children in order of importance, and the main chain from the root cause to
 * the thing being explained ("the chain in short").
 */

import {
  explainChoice,
  explainChokepoint,
  explainEvent,
  parseGoalId,
  policyForFlag,
  explainStat,
  relationId,
  sourceNode,
  type GameState,
  type StatRef,
  type WhyNode,
} from '@ripple/engine';
import { fillNames, formatDate, formatMillions, formatPrice } from './format';
import type { Dispatch } from './news';

/** What the player asked about. */
export type WhyTarget =
  | { readonly kind: 'stat'; readonly ref: StatRef }
  | { readonly kind: 'event'; readonly event: string; readonly tick: number }
  | { readonly kind: 'chokepoint'; readonly id: string }
  /** A computer country's choice, on the day it chose. */
  | {
      readonly kind: 'choice';
      readonly decision: string;
      readonly country: string;
      readonly tick: number;
    };

/** What to ask about for a piece of news, if anything caused it. */
export function whyOfDispatch(d: Dispatch): WhyTarget | null {
  if (d.choice) return { kind: 'choice', ...d.choice };
  if (d.event) return { kind: 'event', event: d.event, tick: d.tick };
  return null;
}

export function rootOf(game: GameState, target: WhyTarget): WhyNode {
  switch (target.kind) {
    case 'stat':
      return explainStat(game, target.ref);
    case 'event':
      return { type: 'event', event: target.event, tick: target.tick };
    case 'chokepoint':
      return explainChokepoint(game, target.id);
    case 'choice':
      return { type: 'decision', decision: target.decision, tick: target.tick, by: target.country };
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
      if (ref.stat.startsWith('demand_')) {
        const resource = game.world.resources[ref.stat.slice('demand_'.length)]?.name ?? ref.stat;
        return ref.id === me
          ? `Your ${lowerFirst(resource)} demand`
          : `${possessive(countryName(game, ref.id))} ${lowerFirst(resource)} demand`;
      }
      if (ref.stat.startsWith('intel_')) {
        return `Your intelligence file on ${countryName(game, ref.stat.slice('intel_'.length))}`;
      }
      if (ref.stat.startsWith('tariff_')) {
        const partner = countryName(game, ref.stat.slice('tariff_'.length));
        return ref.id === me
          ? `Your tariff on ${partner}`
          : `${possessive(countryName(game, ref.id))} tariff on ${partner}`;
      }
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

/** Budget stats are counted in millions a month. */
const isBudgetStat = (ref: StatRef) =>
  ref.kind === 'country' && (ref.stat === 'revenue' || ref.stat === 'spending');

const isTariff = (ref: StatRef) => ref.kind === 'country' && ref.stat.startsWith('tariff_');
const isDemand = (ref: StatRef) => ref.kind === 'country' && ref.stat.startsWith('demand_');

export function formatStat(ref: StatRef, value: number): string {
  if (ref.kind === 'resource' && ref.stat === 'price') return formatPrice(value);
  if (isTariff(ref)) return `${Math.round(value / 100)}%`;
  if (isDemand(ref)) return `${value} a day`;
  if (isBudgetStat(ref)) return `${formatMillions(value)} a month`;
  if (ref.stat === 'treasury') return `${value} bn`;
  if (ref.kind === 'link') return `${value} a day`;
  if (ref.kind === 'relation') return signed(value);
  return String(value);
}

/** A change in the stat's units: "−27", "+45.00", "−20 bn". */
export function formatEffect(ref: StatRef, effect: number): string {
  if (ref.kind === 'resource' && ref.stat === 'price') return signed(effect, formatPrice);
  if (isBudgetStat(ref)) return `${formatMillions(effect, true)} a month`;
  if (isTariff(ref)) return `${signed(Math.round(effect / 100))}%`;
  if (isDemand(ref)) return `${signed(effect)} a day`;
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
    case 'budget': {
      const whose =
        node.country === game.rules.playerCountry
          ? 'Your monthly budget'
          : `${possessive(countryName(game, node.country))} monthly budget`;
      const months = `${node.months} ${node.months === 1 ? 'month' : 'months'}`;
      return { title: whose, note: `${signed(node.settled)} bn over ${months}` };
    }
    case 'trade': {
      const total = node.items.reduce((sum, i) => sum + i.amount, 0);
      const label =
        node.line === 'imports'
          ? 'Imports cost'
          : node.line === 'exports'
            ? 'Exports earn'
            : node.line === 'tariffs'
              ? 'Tariffs earn'
              : 'Transit tolls earn';
      return { title: `${label} ${formatMillions(total)} a month` };
    }
    case 'activity':
      return {
        title:
          node.percentBp >= 0
            ? `Business is good: taxes up ${Math.round(node.percentBp / 100)}%`
            : `Business is slow: taxes down ${Math.round(-node.percentBp / 100)}%`,
      };
    case 'debt':
      return { title: `Debt of ${node.debt} bn weighs on the government` };
    case 'chokepoint': {
      const name = game.world.chokepoints[node.id]?.name ?? node.id;
      return { title: `The ${name} ${node.open ? 'is open' : 'is closed'}` };
    }
    case 'embargo': {
      const me = game.rules.playerCountry;
      const by = node.by === me ? 'Your' : `${possessive(countryName(game, node.by))}`;
      const against = node.against === me ? 'you' : countryName(game, node.against);
      return {
        title: node.active
          ? `${by} sanctions on ${against}: no trade between them`
          : `${by} sanctions on ${against} have been lifted`,
      };
    }
    case 'flag': {
      const policy = policyForFlag(game, node.flag);
      if (!policy) return { title: node.flag.replaceAll('_', ' ') };
      const me = game.rules.playerCountry;
      const name = fillNames(policy.def.name, game.world.countries, me, policy.target);
      return { title: `${name}: in force` };
    }
    case 'event':
      return {
        title: game.defs.events[node.event]?.headline ?? node.event,
        when: formatDate(node.tick),
      };
    case 'decision': {
      const def = game.defs.decisions[node.decision];
      if (node.by === undefined || node.by === game.rules.playerCountry) {
        const name = def
          ? fillNames(def.name, game.world.countries, game.rules.playerCountry, node.target)
          : node.decision;
        return { title: `You signed: ${name}`, when: formatDate(node.tick) };
      }
      const choice = explainChoice(game, node.decision, node.tick, node.by);
      const title = def
        ? fillNames(def.successHeadline, game.world.countries, node.by, choice?.target)
        : node.decision;
      const motive = choice ? motiveText(game, choice.goals) : null;
      return {
        title,
        when: formatDate(node.tick),
        note: motive
          ? `${possessive(countryName(game, node.by))} choice: driven by ${motive}`
          : `${possessive(countryName(game, node.by))} choice`,
      };
    }
    case 'start':
      return { title: 'How things stood at the start' };
    case 'system':
      return { title: 'The way the world works' };
  }
}

/** A goal in plain words, from the acting country's point of view. */
export function goalLabel(game: GameState, goalId: string): string {
  const goal = parseGoalId(goalId);
  if (!goal) return goalId;
  const arg = goal.arg ?? '';
  switch (goal.kind) {
    case 'wealth':
      return 'money';
    case 'standing':
      return 'standing';
    case 'security':
      return 'security';
    case 'prices':
      return `dearer ${lowerFirst(game.world.resources[arg]?.name ?? arg)}`;
    case 'ties':
      return `closer ties with ${countryName(game, arg)}`;
    case 'grievance':
      return `a grudge against ${countryName(game, arg)}`;
  }
}

/** What mostly drives a score: its biggest goal in words, with how badly the country needs it. */
export function motiveText(
  game: GameState,
  goals: readonly { goal: string; need: number; part: number }[],
): string | null {
  const top = [...goals].filter((g) => g.part > 0).sort((a, b) => b.part - a.part)[0];
  if (!top) return null;
  return `${goalLabel(game, top.goal)} (need ${Math.round(top.need / 100)}%)`;
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
        const ongoing = [
          'mood',
          'pressure',
          'market',
          'system',
          'budget',
          'trade',
          'activity',
          'debt',
        ].includes(c.cause.type);
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
      // Supply and demand side by side, the largest change first.
      return [
        ...node.routes.map((r) => ({
          node: r.cause,
          effect: `${signed(r.delta)} a day`,
          size: r.delta,
        })),
        ...node.demands.map((d) => ({
          node: d.cause,
          effect: `${signed(d.delta)} a day wanted`,
          size: d.delta,
        })),
      ]
        .sort((a, b) => Math.abs(b.size) - Math.abs(a.size))
        .map(({ node: n, effect }) => ({ node: n, effect }));
    case 'budget': {
      // Whichever side moved more from its starting level leads.
      const moved = (s: typeof node.revenue) => Math.abs(s.value - s.normal);
      const sides = [node.revenue, node.spending].sort((a, b) => moved(b) - moved(a));
      return sides.map((s) => ({ node: s }));
    }
    case 'trade':
      return node.items.map((i) => {
        const name = game.world.resources[i.resource]?.name ?? i.resource;
        const from = i.partner !== undefined ? ` from ${countryName(game, i.partner)}` : '';
        return {
          node: i.cause,
          effect: `${formatMillions(i.amount)} a month`,
          note: `${i.units} a day of ${lowerFirst(name)}${from}`,
        };
      });
    case 'activity':
      return node.factions.map((f) => ({ node: f.cause, effect: `${signed(f.change)} mood` }));
    case 'debt':
      return [{ node: node.cause }];
    case 'chokepoint':
    case 'embargo':
    case 'flag': {
      const by = node.type === 'flag' ? node.setBy : node.changedBy;
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
    case 'decision': {
      if (node.by === undefined) return [];
      const record = explainChoice(game, node.decision, node.tick, node.by);
      if (!record) return [];
      return [...record.because]
        .sort((a, b) => significance(b) - significance(a))
        .map((b) => ({ node: b, note: 'at the time' }));
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
    .filter(
      (n) =>
        n.type !== 'mood' && n.type !== 'pressure' && n.type !== 'system' && n.type !== 'activity',
    )
    .filter((n) => !((n.type === 'chokepoint' || n.type === 'embargo') && n.changedBy !== null))
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
    case 'choice':
      return `Why did ${countryName(game, target.country)} do this?`;
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
