import { effectiveStat, type GameState } from '@ripple/engine';
import { SPEEDS, type ClockState } from '../game/clock';
import { stabilityTone } from '../game/describe';
import { ARCHETYPE_LABELS, formatChange, formatDate, formatPrice } from '../game/format';
import { actions } from '../game/store';

interface Props {
  readonly game: GameState;
  readonly clock: ClockState;
}

export function Header({ game, clock }: Props) {
  const id = game.rules.playerCountry;
  const country = game.world.countries[id]!;
  const stat = (name: string) => effectiveStat(game, { kind: 'country', id, stat: name });
  const oil = game.world.resources.oil;
  const oilPrice = oil ? effectiveStat(game, { kind: 'resource', id: 'oil', stat: 'price' }) : 0;
  const oilUp = oil ? oilPrice > oil.basePrice : false;

  return (
    <header className="header">
      <div className="identity">
        <h1>{country.name}</h1>
        <span className="muted">{ARCHETYPE_LABELS[country.archetype]}</span>
      </div>

      <dl className="stats">
        <div className="stat">
          <dt>Treasury</dt>
          <dd>{stat('treasury')} bn</dd>
        </div>
        <div className="stat">
          <dt>Stability</dt>
          <dd className={`tone-${stabilityTone(stat('stability'), game.rules.ousting.below)}`}>
            {stat('stability')}
          </dd>
        </div>
        {oil && (
          <div className="stat">
            <dt>Crude</dt>
            <dd>
              {formatPrice(oilPrice)}
              <span className={`delta ${oilUp ? 'up-bad' : 'calm'}`}>
                {formatChange(oilPrice, oil.basePrice)}
              </span>
            </dd>
          </div>
        )}
        <div className="stat">
          <dt>Influence</dt>
          <dd>{stat('influence')}</dd>
        </div>
      </dl>

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
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              type="button"
              aria-pressed={!clock.paused && clock.speed === speed}
              onClick={() => actions.setSpeed(speed)}
              title={`Speed ${speed}× (key ${SPEEDS.indexOf(speed) + 1})`}
            >
              {speed}×
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
