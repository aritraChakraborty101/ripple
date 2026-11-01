import type { AdvisorTip } from '@ripple/content';
import type { GameState } from '@ripple/engine';
import { actions } from '../game/store';
import { DecisionCard } from './DecisionCard';
import { Memo } from './Memo';

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
    <Memo
      kind="advice"
      label="Your advisor"
      headingId="advisor-title"
      onDismiss={actions.dismissAdvice}
      dismissLabel="Dismiss advice"
    >
      <p id="advisor-title" className="advisor-text">
        {tip.text}
      </p>
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
    </Memo>
  );
}
