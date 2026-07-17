import type { AssetClass } from "../domain/types";
import { ALL_ASSET_CLASSES } from "../domain/types";

export interface Preset {
  id: string;
  label: string;
  description: string;
  targets: Record<AssetClass, number>;
}

function make(t: Partial<Record<AssetClass, number>>): Record<AssetClass, number> {
  const out = {} as Record<AssetClass, number>;
  for (const ac of ALL_ASSET_CLASSES) out[ac] = t[ac] ?? 0;
  return out;
}

export const PRESETS: Preset[] = [
  {
    id: "60-40",
    label: "Classic 60/40",
    description: "60% equities, 40% bonds. Simple starting point.",
    targets: make({
      "US Equity": 45,
      "International Equity": 15,
      "US Treasuries": 15,
      "US Bonds": 25,
      "Cash & Money Market": 0,
    }),
  },
  {
    id: "boglehead-3fund",
    label: "3-Fund Portfolio",
    description: "Vanguard-style broad diversification.",
    targets: make({
      "US Equity": 55,
      "International Equity": 25,
      "US Bonds": 20,
    }),
  },
  {
    id: "all-weather",
    label: "All Weather (Dalio)",
    description: "Balanced across growth and inflation regimes.",
    targets: make({
      "US Equity": 30,
      "International Equity": 0,
      "US Treasuries": 40,
      "US Bonds": 15,
      "Gold & Commodities": 15,
    }),
  },
  {
    id: "aggressive",
    label: "Aggressive Growth",
    description: "Long horizon, high equity weight.",
    targets: make({
      "US Equity": 60,
      "International Equity": 25,
      "US Treasuries": 5,
      "Gold & Commodities": 5,
      "Cash & Money Market": 5,
    }),
  },
  {
    id: "cash-heavy",
    label: "Retiree / Cash-Heavy",
    description: "Larger cash and short-duration Treasuries buffer.",
    targets: make({
      "US Equity": 30,
      "International Equity": 10,
      "US Treasuries": 25,
      "US Bonds": 15,
      "Gold & Commodities": 5,
      "Cash & Money Market": 15,
    }),
  },
];
