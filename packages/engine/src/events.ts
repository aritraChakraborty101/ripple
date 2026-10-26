import type { ModifierSource } from './modifiers';

/**
 * Something notable that happened during a tick. Events feed the news feed,
 * the event log (saves and replays) and the why-trace. Systems never call each
 * other; later systems react to the state earlier ones left.
 */
export type EngineEvent =
  | {
      readonly kind: 'modifier_expired';
      readonly tick: number;
      readonly modifierId: string;
      readonly source: ModifierSource;
    }
  | {
      readonly kind: 'price_moved';
      readonly tick: number;
      readonly resource: string;
      /** Prices in cents. */
      readonly from: number;
      readonly to: number;
    }
  | {
      readonly kind: 'event_fired';
      readonly tick: number;
      readonly event: string;
      /** True if it fired because something scheduled it, not its own trigger. */
      readonly scheduled: boolean;
    }
  | {
      readonly kind: 'decision_issued';
      readonly tick: number;
      readonly decision: string;
      /** The country that signed it. */
      readonly by: string;
      readonly target?: string;
      readonly pendingId: string;
      readonly dueTick: number;
    }
  | {
      readonly kind: 'decision_resolved';
      readonly tick: number;
      readonly decision: string;
      readonly by: string;
      readonly target?: string;
      /** The day it was signed, which is when a computer country chose it. */
      readonly issuedTick: number;
      readonly success: boolean;
    }
  | {
      readonly kind: 'order_rejected';
      readonly tick: number;
      readonly decision: string;
      readonly reason: string;
    }
  | {
      readonly kind: 'game_over';
      readonly tick: number;
      readonly result: 'ousted' | 'survived';
    };
