import { useEffect, useRef } from 'react';

interface Props {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onShowBriefing: () => void;
  readonly onRestartSteps: () => void;
  readonly autoPause: boolean;
  readonly onAutoPause: (on: boolean) => void;
  readonly onNewGame: () => void;
}

/** A one-page reference: the goal, the screen, how to act, and the shortcuts. */
export function HowToPlay({
  open,
  onClose,
  onShowBriefing,
  onRestartSteps,
  autoPause,
  onAutoPause,
  onNewGame,
}: Props) {
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
            The Stability meter counts down when you are in danger.
          </p>
        </section>

        <section>
          <h3>How things connect</h3>
          <p>
            Trouble abroad becomes trouble at home. A closed route cuts supply, prices rise, the
            factions who buy those goods grow unhappy, and stability falls. Most crises can be seen
            coming: watch relations and prices, and act before they tip over.
          </p>
          <p>
            Your neighbours have goals of their own and act on them without waiting for you. Poor
            Corvan wants money from the strait, Thessa wants Corvan as an ally, Veskar wants dearer
            oil, and Orrin wants to be your friend. The worse relations get, the bolder they become.
          </p>
          <p>
            Select a country to see what it wants and its current ambition. When a neighbour is
            close to a harmful move, Intelligence warns you in the news, while there is still time
            to act.
          </p>
          <p>
            To trace any ripple back to its cause, click a meter or a price, a faction on your own
            country's page, or "Why did this happen?" on a memo or report. For a neighbour's move,
            the panel shows what drove it. The game pauses while you read.
          </p>
        </section>

        <section>
          <h3>The screen</h3>
          <dl className="help-list">
            <div>
              <dt>Meters and markets</dt>
              <dd>
                Stability, treasury and influence top right; prices bottom left. Hover any of them
                for details; click one to see why it is where it is.
              </dd>
            </div>
            <div>
              <dt>Map</dt>
              <dd>
                Click a country or a strait to see its trade and the orders that concern it; click
                your own country for the mood at home. Lenses under the map (keys 1 to 5) show
                relations, trade, prices, unrest or intelligence.
              </dd>
            </div>
            <div>
              <dt>Unfolding</dt>
              <dd>Bottom left: policies in force and orders still under way.</dd>
            </div>
            <div>
              <dt>Memos and reports</dt>
              <dd>
                On the right: urgent memos and your advisor on top, the pile of reports below, and
                the cabinet, where every order is filed by ministry.
              </dd>
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
                <kbd>+</kbd> <kbd>−</kbd>
              </dt>
              <dd>Faster or slower</dd>
            </div>
            <div>
              <dt>
                <kbd>1</kbd>–<kbd>5</kbd>
              </dt>
              <dd>Map lens: relations, trade, prices, unrest, intelligence</dd>
            </div>
            <div>
              <dt>
                <kbd>D</kbd>
              </dt>
              <dd>The cabinet: every order</dd>
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

      <section className="help-settings">
        <h3>This game</h3>
        <label className="toggle">
          <input
            id="auto-pause"
            type="checkbox"
            checked={autoPause}
            onChange={(e) => onAutoPause(e.target.checked)}
          />
          <span>Pause when a crisis breaks (urgent memos)</span>
        </label>
      </section>

      <div className="sheet-actions">
        <button type="button" className="button" onClick={onNewGame}>
          New game
        </button>
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
