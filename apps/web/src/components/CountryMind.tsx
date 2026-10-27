import type { GameState } from '@ripple/engine';
import { ambitionOf, brewing, needWord, wantsOf } from '../game/intel';

interface Props {
  readonly game: GameState;
  readonly country: string;
}

/**
 * What a computer country wants, its current ambition, and any harmful move it
 * is weighing. Read from the same scores the country decides by.
 */
export function CountryMind({ game, country }: Props) {
  const wants = wantsOf(game, country);
  const ambition = ambitionOf(game, country);
  const weighing = brewing(game).find((b) => b.country === country);
  if (wants.length === 0 && !ambition && !weighing) return null;
  const name = game.world.countries[country]?.name ?? country;

  return (
    <section className="drawer-section mind" aria-labelledby={`mind-${country}`}>
      <h3 id={`mind-${country}`}>What {name} wants</h3>
      {ambition && (
        <p className="mind-ambition">
          <span className="mind-kicker">Ambition</span>
          <span>{ambition.name}</span>
          <span className="mind-progress" aria-label={`${ambition.current} of ${ambition.target}`}>
            <span
              style={{
                width: `${Math.max(0, Math.min(100, (ambition.current * 100) / Math.max(1, ambition.target)))}%`,
              }}
            />
          </span>
        </p>
      )}
      {wants.length > 0 && (
        <ul className="mind-wants">
          {wants.map((w) => (
            <li key={w.goal}>
              <span>{w.label.charAt(0).toUpperCase() + w.label.slice(1)}</span>
              <span className={`mind-need ${w.need >= 6_600 ? 'strong' : ''}`}>
                {needWord(w.need)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {weighing && (
        <p className="mind-weighing" role="status">
          <span className="mind-kicker">Weighing</span>
          {weighing.name}
          <span className="muted small">
            {weighing.score > weighing.inertia ? 'Could happen any day.' : 'Close to tipping over.'}
          </span>
        </p>
      )}
    </section>
  );
}
