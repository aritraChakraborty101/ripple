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

// The golden game: by day 230 Corvan has chosen to close the strait and
// stability has collapsed. Played once and shared, since it takes a moment.
const session = playTo(3, 230);
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
    expect(chain[0]!.type).toBe('event');
    expect(chain.at(-1)!.type).toBe('stat');
    expect(steps.at(-1)).toMatch(/^Stability/);
  });

  it('runs from the dispute through the strait and the oil price', () => {
    const joined = steps.join(' → ');
    const order = [
      /fishing boats/i,
      /Relations with Corvan/,
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
