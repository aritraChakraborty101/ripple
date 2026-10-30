import { loadBuiltInScenario } from '@ripple/content/node';
import { createGame } from '@ripple/engine';
import { describe, expect, it } from 'vitest';
import { cabinet, canSign, MINISTRIES, openTargets, readyCount } from '../src/game/cabinet';

const game = createGame(loadBuiltInScenario('first-crisis'), 1);

describe('cabinet', () => {
  it('files orders under the five ministries, each order once', () => {
    const files = cabinet(game);
    expect(files.map((f) => f.ministry.id)).toEqual(MINISTRIES.map((m) => m.id));
    const ids = files.flatMap((f) => f.orders.map((d) => d.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(files.find((f) => f.ministry.id === 'foreign')!.orders.map((d) => d.id)).toContain(
      'envoy',
    );
  });

  it('leaves out computer orders and undo orders with nothing to undo', () => {
    const ids = cabinet(game).flatMap((f) => f.orders.map((d) => d.id));
    expect(ids).not.toContain('lift_tariff');
    for (const id of ids) expect(game.defs.decisions[id]!.for).toBeUndefined();
  });

  it('counts what can be signed now', () => {
    const ready = readyCount(game);
    expect(ready).toBeGreaterThan(0);
    expect(ready).toBe(
      cabinet(game)
        .flatMap((f) => f.orders)
        .filter((d) => canSign(game, d)).length,
    );
  });

  it('aims an order only at countries it can reach now', () => {
    const envoy = game.defs.decisions.envoy!;
    const targets = openTargets(game, envoy);
    expect(targets).not.toContain(game.rules.playerCountry);
    expect(targets.length).toBeGreaterThan(0);
    expect(openTargets(game, game.defs.decisions.address_nation!)).toEqual([]);
  });
});
