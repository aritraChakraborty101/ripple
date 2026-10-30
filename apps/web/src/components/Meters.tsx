import { effectiveStat, hasBudget, monthlyBalance, type GameState } from '@ripple/engine';
import { stabilityTone } from '../game/describe';
import { formatMillions } from '../game/format';
import { TREASURY_HISTORY } from '../game/session';
import { Hint } from './Hint';
import { Sparkline } from './Sparkline';
import { useWhy } from './WhyContext';

interface Props {
  readonly game: GameState;
  readonly history: Readonly<Record<string, readonly number[]>>;
}

/** Top right: the three numbers that decide whether you survive. */
export function Meters({ game, history }: Props) {
  const id = game.rules.playerCountry;
  const { ousting } = game.rules;
  const stat = (name: string) => effectiveStat(game, { kind: 'country', id, stat: name });
  const why = useWhy();

  const stability = stat(ousting.stat);
  const tone = stabilityTone(stability, ousting.below);
  const daysLeft = ousting.forTicks - game.lowStabilityTicks;

  const treasury = stat('treasury');
  const budgeted = hasBudget(game, id);
  const balance = budgeted ? monthlyBalance(game, id) : 0;
  const balanceTone = balance < 0 ? (balance <= -5_000 ? 'critical' : 'warning') : 'calm';
  const treasuryTone = treasury < 0 ? 'critical' : 'calm';

  const influence = stat('influence');

  return (
    <section className="meters glass" aria-label="Your country">
      <Hint
        focusable={false}
        text={`How firmly you hold power. It follows your factions' mood. Below ${ousting.below} for ${ousting.forTicks} days and you are ousted. Click to see why it is where it is.`}
      >
        <button
          type="button"
          className={`meter-card ${tone}`}
          onClick={() => why({ kind: 'stat', ref: { kind: 'country', id, stat: ousting.stat } })}
          aria-label={`Stability ${stability}. Why is it at this level?`}
        >
          <span className="meter-top">
            <span className="meter-name">Stability</span>
            <span className="meter-number">{stability}</span>
          </span>
          <span className="meter-bar" aria-hidden="true">
            <span style={{ width: `${Math.max(0, Math.min(100, stability))}%` }} />
            <span className="meter-line" style={{ left: `${ousting.below}%` }} />
          </span>
          {game.lowStabilityTicks > 0 ? (
            <span className="meter-note tone-critical" role="status">
              Ousted in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
            </span>
          ) : (
            <span className="meter-note">Ousted below {ousting.below}</span>
          )}
        </button>
      </Hint>

      <Hint
        focusable={false}
        text="Money for orders, in billions. Taxes and trade pay into it at the end of every month, and dearer imports drain it. Below zero, debt weighs on stability. Click to see why it is where it is."
      >
        <button
          type="button"
          className={`meter-card ${treasuryTone}`}
          onClick={() => why({ kind: 'stat', ref: { kind: 'country', id, stat: 'treasury' } })}
          aria-label={`Treasury ${treasury} bn${budgeted ? `, ${formatMillions(balance, true)} a month` : ''}. Why?`}
        >
          <span className="meter-top">
            <span className="meter-name">Treasury</span>
            <span className="meter-number">{treasury}</span>
          </span>
          {budgeted && (
            <Sparkline
              values={history[TREASURY_HISTORY] ?? [treasury]}
              base={history[TREASURY_HISTORY]?.[0] ?? treasury}
              tone={balance < 0 ? 'var(--you)' : 'var(--ink-quiet)'}
              width={120}
              height={14}
            />
          )}
          <span className={`meter-note tone-${balanceTone}`}>
            {budgeted ? `${formatMillions(balance, true)} a month` : 'billions'}
          </span>
        </button>
      </Hint>

      <Hint
        focusable={false}
        text="Diplomatic capital. Envoys, speeches and deals spend it. It recovers by one a month, up to where it started."
      >
        <button
          type="button"
          className="meter-card"
          onClick={() => why({ kind: 'stat', ref: { kind: 'country', id, stat: 'influence' } })}
          aria-label={`Influence ${influence}. Why?`}
        >
          <span className="meter-top">
            <span className="meter-name">Influence</span>
            <span className="meter-number">{influence}</span>
          </span>
          <span className="meter-note">Recovers 1 a month</span>
        </button>
      </Hint>
    </section>
  );
}
