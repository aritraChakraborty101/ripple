import {
  effectiveStat,
  hasBudget,
  monthlyBalance,
  sortedIds,
  type GameState,
} from '@ripple/engine';
import { SPEEDS, type ClockState } from '../game/clock';
import { stabilityTone } from '../game/describe';
import {
  ARCHETYPE_LABELS,
  formatChange,
  formatDate,
  formatMillions,
  formatPrice,
} from '../game/format';
import { TREASURY_HISTORY } from '../game/session';
import { actions } from '../game/store';
import { Hint } from './Hint';
import { Sparkline } from './Sparkline';
import { useWhy } from './WhyContext';

interface Props {
  readonly game: GameState;
  readonly clock: ClockState;
  readonly history: Readonly<Record<string, readonly number[]>>;
  readonly onOpenHelp: () => void;
  /** Draw the eye to the play button before the first game starts. */
  readonly nudgePlay: boolean;
}

/** Everything you need at a glance: your country, your numbers, the markets and the clock. */
export function Header({ game, clock, history, onOpenHelp, nudgePlay }: Props) {
  const id = game.rules.playerCountry;
  const country = game.world.countries[id]!;
  const { ousting } = game.rules;
  const stat = (name: string) => effectiveStat(game, { kind: 'country', id, stat: name });
  const stability = stat(ousting.stat);
  const tone = stabilityTone(stability, ousting.below);
  const why = useWhy();
  const budgeted = hasBudget(game, id);
  const balance = budgeted ? monthlyBalance(game, id) : 0;
  const balanceTone = balance < 0 ? (balance <= -5_000 ? 'critical' : 'warning') : 'calm';

  return (
    <header className="topbar">
      <div className="identity">
        <h1>{country.name}</h1>
        <span className="muted small">{ARCHETYPE_LABELS[country.archetype]}</span>
      </div>

      <div className="stats">
        <Hint
          focusable={false}
          text="Money for orders, in billions. Taxes and trade pay into it at the end of every month, and dearer imports drain it. Below zero, debt weighs on stability. Click to see why it is where it is."
        >
          <button
            type="button"
            className="stat stat-button treasury"
            onClick={() => why({ kind: 'stat', ref: { kind: 'country', id, stat: 'treasury' } })}
            aria-label={`Treasury ${stat('treasury')} bn${budgeted ? `, ${formatMillions(balance, true)} a month` : ''}. Why?`}
          >
            <span className="stat-label">Treasury</span>
            <span className="stat-value">{stat('treasury')} bn</span>
            {budgeted && (
              <span className={`stat-sub tone-${balanceTone}`}>
                {formatMillions(balance, true)}/mo
              </span>
            )}
            {budgeted && (
              <Sparkline
                values={history[TREASURY_HISTORY] ?? [stat('treasury')]}
                base={history[TREASURY_HISTORY]?.[0] ?? stat('treasury')}
                tone={balance < 0 ? 'var(--warning)' : 'var(--accent)'}
                width={48}
                height={16}
              />
            )}
          </button>
        </Hint>
        <Hint text="Diplomatic capital. Envoys and speeches spend it, and it does not come back on its own.">
          <span className="stat">
            <span className="stat-label">Influence</span>
            <span className="stat-value">{stat('influence')}</span>
          </span>
        </Hint>
        <Hint
          focusable={false}
          text={`How firmly you hold power. It follows your factions' mood. Below ${ousting.below} for ${ousting.forTicks} days and you are ousted. Click to see why it is where it is.`}
        >
          <button
            type="button"
            className={`stat stat-button gauge-mini ${tone}`}
            onClick={() => why({ kind: 'stat', ref: { kind: 'country', id, stat: ousting.stat } })}
            aria-label={`Stability ${stability}. Why is it at this level?`}
          >
            <span className="stat-label">Stability</span>
            <span className="stat-value">{stability}</span>
            <span className="meter" aria-hidden="true">
              <span style={{ width: `${Math.max(0, Math.min(100, stability))}%` }} />
              <span className="meter-mark" style={{ left: `${ousting.below}%` }} />
            </span>
            {game.lowStabilityTicks > 0 && (
              <span className="countdown" role="status">
                Ousted in {ousting.forTicks - game.lowStabilityTicks}d
              </span>
            )}
          </button>
        </Hint>
      </div>

      <ul className="tickers" aria-label="Markets">
        {sortedIds(game.world.resources).map((rid) => {
          const resource = game.world.resources[rid]!;
          const price = effectiveStat(game, { kind: 'resource', id: rid, stat: 'price' });
          const pct = ((price - resource.basePrice) * 100) / resource.basePrice;
          const level = pct >= 30 ? 'critical' : pct >= 10 ? 'warning' : 'calm';
          const color =
            level === 'critical'
              ? 'var(--critical)'
              : level === 'warning'
                ? 'var(--warning)'
                : 'var(--accent)';
          return (
            <li key={rid}>
              <Hint
                focusable={false}
                text={`${resource.name}: price per unit, normally ${formatPrice(resource.basePrice)}. It rises when open routes supply less than countries demand, and dearer goods upset factions at home. Click to see why.`}
              >
                <button
                  type="button"
                  className={`ticker ${level}`}
                  aria-label={`${resource.name} ${formatPrice(price)}, ${formatChange(price, resource.basePrice)} from normal. Why?`}
                  onClick={() =>
                    why({ kind: 'stat', ref: { kind: 'resource', id: rid, stat: 'price' } })
                  }
                >
                  <span className="ticker-name">{resource.name}</span>
                  <span className="ticker-price">{formatPrice(price)}</span>
                  <span className={`ticker-change tone-${level}`}>
                    {formatChange(price, resource.basePrice)}
                  </span>
                  <Sparkline
                    values={history[rid] ?? [price]}
                    base={resource.basePrice}
                    tone={color}
                    width={64}
                    height={20}
                  />
                </button>
              </Hint>
            </li>
          );
        })}
      </ul>

      <div className="clock">
        <span className="date" aria-live="polite">
          {formatDate(game.tick)}
        </span>
        <div className="speed-group" role="group" aria-label="Game speed">
          <button
            type="button"
            className={`pause ${nudgePlay ? 'nudge' : ''}`}
            aria-label={clock.paused ? 'Resume' : 'Pause'}
            aria-pressed={clock.paused}
            onClick={actions.togglePause}
            title="Pause or resume (Space)"
          >
            {clock.paused ? (
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path d="M3.5 2.2 L11.5 7 L3.5 11.8 Z" fill="currentColor" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <rect x="2.5" y="2" width="3" height="10" rx="1" fill="currentColor" />
                <rect x="8.5" y="2" width="3" height="10" rx="1" fill="currentColor" />
              </svg>
            )}
          </button>
          {SPEEDS.map((speed, i) => (
            <button
              key={speed}
              type="button"
              aria-pressed={!clock.paused && clock.speed === speed}
              onClick={() => actions.setSpeed(speed)}
              title={`Speed ${speed}× (key ${i + 1})`}
            >
              {speed}×
            </button>
          ))}
        </div>
        <button
          type="button"
          className="icon-button help-button"
          aria-label="How to play"
          title="How to play (?)"
          onClick={onOpenHelp}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <circle cx="9" cy="9" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <path
              d="M6.9 7a2.2 2.2 0 1 1 3.2 1.95c-.65.35-1.1.8-1.1 1.55v.3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <circle cx="9" cy="13.1" r="0.9" fill="currentColor" />
          </svg>
        </button>
      </div>
    </header>
  );
}
