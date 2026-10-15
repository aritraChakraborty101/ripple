/**
 * Node-only loader: reads a scenario folder of YAML files.
 *
 * A scenario folder holds scenario.yaml (id, name, rules) and one file per
 * section: countries, factions, resources, links, chokepoints. Each section
 * file is a list. Splitting by section keeps files short and lets new content
 * be added as new entries without touching anything else.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { ScenarioDef } from '@ripple/engine';
import { ContentError, parseScenario } from './schema';

const SECTIONS = ['countries', 'factions', 'resources', 'links', 'chokepoints'] as const;

function readYaml(file: string): unknown {
  try {
    return parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new ContentError(file, [(error as Error).message]);
  }
}

export function loadScenario(folder: string): ScenarioDef {
  const metaFile = join(folder, 'scenario.yaml');
  if (!existsSync(metaFile)) {
    throw new ContentError(folder, ['Missing scenario.yaml']);
  }
  const meta = readYaml(metaFile);
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) {
    throw new ContentError(metaFile, ['Expected a mapping with id, name and rules']);
  }

  const raw: Record<string, unknown> = { ...meta };
  for (const section of SECTIONS) {
    const file = join(folder, `${section}.yaml`);
    if (existsSync(file)) {
      raw[section] = readYaml(file) ?? [];
    }
  }
  return parseScenario(raw, folder);
}

/** Folder of the built-in scenarios shipped with the game. */
export const SCENARIOS_DIR = new URL('../scenarios/', import.meta.url).pathname;

export function loadBuiltInScenario(name: string): ScenarioDef {
  return loadScenario(join(SCENARIOS_DIR, name));
}
