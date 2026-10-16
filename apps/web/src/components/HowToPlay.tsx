import { useEffect, useRef } from 'react';

interface Props {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onShowBriefing: () => void;
  readonly onRestartSteps: () => void;
}

/** A one-page reference: the goal, the screen, how to act, and the shortcuts. */
export function HowToPlay({ open, onClose, onShowBriefing, onRestartSteps }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="sheet help" aria-labelledby="help-title" onClose={onClose}>
      <div className="sheet-head">
        <div>
          <p className="eyebrow">Help</p>
          <h2 id="help-title">How to play</h2>
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

      <div className="help-body">
        <section>
          <h3>The goal</h3>
          <p>
            Stay in power for five years. You are ousted if stability stays below 20 for 30 days.
            The top bar counts down when you are in danger.
          </p>
        </section>

        <section>
          <h3>How things connect</h3>
          <p>
            Trouble abroad becomes trouble at home. A closed route cuts supply, prices rise, the
            factions who buy those goods grow unhappy, and stability falls. Most crises can be seen
            coming: watch relations and prices, and act before they tip over.
          </p>
        </section>

        <section>
          <h3>The screen</h3>
          <dl className="help-list">
            <div>
              <dt>Top bar</dt>
              <dd>Treasury, influence, stability and prices. Hover any of them for details.</dd>
            </div>
            <div>
              <dt>Map</dt>
              <dd>
                Each country shows its relations with you. Click a country or the strait to see its
                trade and the orders that concern it.
              </dd>
            </div>
            <div>
              <dt>Unfolding</dt>
              <dd>Under the map: policies in force and orders still under way.</dd>
            </div>
            <div>
              <dt>Side panel</dt>
              <dd>News as it happens, your factions at home, and relations with everyone.</dd>
            </div>
          </dl>
        </section>

        <section>
          <h3>Acting</h3>
          <p>
            Orders cost money or influence when you sign them. Some take weeks and some can fail.
            Policies such as tariffs stay in force until you lift them. You can sign orders while
            paused.
          </p>
        </section>

        <section>
          <h3>Shortcuts</h3>
          <dl className="help-list keys">
            <div>
              <dt>
                <kbd>Space</kbd>
              </dt>
              <dd>Pause or resume</dd>
            </div>
            <div>
              <dt>
                <kbd>1</kbd>–<kbd>4</kbd>
              </dt>
              <dd>Game speed</dd>
            </div>
            <div>
              <dt>
                <kbd>D</kbd>
              </dt>
              <dd>All orders</dd>
            </div>
            <div>
              <dt>
                <kbd>?</kbd>
              </dt>
              <dd>This help</dd>
            </div>
            <div>
              <dt>
                <kbd>Esc</kbd>
              </dt>
              <dd>Close details or a dialog</dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="sheet-actions">
        <button type="button" className="button" onClick={onRestartSteps}>
          Show first steps again
        </button>
        <button type="button" className="button" onClick={onShowBriefing}>
          Read the briefing again
        </button>
      </div>
    </dialog>
  );
}
