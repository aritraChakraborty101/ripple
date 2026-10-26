/**
 * Assemble a scenario from the text of its YAML files. Browser-safe: the web
 * app bundles the files as text, and the Node loader reads them from disk;
 * both end up here.
 */

import type { ScenarioDef } from '@ripple/engine';
import { parse } from 'yaml';
import { ContentError, parseScenario } from './schema';

export const SCENARIO_SECTIONS = [
  'countries',
  'factions',
  'resources',
  'links',
  'chokepoints',
  'relations',
  'events',
  'decisions',
] as const;

export function parseYaml(text: string, file: string): unknown {
  try {
    return parse(text);
  } catch (error) {
    throw new ContentError(file, [(error as Error).message]);
  }
}

/**
 * @param files Map of file name (for example "links.yaml") to its text.
 *   "scenario.yaml" is required; section files are optional.
 */
export function scenarioFromYaml(
  files: Readonly<Record<string, string>>,
  source = 'scenario',
): ScenarioDef {
  const metaText = files['scenario.yaml'];
  if (metaText === undefined) {
    throw new ContentError(source, ['Missing scenario.yaml']);
  }
  const meta = parseYaml(metaText, `${source}/scenario.yaml`);
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) {
    throw new ContentError(`${source}/scenario.yaml`, [
      'Expected a mapping with id, name and rules',
    ]);
  }

  const raw: Record<string, unknown> = { ...meta };
  for (const section of SCENARIO_SECTIONS) {
    const text = files[`${section}.yaml`];
    if (text !== undefined) {
      raw[section] = parseYaml(text, `${source}/${section}.yaml`) ?? [];
    }
  }
  // Computer countries: ai.yaml (personalities) and ai-tuning.yaml (profiles) are mappings.
  const ai = files['ai.yaml'];
  if (ai !== undefined) raw.ai = parseYaml(ai, `${source}/ai.yaml`);
  const tuning = files['ai-tuning.yaml'];
  if (tuning !== undefined) raw.aiTuning = parseYaml(tuning, `${source}/ai-tuning.yaml`);
  return parseScenario(raw, source);
}
