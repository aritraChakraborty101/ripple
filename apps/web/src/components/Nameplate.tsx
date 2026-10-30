import type { GameState } from '@ripple/engine';
import { SPEEDS, type ClockState } from '../game/clock';
import { ARCHETYPE_LABELS, formatDate } from '../game/format';
import { actions } from '../game/store';

interface Props {
  readonly game: GameState;
  readonly clock: ClockState;
  readonly onOpenHelp: () => void;
  /** Draw the eye to the play button before the first game starts. */
  readonly nudgePlay: boolean;
}

/** Top left: who you are, what day it is, and the clock. */
export function Nameplate({ game, clock, onOpenHelp, nudgePlay }: Props) {
  const country = game.world.countries[game.rules.playerCountry]!;
  return (
    <header className="nameplate glass">
      <div className="nameplate-id">
        <span className="you-mark" aria-hidden="true" />
        <div>
          <h1>{country.name}</h1>
          <p className="nameplate-sub">
            <span aria-live="polite">{formatDate(game.tick)}</span>
            <span className="sep" aria-hidden="true">
              ·
            </span>
            <span>{ARCHETYPE_LABELS[country.archetype]}</span>
          </p>
        </div>
      </div>
      <div className="clock-pill" role="group" aria-label="Game speed">
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
        {SPEEDS.map((speed) => (
          <button
            key={speed}
            type="button"
            aria-pressed={!clock.paused && clock.speed === speed}
            onClick={() => actions.setSpeed(speed)}
            title={`Speed ${speed}× (+ and − change speed)`}
          >
            {speed}×
          </button>
        ))}
        <button
          type="button"
          className="help-button"
          aria-label="How to play"
          title="How to play (?)"
          onClick={onOpenHelp}
        >
          ?
        </button>
      </div>
    </header>
  );
}
