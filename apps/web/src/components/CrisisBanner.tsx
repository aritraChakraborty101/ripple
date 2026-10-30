import { formatShortDate } from '../game/format';
import type { Dispatch } from '../game/news';
import { actions } from '../game/store';
import { whyOfDispatch } from '../game/why';
import { Memo } from './Memo';
import { useWhy } from './WhyContext';

interface Props {
  readonly alert: Dispatch;
  readonly paused: boolean;
  readonly onRespond: () => void;
}

/** A crisis lands as an urgent memo on top of the pile, so you never miss one at 5× speed. */
export function CrisisBanner({ alert, paused, onRespond }: Props) {
  const why = useWhy();
  const cause = whyOfDispatch(alert);
  return (
    <Memo
      kind="urgent"
      label={`Urgent · ${alert.tag}`}
      when={`${formatShortDate(alert.tick)}${paused ? ' · paused' : ''}`}
      headingId="crisis-headline"
      onDismiss={actions.dismissAlert}
      dismissLabel="Dismiss"
      role="alert"
    >
      <h2 id="crisis-headline" className="memo-headline">
        {alert.headline}
      </h2>
      {alert.detail && <p className="memo-text">{alert.detail}</p>}
      <div className="memo-actions">
        <button type="button" className="button primary" onClick={onRespond}>
          Respond
        </button>
        {cause && (
          <button type="button" className="button" onClick={() => why(cause)}>
            Why did this happen?
          </button>
        )}
      </div>
    </Memo>
  );
}
