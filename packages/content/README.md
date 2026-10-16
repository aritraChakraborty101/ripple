# @ripple/content

Game content as data, plus the schemas that validate it before the engine sees it.

## Scenarios

Each folder in `scenarios/` is one scenario:

| File               | Holds                                                              |
| ------------------ | ------------------------------------------------------------------ |
| `scenario.yaml`    | id, name and rules (player country, length, ousting rule)          |
| `countries.yaml`   | countries, their stats and daily import demand                     |
| `factions.yaml`    | domestic groups, their mood, power and which prices they feel      |
| `resources.yaml`   | tradable goods and their base prices (in cents)                    |
| `links.yaml`       | trade routes, capacities and the chokepoints they cross            |
| `chokepoints.yaml` | straits and passes that a country can close                        |
| `relations.yaml`   | starting relations between countries (pairs not listed start at 0) |
| `events.yaml`      | things that happen in the world: triggers and effects              |
| `decisions.yaml`   | orders the player can sign: costs, duration, odds and effects      |
| `briefing.yaml`    | the opening briefing and the country the first steps point at      |
| `advisor.yaml`     | advisor tips: when each appears and which orders it recommends     |

## Writing events and decisions

Each condition or effect is a mapping with one key that names it.

```yaml
- id: corvan_closes_strait
  tag: corvan # a country, or home, markets or world
  severity: critical # critical, warning or info
  headline: Corvan closes the South Strait to shipping
  cooldownDays: 120
  trigger:
    all:
      - chokepointOpen: south_strait
      - relation: { between: [aldoria, corvan], below: -40 }
      - chance: 400 # basis points per day: 400 = 4%
  effects:
    - setChokepoint: { id: south_strait, open: false }
    - schedule: { event: corvan_reopens_strait, inDays: 75 }
```

**Conditions:** `all`, `any`, `not`, `stat: { target, above, below }`, `relation: { between, above, below }`, `chokepointOpen`, `chokepointClosed`, `flag`, `noFlag`, `afterDay`, `chance`. Bounds are exclusive. Put `chance` last, so randomness is only drawn when everything else holds.

**Effects:** `modify: { target, add | pct, days }` (lasts `days`; permanent if omitted), `adjust: { target, by }` (permanent change to the base value), `relation: { between, by, days }`, `setChokepoint`, `schedule: { event, inDays }`, `setFlag`, `clearFlag`, `endEffectsOf: { decision | event }` (removes the lingering modifiers an earlier decision or event created; base changes stay).

**Policies** are decisions that stay in force until reversed. Give the decision a `policyFlag`, set that flag in its effects, and write a second decision that requires the flag, clears it and uses `endEffectsOf` to undo the policy's lingering effects. The game lists policies in force so the player can see and reverse them. See `steel_tariff` and `lift_steel_tariff`.

**Stat targets** are written `kind.id.stat`, such as `country.aldoria.treasury`, `faction.aldoria_workers.satisfaction`, `resource.oil.price` or `link.oil_veskar_aldoria.capacity`.

## The guide: briefing and advisor

`briefing.yaml` and `advisor.yaml` are what a new player is told. They never affect the simulation.

```yaml
- id: corvan_slipping
  when:
    relation: { between: [aldoria, corvan], below: -12 }
  country: corvan # optional: lets the player open it on the map
  text: Relations with Corvan are slipping. An envoy now costs far less than a closed strait later.
  suggest: [envoy_corvan, transit_fees]
```

Each tip appears once per game, one at a time, the first time its `when` holds and at least one suggested order can be signed. Conditions use the event vocabulary except `chance`. Every suggested order, country and stat is checked when the guide loads.

## Rules that keep content safe

- IDs are `lower_snake_case` and must be unique within a section.
- Every reference (a link's country, a route's chokepoint, a scheduled event, a stat target) must exist; the validator reports the exact path of anything that doesn't.
- Stats are integers. Prices are in cents; percentages and chances are in basis points.
- Unknown fields are rejected, since they usually mean a typo.

After changing a scenario, run `pnpm balance` to see how complete games play out.

## Use

```ts
import { parseScenario, scenarioFromYaml } from '@ripple/content'; // browser-safe
import { loadBuiltInScenario } from '@ripple/content/node'; // Node: read a scenario folder

const scenario = loadBuiltInScenario('first-crisis');
```
