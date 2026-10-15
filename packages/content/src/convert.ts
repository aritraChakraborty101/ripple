/**
 * Converts validated YAML shapes into the engine's types. Runs only after
 * validation, so every reference here is known to exist.
 */

import {
  relationId,
  type Condition,
  type DecisionDef,
  type Effect,
  type EventDef,
  type ScenarioDef,
  type StatEntityKind,
  type StatRef,
} from '@ripple/engine';
import type { RawCondition, RawEffect } from './rules-schema';
import type { RawScenario } from './schema';

function statRef(path: string): StatRef {
  const [kind, id, stat] = path.split('.') as [StatEntityKind, string, string];
  return { kind, id, stat };
}

function relationRef([a, b]: readonly [string, string]): StatRef {
  return { kind: 'relation', id: relationId(a, b), stat: 'value' };
}

function withBounds<T extends object>(
  base: T,
  bounds: { above?: number | undefined; below?: number | undefined },
): T & { above?: number; below?: number } {
  return {
    ...base,
    ...(bounds.above !== undefined ? { above: bounds.above } : {}),
    ...(bounds.below !== undefined ? { below: bounds.below } : {}),
  };
}

export function toCondition(c: RawCondition): Condition {
  if ('all' in c) return { type: 'all', of: c.all.map(toCondition) };
  if ('any' in c) return { type: 'any', of: c.any.map(toCondition) };
  if ('not' in c) return { type: 'not', condition: toCondition(c.not) };
  if ('stat' in c)
    return withBounds({ type: 'stat' as const, target: statRef(c.stat.target) }, c.stat);
  if ('relation' in c) {
    return withBounds(
      { type: 'stat' as const, target: relationRef(c.relation.between) },
      c.relation,
    );
  }
  if ('chokepointOpen' in c) return { type: 'chokepoint', id: c.chokepointOpen, open: true };
  if ('chokepointClosed' in c) return { type: 'chokepoint', id: c.chokepointClosed, open: false };
  if ('flag' in c) return { type: 'flag', flag: c.flag, set: true };
  if ('noFlag' in c) return { type: 'flag', flag: c.noFlag, set: false };
  if ('afterDay' in c) return { type: 'after_day', day: c.afterDay };
  return { type: 'chance', bp: c.chance };
}

export function toEffect(e: RawEffect): Effect {
  if ('modify' in e) {
    const { target, add, pct, days } = e.modify;
    return {
      type: 'modify',
      target: statRef(target),
      op: add !== undefined ? 'add' : 'pct',
      amount: add ?? pct ?? 0,
      days: days ?? null,
    };
  }
  if ('adjust' in e) return { type: 'adjust', target: statRef(e.adjust.target), by: e.adjust.by };
  if ('relation' in e) {
    const target = relationRef(e.relation.between);
    return e.relation.days === undefined
      ? { type: 'adjust', target, by: e.relation.by }
      : { type: 'modify', target, op: 'add', amount: e.relation.by, days: e.relation.days };
  }
  if ('setChokepoint' in e) {
    return { type: 'set_chokepoint', id: e.setChokepoint.id, open: e.setChokepoint.open };
  }
  if ('schedule' in e) {
    return { type: 'schedule', event: e.schedule.event, inDays: e.schedule.inDays };
  }
  if ('setFlag' in e) return { type: 'set_flag', flag: e.setFlag };
  return { type: 'clear_flag', flag: e.clearFlag };
}

export function toScenarioDef(s: RawScenario): ScenarioDef {
  const events: EventDef[] = s.events.map((e) => ({
    id: e.id,
    tag: e.tag,
    severity: e.severity,
    headline: e.headline,
    ...(e.detail !== undefined ? { detail: e.detail } : {}),
    trigger: e.trigger ? toCondition(e.trigger) : null,
    once: e.once,
    cooldownDays: e.cooldownDays,
    effects: e.effects.map(toEffect),
  }));

  const decisions: DecisionDef[] = s.decisions.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    requires: d.requires ? toCondition(d.requires) : null,
    ...(d.unavailableText !== undefined ? { unavailableText: d.unavailableText } : {}),
    costs: d.costs.map(toEffect),
    durationDays: d.durationDays,
    cooldownDays: d.cooldownDays,
    chanceBp: d.chance,
    effects: d.effects.map(toEffect),
    failureEffects: d.failureEffects.map(toEffect),
    successHeadline: d.successHeadline,
    ...(d.failureHeadline !== undefined ? { failureHeadline: d.failureHeadline } : {}),
  }));

  return {
    id: s.id,
    name: s.name,
    rules: s.rules,
    countries: s.countries,
    factions: s.factions,
    resources: s.resources,
    links: s.links,
    chokepoints: s.chokepoints,
    relations: s.relations,
    events,
    decisions,
  };
}
