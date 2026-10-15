import { formatShortDate } from '../game/format';
import type { Dispatch } from '../game/news';

interface Props {
  readonly dispatches: readonly Dispatch[];
}

export function Dispatches({ dispatches }: Props) {
  return (
    <section
      aria-labelledby="dispatches-title"
      style={{ display: 'flex', flexDirection: 'column', flex: 1 }}
    >
      <div className="section-head">
        <h2 id="dispatches-title">Dispatches</h2>
        <span className="muted small">
          {dispatches.length > 0 ? `${dispatches.length} so far` : ''}
        </span>
      </div>

      {dispatches.length === 0 ? (
        <p className="empty">
          All quiet. Press play to start the clock; news will arrive here as the world changes.
        </p>
      ) : (
        <ol className="feed" aria-live="polite">
          {dispatches.map((d) => (
            <li key={d.id} className="dispatch">
              <div className="dispatch-meta">
                <span className={`dot ${d.severity}`} />
                <span className={`dispatch-tag ${d.severity === 'critical' ? 'critical' : ''}`}>
                  {d.tag}
                </span>
                <span className="muted">· {formatShortDate(d.tick)}</span>
              </div>
              <h3>{d.headline}</h3>
              {d.detail && <p>{d.detail}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
