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
  monthlyBalance,
  relationId,
  step,
  type GameState,
  type Order,
} from '@ripple/engine';

/** What a player wants to sign today: a decision, aimed at a country if it is a template. */
interface Want {
  readonly decision: string;
  readonly target?: string;
}

type Player = (state: GameState) => Want[];

/** The chokepoint the "strait" lines report on. */
const STRAIT = 'south_strait';

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

  const wants: Want[] = [];
  const want = (decision: string, target?: string) =>
    wants.push(target === undefined ? { decision } : { decision, target });
  // Corvan: lasting goodwill first, then talks, then money, as relations worsen.
  if (relation('corvan') < -15) want('broadcast', 'corvan');
  if (relation('corvan') < -25) want('envoy', 'corvan');
  if (relation('corvan') < -32) want('transit_fees');
  if (stat('country', me, 'stability') < 45) want('fuel_subsidy');
  if (oilUp > 0.4) {
    want('release_reserves');
    want('veskar_discount');
  }
  if (stat('country', me, 'stability') < 30) want('address_nation');
  if (state.tick > 60 && stat('country', me, 'treasury') > 200) want('overland_pipeline');
  // Friends first: deals and a treaty with whoever is friendly enough.
  for (const partner of ['orrin', 'veskar', 'kesh', 'ilmar', 'velmont']) {
    if (relation(partner) >= 25) want('trade_deal', partner);
    if (relation(partner) >= 55) want('treaty', partner);
  }
  // Buy Corvan's goodwill when it sours and money allows.
  if (relation('corvan') < -30 && stat('country', me, 'treasury') > 150) {
    want('emergency_aid', 'corvan');
  }
  // Short of money while running a deficit: tax what comes from Thessa.
  if (stat('country', me, 'treasury') < 150 && monthlyBalance(state, me) < -3_000) {
    want('tariff', 'thessa');
  }
  // No intelligence files: they change what a person sees and reads, which a
  // script cannot use, so here they would only cost money.
  // Ration fuel in a deep oil crisis, and stop once it passes.
  const rationing = state.flags.includes('rationing');
  if (!rationing && oilUp > 0.6) want('ration_fuel');
  if (rationing && oilUp < 0.15) want('end_rationing');
  // Spend on public works when the mood sours and money allows; stop when money runs low.
  const works = state.flags.includes('public_works');
  const treasury = stat('country', me, 'treasury');
  if (!works && stat('country', me, 'stability') < 50 && treasury > 200) want('public_works');
  if (works && treasury < 100) want('end_public_works');
  // Tighten the belt when broke and bleeding.
  const austerity = state.flags.includes('austerity');
  if (!austerity && treasury < 60 && monthlyBalance(state, me) < 0) want('austerity');
  if (austerity && treasury > 180) want('end_austerity');
  return wants.filter((w) => canIssue(state, w.decision, me, w.target).ok);
};

interface GameSummary {
  readonly result: 'ousted' | 'survived';
  readonly day: number;
  readonly finalStability: number;
  readonly finalTreasury: number;
  readonly straitClosures: number;
  /** Closures of every chokepoint, by ID. */
  readonly closures: Readonly<Record<string, number>>;
  /** The day a strait first closed, if one did. */
  readonly firstClosure: number | null;
  /** The player's orders. */
  readonly decisions: number;
  /** The player's orders by decision ID. */
  readonly orders: Readonly<Record<string, number>>;
  /** What caused the first critical crisis (a critical event or computer move), if any. */
  readonly firstCrisis: string | null;
  /** Computer countries' choices, as "country:decision". */
  readonly choices: readonly string[];
}

function play(scenarioName: string, seed: number, player: Player, aiProfile?: string): GameSummary {
  const scenario = loadBuiltInScenario(scenarioName);
  let state = createGame(scenario, seed, aiProfile ? { aiProfile } : {});
  const me = state.rules.playerCountry;
  let straitClosures = 0;
  const closures: Record<string, number> = {};
  let firstClosure: number | null = null;
  let decisions = 0;
  const orders: Record<string, number> = {};
  let firstCrisis: string | null = null;
  while (!state.outcome) {
    const signed: Order[] = player(state).map((w) => ({ kind: 'decide', ...w, by: me }));
    const before = state;
    const result = step(state, signed);
    state = result.state;
    for (const id of Object.keys(state.world.chokepoints)) {
      if (before.world.chokepoints[id]!.open && !state.world.chokepoints[id]!.open) {
        closures[id] = (closures[id] ?? 0) + 1;
        // The strait is the scenario's main lever; other chokepoints are reported separately.
        if (id === STRAIT) {
          straitClosures += 1;
          firstClosure ??= before.tick;
        }
      }
    }
    for (const event of result.events) {
      if (firstCrisis === null) {
        if (
          event.kind === 'event_fired' &&
          state.defs.events[event.event]?.severity === 'critical'
        ) {
          firstCrisis = event.event;
        }
        if (
          event.kind === 'decision_resolved' &&
          event.success &&
          event.by !== me &&
          state.defs.decisions[event.decision]?.severity === 'critical'
        ) {
          firstCrisis = event.decision;
        }
      }
      if (event.kind === 'decision_issued' && event.by === me) {
        decisions += 1;
        orders[event.decision] = (orders[event.decision] ?? 0) + 1;
      }
    }
  }
  return {
    result: state.outcome.result,
    day: state.outcome.tick,
    finalStability: effectiveStat(state, { kind: 'country', id: me, stat: 'stability' }),
    finalTreasury: effectiveStat(state, { kind: 'country', id: me, stat: 'treasury' }),
    straitClosures,
    firstClosure,
    closures,
    decisions,
    orders,
    firstCrisis,
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
  const others = new Set(games.flatMap((g) => Object.keys(g.closures)).filter((c) => c !== STRAIT));
  for (const c of [...others].sort()) {
    const closed = games.filter((g) => (g.closures[c] ?? 0) > 0).length;
    console.log(`  ${c} closed at least once: ${pct(closed)}`);
  }
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
  // What starts the trouble: the cause of each game's first critical crisis.
  const causes = new Map<string, number>();
  for (const g of games) {
    const key = g.firstCrisis ?? '(none)';
    causes.set(key, (causes.get(key) ?? 0) + 1);
  }
  console.log(
    `  first crisis caused by: ${[...causes.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([c, n]) => `${c} ${pct(n)}`)
      .join(', ')}`,
  );
  // Which orders the player leans on: no single one should carry the game.
  const mine = new Map<string, number>();
  for (const g of games) {
    for (const [d, n] of Object.entries(g.orders)) mine.set(d, (mine.get(d) ?? 0) + n);
  }
  const all = [...mine.values()].reduce((a, b) => a + b, 0);
  if (all > 0) {
    const top = [...mine.entries()].sort((a, b) => b[1] - a[1]);
    const share = (n: number) => `${Math.round((n * 100) / all)}%`;
    console.log(`  your orders by share:  ${top.map(([d, n]) => `${d} ${share(n)}`).join(', ')}`);
  }

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
