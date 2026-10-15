import { effectiveStat, relationId, sortedIds, type GameState } from '@ripple/engine';
import { relationLabel, relationTone } from '../game/describe';

interface Props {
  readonly game: GameState;
  readonly onSelectCountry: (id: string) => void;
}

/** How each country regards the player, from hostile to friendly. */
export function Relations({ game, onSelectCountry }: Props) {
  const me = game.rules.playerCountry;
  const others = sortedIds(game.world.countries).filter((id) => id !== me);

  return (
    <section aria-labelledby="relations-title" className="tab-section">
      <div className="section-head">
        <h2 id="relations-title">Relations</h2>
        <span className="muted small">−100 hostile · 100 allied</span>
      </div>
      <ul className="rows">
        {others.map((id) => {
          const value = effectiveStat(game, {
            kind: 'relation',
            id: relationId(me, id),
            stat: 'value',
          });
          const tone = relationTone(value);
          const clamped = Math.max(-100, Math.min(100, value));
          return (
            <li key={id}>
              <button
                type="button"
                className="row relation-row row-button"
                onClick={() => onSelectCountry(id)}
                aria-label={`${game.world.countries[id]!.name}: ${value}, ${relationLabel(value)}. Show on the map.`}
              >
                <span>{game.world.countries[id]!.name}</span>
                <span className="center-meter" aria-hidden="true">
                  <span
                    className={tone}
                    style={
                      clamped >= 0
                        ? { left: '50%', width: `${clamped / 2}%` }
                        : { left: `${50 + clamped / 2}%`, width: `${-clamped / 2}%` }
                    }
                  />
                </span>
                <span className={`row-value tone-${tone}`}>
                  {value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '0'}
                  <span className="row-note">{relationLabel(value)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="hint">Select a country to see its routes and the orders that concern it.</p>
    </section>
  );
}
