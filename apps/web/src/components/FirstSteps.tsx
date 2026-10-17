export type StepId = 'play' | 'country' | 'order' | 'home';

export const STEP_IDS: readonly StepId[] = ['play', 'country', 'order', 'home'];

interface Props {
  readonly done: ReadonlySet<StepId>;
  /** The name of the country the briefing points at, such as "Corvan". */
  readonly focusName: string;
  readonly onHide: () => void;
}

/** A short checklist that ticks itself off as the player does each thing. */
export function FirstSteps({ done, focusName, onHide }: Props) {
  const steps: { id: StepId; text: string }[] = [
    { id: 'play', text: 'Press play (or Space) to start the clock' },
    { id: 'country', text: `Click ${focusName} on the map to see your options` },
    { id: 'order', text: 'Sign your first order' },
    { id: 'home', text: 'Open the Home tab to see who is unhappy, and why' },
  ];
  const finished = steps.every((s) => done.has(s.id));

  return (
    <section className="first-steps" aria-labelledby="first-steps-title">
      <div className="first-steps-head">
        <h2 id="first-steps-title">First steps</h2>
        <button type="button" className="text-button inline" onClick={onHide}>
          {finished ? 'Done' : 'Hide'}
        </button>
      </div>
      {finished ? (
        <p className="small">
          That is the basics. Your advisor will speak up when something needs you.
        </p>
      ) : (
        <ol className="steps">
          {steps.map((s) => (
            <li key={s.id} className={done.has(s.id) ? 'done' : ''}>
              <span className="check" aria-hidden="true">
                {done.has(s.id) && (
                  <svg width="12" height="12" viewBox="0 0 12 12">
                    <path
                      d="M2.5 6.2 L5 8.6 L9.5 3.6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              <span>
                {s.text}
                {done.has(s.id) && <span className="visually-hidden"> (done)</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
