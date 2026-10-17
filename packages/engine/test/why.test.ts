import { describe, expect, it } from 'vitest';
import {
  createGame,
  explainChokepoint,
  explainEvent,
  explainStat,
  run,
  step,
  type GameState,
  type StatWhy,
  type WhyNode,
} from '../src/index';
import { relationRef, stabilityRef, tinyScenario, treasuryRef } from './fixtures';

const insult = { kind: 'decide' as const, decision: 'insult', by: 'importer' };
const envoy = { kind: 'decide' as const, decision: 'envoy', by: 'importer' };

/** Insult the exporter on day 0 (it closes the strait), then let 8 days pass. */
function afterInsult(days = 8): GameState {
  return run(step(createGame(tinyScenario, 1), [insult]).state, days);
}

/** Follow the largest cause at each step, the way the summary chain does. */
function firstChild(node: WhyNode): WhyNode | undefined {
  switch (node.type) {
    case 'stat':
      return node.contributions[0]?.cause;
    case 'mood':
      return node.factions[0]?.cause;
    case 'pressure':
      return node.prices[0]?.cause;
    case 'market':
      return node.routes[0]?.cause;
    case 'chokepoint':
      return node.changedBy ?? undefined;
    default:
      return undefined;
  }
}

function chainTypes(root: WhyNode): string[] {
  const types: string[] = [];
  let node: WhyNode | undefined = root;
  while (node) {
    types.push(node.type === 'stat' ? `stat:${node.ref.kind}.${node.ref.stat}` : node.type);
    node = firstChild(node);
  }
  return types;
}

describe('why: live values', () => {
  it('has nothing to explain at the start', () => {
    const why = explainStat(createGame(tinyScenario, 1), stabilityRef);
    expect(why).toMatchObject({ value: 60, normal: 60, contributions: [] });
  });

  it('follows stability all the way back to the strait closing', () => {
    const why = explainStat(afterInsult(), stabilityRef);
    expect(why.value).toBeLessThan(60);
    expect(chainTypes(why)).toEqual([
      'stat:country.stability',
      'mood',
      'stat:faction.satisfaction',
      'pressure',
      'stat:resource.price',
      'market',
      'chokepoint',
      'event',
    ]);
  });

  it('measures each step', () => {
    const state = afterInsult();
    const price = explainStat(state, { kind: 'resource', id: 'oil', stat: 'price' });
    expect(price.normal).toBe(7_300);
    expect(price.contributions[0]!.effect).toBe(price.value - 7_300);
    const market = price.contributions[0]!.cause;
    expect(market).toMatchObject({
      type: 'market',
      supply: 10,
      demand: 50,
      routes: [{ link: 'oil_by_sea', delta: -40 }],
    });
    expect(explainChokepoint(state, 'strait')).toEqual({
      type: 'chokepoint',
      id: 'strait',
      open: false,
      changedBy: { type: 'event', event: 'strait_closes', tick: 0 },
    });
  });

  it('records permanent changes and who made them', () => {
    const state = run(step(createGame(tinyScenario, 1), [envoy]).state, 1);
    const treasury = explainStat(state, treasuryRef);
    expect(treasury).toMatchObject({ value: 380, normal: 400 });
    expect(treasury.contributions).toEqual([
      {
        effect: -20,
        permanent: true,
        untilTick: null,
        cause: { type: 'decision', decision: 'envoy', tick: 0 },
      },
    ]);
  });

  it('stops at the depth limit instead of running forever', () => {
    const why = explainStat(afterInsult(), stabilityRef, 1);
    const mood = why.contributions[0]!.cause;
    expect(mood.type).toBe('mood');
    const faction = (mood as Extract<WhyNode, { type: 'mood' }>).factions[0]!.cause as StatWhy;
    expect(faction.truncated).toBe(true);
    expect(faction.contributions).toEqual([]);
  });
});

describe('why: events, as recorded when they fired', () => {
  it('records the conditions that triggered an event', () => {
    const record = explainEvent(afterInsult(), 'strait_closes', 0)!;
    expect(record.scheduledBy).toBeNull();
    // The open strait is a precondition, not a cause; the relation is the cause.
    expect(record.because).toHaveLength(1);
    expect(record.because[0]).toMatchObject({
      type: 'stat',
      ref: relationRef,
      value: -60,
      normal: -10,
      contributions: [{ effect: -50, cause: { type: 'decision', decision: 'insult', tick: 0 } }],
    });
  });

  it('records what scheduled a delayed consequence', () => {
    const state = afterInsult(11);
    expect(explainEvent(state, 'strait_reopens', 10)).toEqual({
      event: 'strait_reopens',
      tick: 10,
      scheduledBy: { kind: 'event', id: 'strait_closes', tick: 0 },
      because: [],
    });
  });

  it('keeps the snapshot even after the world has moved on', () => {
    // The strait reopened on day 10 and relations recovered, but the record stands.
    const later = afterInsult(40);
    expect(later.world.chokepoints.strait!.open).toBe(true);
    expect(explainEvent(later, 'strait_closes', 0)!.because[0]).toMatchObject({ value: -60 });
  });

  it('never changes the game', () => {
    const state = afterInsult(30);
    const before = JSON.stringify(state);
    explainStat(state, stabilityRef);
    explainEvent(state, 'strait_closes', 0);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('keeps the trace serializable', () => {
    const state = afterInsult(30);
    expect(JSON.parse(JSON.stringify(state.trace))).toEqual(state.trace);
  });
});
