import { canIssue, targetsOf, type DecisionDef, type GameState } from '@ripple/engine';
import { useState } from 'react';
import { describeCosts, durationLabel, isUndo, oddsLabel } from '../game/describe';
import { fillNames } from '../game/format';
import { actions } from '../game/store';

interface Props {
  readonly game: GameState;
  readonly def: DecisionDef;
  /**
   * For an order aimed at a country: aim it at this one, with no picker (as on
   * a country's page or in the advisor's suggestion).
   */
  readonly target?: string;
  /** Called after the order is signed, for example to close a dialog. */
  readonly onSigned?: () => void;
  readonly compact?: boolean;
}

/**
 * One order: what it does, what it costs, how long it takes, and a Sign
 * button. An order aimed at a country shows whom it is aimed at; when no
 * target is given, the player picks one from the countries it can reach.
 */
export function DecisionCard({ game, def, target, onSigned, compact = false }: Props) {
  const me = game.rules.playerCountry;
  const all =
    def.targets === undefined || target !== undefined
      ? []
      : targetsOf(game, def, me).filter((t): t is string => t !== undefined);
  // An undo order offers only the countries it can undo something for.
  const options = isUndo(game, def) ? all.filter((t) => canIssue(game, def.id, me, t).ok) : all;
  const firstOpen = options.find((t) => canIssue(game, def.id, me, t).ok) ?? options[0];
  const [picked, setPicked] = useState<string | undefined>(undefined);
  // A pick that is no longer offered falls back to the first open target.
  const chosen = target ?? (picked !== undefined && options.includes(picked) ? picked : firstOpen);

  const availability = canIssue(game, def.id, me, chosen);
  const fill = (text: string) => fillNames(text, game.world.countries, me, chosen);
  const costs = describeCosts(game, def);
  const odds = oddsLabel(def.chanceBp);
  const name = fill(def.name);

  return (
    <li className={`decision ${availability.ok ? '' : 'unavailable'} ${compact ? 'compact' : ''}`}>
      <div className="decision-text">
        <h3>{name}</h3>
        {options.length > 1 && (
          <div className="target-picker" role="radiogroup" aria-label={`Whom to aim it at`}>
            {options.map((t) => {
              const open = canIssue(game, def.id, me, t);
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={t === chosen}
                  className={`target ${open.ok ? '' : 'closed'}`}
                  title={open.ok ? undefined : fillNames(open.reason, game.world.countries, me, t)}
                  onClick={() => setPicked(t)}
                >
                  {game.world.countries[t]?.name ?? t}
                </button>
              );
            })}
          </div>
        )}
        {!compact && <p>{fill(def.description)}</p>}
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
        {!availability.ok && <p className="decision-reason">{fill(availability.reason)}</p>}
      </div>
      <button
        type="button"
        className="button primary"
        disabled={!availability.ok}
        title={compact ? fill(def.description) : undefined}
        aria-label={`Sign: ${name}`}
        onClick={() => {
          actions.issue(def.id, chosen);
          // The country just chosen is now busy; next time, start from one that is open.
          setPicked(undefined);
          onSigned?.();
        }}
      >
        Sign
      </button>
    </li>
  );
}
