import { LENSES, type Lens } from '../game/lenses';

interface Props {
  readonly lens: Lens;
  readonly onLens: (lens: Lens) => void;
}

/** Bottom centre: which question the map answers. Keys 1 to 5 pick one. */
export function LensBar({ lens, onLens }: Props) {
  const current = LENSES.find((l) => l.id === lens)!;
  return (
    <nav className="lens-bar" aria-label="Map lens">
      <div className="lens-pills glass" role="radiogroup" aria-label="Map lens">
        {LENSES.map((l, i) => (
          <button
            key={l.id}
            type="button"
            role="radio"
            aria-checked={l.id === lens}
            onClick={() => onLens(l.id)}
            title={`${l.question} (key ${i + 1})`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <p className="lens-question" aria-live="polite">
        {current.question}
      </p>
    </nav>
  );
}
