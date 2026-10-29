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
| `actions.yaml`     | orders computer countries sign on their own (see below)            |
| `briefing.yaml`    | the opening briefing and the country the first steps point at      |
| `advisor.yaml`     | advisor tips: when each appears and which orders it recommends     |
| `map.yaml`         | how the world is drawn: country shapes and chokepoint positions    |
| `ai.yaml`          | what each computer country wants: goals, aspirations, ambitions    |
| `ai-tuning.yaml`   | named tuning profiles that change how strongly countries behave    |

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

**Effects:** `modify: { target, add | pct, days }` (lasts `days`; permanent if omitted), `adjust: { target, by }` (permanent change to the base value), `relation: { between, by, days }`, `setChokepoint`, `schedule: { event, inDays }`, `setFlag`, `clearFlag`, `endEffectsOf: { decision | event }` (removes the lingering modifiers an earlier decision or event created; base changes stay; in a template, only those aimed at the same target, or at `target: self`), `embargo: { by, against, active }` (`by` stops all trade with `against` until it lifts its own embargo). A `relation` change with `untilLifted: true` lasts until `endEffectsOf` ends it.

**Names inside templates.** In a template, `{self}` and `{target}` can sit inside a stat path, link ID or flag: `link.deal_{target}.capacity`, `country.self.tariff_{target}`, `treaty_with_{self}`. Quote them inside `{ }` maps (`{ target: 'link.deal_{target}.capacity', add: 5 }`). The loader checks the name exists for every country the template can be aimed at.

**Demand** is the stat `demand_<resource>` on each country, seeded from its `demand`. Modify it to change what a country buys: `modify: { target: country.aldoria.demand_oil, add: -8 }`.

**Intelligence files** are the stat `intel_<country>` on the player's country. While it is above zero, the interface warns earlier of that country's harmful moves and shows its budget.

**Tariffs** are the stat `tariff_<partner>` on the importing country, in basis points: the economy charges it on the value of everything that country's open routes bring in from the partner.

An event can also have `requires`: a condition that must hold for it to fire at all. That matters for scheduled events, which otherwise fire whatever has changed since. For example, the strait's forced reopening only happens if it is still closed.

**Orders aimed at a country.** Give a player decision `targets` (a list of countries, or `others` for every other country) and the player picks whom to aim it at. Inside it, `self` is the player's country and `target` the chosen one, in stat paths, relations and flags; names, descriptions, headlines and `unavailableText` use `{target}`. Add `perTarget: true` to keep cooldowns and "already under way" per target, so an envoy to Corvan does not hold up one to Orrin. See `envoy`.

**Policies** are decisions that stay in force until reversed. Give the decision a `policyFlag`, set that flag in its effects, and write a second decision that requires the flag, clears it and uses `endEffectsOf` to undo the policy's lingering effects. The game lists policies in force so the player can see and reverse them. A policy aimed at a country puts `{target}` in its flag (`tariff_on_{target}`), so it can be in force against several countries at once, and `endEffectsOf` in the lifting order ends only what was done to that target. See `tariff` and `lift_tariff`.

**Stat targets** are written `kind.id.stat`, such as `country.aldoria.treasury`, `faction.aldoria_workers.satisfaction`, `resource.oil.price` or `link.oil_veskar_aldoria.capacity`.

**Budgets.** A country with `revenue` and `spending` stats keeps a monthly budget, in millions: taxes and upkeep before trade. The economy system adds imports, exports and transit tolls (a chokepoint's `tollBp`), and settles each month into the treasury in whole billions. A running cost or income is a `modify` on `revenue` or `spending`: with `days` for a fixed term (a three-month subsidy), or without for a policy that lasts until `endEffectsOf` lifts it (a tariff). Countries without a `revenue` stat keep no budget.

## The guide: briefing and advisor

`briefing.yaml` and `advisor.yaml` are what a new player is told. They never affect the simulation.

```yaml
- id: corvan_slipping
  when:
    relation: { between: [aldoria, corvan], below: -12 }
  country: corvan # optional: lets the player open it on the map
  text: Relations with Corvan are slipping. An envoy now costs far less than a closed strait later.
  suggest: [envoy>corvan, transit_fees] # an order aimed at a country is decision>target
```

Each tip appears once per game, one at a time, the first time its `when` holds and at least one suggested order can be signed. Conditions use the event vocabulary except `chance`. Every suggested order, country and stat is checked when the guide loads.

## Computer countries

`ai.yaml` says what each computer country wants. A goal's `weight` is how much the country cares (weights add up to 100), and `aspire` is where it wants the goal to be. The gap to `aspire` is a standing **need**, so countries have reasons to act even in a calm world.

```yaml
personalities:
  corvan:
    goals:
      wealth: { weight: 35, aspire: 250 } # treasury, bn
      grievance(aldoria): { weight: 30 } # grows as relations sour
      ties(thessa): { weight: 20, aspire: 60 } # relations
      standing: { weight: 15, aspire: 50 } # influence
    ambitions:
      - { id: strait_pays, name: Make the strait pay, goal: wealth, target: 250 }
```

Goals: `wealth`, `standing`, `security`, `prices(resource)`, `ties(country)`, `grievance(country)`. An unmet ambition's goal counts 1.5 times as much.

Computer orders live in `actions.yaml` and are written like the player's, plus `for` (which countries may sign them, or `any`), `drives` (which goals they move, from -5 to 5) and `consider` (how the situation changes their appeal). With `targets`, an order is a **template** aimed at each target in turn, written with `self` and `target`:

```yaml
- id: court
  name: 'Court {target}'
  for: any
  targets: others
  drives: { ties(target): 2, standing: 1 }
  consider:
    - relation: [self, target]
      falls: [40, 90] # full appeal at 40, none at 90
  costs:
    - adjust: { target: country.self.influence, by: -5 }
```

Keep drives honest: an order that drives `standing` should raise influence, and one that drives `wealth` should raise the treasury. Then needs are met over time and countries calm down instead of repeating themselves.

Computer orders can also set `severity` and `detail` for the news. Use them for deliberate choices (closing a strait, massing troops); keep accidents and moods (an explosion, a drought, a strike) as events.

A consideration has one measure (`stat`, `relation`, `price`, `flag`, or `day: true` for the day number) and one curve (`rises: [from, to]`, `falls: [from, to]`, `peaks: [from, peak, to]` or `step: at`). Add `gate: true` to a check that is usually wide open, such as "is there a treaty?": a gate multiplies the appeal after the other considerations are combined and does not count toward their compensation, so it changes nothing until it closes. Flags in computer templates can name the acting country: `treaty_with_{self}`.

`ai-tuning.yaml` holds profiles of knobs, such as `aggressive: { inertia: 15, hostility: 1.5 }`. Its comments list every knob and its default.

## The map

`map.yaml` says how the world is drawn. Like the guide, the engine never sees it. Coordinates are whole numbers on a `width` x `height` canvas, with x to the right and y down.

```yaml
width: 900
height: 520
countries:
  aldoria:
    outline: [[120, 150], [300, 118], [360, 192], [332, 300], [200, 334], [108, 262]]
    anchor: [230, 236] # where trade routes start and end
    label: [222, 214] # where the name is written
    labelSize: 20
chokepoints:
  south_strait: [520, 356]
```

Every country and chokepoint in the scenario must be drawn, nothing else may be, and every point must lie on the canvas. Adding a country or a strait therefore means adding its shape or position here, with no code change.

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
