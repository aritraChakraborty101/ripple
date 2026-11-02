import { describe, expect, it } from 'vitest';
import {
  addModifier,
  createGame,
  effectiveStat,
  explainStat,
  inTransit,
  marketSupply,
  run,
  setChokepointOpen,
  shortageStat,
  stockStat,
  type GameState,
  type WhyNode,
} from '../src/index';
import { chainScenario } from './fixtures';

const stock = (s: GameState, country: string, resource: string) =>
  s.world.countries[country]!.stats[stockStat(resource)] ?? 0;
const shortage = (s: GameState, country: string) =>
  s.world.countries[country]!.stats[shortageStat('fuel')] ?? 0;
const price = (s: GameState, resource: string) =>
  effectiveStat(s, { kind: 'resource', id: resource, stat: 'price' });
const start = () => createGame(chainScenario, 1);
const closed = () => setChokepointOpen(start(), 'strait', false);

/** Every node in a why tree, depth first. */
function nodes(node: WhyNode): WhyNode[] {
  const out: WhyNode[] = [node];
  const children: WhyNode[] = [];
  if (node.type === 'stat') children.push(...node.contributions.map((c) => c.cause));
  if (node.type === 'stock') {
    children.push(...node.routes.map((r) => r.cause), ...node.plants.map((p) => p.cause));
  }
  if (node.type === 'pressure') {
    for (const p of node.prices) {
      children.push(p.cause);
      if (p.shortage) children.push(p.shortage.cause);
    }
  }
  if (node.type === 'mood') children.push(...node.factions.map((f) => f.cause));
  if (node.type === 'market') {
    children.push(...node.routes.map((r) => r.cause), ...(node.stocks ?? []).map((s) => s.cause));
  }
  for (const c of children) out.push(...nodes(c));
  return out;
}

describe('supply chain', () => {
  it('starts with 20 days of stock and a full pipeline', () => {
    const s = start();
    expect(stock(s, 'importer', 'fuel')).toBe(800);
    expect(stock(s, 'refiner', 'crude')).toBe(1_000);
    expect(stock(s, 'refiner', 'fuel')).toBe(200);
    expect(stock(s, 'producer', 'crude')).toBe(0);
    expect(inTransit(s, 'crude')).toBe(250);
    expect(inTransit(s, 'fuel')).toBe(120);
  });

  it('stays in balance when nothing happens', () => {
    const later = run(start(), 200);
    expect(stock(later, 'importer', 'fuel')).toBe(800);
    expect(stock(later, 'refiner', 'crude')).toBe(1_000);
    expect(stock(later, 'refiner', 'fuel')).toBe(200);
    expect(inTransit(later, 'crude')).toBe(250);
    expect(shortage(later, 'importer')).toBe(0);
    expect(price(later, 'fuel')).toBe(9_000);
    expect(price(later, 'crude')).toBe(7_000);
  });

  it("counts a refinery's crude as demand", () => {
    expect(marketSupply(start(), 'crude')).toBe(50);
  });

  it('keeps delivering what is already at sea after a strait closes', () => {
    const after = run(closed(), 5);
    // Five days of shipments were already past the strait: the refiner has not noticed yet.
    expect(stock(after, 'refiner', 'crude')).toBe(1_000);
    expect(stock(run(closed(), 10), 'refiner', 'crude')).toBe(750);
  });

  it('lets the shortage reach people weeks later, and prices climb as stocks fall', () => {
    const day10 = run(closed(), 10);
    const day40 = run(closed(), 40);
    const day80 = run(closed(), 80);
    expect(shortage(day10, 'importer')).toBe(0);
    expect(shortage(day40, 'importer')).toBe(0);
    expect(shortage(day80, 'importer')).toBe(40);
    expect(price(day10, 'fuel')).toBeLessThan(price(day40, 'fuel'));
    expect(price(day40, 'fuel')).toBeLessThan(price(day80, 'fuel'));
    // Running out weighs on people on top of the price.
    const satisfaction = (s: GameState) =>
      effectiveStat(s, { kind: 'faction', id: 'importer_workers', stat: 'satisfaction' });
    expect(satisfaction(day80)).toBeLessThan(satisfaction(day40));
  });

  it('keeps the refiner supplied first: it exports only what is above half its normal stock', () => {
    let s = closed();
    while ((s.world.links.fuel_by_road!.stats.shipped ?? 0) === 40) s = run(s, 1);
    // Exports fall off while the refiner still holds about half its normal 200 for itself.
    expect(stock(s, 'refiner', 'fuel')).toBeGreaterThanOrEqual(90);
    expect(shortage(s, 'refiner')).toBe(0);
    expect(shortage(s, 'importer')).toBe(0);
  });

  it('recovers only after the pipeline refills when the strait reopens', () => {
    const crisis = run(closed(), 80);
    const reopened = setChokepointOpen(crisis, 'strait', true);
    // Crude takes 5 days to reach the refinery and fuel 3 more to reach the importer.
    expect(shortage(run(reopened, 6), 'importer')).toBe(40);
    expect(shortage(run(reopened, 12), 'importer')).toBe(0);
    expect(price(run(reopened, 30), 'fuel')).toBeGreaterThan(9_000);
  });

  it('piles crude up at a burning refinery without counting it as supply', () => {
    const fire = addModifier(start(), {
      target: { kind: 'plant', id: 'refinery', stat: 'capacity' },
      op: 'pct',
      amount: -7_500,
      source: { kind: 'event', id: 'refinery_fire', tick: 0 },
      expiresAt: null,
    });
    const later = run(fire, 30);
    expect(stock(later, 'refiner', 'crude')).toBeGreaterThan(1_000);
    expect(stock(later, 'importer', 'fuel')).toBeLessThan(800);
    expect(price(later, 'fuel')).toBeGreaterThan(9_000);
    expect(price(later, 'crude')).toBe(7_000);
  });

  it('stops pumping when crude has nowhere to go', () => {
    const later = run(closed(), 200);
    expect(stock(later, 'producer', 'crude')).toBe(1_000);
  });

  it('explains a shortage back to the closed strait', () => {
    const day80 = run(closed(), 80);
    const why = explainStat(day80, { kind: 'country', id: 'importer', stat: stockStat('fuel') });
    const all = nodes(why);
    expect(all.some((n) => n.type === 'stock')).toBe(true);
    expect(all.some((n) => n.type === 'chokepoint' && n.id === 'strait')).toBe(true);
  });

  it('plays out identically from the same state', () => {
    expect(run(closed(), 60)).toEqual(run(closed(), 60));
  });
});
