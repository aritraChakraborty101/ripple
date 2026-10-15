/**
 * Balance report: plays many complete games of a scenario and summarizes how
 * they went, for two kinds of player:
 *
 *   idle     never makes a decision
 *   steady   follows a few sensible rules of thumb
 *
 * A healthy scenario punishes the idle player and rewards the steady one.
 *
 *   pnpm balance                    # 200 games of first-crisis
 *   pnpm balance first-crisis 500   # scenario and number of games
 */

import { loadBuiltInScenario } from '@ripple/content/node';
import {
  canIssue,
  createGame,
  effectiveStat,
  relationId,
  step,
  type GameState,
  type Order,
} from '@ripple/engine';

type Player = (state: GameState) => string[];

const idle: Player = () => [];

/** Rules of thumb a reasonable player might follow. */
const steady: Player = (state) => {
  const me = state.rules.playerCountry;
  const stat = (kind: 'country' | 'faction' | 'resource', id: string, name: string) =>
    effectiveStat(state, { kind, id, stat: name });
  const relation = (other: string) =>
    effectiveStat(state, { kind: 'relation', id: relationId(me, other), stat: 'value' });
  const oil = state.world.resources.oil!;
  const oilUp = (stat('resource', 'oil', 'price') - oil.basePrice) / oil.basePrice;

  const wants: string[] = [];
  if (relation('corvan') < -20) wants.push('envoy_corvan', 'transit_fees');
  if (stat('country', me, 'stability') < 45) wants.push('fuel_subsidy');
  if (oilUp > 0.4) wants.push('release_reserves', 'envoy_veskar');
  if (stat('country', me, 'stability') < 30) wants.push('address_nation');
  if (state.tick > 60 && stat('country', me, 'treasury') > 200) wants.push('overland_pipeline');
  return wants.filter((d) => canIssue(state, d, me).ok);
};

interface GameSummary {
  readonly result: 'ousted' | 'survived';
  readonly day: number;
  readonly finalStability: number;
  readonly finalTreasury: number;
  readonly straitClosures: number;
  readonly decisions: number;
}

function play(scenarioName: string, seed: number, player: Player): GameSummary {
  const scenario = loadBuiltInScenario(scenarioName);
  let state = createGame(scenario, seed);
  let straitClosures = 0;
  let decisions = 0;
  while (!state.outcome) {
    const orders: Order[] = player(state).map((decision) => ({
      kind: 'decide',
      decision,
      by: state.rules.playerCountry,
    }));
    const result = step(state, orders);
    state = result.state;
    for (const event of result.events) {
      if (event.kind === 'event_fired' && event.event.endsWith('closes_strait'))
        straitClosures += 1;
      if (event.kind === 'decision_issued') decisions += 1;
    }
  }
  const me = state.rules.playerCountry;
  return {
    result: state.outcome.result,
    day: state.outcome.tick,
    finalStability: effectiveStat(state, { kind: 'country', id: me, stat: 'stability' }),
    finalTreasury: effectiveStat(state, { kind: 'country', id: me, stat: 'treasury' }),
    straitClosures,
    decisions,
  };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]!;
}

function report(label: string, games: GameSummary[]): void {
  const ousted = games.filter((g) => g.result === 'ousted');
  const pct = (n: number) => `${Math.round((n * 100) / games.length)}%`;
  const avg = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1);
  console.log(`\n${label} (${games.length} games)`);
  console.log(`  ousted:                ${pct(ousted.length)}`);
  if (ousted.length > 0) {
    const days = ousted.map((g) => g.day);
    console.log(
      `  day ousted:            median ${percentile(days, 50)}, earliest ${percentile(days, 0)}`,
    );
  }
  console.log(
    `  strait closed at least once: ${pct(games.filter((g) => g.straitClosures > 0).length)}`,
  );
  console.log(`  avg strait closures:   ${avg(games.map((g) => g.straitClosures))}`);
  console.log(
    `  final stability:       median ${percentile(
      games.map((g) => g.finalStability),
      50,
    )}`,
  );
  console.log(
    `  final treasury:        median ${percentile(
      games.map((g) => g.finalTreasury),
      50,
    )} bn`,
  );
  console.log(`  decisions per game:    ${avg(games.map((g) => g.decisions))}`);
}

const scenarioName = process.argv[2] ?? 'first-crisis';
const count = Number(process.argv[3] ?? 200);
const seeds = Array.from({ length: count }, (_, i) => i + 1);

console.log(`Balance report: ${scenarioName}`);
report(
  'Idle player',
  seeds.map((seed) => play(scenarioName, seed, idle)),
);
report(
  'Steady player',
  seeds.map((seed) => play(scenarioName, seed, steady)),
);
