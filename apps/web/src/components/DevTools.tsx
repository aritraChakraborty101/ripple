import { sortedIds, type GameState } from '@ripple/engine';
import { actions } from '../game/store';

interface Props {
  readonly game: GameState;
}

/**
 * Temporary controls for watching the simulation react. They go away once
 * crises and decisions happen inside the game.
 */
export function DevTools({ game }: Props) {
  return (
    <details className="devtools" open>
      <summary>Developer tools (temporary)</summary>
      <p>
        Force a crisis to watch it ripple through the markets. Real crises arrive with the next
        update.
      </p>
      <div className="devtools-actions">
        {sortedIds(game.world.chokepoints).map((id) => {
          const chokepoint = game.world.chokepoints[id]!;
          return (
            <button
              key={id}
              type="button"
              className={`button ${chokepoint.open ? 'danger' : ''}`}
              onClick={() => actions.setChokepoint(id, !chokepoint.open)}
            >
              {chokepoint.open ? `Close the ${chokepoint.name}` : `Reopen the ${chokepoint.name}`}
            </button>
          );
        })}
        <button type="button" className="button" onClick={actions.reset}>
          Restart
        </button>
      </div>
    </details>
  );
}
