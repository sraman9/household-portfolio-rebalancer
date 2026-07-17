# Household Portfolio Rebalancer

A local, browser-based tool that turns a flat broker positions export into a household portfolio view, lets the user set a target asset allocation, and produces the exact buy/sell trades per account to reach that target while respecting cash isolation and per-account liquidity preferences.

## Run locally

Requires Node 18 or newer.

```bash
cd app
npm install
npm run dev
```

Then open http://localhost:5173. Click "Try sample data" to load the provided sample, or upload your own `.xlsx` / `.csv` positions export.

Nothing is uploaded to a server. Parsing and computation run entirely in the browser.

## Where things live

```
app/
  src/
    domain/
      types.ts             data model
      assetClasses.ts      ticker to asset class mapping + defaults
      parse.ts             xlsx parser (SheetJS)
      rebalance.ts         rebalancing algorithm
    components/
      UploadCard.tsx       upload + sample loader
      PortfolioOverview.tsx    reorganized current view
      AssetClassMapping.tsx    editable ticker mapping
      TargetAllocationEditor.tsx  target sliders + presets
      LiquidityPreferences.tsx    per-account cash preference sliders
      RebalancePlanView.tsx       trade output
    lib/
      format.ts, presets.ts
  scripts/
    test-with-sample.mjs   node smoke test using the sample xlsx
  public/
    sample-portfolio.xlsx  the provided example export
sample-data/               original sample copy
SUBMISSION.md              Sections A, B, C required by the challenge
```

## Sanity-check script

`app/scripts/test-with-sample.mjs` parses the sample, runs the rebalance against a preset, and prints every trade with a per-account cash sanity check (starting cash + sells - buys == target cash). Run with `npx tsx scripts/test-with-sample.mjs` from inside `app/`.
