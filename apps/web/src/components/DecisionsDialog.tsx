import type { GameState } from '@ripple/engine';
import { useEffect, useRef } from 'react';
import { playerDecisions } from '../game/describe';
import { DecisionCard } from './DecisionCard';

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
        Costs are paid when you sign. Time keeps running while you decide unless you pause. Click a
        country on the map to see only the orders that concern it.
      </p>
      <ul className="decision-list">
        {playerDecisions(game).map((def) => (
          <DecisionCard key={def.id} game={game} def={def} onSigned={onClose} />
        ))}
      </ul>
    </dialog>
  );
}
