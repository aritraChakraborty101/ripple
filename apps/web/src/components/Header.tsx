import { effectiveStat, sortedIds, type GameState } from '@ripple/engine';
import { SPEEDS, type ClockState } from '../game/clock';
import { stabilityTone } from '../game/describe';
import { ARCHETYPE_LABELS, formatChange, formatDate, formatPrice } from '../game/format';
import { actions } from '../game/store';
import { Sparkline } from './Sparkline';

interface Props {
  readonly game: GameState;
  readonly clock: ClockState;
  readonly history: Readonly<Record<string, readonly number[]>>;
  readonly onOpenHome: () => void;
}

/** Everything you need at a glance: your country, your numbers, the markets and the clock. */
export function Header({ game, clock, history, onOpenHome }: Props) {
  const id = game.rules.playerCountry;
  const country = game.world.countries[id]!;
  const { ousting } = game.rules;
  const stat = (name: string) => effectiveStat(game, { kind: 'country', id, stat: name });
  const stability = stat(ousting.stat);
  const tone = stabilityTone(stability, ousting.below);

  return (
    <header className="topbar">
      <div className="identity">
        <h1>{country.name}</h1>
        <span className="muted small">{ARCHETYPE_LABELS[country.archetype]}</span>
      </div>

      <div className="stats">
        <div className="stat">
          <span className="stat-label">Treasury</span>
          <span className="stat-value">{stat('treasury')} bn</span>
        </div>
        <div className="stat">
          <span className="stat-label">Influence</span>
          <span className="stat-value">{stat('influence')}</span>
        </div>
        <button
          type="button"
          className={`stat stat-button gauge-mini ${tone}`}
          onClick={onOpenHome}
          title="Stability: open the Home tab"
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
            <li key={rid} className={`ticker ${level}`}>
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
            className="pause"
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
      </div>
    </header>
  );
}
