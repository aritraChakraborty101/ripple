import { loadBuiltInScenario } from '@ripple/content/node';
import type { GameState, WhyNode } from '@ripple/engine';
import { describe, expect, it } from 'vitest';
import { newSession, tickSession, type Session } from '../src/game/session';
import {
  chainInShort,
  childrenOf,
  describeNode,
  formatEffect,
  formatStat,
  questionFor,
  relationRefWith,
  rootOf,
  whyOfDispatch,
  type WhyTarget,
} from '../src/game/why';

const scenario = loadBuiltInScenario('first-crisis');

function playTo(seed: number, tick: number): Session {
  let session = newSession(scenario, seed);
  while (session.game.tick < tick && !session.game.outcome) session = tickSession(session);
  return session;
}

// The golden game: by day 470 Corvan has chosen to close the strait and
// stability has collapsed. Played once and shared, since it takes a moment.
const session = playTo(3, 470);
const game: GameState = session.game;
const me = game.rules.playerCountry;
const stability: WhyTarget = {
  kind: 'stat',
  ref: { kind: 'country', id: me, stat: 'stability' },
};

function titles(nodes: readonly WhyNode[]): string[] {
  return nodes.map((n) => describeNode(game, n).title);
}

describe('why-trace labels', () => {
  it('asks the question in plain words', () => {
    expect(questionFor(game, stability)).toMatch(/^Why is stability at \d+\?$/);
    const relation: WhyTarget = { kind: 'stat', ref: relationRefWith(game, 'corvan') };
    expect(questionFor(game, relation)).toMatch(/^Why are relations with Corvan at /);
  });

  it('formats prices as money and effects with a sign', () => {
    const price = { kind: 'resource', id: 'oil', stat: 'price' } as const;
    expect(formatStat(price, 16_490)).toBe('164.90');
    expect(formatEffect(stability.ref, -12)).toBe('−12');
    expect(formatEffect(stability.ref, 5)).toBe('+5');
  });
});

describe('why-trace chain', () => {
  const chain = chainInShort(game, rootOf(game, stability));
  const steps = titles(chain);

  it('starts at the root cause and ends at the question', () => {
    // The root cause has nothing further behind it: here, Corvan and Thessa's old friendship.
    expect(childrenOf(game, chain[0]!)).toEqual([]);
    expect(chain.at(-1)!.type).toBe('stat');
    expect(steps.at(-1)).toMatch(/^Stability/);
  });

  it('runs from Thessa courting Corvan through the strait and the oil price', () => {
    const joined = steps.join(' → ');
    const order = [
      /Thessa offers Corvan a security pact/,
      /Nationalist rallies in Corvan/,
      /South Strait/,
      /Crude oil price/,
      /Stability/,
    ];
    let from = 0;
    for (const pattern of order) {
      const match = joined.slice(from).search(pattern);
      expect(match, `${pattern} after position ${from} in: ${joined}`).toBeGreaterThanOrEqual(0);
      from += match + 1;
    }
  });

  it('passes through Corvan choosing to close the strait, and says why', () => {
    const choice = chain.find((n) => n.type === 'decision' && n.by === 'corvan');
    expect(choice).toBeDefined();
    const text = describeNode(game, choice!);
    expect(text.title).toBe('Corvan closes the South Strait to shipping');
    expect(text.note).toMatch(/^Corvan's choice: driven by /);
    expect(childrenOf(game, choice!).length).toBeGreaterThan(0);
  });

  it('leaves out the bookkeeping steps', () => {
    for (const node of chain) {
      expect(['mood', 'pressure', 'system']).not.toContain(node.type);
    }
  });

  it('gives every contribution a readable title', () => {
    for (const item of childrenOf(game, rootOf(game, stability))) {
      expect(describeNode(game, item.node).title.length).toBeGreaterThan(0);
    }
  });
});

describe('why-trace for the treasury', () => {
  const treasury: WhyTarget = { kind: 'stat', ref: { kind: 'country', id: me, stat: 'treasury' } };
  const root = rootOf(game, treasury);
  const items = childrenOf(game, root);
  const budget = items.find((i) => i.node.type === 'budget')!;

  it('names the monthly budget as a cause, with what it has added up to', () => {
    expect(budget).toBeDefined();
    const text = describeNode(game, budget.node);
    expect(text.title).toBe('Your monthly budget');
    expect(text.note).toMatch(/bn over \d+ months$/);
  });

  it('follows the budget into imports and the oil price', () => {
    const titles = (nodes: readonly { node: WhyNode }[]) =>
      nodes.map((n) => describeNode(game, n.node).title);
    const sides = childrenOf(game, budget.node);
    expect(titles(sides).join(' | ')).toMatch(/Spending .* a month/);
    const spending = sides.find((s) => describeNode(game, s.node).title.startsWith('Spending'))!;
    const lines = childrenOf(game, spending.node);
    const imports = lines.find((l) => l.node.type === 'trade')!;
    expect(describeNode(game, imports.node).title).toMatch(/^Imports cost [\d.]+ bn a month$/);
    const goods = childrenOf(game, imports.node);
    expect(describeNode(game, goods[0]!.node).title).toMatch(/^Crude oil price/);
    expect(goods[0]!.note).toBe('40 a day of crude oil');
  });
});

describe('dispatches', () => {
  it('carry the event or choice behind world news, so it can be asked about', () => {
    const world = session.dispatches.filter((d) => d.source === 'world');
    expect(world.some((d) => d.event)).toBe(true);
    expect(world.some((d) => d.choice)).toBe(true);
    for (const d of world) {
      const target = whyOfDispatch(d);
      expect(target, d.headline).not.toBeNull();
      expect(['event', 'decision']).toContain(rootOf(game, target!).type);
    }
  });
});
