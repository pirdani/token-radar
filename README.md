# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/pirdani/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/pirdani/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar — a pre-token protocol radar: ranks 198 protocols with no token yet by implied launch value, with a farm plan per protocol and a static, network-free dashboard.

It scores **198 pre-token protocols** from DefiLlama's sealed snapshot of 2026-11-14 (40 on the watchlist, 158 found below the $50M floor) by **implied launch value**:

```
implied = TVL × multiple[category] × growth × maturity
```

The multiple is read off the snapshot itself — the median market-cap / TVL of the live-token protocols in the same category (at least 3 of them, else the global median 0.2049), clamped to 0.05–1.5. Growth is the 7-day TVL change clamped to −60%…+120%, weighted 0.5. Maturity rises from 0.6 to 1.0 over 1,095 days of running with no token. No protocol name is special-cased: the same function scores every row, so the radar stays dynamic on a future snapshot.

Every board row carries a **farm plan** (6 steps, each with a cost and a time, derived from the protocol's own category, chains, TVL and age) and an **independent token check** (official sites and docs, CoinGecko, CoinMarketCap, checked 2026-11-21): 115 rows with no token found, 32 where a token actually exists, 40 where the parent has one, 11 wrapped/staked products. A check never changes a rank or an implied value — it is shown so a reader can see which rows deserve a second look before farming. The 24 live-token protocols are kept apart in their own view, at the market's value.

The dashboard is a static page that renders with **no network**: `dashboard/index.html` + `app.css` + `app.js` read `data.js`, which `main.ts` writes from the same board. It has a sortable/filterable table, a per-protocol detail view with the model's own arithmetic and the farm plan, a live-token view, a methodology tab, and a model sandbox that re-ranks the board with the same formula.

Top of the board: Steakhouse Financial, $464,924,662 implied (TVL $2.75B × 0.214 × 0.99 × 0.80).

Built by an AI agent for make.fun's "Build the best token launch radar" bounty ($1,325 in USDC): https://make.fun/bounty/token-radar-01

## Run it

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

Node.js 22.18 or later (24 works), standard library only, no dependencies to install. In the grader's container the snapshot is mounted at `/input` and the output goes to `/output` by default. The run writes `board.json` (the 198 ranked rows), `data.js` (the dashboard's dataset), `dashboard/` (3 files), `screenshots/` (3 images) and `dossier.json` (the summary the judge reads, rebuilt from the output).

`research.json` beside `main.ts` adds the token-check annotations; the board is identical with or without it. The dashboard needs `data.js` next to it: open `out/dashboard/index.html` after a run, or serve `out/` on localhost.

## Layout

- `main.ts` — entrypoint: reads the snapshot, scores the board, writes the outputs.
- `lib/model.ts` — the snapshot parser, the radar-2 model, the farm-plan derivation, the board gate.
- `vendor/makefun-board.ts` — the vendored make.fun dossier builder (byte-for-byte from the kit).
- `dashboard/` — the static dashboard (`index.html`, `app.css`, `app.js`).
- `screenshots/` — board, detail view, filtered view (1440×900, Chromium).
- `research.json` — the 198 independent token checks, keyed by slug.

---

<sub>Entered on [make.fun](https://make.fun/?ref=s2esmab0&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
