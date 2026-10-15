import { canIssue, type DecisionDef, type GameState } from '@ripple/engine';
import { describeCosts, durationLabel, oddsLabel } from '../game/describe';
import { actions } from '../game/store';

interface Props {
  readonly game: GameState;
  readonly def: DecisionDef;
  /** Called after the order is signed, for example to close a dialog. */
  readonly onSigned?: () => void;
  readonly compact?: boolean;
}

/** One order: what it does, what it costs, how long it takes, and a Sign button. */
export function DecisionCard({ game, def, onSigned, compact = false }: Props) {
  const availability = canIssue(game, def.id, game.rules.playerCountry);
  const costs = describeCosts(game, def);
  const odds = oddsLabel(def.chanceBp);
  return (
    <li className={`decision ${availability.ok ? '' : 'unavailable'} ${compact ? 'compact' : ''}`}>
      <div className="decision-text">
        <h3>{def.name}</h3>
        {!compact && <p>{def.description}</p>}
        <dl className="decision-meta">
          <div>
            <dt>Cost</dt>
            <dd>{costs.length > 0 ? costs.join(', ') : 'None'}</dd>
          </div>
          <div>
            <dt>Takes</dt>
            <dd>{durationLabel(def.durationDays)}</dd>
          </div>
          {odds && (
            <div>
              <dt>Odds</dt>
              <dd>{odds}</dd>
            </div>
          )}
        </dl>
        {!availability.ok && <p className="decision-reason">{availability.reason}</p>}
      </div>
      <button
        type="button"
        className="button primary"
        disabled={!availability.ok}
        title={compact ? def.description : undefined}
        onClick={() => {
          actions.issue(def.id);
          onSigned?.();
        }}
      >
        Sign
      </button>
    </li>
  );
}
