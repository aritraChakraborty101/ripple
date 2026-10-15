import { policiesInForce, type GameState } from '@ripple/engine';
import { formatDate } from '../game/format';

interface Props {
  readonly game: GameState;
  /** Opens the orders dialog, where policies can be reversed. */
  readonly onOpenOrders: () => void;
}

/** Policies you have in force, and orders signed but not yet resolved. */
export function Unfolding({ game, onOpenOrders }: Props) {
  const policies = policiesInForce(game);
  const nothing = policies.length === 0 && game.pending.length === 0;

  return (
    <section aria-labelledby="unfolding-title">
      <div className="section-head">
        <h2 id="unfolding-title">Unfolding</h2>
        <span className="muted small">Your policies and orders under way</span>
      </div>
      {nothing ? (
        <p className="empty">
          No orders under way. Policies you set and orders that take time will show here.
        </p>
      ) : (
        <div className="unfolding">
          {policies.map((def) => {
            const since = game.lastIssued[def.id];
            return (
              <article key={def.id} className="order policy">
                <span className="muted small">
                  In force{since !== undefined ? ` since ${formatDate(since)}` : ''}
                </span>
                <span className="order-name">{def.name}</span>
                <button type="button" className="text-button inline" onClick={onOpenOrders}>
                  Change in your orders
                </button>
              </article>
            );
          })}
          {game.pending.map((p) => {
            const def = game.defs.decisions[p.decision];
            const total = Math.max(1, p.dueTick - p.issuedTick);
            const done = Math.min(1, (game.tick - p.issuedTick) / total);
            const left = Math.max(0, p.dueTick - game.tick);
            return (
              <article key={p.id} className="order">
                <span className="muted small">Signed {formatDate(p.issuedTick)}</span>
                <span className="order-name">{def?.name ?? p.decision}</span>
                <div
                  className="progress"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(done * 100)}
                  aria-label={`${def?.name ?? p.decision} progress`}
                >
                  <div style={{ width: `${done * 100}%` }} />
                </div>
                <span className="order-due">
                  {left === 0 ? 'Resolving' : `${left} ${left === 1 ? 'day' : 'days'} to go`}
                </span>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
