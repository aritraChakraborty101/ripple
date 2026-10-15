import type { ModifierSource } from './modifiers';

/**
 * Something notable that happened during a tick. Events feed the news feed,
 * the event log (saves and replays) and the why-trace. Systems never call each
 * other; later systems react to the events earlier ones emitted.
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
    };
