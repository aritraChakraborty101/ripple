import {
  FULL,
  computerCountries,
  dailyChance,
  isFree,
  rank,
  urgency,
  type GameState,
  type ScoreReport,
  type Tuning,
  type TuningOverrides,
} from '@ripple/engine';
import { useState } from 'react';
import { formatShortDate } from '../game/format';
import { ambitionOf } from '../game/intel';
import { actions, aiProfiles, currentProfile } from '../game/store';
import { goalLabel } from '../game/why';

/** Hundredths of a point as a readable score. */
const points = (centi: number) => (centi / 100).toFixed(1);
const percent = (bp: number) => `${(bp / 100).toFixed(bp % 100 === 0 ? 0 : 1)}%`;
const factor = (bp: number) => (bp / FULL).toFixed(2);

interface Knob {
  readonly key: keyof Tuning;
  readonly label: string;
  readonly hint: string;
  readonly step: number;
  /** Engine integers to the friendly number shown, and back. */
  readonly show: (value: number) => number;
  readonly store: (value: number) => number;
}

const KNOBS: readonly Knob[] = [
  {
    key: 'inertia',
    label: 'Inertia',
    hint: 'points to beat doing nothing',
    step: 1,
    show: (v) => v / 100,
    store: (v) => Math.round(v * 100),
  },
  {
    key: 'attention',
    label: 'Attention',
    hint: '% chance per point a day',
    step: 0.05,
    show: (v) => v / 100,
    store: (v) => Math.round(v * 100),
  },
  {
    key: 'temperature',
    label: 'Temperature',
    hint: '0 always best',
    step: 0.1,
    show: (v) => v / FULL,
    store: (v) => Math.round(v * FULL),
  },
  {
    key: 'hostility',
    label: 'Hostility',
    hint: 'x grievance goals',
    step: 0.1,
    show: (v) => v / FULL,
    store: (v) => Math.round(v * FULL),
  },
  {
    key: 'cooperation',
    label: 'Cooperation',
    hint: 'x ties goals',
    step: 0.1,
    show: (v) => v / FULL,
    store: (v) => Math.round(v * FULL),
  },
  {
    key: 'restDays',
    label: 'Rest days',
    hint: 'after acting',
    step: 1,
    show: (v) => v,
    store: (v) => Math.round(v),
  },
];

/** An option in words, with {self} and {target} filled in. */
function optionName(
  game: GameState,
  r: { readonly decision: string; readonly country: string; readonly target?: string },
): string {
  if (r.decision === 'nothing') return 'Do nothing';
  const name = game.defs.decisions[r.decision]?.name ?? r.decision;
  return name
    .replaceAll('{self}', game.world.countries[r.country]?.name ?? r.country)
    .replaceAll('{target}', r.target ? (game.world.countries[r.target]?.name ?? r.target) : '');
}

function Breakdown({ game, report }: { game: GameState; report: ScoreReport }) {
  return (
    <div className="dev-breakdown">
      {!report.available && <p className="tone-critical">{report.reason}</p>}
      {report.goals.length > 0 && (
        <table>
          <tbody>
            {report.goals.map((g) => (
              <tr key={g.goal}>
                <td>{goalLabel(game, g.goal)}</td>
                <td>
                  {points(g.weight)} × {percent(g.need)} × {g.drive}
                </td>
                <td className={g.part < 0 ? 'tone-critical' : ''}>{points(g.part)}</td>
              </tr>
            ))}
            <tr className="dev-total">
              <td>value</td>
              <td />
              <td>{points(report.value)}</td>
            </tr>
          </tbody>
        </table>
      )}
      {report.appeal.map((a) => (
        <p key={a.measure + a.curve}>
          {a.measure} = {a.value}, {a.curve} → <strong>{factor(a.factor)}</strong>
        </p>
      ))}
      <p className="muted">
        appeal {factor(report.appealTotal)} · odds {percent(report.odds)} · tuning ×
        {factor(report.multiplier)} → score <strong>{points(report.score)}</strong>
      </p>
    </div>
  );
}

function CountryBoard({ game, country }: { game: GameState; country: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const tuning = game.defs.ai!.tuning;
  const options = rank(game, country).slice(0, 7);
  const scale = Math.max(tuning.inertia * 2, ...options.map((o) => o.score), 1);
  const u = urgency(game, country);
  const attention = game.attention[country];
  const status = !isFree(game, country)
    ? game.pending.some((p) => p.by === country)
      ? 'busy: an order is under way'
      : `resting until ${formatShortDate((attention?.lastActed ?? 0) + tuning.restDays)}`
    : attention && attention.noticeUntil > game.tick
      ? `noticing until ${formatShortDate(attention.noticeUntil)}`
      : 'free';
  const ambition = ambitionOf(game, country);

  return (
    <section className="dev-country">
      <header>
        <strong>{game.world.countries[country]?.name}</strong>
        <span className="muted">
          urgency {points(u)} · today {percent(u > 0 ? dailyChance(game, country, u) : 0)} ·{' '}
          {status}
        </span>
      </header>
      {ambition && (
        <p className="muted small">
          Ambition: {ambition.name} ({ambition.current} of {ambition.target})
        </p>
      )}
      <ol className="dev-options">
        {options.map((r) => {
          const key = `${r.decision}:${r.target ?? ''}`;
          return (
            <li key={key} className={r.available ? '' : 'unavailable'}>
              <button
                type="button"
                className="dev-option"
                aria-expanded={open === key}
                onClick={() => setOpen(open === key ? null : key)}
              >
                <span className="dev-option-name">{optionName(game, r)}</span>
                <span className="dev-bar" aria-hidden="true">
                  <span style={{ width: `${(Math.max(0, r.score) * 100) / scale}%` }} />
                  <span
                    className="dev-inertia"
                    style={{ left: `${(tuning.inertia * 100) / scale}%` }}
                  />
                </span>
                <span className="dev-score">{points(r.score)}</span>
              </button>
              {open === key && <Breakdown game={game} report={r} />}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * The AI dev panel (open the game with ?dev, toggle with the ` key): every
 * computer country's options as the clearing house scores them, with full
 * breakdowns, recent choices, and knobs to retune the AI live.
 */
export function DevPanel({ game, onClose }: { game: GameState; onClose: () => void }) {
  const ai = game.defs.ai;
  if (!ai) return null;
  const set = (knob: Knob, value: number) => {
    if (!Number.isFinite(value) || value < 0) return;
    actions.retune({ [knob.key]: knob.store(value) } as TuningOverrides);
  };
  const recent = [...game.trace.choices].reverse().slice(0, 8);

  return (
    <aside className="dev-panel" aria-label="AI dev panel">
      <header className="dev-head">
        <strong>AI dev panel</strong>
        <label className="dev-profile">
          Profile
          <select
            value={currentProfile()}
            onChange={(e) => actions.newGameWithProfile(e.target.value)}
          >
            {aiProfiles.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="text-button inline" onClick={onClose}>
          Close
        </button>
      </header>
      <p className="muted small">
        Changing the profile starts a new game. Knobs apply from today and are recorded in the game.
      </p>
      <div className="dev-knobs">
        {KNOBS.map((k) => (
          <label key={k.key} title={k.hint}>
            <span>{k.label}</span>
            <input
              type="number"
              step={k.step}
              min={0}
              defaultValue={k.show(ai.tuning[k.key] as number)}
              key={`${k.key}-${String(ai.tuning[k.key])}`}
              onBlur={(e) => set(k, Number(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') set(k, Number((e.target as HTMLInputElement).value));
              }}
            />
          </label>
        ))}
      </div>
      {computerCountries(game).map((c) => (
        <CountryBoard key={c} game={game} country={c} />
      ))}
      <section className="dev-country">
        <header>
          <strong>Recent choices</strong>
        </header>
        {recent.length === 0 ? (
          <p className="muted small">None yet.</p>
        ) : (
          <ol className="dev-recent">
            {recent.map((c) => (
              <li key={`${c.country}-${c.decision}-${c.tick}`}>
                <span className="muted">{formatShortDate(c.tick)}</span>{' '}
                {game.world.countries[c.country]?.name}: {optionName(game, c)} ({points(c.score)})
              </li>
            ))}
          </ol>
        )}
      </section>
    </aside>
  );
}
