import type { GameState } from '@ripple/engine';
import { formatDate } from '../game/format';

interface Props {
  readonly game: GameState;
}

/** Orders signed but not yet resolved, with how far along each one is. */
export function Unfolding({ game }: Props) {
  return (
    <section aria-labelledby="unfolding-title">
      <div className="section-head">
        <h2 id="unfolding-title">Unfolding</h2>
        <span className="muted small">Your orders under way</span>
      </div>
      {game.pending.length === 0 ? (
        <p className="empty">
          No orders under way. Orders that take time will show their progress here.
        </p>
      ) : (
        <div className="unfolding">
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
