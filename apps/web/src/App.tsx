import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AdvisorCard } from './components/AdvisorCard';
import { BriefingDialog } from './components/BriefingDialog';
import { DevPanel } from './components/DevPanel';
import { CrisisBanner } from './components/CrisisBanner';
import { DecisionsDialog } from './components/DecisionsDialog';
import { FirstSteps, STEP_IDS, type StepId } from './components/FirstSteps';
import { GameOver } from './components/GameOver';
import { HowToPlay } from './components/HowToPlay';
import { MapDrawer } from './components/MapDrawer';
import { Markets } from './components/Markets';
import { Meters } from './components/Meters';
import { Nameplate } from './components/Nameplate';
import { SidePanel, type Tab } from './components/SidePanel';
import { Unfolding } from './components/Unfolding';
import { WhyContext } from './components/WhyContext';
import { WhyDialog } from './components/WhyDialog';
import { WorldMap } from './components/WorldMap';
import { SPEEDS } from './game/clock';
import { readPref, writePref } from './game/prefs';
import { firstCrisisGuide, firstCrisisMap } from './game/scenario';
import type { Selection } from './game/selection';
import { actions, devMode, startLoop, useSession } from './game/store';
import type { WhyTarget } from './game/why';

interface Shortcuts {
  readonly openOrders: () => void;
  readonly openHelp: () => void;
  readonly clearSelection: () => void;
  readonly toggleDev: () => void;
}

function useKeyboardShortcuts({
  openOrders,
  openHelp,
  clearSelection,
  toggleDev,
}: Shortcuts): void {
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
      if (event.key === '?') {
        openHelp();
        return;
      }
      if (event.key === '+' || event.key === '=') {
        actions.faster();
        return;
      }
      if (event.key === '-' || event.key === '_') {
        actions.slower();
        return;
      }
      if (event.key === '`' && devMode) {
        toggleDev();
        return;
      }
      const speed = SPEEDS[Number(event.key) - 1];
      if (speed !== undefined) actions.setSpeed(speed);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openOrders, openHelp, clearSelection, toggleDev]);
}

/** Tracks the first-steps checklist and remembers it across visits. */
function useFirstSteps(): {
  done: ReadonlySet<StepId>;
  visible: boolean;
  mark: (step: StepId) => void;
  hide: () => void;
  restart: () => void;
} {
  const [done, setDone] = useState<ReadonlySet<StepId>>(
    () => new Set(readPref<StepId[]>('steps.done', [])),
  );
  const [visible, setVisible] = useState(() => !readPref('steps.hidden', false));

  const mark = useCallback((step: StepId) => {
    setDone((prev) => {
      if (prev.has(step)) return prev;
      const next = new Set(prev).add(step);
      writePref(
        'steps.done',
        STEP_IDS.filter((s) => next.has(s)),
      );
      return next;
    });
  }, []);
  const hide = useCallback(() => {
    setVisible(false);
    writePref('steps.hidden', true);
  }, []);
  const restart = useCallback(() => {
    setDone(new Set());
    setVisible(true);
    writePref('steps.done', []);
    writePref('steps.hidden', false);
  }, []);

  return { done, visible, mark, hide, restart };
}

export function App() {
  const session = useSession();
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [briefingOpen, setBriefingOpen] = useState(
    () => firstCrisisGuide.briefing !== null && !readPref('briefing.seen', false),
  );
  const [tab, setTab] = useState<Tab>('news');
  const [selection, setSelection] = useState<Selection>(null);
  const [whyTarget, setWhyTarget] = useState<WhyTarget | null>(null);
  const [devOpen, setDevOpen] = useState(devMode);
  const steps = useFirstSteps();
  useEffect(() => startLoop(), []);

  const openOrders = useCallback(() => setOrdersOpen(true), []);
  const openHelp = useCallback(() => setHelpOpen(true), []);
  const clearSelection = useCallback(() => setSelection(null), []);
  // Asking why pauses the world, so the answer does not change while you read it.
  const openWhy = useCallback((target: WhyTarget) => {
    actions.pause();
    setWhyTarget(target);
  }, []);
  const toggleDev = useCallback(() => setDevOpen((open) => !open), []);
  useKeyboardShortcuts({ openOrders, openHelp, clearSelection, toggleDev });

  const { game, alert } = session;
  const tip = session.advisor.current;
  const selectCountry = useCallback((id: string) => setSelection({ kind: 'country', id }), []);

  // A new game starts with nothing selected.
  useEffect(() => {
    setSelection(null);
    setWhyTarget(null);
  }, [game.seed]);

  // Tick off first steps as the player does each one.
  const { mark } = steps;
  useEffect(() => {
    if (!session.clock.paused) mark('play');
  }, [session.clock.paused, mark]);
  useEffect(() => {
    if (selection?.kind === 'country' && selection.id !== game.rules.playerCountry) mark('country');
  }, [selection, game.rules.playerCountry, mark]);
  useEffect(() => {
    if (session.tallies.ordersSigned > 0) mark('order');
  }, [session.tallies.ordersSigned, mark]);
  useEffect(() => {
    if (tab === 'home') mark('home');
  }, [tab, mark]);

  const closeBriefing = () => {
    setBriefingOpen(false);
    writePref('briefing.seen', true);
  };

  const respondToAlert = () => {
    if (alert?.country) setSelection({ kind: 'country', id: alert.country });
    else setOrdersOpen(true);
    actions.dismissAlert();
  };

  const briefing = firstCrisisGuide.briefing;
  const focusName = briefing ? (game.world.countries[briefing.focusCountry]?.name ?? '') : '';
  let firstSteps: ReactNode = null;
  if (steps.visible && briefing) {
    firstSteps = <FirstSteps done={steps.done} focusName={focusName} onHide={steps.hide} />;
  }

  return (
    <WhyContext.Provider value={openWhy}>
      <div className="app">
        <main className="world">
          <WorldMap
            game={game}
            map={firstCrisisMap}
            paused={session.clock.paused}
            selection={selection}
            onSelect={setSelection}
            alertCountry={alert?.country ?? null}
            showLegend={!tip}
            highlightCountry={
              briefing && steps.visible && !steps.done.has('country') && steps.done.has('play')
                ? briefing.focusCountry
                : null
            }
          />
        </main>
        <Nameplate
          game={game}
          clock={session.clock}
          onOpenHelp={openHelp}
          nudgePlay={session.clock.paused && game.tick === 0 && !steps.done.has('play')}
        />
        <Meters game={game} history={session.history} />
        {alert && (
          <CrisisBanner alert={alert} paused={session.clock.paused} onRespond={respondToAlert} />
        )}
        <div className="dock-left">
          <Unfolding game={game} onOpenOrders={openOrders} />
          <Markets game={game} history={session.history} />
        </div>
        <div className="dock-right">
          {tip && !game.outcome && !selection && (
            <AdvisorCard game={game} tip={tip} onShowCountry={selectCountry} />
          )}
          {selection ? (
            <MapDrawer
              game={game}
              selection={selection}
              dispatches={session.dispatches}
              onSelect={setSelection}
            />
          ) : (
            <SidePanel
              game={game}
              dispatches={session.dispatches}
              tab={tab}
              onTab={setTab}
              autoPause={session.autoPause}
              onOpenOrders={openOrders}
              onSelectCountry={selectCountry}
              top={firstSteps}
            />
          )}
        </div>
        {devMode &&
          (devOpen ? (
            <DevPanel game={game} onClose={() => setDevOpen(false)} />
          ) : (
            <button type="button" className="dev-toggle" onClick={() => setDevOpen(true)}>
              AI panel
            </button>
          ))}
        <DecisionsDialog game={game} open={ordersOpen} onClose={() => setOrdersOpen(false)} />
        <HowToPlay
          open={helpOpen}
          onClose={() => setHelpOpen(false)}
          onShowBriefing={() => {
            setHelpOpen(false);
            setBriefingOpen(true);
          }}
          onRestartSteps={() => {
            steps.restart();
            setHelpOpen(false);
          }}
        />
        {briefing && (
          <BriefingDialog briefing={briefing} open={briefingOpen} onClose={closeBriefing} />
        )}
        <WhyDialog
          game={game}
          target={whyTarget}
          onClose={() => setWhyTarget(null)}
          onAsk={setWhyTarget}
        />
        <GameOver game={game} tallies={session.tallies} startTreasury={session.startTreasury} />
      </div>
    </WhyContext.Provider>
  );
}
