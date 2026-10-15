import { scenarioFromYaml } from '@ripple/content';
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

export const firstCrisis: ScenarioDef = scenarioFromYaml(byFileName(files), 'first-crisis');
