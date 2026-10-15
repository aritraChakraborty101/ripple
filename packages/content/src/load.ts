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
