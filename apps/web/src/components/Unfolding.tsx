import { policiesInForce, type GameState } from '@ripple/engine';
import { formatShortDate } from '../game/format';

interface Props {
  readonly game: GameState;
  /** Opens the orders dialog, where policies can be reversed. */
  readonly onOpenOrders: () => void;
}

/** A strip under the map: policies in force and orders still under way. */
export function Unfolding({ game, onOpenOrders }: Props) {
  const policies = policiesInForce(game);
  const nothing = policies.length === 0 && game.pending.length === 0;

  return (
    <section className="strip" aria-label="Your policies and orders under way">
      <span className="strip-label">Unfolding</span>
      {nothing ? (
        <span className="muted small">
          No orders under way. Policies you set and orders that take time appear here.
        </span>
      ) : (
        <ul className="chips">
          {policies.map((def) => (
            <li key={def.id}>
              <button
                type="button"
                className="chip policy"
                onClick={onOpenOrders}
                title="In force until you change it. Open your orders to change it."
              >
                <span className="chip-kind">In force</span>
                <span className="chip-name">{def.name}</span>
              </button>
            </li>
          ))}
          {game.pending.map((p) => {
            const def = game.defs.decisions[p.decision];
            const name = def?.name ?? p.decision;
            const total = Math.max(1, p.dueTick - p.issuedTick);
            const done = Math.min(1, (game.tick - p.issuedTick) / total);
            const left = Math.max(0, p.dueTick - game.tick);
            return (
              <li key={p.id} className="chip" title={`Signed ${formatShortDate(p.issuedTick)}`}>
                <span className="chip-name">{name}</span>
                <span
                  className="progress"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(done * 100)}
                  aria-label={`${name} progress`}
                >
                  <span style={{ width: `${done * 100}%` }} />
                </span>
                <span className="chip-due">{left === 0 ? 'now' : `${left}d`}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
