import { effectiveStat, sortedIds, type GameState } from '@ripple/engine';
import { stabilityTone } from '../game/describe';
import { useWhy } from './WhyContext';

interface Props {
  readonly game: GameState;
}

/** Stability and the factions behind it. */
export function HomeFront({ game }: Props) {
  const me = game.rules.playerCountry;
  const { ousting } = game.rules;
  const stability = effectiveStat(game, { kind: 'country', id: me, stat: ousting.stat });
  const tone = stabilityTone(stability, ousting.below);
  const why = useWhy();
  const factions = sortedIds(game.world.factions)
    .map((id) => game.world.factions[id]!)
    .filter((f) => f.country === me);

  return (
    <section aria-labelledby="home-title" className="tab-section">
      <div className="section-head">
        <h2 id="home-title">Home front</h2>
        <span className="muted small">
          Ousted below {ousting.below} for {ousting.forTicks} days
        </span>
      </div>

      <div className={`gauge ${tone}`}>
        <span className="gauge-label">Stability</span>
        <span className="gauge-value">{stability}</span>
        <div className="meter" aria-hidden="true">
          <div style={{ width: `${Math.max(0, Math.min(100, stability))}%` }} />
          <span className="meter-mark" style={{ left: `${ousting.below}%` }} />
        </div>
        {game.lowStabilityTicks > 0 && (
          <p className="warning-line" role="status">
            Below {ousting.below} for {game.lowStabilityTicks} of {ousting.forTicks} days. Act now.
          </p>
        )}
        <button
          type="button"
          className="text-button inline gauge-why"
          onClick={() =>
            why({ kind: 'stat', ref: { kind: 'country', id: me, stat: ousting.stat } })
          }
        >
          Why is stability at {stability}?
        </button>
      </div>

      <ul className="rows">
        {factions.map((f) => {
          const base = f.stats.satisfaction ?? 50;
          const now = effectiveStat(game, { kind: 'faction', id: f.id, stat: 'satisfaction' });
          const change = now - base;
          return (
            <li key={f.id}>
              <button
                type="button"
                className="row row-button"
                aria-label={`${f.name}: satisfaction ${now}. Why?`}
                onClick={() =>
                  why({ kind: 'stat', ref: { kind: 'faction', id: f.id, stat: 'satisfaction' } })
                }
              >
                <span>{f.name}</span>
                <span className="row-value">
                  {now}
                  <span
                    className={`delta ${change < -9 ? 'up-bad' : change < 0 ? 'warn' : 'calm'}`}
                  >
                    {change > 0 ? `+${change}` : change < 0 ? `−${-change}` : ''}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="hint">Select a faction to see what is weighing on it.</p>
    </section>
  );
}
