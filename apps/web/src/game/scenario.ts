import {
  guideFromYaml,
  mapFromYaml,
  scenarioFromYaml,
  type Guide,
  type ScenarioMap,
} from '@ripple/content';
import type { ScenarioDef } from '@ripple/engine';

// Vite bundles the scenario's YAML files as text at build time.
const files = import.meta.glob('../../../../packages/content/scenarios/first-crisis/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function byFileName(entries: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, text] of Object.entries(entries)) {
    out[path.slice(path.lastIndexOf('/') + 1)] = text;
  }
  return out;
}

const yaml = byFileName(files);

export const firstCrisis: ScenarioDef = scenarioFromYaml(yaml, 'first-crisis');
export const firstCrisisGuide: Guide = guideFromYaml(yaml, firstCrisis, 'first-crisis');
export const firstCrisisMap: ScenarioMap = mapFromYaml(yaml, firstCrisis, 'first-crisis');
