import type { AdvisorTip } from '@ripple/content';
import type { GameState } from '@ripple/engine';
import { actions } from '../game/store';
import { DecisionCard } from './DecisionCard';

interface Props {
  readonly game: GameState;
  readonly tip: AdvisorTip;
  readonly onShowCountry: (id: string) => void;
}

/** Advice at the moment it matters, with the orders it recommends ready to sign. */
export function AdvisorCard({ game, tip, onShowCountry }: Props) {
  const suggested = tip.suggest.flatMap((s) => {
    const def = game.defs.decisions[s.decision];
    return def ? [{ def, target: s.target }] : [];
  });
  const country = tip.country ? game.world.countries[tip.country] : undefined;

  return (
    <aside className="advisor" aria-labelledby="advisor-title" aria-live="polite">
      <div className="advisor-head">
        <p id="advisor-title" className="eyebrow">
          Your advisor
        </p>
        <button
          type="button"
          className="icon-button small-icon"
          aria-label="Dismiss advice"
          onClick={actions.dismissAdvice}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      <p className="advisor-text">{tip.text}</p>
      {suggested.length > 0 && (
        <ul className="decision-list">
          {suggested.map(({ def, target }) => (
            <DecisionCard
              key={`${def.id}>${target ?? ''}`}
              game={game}
              def={def}
              {...(target !== undefined ? { target } : {})}
              compact
            />
          ))}
        </ul>
      )}
      {country && (
        <button
          type="button"
          className="text-button inline"
          onClick={() => onShowCountry(country.id)}
        >
          Show {country.name} on the map
        </button>
      )}
    </aside>
  );
}
