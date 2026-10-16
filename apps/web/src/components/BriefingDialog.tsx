import type { Briefing } from '@ripple/content';
import { useEffect, useRef } from 'react';

interface Props {
  readonly briefing: Briefing;
  readonly open: boolean;
  readonly onClose: () => void;
}

/** The opening briefing: who you are, how you win or lose, and where trouble starts. */
export function BriefingDialog({ briefing, open, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="sheet briefing" aria-labelledby="briefing-title" onClose={onClose}>
      <p className="eyebrow">Briefing</p>
      <h2 id="briefing-title">{briefing.title}</h2>
      <div className="briefing-sections">
        {briefing.sections.map((s) => (
          <section key={s.heading}>
            <h3>{s.heading}</h3>
            <p>{s.text}</p>
          </section>
        ))}
      </div>
      <div className="sheet-actions">
        <span className="muted small">The game is paused. Press play when you are ready.</span>
        <button type="button" className="button primary" onClick={onClose} autoFocus>
          Take office
        </button>
      </div>
    </dialog>
  );
}
