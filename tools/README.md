# @ripple/tools

Developer scripts.

## Balance report

Plays many complete games and summarizes them for two players: one who never acts, and one who follows a few rules of thumb (envoys when Corvan sours, subsidies when stability drops, reserves when oil spikes).

```sh
pnpm balance                    # 200 games of first-crisis
pnpm balance first-crisis 500   # pick the scenario and number of games
```

A healthy scenario punishes the idle player and rewards the steady one, and still puts the steady player through crises.
