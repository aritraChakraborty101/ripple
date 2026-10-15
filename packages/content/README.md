# @ripple/content

Game content as data, plus the schemas that validate it before the engine sees it.

## Scenarios

Each folder in `scenarios/` is one scenario:

| File               | Holds                                                     |
| ------------------ | --------------------------------------------------------- |
| `scenario.yaml`    | id, name and rules (player country, length, ousting rule) |
| `countries.yaml`   | countries, their stats and daily import demand            |
| `factions.yaml`    | domestic groups inside a country                          |
| `resources.yaml`   | tradable goods and their base prices (in cents)           |
| `links.yaml`       | trade routes, capacities and the chokepoints they cross   |
| `chokepoints.yaml` | straits and passes that a country can close               |

Rules that keep content safe:

- IDs are `lower_snake_case` and must be unique within a section.
- Every reference (a link's country, a route's chokepoint) must exist; the validator reports the exact path of anything that doesn't.
- Stats are integers. Prices are in cents.
- Unknown fields are rejected, since they usually mean a typo.

## Use

```ts
import { parseScenario } from '@ripple/content'; // browser-safe: validate already-parsed data
import { loadBuiltInScenario } from '@ripple/content/node'; // Node: read a scenario folder

const scenario = loadBuiltInScenario('first-crisis');
```
