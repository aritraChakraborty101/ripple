import type { ReactNode } from 'react';
import type { Dispatch } from '../game/news';
import { Dispatches } from './Dispatches';

interface Props {
  readonly dispatches: readonly Dispatch[];
  readonly onSelectCountry: (id: string) => void;
  /** On top of the pile, such as the first-steps checklist. */
  readonly top?: ReactNode;
}

/** The pile of reports: everything that happened, newest on top. */
export function Reports({ dispatches, onSelectCountry, top }: Props) {
  return (
    <section className="reports" aria-labelledby="reports-title">
      <h2 id="reports-title" className="reports-title">
        Reports
      </h2>
      <div className="reports-pile">
        {top}
        <Dispatches dispatches={dispatches} onSelectCountry={onSelectCountry} />
      </div>
    </section>
  );
}
