import { formatShortDate } from '../game/format';
import type { Dispatch } from '../game/news';
import { actions } from '../game/store';
import { whyOfDispatch } from '../game/why';
import { useWhy } from './WhyContext';

interface Props {
  readonly alert: Dispatch;
  readonly paused: boolean;
  readonly onRespond: () => void;
}

/** A crisis interrupts you over the map, so you never miss one at 5× speed. */
export function CrisisBanner({ alert, paused, onRespond }: Props) {
  const why = useWhy();
  const cause = whyOfDispatch(alert);
  return (
    <div className="crisis" role="alert">
      <div className="crisis-text">
        <span className="crisis-meta">
          {alert.tag} · {formatShortDate(alert.tick)}
          {paused ? ' · Game paused' : ''}
        </span>
        <strong>{alert.headline}</strong>
        {alert.detail && <span className="crisis-detail">{alert.detail}</span>}
      </div>
      <div className="crisis-actions">
        <button type="button" className="button primary" onClick={onRespond}>
          See what you can do
        </button>
        {cause && (
          <button type="button" className="button" onClick={() => why(cause)}>
            Why?
          </button>
        )}
        <button
          type="button"
          className="icon-button"
          aria-label="Dismiss"
          onClick={actions.dismissAlert}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
