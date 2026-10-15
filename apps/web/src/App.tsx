import { useCallback, useEffect, useState } from 'react';
import { CrisisBanner } from './components/CrisisBanner';
import { DecisionsDialog } from './components/DecisionsDialog';
import { GameOver } from './components/GameOver';
import { Header } from './components/Header';
import { MapDrawer } from './components/MapDrawer';
import { SidePanel, type Tab } from './components/SidePanel';
import { Unfolding } from './components/Unfolding';
import { WorldMap } from './components/WorldMap';
import { SPEEDS } from './game/clock';
import type { Selection } from './game/selection';
import { actions, startLoop, useSession } from './game/store';

interface Shortcuts {
  readonly openOrders: () => void;
  readonly clearSelection: () => void;
}

function useKeyboardShortcuts({ openOrders, clearSelection }: Shortcuts): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      if (event.key === 'Escape') {
        clearSelection();
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) return;
      if (target?.getAttribute('role') === 'button') return;
      if (event.code === 'Space') {
        event.preventDefault();
        actions.togglePause();
        return;
      }
      if (event.key === 'd' || event.key === 'D') {
        openOrders();
        return;
      }
      const speed = SPEEDS[Number(event.key) - 1];
      if (speed !== undefined) actions.setSpeed(speed);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openOrders, clearSelection]);
}

export function App() {
  const session = useSession();
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('news');
  const [selection, setSelection] = useState<Selection>(null);
  useEffect(() => startLoop(), []);

  const openOrders = useCallback(() => setOrdersOpen(true), []);
  const clearSelection = useCallback(() => setSelection(null), []);
  useKeyboardShortcuts({ openOrders, clearSelection });

  const { game, alert } = session;
  const selectCountry = useCallback((id: string) => setSelection({ kind: 'country', id }), []);

  // A new game starts with nothing selected.
  useEffect(() => {
    setSelection(null);
  }, [game.seed]);

  const respondToAlert = () => {
    if (alert?.country) setSelection({ kind: 'country', id: alert.country });
    else setOrdersOpen(true);
    actions.dismissAlert();
  };

  return (
    <div className="app">
      <Header
        game={game}
        clock={session.clock}
        history={session.history}
        onOpenHome={() => setTab('home')}
      />
      <div className="body">
        <main className="stage">
          <div className="map-area">
            <WorldMap
              game={game}
              paused={session.clock.paused}
              selection={selection}
              onSelect={setSelection}
              alertCountry={alert?.country ?? null}
            />
            {alert && (
              <CrisisBanner
                alert={alert}
                paused={session.clock.paused}
                onRespond={respondToAlert}
              />
            )}
            {selection && (
              <MapDrawer
                game={game}
                selection={selection}
                dispatches={session.dispatches}
                onSelect={setSelection}
              />
            )}
          </div>
          <Unfolding game={game} onOpenOrders={openOrders} />
        </main>
        <SidePanel
          game={game}
          dispatches={session.dispatches}
          tab={tab}
          onTab={setTab}
          autoPause={session.autoPause}
          onOpenOrders={openOrders}
          onSelectCountry={selectCountry}
        />
      </div>
      <DecisionsDialog game={game} open={ordersOpen} onClose={() => setOrdersOpen(false)} />
      <GameOver game={game} tallies={session.tallies} startTreasury={session.startTreasury} />
    </div>
  );
}
