import { describe, expect, it } from 'vitest';
import { chance, nextInt, nextU32, seedRng, type RngState } from '../src/index';

function drawU32s(seed: number, count: number): number[] {
  let state: RngState = seedRng(seed);
  const values: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const draw = nextU32(state);
    values.push(draw.value);
    state = draw.next;
  }
  return values;
}

describe('seeded RNG', () => {
  it('produces the same sequence for the same seed', () => {
    expect(drawU32s(7, 100)).toEqual(drawU32s(7, 100));
  });

  it('produces different sequences for different seeds', () => {
    expect(drawU32s(7, 10)).not.toEqual(drawU32s(8, 10));
  });

  it('matches the recorded golden sequence', () => {
    // If this fails, the RNG changed and every saved game and replay would
    // play out differently. Only update these values deliberately.
    expect(drawU32s(42, 5)).toEqual([2581720956, 1925393290, 3661312704, 2876485805, 750819978]);

    let state = seedRng(2026);
    const rolls: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      const draw = nextInt(state, 1, 6);
      rolls.push(draw.value);
      state = draw.next;
    }
    expect(rolls).toEqual([2, 1, 1, 1, 6, 1, 5, 2, 3, 3]);
  });

  it('does not mutate or depend on hidden state', () => {
    const state = seedRng(99);
    expect(nextU32(state)).toEqual(nextU32(state));
  });

  it('keeps nextInt within the inclusive range', () => {
    let state = seedRng(1);
    const seen = new Set<number>();
    for (let i = 0; i < 2_000; i += 1) {
      const draw = nextInt(state, -3, 3);
      expect(draw.value).toBeGreaterThanOrEqual(-3);
      expect(draw.value).toBeLessThanOrEqual(3);
      seen.add(draw.value);
      state = draw.next;
    }
    expect(seen.size).toBe(7);
  });

  it('handles certain and impossible chances', () => {
    const state = seedRng(5);
    expect(chance(state, 0).value).toBe(false);
    expect(chance(state, 10_000).value).toBe(true);
  });

  it('roughly honors a chance over many draws', () => {
    let state = seedRng(123);
    let hits = 0;
    const draws = 20_000;
    for (let i = 0; i < draws; i += 1) {
      const draw = chance(state, 2_500);
      if (draw.value) hits += 1;
      state = draw.next;
    }
    expect(hits / draws).toBeGreaterThan(0.23);
    expect(hits / draws).toBeLessThan(0.27);
  });

  it('rejects invalid input', () => {
    expect(() => seedRng(1.5)).toThrow();
    expect(() => nextInt(seedRng(1), 5, 1)).toThrow();
    expect(() => chance(seedRng(1), 10_001)).toThrow();
  });
});
