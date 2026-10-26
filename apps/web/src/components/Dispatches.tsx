import { formatShortDate } from '../game/format';
import type { Dispatch } from '../game/news';
import { whyOfDispatch } from '../game/why';
import { useWhy } from './WhyContext';

interface Props {
  readonly dispatches: readonly Dispatch[];
  readonly onSelectCountry: (id: string) => void;
}

export function Dispatches({ dispatches, onSelectCountry }: Props) {
  const why = useWhy();
  if (dispatches.length === 0) {
    return (
      <p className="empty">
        All quiet. Press play (Space) to start the clock; news will arrive here as the world
        changes.
      </p>
    );
  }
  return (
    <ol className="feed" aria-live="polite" aria-label="Dispatches, newest first">
      {dispatches.map((d) => {
        const mine = d.source === 'order';
        return (
          <li key={d.id} className="dispatch">
            <div className="dispatch-meta">
              <span className={`dot ${mine ? 'mine' : d.severity}`} />
              <span
                className={`dispatch-tag ${mine ? 'mine' : d.severity === 'critical' ? 'critical' : ''}`}
              >
                {d.tag}
              </span>
              <span className="muted">· {formatShortDate(d.tick)}</span>
            </div>
            <h3>{d.headline}</h3>
            {d.detail && <p>{d.detail}</p>}
            {(whyOfDispatch(d) || d.country) && (
              <div className="dispatch-links">
                {whyOfDispatch(d) && (
                  <button
                    type="button"
                    className="text-button inline"
                    onClick={() => why(whyOfDispatch(d)!)}
                  >
                    {d.choice ? `Why did ${d.tag} do this?` : 'Why did this happen?'}
                  </button>
                )}
                {d.country && (
                  <button
                    type="button"
                    className="text-button inline"
                    onClick={() => onSelectCountry(d.country!)}
                  >
                    Show {d.tag} on the map
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
