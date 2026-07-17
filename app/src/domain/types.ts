export type AssetClass =
  | "US Equity"
  | "International Equity"
  | "US Treasuries"
  | "US Bonds"
  | "Gold & Commodities"
  | "Real Estate"
  | "Cash & Money Market"
  | "Other";

export const ALL_ASSET_CLASSES: AssetClass[] = [
  "US Equity",
  "International Equity",
  "US Treasuries",
  "US Bonds",
  "Gold & Commodities",
  "Real Estate",
  "Cash & Money Market",
  "Other",
];

export const ASSET_CLASS_COLORS: Record<AssetClass, string> = {
  "US Equity": "#2563eb",
  "International Equity": "#8b5cf6",
  "US Treasuries": "#0d9488",
  "US Bonds": "#14b8a6",
  "Gold & Commodities": "#f59e0b",
  "Real Estate": "#ef4444",
  "Cash & Money Market": "#64748b",
  Other: "#a3a3a3",
};

export type AccountType = "brokerage" | "ira" | "roth" | "401k" | "hsa" | "other";

export interface RawPosition {
  accountNumber: string;
  accountName: string;
  symbol: string;
  description: string;
  quantity: number;
  price: number;
  value: number;
}

export interface Position extends RawPosition {
  assetClass: AssetClass;
  isCash: boolean;
  fractional: boolean;
}

export interface Account {
  number: string;
  name: string;
  type: AccountType;
  totalValue: number;
  cashSymbol: string;
  cashValue: number;
  liquidityPreference: number;
}

export interface SymbolMeta {
  symbol: string;
  description: string;
  assetClass: AssetClass;
  isCash: boolean;
  fractional: boolean;
}

export interface Trade {
  account: string;
  accountName: string;
  symbol: string;
  description: string;
  action: "BUY" | "SELL";
  assetClass: AssetClass;
  dollarAmount: number;
  quantity: number;
  price: number;
  note?: string;
}

export interface AccountRebalancePlan {
  account: Account;
  currentByClass: Record<AssetClass, number>;
  targetByClass: Record<AssetClass, number>;
  deltaByClass: Record<AssetClass, number>;
  trades: Trade[];
  warnings: string[];
}

export interface RebalanceResult {
  totalValue: number;
  targetDollarsByClass: Record<AssetClass, number>;
  perAccount: AccountRebalancePlan[];
  warnings: string[];
}
