import type { GameState, Ministry } from '@ripple/engine';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cabinet } from '../game/cabinet';
import { formatDate } from '../game/format';
import { DecisionCard } from './DecisionCard';

interface Props {
  readonly game: GameState;
  readonly open: boolean;
  readonly onClose: () => void;
  /** Close the cabinet and pick this order's country on the map. */
  readonly onAim: (decision: string) => void;
}

/**
 * Every order you can give, filed by ministry, on one sheet of paper over the
 * dimmed map. An order aimed at a country can be aimed here or on the map.
 */
export function Cabinet({ game, open, onClose, onAim }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [ministry, setMinistry] = useState<Ministry>('foreign');
  const files = useMemo(() => (open ? cabinet(game) : []), [game, open]);
  const current = files.find((f) => f.ministry.id === ministry);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="sheet cabinet" aria-labelledby="cabinet-title" onClose={onClose}>
      {open && (
        <>
          <header className="cabinet-head">
            <div>
              <p className="eyebrow">Cabinet · {formatDate(game.tick)}</p>
              <h2 id="cabinet-title">What will you do?</h2>
              <p className="sheet-note">
                Costs are paid when you sign. The world keeps moving while this is open unless you
                pause.
              </p>
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
          </header>

          <div className="cabinet-body">
            <nav className="ministries" aria-label="Ministries">
              {files.map((file) => (
                <button
                  key={file.ministry.id}
                  type="button"
                  aria-current={file.ministry.id === ministry ? 'true' : undefined}
                  onClick={() => setMinistry(file.ministry.id)}
                >
                  <span className="ministry-name">{file.ministry.label}</span>
                  <span className="ministry-brief">{file.ministry.brief}</span>
                  <span className="ministry-count">
                    {file.ready} of {file.orders.length} ready
                  </span>
                </button>
              ))}
            </nav>

            <section className="cabinet-orders" aria-label={current?.ministry.label}>
              {current && current.orders.length === 0 ? (
                <p className="muted">Nothing to sign here right now.</p>
              ) : (
                <ul className="decision-list">
                  {current?.orders.map((def) => (
                    <DecisionCard
                      key={def.id}
                      game={game}
                      def={def}
                      onSigned={onClose}
                      {...(def.targets !== undefined ? { onAim: () => onAim(def.id) } : {})}
                    />
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </dialog>
  );
}
