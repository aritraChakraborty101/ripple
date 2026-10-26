/**
 * Node-only loader: reads a scenario folder of YAML files from disk.
 *
 * A scenario folder holds scenario.yaml (id, name, rules) and one file per
 * section: countries, factions, resources, links, chokepoints. Each section
 * file is a list. Splitting by section keeps files short and lets new content
 * be added as new entries without touching anything else.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ScenarioDef } from '@ripple/engine';
import { SCENARIO_SECTIONS, scenarioFromYaml } from './assemble';
import { guideFromYaml, type Guide } from './guide';
import { mapFromYaml, type ScenarioMap } from './map';

export function loadScenario(folder: string): ScenarioDef {
  const files: Record<string, string> = {};
  for (const name of ['scenario', ...SCENARIO_SECTIONS]) {
    const file = join(folder, `${name}.yaml`);
    if (existsSync(file)) {
      files[`${name}.yaml`] = readFileSync(file, 'utf8');
    }
  }
  return scenarioFromYaml(files, folder);
}

/** Folder of the built-in scenarios shipped with the game. */
export const SCENARIOS_DIR = new URL('../scenarios/', import.meta.url).pathname;

export function loadBuiltInScenario(name: string): ScenarioDef {
  return loadScenario(join(SCENARIOS_DIR, name));
}

/** The briefing and advisor for a built-in scenario. */
export function loadBuiltInGuide(name: string, scenario: ScenarioDef): Guide {
  const folder = join(SCENARIOS_DIR, name);
  const files: Record<string, string> = {};
  for (const file of ['briefing.yaml', 'advisor.yaml']) {
    const path = join(folder, file);
    if (existsSync(path)) files[file] = readFileSync(path, 'utf8');
  }
  return guideFromYaml(files, scenario, folder);
}

/** How a built-in scenario is drawn. */
export function loadBuiltInMap(name: string, scenario: ScenarioDef): ScenarioMap {
  const folder = join(SCENARIOS_DIR, name);
  const path = join(folder, 'map.yaml');
  const files: Record<string, string> = existsSync(path)
    ? { 'map.yaml': readFileSync(path, 'utf8') }
    : {};
  return mapFromYaml(files, scenario, folder);
}
