import type { FieldNote } from '../game/fieldNotes';

interface Props {
  readonly note: FieldNote;
  readonly onRead: () => void;
  readonly onTurnOff: () => void;
}

/** A one-time note on top of the reports: what just happened is new, and how to read it. */
export function FieldNoteCard({ note, onRead, onTurnOff }: Props) {
  return (
    <section className="field-note paper" aria-labelledby="field-note-title" role="note">
      <p className="eyebrow">Field note</p>
      <h2 id="field-note-title">{note.title}</h2>
      <p className="small">{note.text}</p>
      <div className="field-note-actions">
        <button type="button" className="button" onClick={onRead}>
          Got it
        </button>
        <button type="button" className="text-button inline" onClick={onTurnOff}>
          No more notes
        </button>
      </div>
    </section>
  );
}
