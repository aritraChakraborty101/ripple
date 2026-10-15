import { canIssue, sortedIds, type GameState } from '@ripple/engine';
import { useEffect, useRef } from 'react';
import { describeCosts, durationLabel, oddsLabel } from '../game/describe';
import { actions } from '../game/store';

interface Props {
  readonly game: GameState;
  readonly open: boolean;
  readonly onClose: () => void;
}

export function DecisionsDialog({ game, open, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const me = game.rules.playerCountry;

  return (
    <dialog ref={ref} className="sheet" aria-labelledby="decisions-title" onClose={onClose}>
      <div className="sheet-head">
        <div>
          <p className="eyebrow">Orders</p>
          <h2 id="decisions-title">What will you do?</h2>
        </div>
        <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
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
      <p className="sheet-note">
        Costs are paid when you sign. Time keeps running while you decide unless you pause.
      </p>

      <ul className="decision-list">
        {sortedIds(game.defs.decisions).map((id) => {
          const def = game.defs.decisions[id]!;
          const availability = canIssue(game, id, me);
          const costs = describeCosts(game, def);
          const odds = oddsLabel(def.chanceBp);
          return (
            <li key={id} className={`decision ${availability.ok ? '' : 'unavailable'}`}>
              <div className="decision-text">
                <h3>{def.name}</h3>
                <p>{def.description}</p>
                <dl className="decision-meta">
                  <div>
                    <dt>Cost</dt>
                    <dd>{costs.length > 0 ? costs.join(', ') : 'None'}</dd>
                  </div>
                  <div>
                    <dt>Takes</dt>
                    <dd>{durationLabel(def.durationDays)}</dd>
                  </div>
                  {odds && (
                    <div>
                      <dt>Odds</dt>
                      <dd>{odds}</dd>
                    </div>
                  )}
                </dl>
                {!availability.ok && <p className="decision-reason">{availability.reason}</p>}
              </div>
              <button
                type="button"
                className="button primary"
                disabled={!availability.ok}
                onClick={() => {
                  actions.issue(id);
                  onClose();
                }}
              >
                Sign
              </button>
            </li>
          );
        })}
      </ul>
    </dialog>
  );
}
