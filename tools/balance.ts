/**
 * Balance report: plays many complete games of a scenario and summarizes how
 * they went, for two kinds of player:
 *
 *   idle     never makes a decision
 *   steady   follows a few sensible rules of thumb
 *
 * A healthy scenario punishes the idle player and rewards the steady one.
 *
 * It also reports what the computer countries chose, and how often.
 *
 *   pnpm balance                               # 200 games of first-crisis
 *   pnpm balance first-crisis 500              # scenario and number of games
 *   pnpm balance --ai aggressive               # use a tuning profile
 *   pnpm balance --compare passive,standard,aggressive
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
  /** The day a strait first closed, if one did. */
  readonly firstClosure: number | null;
  /** The player's orders. */
  readonly decisions: number;
  /** Computer countries' choices, as "country:decision". */
  readonly choices: readonly string[];
}

function play(scenarioName: string, seed: number, player: Player, aiProfile?: string): GameSummary {
  const scenario = loadBuiltInScenario(scenarioName);
  let state = createGame(scenario, seed, aiProfile ? { aiProfile } : {});
  const me = state.rules.playerCountry;
  let straitClosures = 0;
  let firstClosure: number | null = null;
  let decisions = 0;
  while (!state.outcome) {
    const orders: Order[] = player(state).map((decision) => ({ kind: 'decide', decision, by: me }));
    const before = state;
    const result = step(state, orders);
    state = result.state;
    for (const id of Object.keys(state.world.chokepoints)) {
      if (before.world.chokepoints[id]!.open && !state.world.chokepoints[id]!.open) {
        straitClosures += 1;
        firstClosure ??= before.tick;
      }
    }
    for (const event of result.events) {
      if (event.kind === 'decision_issued' && event.by === me) decisions += 1;
    }
  }
  return {
    result: state.outcome.result,
    day: state.outcome.tick,
    finalStability: effectiveStat(state, { kind: 'country', id: me, stat: 'stability' }),
    finalTreasury: effectiveStat(state, { kind: 'country', id: me, stat: 'treasury' }),
    straitClosures,
    firstClosure,
    decisions,
    choices: state.trace.choices.map((c) => `${c.country}:${c.decision}`),
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
  const closures = games.map((g) => g.firstClosure).filter((d): d is number => d !== null);
  if (closures.length > 0) {
    console.log(
      `  first closure:         median day ${percentile(closures, 50)}, earliest ${percentile(closures, 0)}`,
    );
  }
  console.log(`  your orders per game:  ${avg(games.map((g) => g.decisions))}`);

  // What the computer countries chose, per game on average.
  const counts = new Map<string, number>();
  for (const g of games) for (const c of g.choices) counts.set(c, (counts.get(c) ?? 0) + 1);
  const byCountry = new Map<string, [string, number][]>();
  for (const [key, n] of counts) {
    const [country, decision] = key.split(':') as [string, string];
    byCountry.set(country, [...(byCountry.get(country) ?? []), [decision, n]]);
  }
  if (byCountry.size > 0) console.log('  computer choices per game:');
  for (const country of [...byCountry.keys()].sort()) {
    const list = byCountry.get(country)!.sort((a, b) => b[1] - a[1]);
    const total = list.reduce((sum, [, n]) => sum + n, 0);
    const parts = list.map(([d, n]) => `${d} ${(n / games.length).toFixed(1)}`).join(', ');
    console.log(
      `    ${country.padEnd(8)} ${(total / games.length).toFixed(1).padStart(4)}  (${parts})`,
    );
  }
}

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args.splice(i, 2)[1];
};
const profile = flag('ai');
const compare = flag('compare')?.split(',');
const scenarioName = args[0] ?? 'first-crisis';
const count = Number(args[1] ?? 200);
const seeds = Array.from({ length: count }, (_, i) => i + 1);

console.log(`Balance report: ${scenarioName}`);
for (const name of compare ?? [profile]) {
  const suffix = name ? `, ${name} AI` : '';
  report(
    `Idle player${suffix}`,
    seeds.map((seed) => play(scenarioName, seed, idle, name)),
  );
  report(
    `Steady player${suffix}`,
    seeds.map((seed) => play(scenarioName, seed, steady, name)),
  );
}
