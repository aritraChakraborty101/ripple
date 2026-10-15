import type { GameState } from '@ripple/engine';
import { useRef, type KeyboardEvent } from 'react';
import type { Dispatch } from '../game/news';
import { actions } from '../game/store';
import { Dispatches } from './Dispatches';
import { HomeFront } from './HomeFront';
import { Relations } from './Relations';

export type Tab = 'news' | 'home' | 'relations';

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'news', label: 'News' },
  { id: 'home', label: 'Home' },
  { id: 'relations', label: 'Relations' },
];

interface Props {
  readonly game: GameState;
  readonly dispatches: readonly Dispatch[];
  readonly tab: Tab;
  readonly onTab: (tab: Tab) => void;
  readonly autoPause: boolean;
  readonly onOpenOrders: () => void;
  readonly onSelectCountry: (id: string) => void;
}

/** One tab at a time, so the side panel never pushes the map off screen. */
export function SidePanel(props: Props) {
  const { game, tab, onTab } = props;
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Arrow keys move between tabs, as in any tab list.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const index = TABS.findIndex((t) => t.id === tab);
    const next = TABS.at((index + (event.key === 'ArrowRight' ? 1 : -1)) % TABS.length)!;
    onTab(next.id);
    tabRefs.current[next.id]?.focus();
  };

  return (
    <aside className="side" aria-label="Briefing">
      <button
        type="button"
        className="button primary wide"
        onClick={props.onOpenOrders}
        disabled={game.outcome !== null}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        Sign an order
      </button>

      <div className="tabs" role="tablist" aria-label="Briefing sections" onKeyDown={onKeyDown}>
        {TABS.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[t.id] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            className="tab"
            onClick={() => onTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="tab-panel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'news' && (
          <Dispatches dispatches={props.dispatches} onSelectCountry={props.onSelectCountry} />
        )}
        {tab === 'home' && <HomeFront game={game} />}
        {tab === 'relations' && <Relations game={game} onSelectCountry={props.onSelectCountry} />}
      </div>

      <div className="side-foot">
        <label className="toggle">
          <input
            id="auto-pause"
            type="checkbox"
            checked={props.autoPause}
            onChange={(e) => actions.setAutoPause(e.target.checked)}
          />
          <span>Pause when a crisis breaks</span>
        </label>
        <button type="button" className="text-button" onClick={actions.newGame}>
          New game
        </button>
      </div>
    </aside>
  );
}
