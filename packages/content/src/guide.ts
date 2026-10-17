/**
 * The guide: what a new player is told. A scenario's opening briefing
 * (briefing.yaml) and its advisor (advisor.yaml), whose tips appear when their
 * condition holds and point at the orders that would help.
 *
 * The guide is presentation, not simulation: the engine never sees it, and
 * tips never consume the game's randomness.
 *
 *   # advisor.yaml
 *   - id: oil_hurting
 *     when:
 *       stat: { target: resource.oil.price, above: 8760 }
 *     text: Fuel prices are hurting workers and industry.
 *     suggest: [fuel_subsidy, release_reserves]
 */

import { createGame, evaluate, type Condition, type ScenarioDef } from '@ripple/engine';
import { z } from 'zod';
import { parseYaml } from './assemble';
import { toCondition } from './convert';
import { conditionSchema, id, type RawCondition } from './rules-schema';
import { ContentError, formatPath } from './schema';

const text = z.string().min(1);

export const briefingSchema = z.strictObject({
  title: text,
  sections: z.array(z.strictObject({ heading: text, text })).min(1),
  /** The country the first steps point the player toward. */
  focusCountry: id,
});

export const advisorTipSchema = z.strictObject({
  id,
  when: conditionSchema,
  text,
  /** Orders the advisor recommends; shown with the tip, ready to sign. */
  suggest: z.array(id).default([]),
  /** The country the tip is about, so the player can open it on the map. */
  country: id.optional(),
});

export interface Briefing {
  readonly title: string;
  readonly sections: readonly { readonly heading: string; readonly text: string }[];
  readonly focusCountry: string;
}

export interface AdvisorTip {
  readonly id: string;
  readonly when: Condition;
  readonly text: string;
  readonly suggest: readonly string[];
  readonly country?: string;
}

export interface Guide {
  readonly briefing: Briefing | null;
  readonly tips: readonly AdvisorTip[];
}

function usesChance(c: RawCondition): boolean {
  if ('chance' in c) return true;
  if ('all' in c) return c.all.some(usesChance);
  if ('any' in c) return c.any.some(usesChance);
  if ('not' in c) return usesChance(c.not);
  return false;
}

/** Validate a guide against the scenario it belongs to. */
export function parseGuide(
  raw: { briefing?: unknown; advisor?: unknown },
  scenario: ScenarioDef,
  source = 'guide',
): Guide {
  const problems: string[] = [];
  const countries = new Set(scenario.countries.map((c) => c.id));
  const decisions = new Set(scenario.decisions.map((d) => d.id));
  // A fresh game to check that every stat a condition reads exists.
  const probe = createGame(scenario, 0);

  let briefing: Briefing | null = null;
  if (raw.briefing !== undefined) {
    const result = briefingSchema.safeParse(raw.briefing);
    if (!result.success) {
      for (const i of result.error.issues) {
        problems.push(`briefing.${formatPath(i.path) || '(root)'}: ${i.message}`);
      }
    } else {
      briefing = result.data;
      if (!countries.has(briefing.focusCountry)) {
        problems.push(`briefing.focusCountry: Unknown country "${briefing.focusCountry}"`);
      }
    }
  }

  const tips: AdvisorTip[] = [];
  const seen = new Set<string>();
  const list = raw.advisor === undefined ? [] : raw.advisor;
  if (!Array.isArray(list)) {
    problems.push('advisor: Expected a list of tips');
  } else {
    list.forEach((item, i) => {
      const at = `advisor[${i}]`;
      const result = advisorTipSchema.safeParse(item);
      if (!result.success) {
        for (const issue of result.error.issues) {
          problems.push(`${at}.${formatPath(issue.path) || '(root)'}: ${issue.message}`);
        }
        return;
      }
      const tip = result.data;
      if (seen.has(tip.id)) problems.push(`${at}.id: Duplicate id "${tip.id}"`);
      seen.add(tip.id);
      if (usesChance(tip.when)) {
        problems.push(`${at}.when: Advisor tips cannot use chance; they must not affect the game`);
      }
      tip.suggest.forEach((d, j) => {
        if (!decisions.has(d)) problems.push(`${at}.suggest[${j}]: Unknown decision "${d}"`);
      });
      if (tip.country !== undefined && !countries.has(tip.country)) {
        problems.push(`${at}.country: Unknown country "${tip.country}"`);
      }
      const when = toCondition(tip.when);
      try {
        evaluate(probe, when);
      } catch (error) {
        problems.push(`${at}.when: ${(error as Error).message}`);
      }
      tips.push({
        id: tip.id,
        when,
        text: tip.text,
        suggest: tip.suggest,
        ...(tip.country !== undefined ? { country: tip.country } : {}),
      });
    });
  }

  if (problems.length > 0) throw new ContentError(source, problems);
  return { briefing, tips };
}

/** Assemble a guide from a scenario folder's briefing.yaml and advisor.yaml, if present. */
export function guideFromYaml(
  files: Readonly<Record<string, string>>,
  scenario: ScenarioDef,
  source = 'guide',
): Guide {
  const raw: { briefing?: unknown; advisor?: unknown } = {};
  const briefing = files['briefing.yaml'];
  const advisor = files['advisor.yaml'];
  if (briefing !== undefined) raw.briefing = parseYaml(briefing, `${source}/briefing.yaml`);
  if (advisor !== undefined) raw.advisor = parseYaml(advisor, `${source}/advisor.yaml`) ?? [];
  return parseGuide(raw, scenario, source);
}
