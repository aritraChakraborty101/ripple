import type { Briefing, BriefingSection } from '@ripple/content';
import { useEffect, useRef, useState } from 'react';

interface Props {
  readonly briefing: Briefing;
  readonly open: boolean;
  /** A country's display name, for the who's-who. */
  readonly countryName: (id: string) => string;
  readonly onClose: () => void;
}

/** A cause-and-effect chain: boxes joined by arrows, each with an optional note on timing. */
function Chain({ steps }: { steps: NonNullable<BriefingSection['chain']> }) {
  return (
    <ol className="briefing-chain" aria-label="How it unfolds">
      {steps.map((step) => (
        <li key={step.label}>
          <span className="chain-label">{step.label}</span>
          {step.note && <span className="chain-note">{step.note}</span>}
        </li>
      ))}
    </ol>
  );
}

function Cast({
  cast,
  countryName,
}: {
  cast: NonNullable<BriefingSection['cast']>;
  countryName: (id: string) => string;
}) {
  return (
    <dl className="briefing-cast">
      {cast.map((c) => (
        <div key={c.country}>
          <dt>{countryName(c.country)}</dt>
          <dd>{c.text}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The opening briefing, one page at a time: who you are, how you win or
 * lose, how trouble travels, who your neighbours are, and how to act.
 */
export function BriefingDialog({ briefing, open, countryName, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [page, setPage] = useState(0);
  const pages = briefing.sections;
  const section = pages[Math.min(page, pages.length - 1)]!;
  const last = page >= pages.length - 1;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setPage(0);
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet briefing"
      aria-labelledby="briefing-title"
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' && !last) setPage((p) => p + 1);
        if (e.key === 'ArrowLeft' && page > 0) setPage((p) => p - 1);
      }}
    >
      <p className="eyebrow">
        Briefing · {page + 1} of {pages.length}
      </p>
      <h2 id="briefing-title">{briefing.title}</h2>

      <section className="briefing-page" key={page} aria-live="polite">
        <h3>{section.heading}</h3>
        <p>{section.text}</p>
        {section.chain && <Chain steps={section.chain} />}
        {section.cast && <Cast cast={section.cast} countryName={countryName} />}
      </section>

      <div className="briefing-dots" role="tablist" aria-label="Briefing pages">
        {pages.map((p, i) => (
          <button
            key={p.heading}
            type="button"
            role="tab"
            aria-selected={i === page}
            aria-label={`${i + 1}. ${p.heading}`}
            title={p.heading}
            onClick={() => setPage(i)}
          />
        ))}
      </div>

      <div className="sheet-actions">
        {page > 0 ? (
          <button type="button" className="button" onClick={() => setPage(page - 1)}>
            Back
          </button>
        ) : (
          <button type="button" className="text-button inline" onClick={onClose}>
            Skip the briefing
          </button>
        )}
        <span className="muted small">The game is paused.</span>
        {last ? (
          <button type="button" className="button primary" onClick={onClose} autoFocus>
            Take office
          </button>
        ) : (
          <button
            type="button"
            className="button primary"
            onClick={() => setPage(page + 1)}
            autoFocus
          >
            Next
          </button>
        )}
      </div>
    </dialog>
  );
}
