import type { AssetClass, SymbolMeta, AccountType } from "./types";

/**
 * Curated default mapping from ticker to asset class.
 *
 * Coverage priorities:
 * 1. All symbols observed in the sample export.
 * 2. The largest, most common ETFs and money-market funds a household is
 *    likely to hold across Fidelity, Vanguard, Schwab, iShares, and SPDR.
 *
 * Any symbol not in this list falls through to the fuzzy classifier in
 * `classifyBySymbolAndDescription`, and finally to a user-editable override
 * from the UI. This is intentional: users should be able to correct our guess
 * without touching code.
 */
export const SYMBOL_ASSET_CLASS: Record<string, AssetClass> = {
  // Money-market / cash sweeps
  "FZFXX": "Cash & Money Market",
  "FCASH": "Cash & Money Market",
  "SPAXX": "Cash & Money Market",
  "FDRXX": "Cash & Money Market",
  "SPRXX": "Cash & Money Market",
  "FRGXX": "Cash & Money Market",
  "VMFXX": "Cash & Money Market",
  "VUSXX": "Cash & Money Market",
  "SWVXX": "Cash & Money Market",
  "CASH": "Cash & Money Market",

  // Treasuries (short bills through long bonds)
  "BIL": "US Treasuries",
  "SGOV": "US Treasuries",
  "SHV": "US Treasuries",
  "SHY": "US Treasuries",
  "VGSH": "US Treasuries",
  "IEF": "US Treasuries",
  "TLT": "US Treasuries",
  "GOVT": "US Treasuries",
  "VGIT": "US Treasuries",
  "VGLT": "US Treasuries",
  "EDV": "US Treasuries",

  // US aggregate / corporate bonds
  "AGG": "US Bonds",
  "BND": "US Bonds",
  "VCIT": "US Bonds",
  "LQD": "US Bonds",
  "VTC": "US Bonds",
  "HYG": "US Bonds",
  "JNK": "US Bonds",

  // US equity: broad and single-country
  "VTI": "US Equity",
  "VOO": "US Equity",
  "SPY": "US Equity",
  "IVV": "US Equity",
  "VUG": "US Equity",
  "VTV": "US Equity",
  "VB": "US Equity",
  "VBR": "US Equity",
  "QQQ": "US Equity",
  "SCHB": "US Equity",
  "SCHD": "US Equity",
  "ITOT": "US Equity",
  "FNILX": "US Equity",
  "FXAIX": "US Equity",
  "FSKAX": "US Equity",
  "FZROX": "US Equity",
  // Thematic US equity: still equity for asset-allocation purposes
  "NUKZ": "US Equity",
  "SHLD": "US Equity",
  "SMH": "US Equity",
  "XLE": "US Equity",
  "XLF": "US Equity",
  "XLK": "US Equity",

  // International equity
  "VXUS": "International Equity",
  "VEA": "International Equity",
  "VWO": "International Equity",
  "EFA": "International Equity",
  "IEMG": "International Equity",
  "IEFA": "International Equity",
  "VGK": "International Equity",
  "FZILX": "International Equity",
  "FTIHX": "International Equity",

  // Gold & commodities
  "GLD": "Gold & Commodities",
  "IAU": "Gold & Commodities",
  "SGOL": "Gold & Commodities",
  "GLDM": "Gold & Commodities",
  "SLV": "Gold & Commodities",
  "PDBC": "Gold & Commodities",
  "DBC": "Gold & Commodities",

  // Real estate
  "VNQ": "Real Estate",
  "IYR": "Real Estate",
  "SCHH": "Real Estate",
  "REET": "Real Estate",
};

/**
 * Some symbols cannot be sold fractionally at most retail brokers.
 * We keep an explicit list: everything else defaults to fractional=true.
 * This is a conservative, editable default; the UI lets the user override.
 */
export const NON_FRACTIONAL_SYMBOLS = new Set<string>([
  // Placeholder for individual stocks or non-fractional ETFs users add.
]);

const CASH_SUFFIX_MARKERS = ["**"];
const CASH_DESCRIPTION_HINTS = [
  "MONEY MARKET",
  "FCASH",
  "GOVERNMENT PORTFOLIO",
  "CASH RESERVES",
  "TREASURY MONEY",
];

export function normalizeSymbol(raw: string): string {
  // Fidelity marks money-market sweeps with a "**" suffix; strip it for lookup
  // but keep the display symbol as-is elsewhere.
  let s = (raw || "").trim().toUpperCase();
  for (const suf of CASH_SUFFIX_MARKERS) {
    if (s.endsWith(suf)) s = s.slice(0, -suf.length);
  }
  return s;
}

export function classifyBySymbolAndDescription(
  symbol: string,
  description: string,
): { assetClass: AssetClass; isCash: boolean } {
  const norm = normalizeSymbol(symbol);
  const upperDesc = (description || "").toUpperCase();

  const rawEndsWithSuffix = CASH_SUFFIX_MARKERS.some((suf) =>
    (symbol || "").trim().endsWith(suf),
  );
  const descHitsCash = CASH_DESCRIPTION_HINTS.some((h) => upperDesc.includes(h));

  if (SYMBOL_ASSET_CLASS[norm]) {
    const ac = SYMBOL_ASSET_CLASS[norm];
    return { assetClass: ac, isCash: ac === "Cash & Money Market" };
  }
  if (rawEndsWithSuffix || descHitsCash) {
    return { assetClass: "Cash & Money Market", isCash: true };
  }
  // Fallback: put unknown symbols into "Other" so the user notices and can
  // reclassify. Defaulting to "US Equity" would silently mis-model exotic
  // holdings and quietly distort the target math.
  return { assetClass: "Other", isCash: false };
}

export function buildSymbolMeta(
  symbol: string,
  description: string,
): SymbolMeta {
  const { assetClass, isCash } = classifyBySymbolAndDescription(
    symbol,
    description,
  );
  const norm = normalizeSymbol(symbol);
  return {
    symbol,
    description,
    assetClass,
    isCash,
    fractional: !NON_FRACTIONAL_SYMBOLS.has(norm),
  };
}

/**
 * When we need to BUY into an asset class in an account that doesn't already
 * hold any position in that class, pick a broad, low-cost default ETF as the
 * concrete instrument to trade.
 */
export const DEFAULT_ETF_FOR_CLASS: Record<AssetClass, string> = {
  "US Equity": "VTI",
  "International Equity": "VXUS",
  "US Treasuries": "GOVT",
  "US Bonds": "BND",
  "Gold & Commodities": "IAU",
  "Real Estate": "VNQ",
  "Cash & Money Market": "SPAXX",
  Other: "VTI",
};

export function inferAccountType(name: string): AccountType {
  const s = name.toLowerCase();
  if (s.includes("roth")) return "roth";
  if (s.includes("ira")) return "ira";
  if (s.includes("401")) return "401k";
  if (s.includes("hsa")) return "hsa";
  if (
    s.includes("brokerage") ||
    s.includes("joint") ||
    s.includes("individual") ||
    s.includes("wros") ||
    s.includes("taxable")
  ) {
    return "brokerage";
  }
  return "other";
}

/**
 * Default liquidity preference weight per account. Higher = user prefers
 * cash to sit here. Brokerage/taxable accounts are penalty-free to draw
 * from, so they default to the highest preference. Retirement accounts
 * get the lowest preference because early withdrawals trigger taxes and
 * penalties.
 *
 * The UI exposes these as sliders so the user can tune the default.
 */
export function defaultLiquidityPreference(type: AccountType): number {
  switch (type) {
    case "brokerage":
      return 1.0;
    case "hsa":
      return 0.6;
    case "other":
      return 0.5;
    case "roth":
      return 0.2;
    case "ira":
    case "401k":
      return 0.0;
  }
}
