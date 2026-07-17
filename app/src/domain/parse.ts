import * as XLSX from "xlsx";
import type { Account, Position, RawPosition, SymbolMeta } from "./types";
import {
  buildSymbolMeta,
  defaultLiquidityPreference,
  inferAccountType,
} from "./assetClasses";

/**
 * Expected column headers. These match the sample Fidelity export. The parser
 * looks them up case-insensitively so the ingest survives small formatting
 * differences across brokers and export dates.
 */
const REQUIRED_HEADERS = [
  "Account Number",
  "Account Name",
  "Symbol",
  "Description",
  "Current Value",
] as const;

const OPTIONAL_HEADERS = ["Quantity", "Last Price"] as const;

type HeaderMap = Record<string, number>;

function findHeaderRow(rows: unknown[][]): {
  headerRow: number;
  headerMap: HeaderMap;
} {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i] || [];
    const map: HeaderMap = {};
    let hits = 0;
    row.forEach((cell, idx) => {
      if (typeof cell === "string") {
        const key = cell.trim().toLowerCase();
        map[key] = idx;
        if (
          (REQUIRED_HEADERS as readonly string[])
            .map((h) => h.toLowerCase())
            .includes(key)
        ) {
          hits++;
        }
      }
    });
    if (hits >= REQUIRED_HEADERS.length) {
      return { headerRow: i, headerMap: map };
    }
  }
  throw new Error(
    `Could not find header row. Expected columns: ${REQUIRED_HEADERS.join(", ")}`,
  );
}

function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const s = String(v).trim();
  if (!s || s === "--" || s === "n/a" || s.toLowerCase() === "na") return 0;
  const cleaned = s.replace(/[$,\s]/g, "");
  const n = Number(cleaned);
  return isFinite(n) ? n : 0;
}

function toStr(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

export interface ParsedPortfolio {
  positions: Position[];
  accounts: Account[];
  symbols: SymbolMeta[];
}

export async function parseXlsxFile(file: File): Promise<ParsedPortfolio> {
  const buf = await file.arrayBuffer();
  return parseXlsxBuffer(buf);
}

export function parseXlsxBuffer(buf: ArrayBuffer): ParsedPortfolio {
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("Workbook has no sheets.");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    blankrows: false,
    raw: true,
    defval: null,
  });
  const { headerRow, headerMap } = findHeaderRow(rows);

  const idx = (name: string): number => {
    const k = name.toLowerCase();
    return headerMap[k] ?? -1;
  };
  const iAcctNum = idx("Account Number");
  const iAcctName = idx("Account Name");
  const iSymbol = idx("Symbol");
  const iDesc = idx("Description");
  const iQty = idx("Quantity");
  const iPrice = idx("Last Price");
  const iValue = idx("Current Value");
  void OPTIONAL_HEADERS;

  const raws: RawPosition[] = [];
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const acct = toStr(row[iAcctNum]);
    const name = toStr(row[iAcctName]);
    const symbol = toStr(row[iSymbol]);
    const description = toStr(row[iDesc]);
    const value = toNumber(row[iValue]);
    // Skip trailing disclaimer / footer rows: no account, no symbol.
    if (!acct && !symbol) continue;
    // Skip rows that are purely metadata (only description). Ingest anything
    // with an account and a value, even if quantity is missing (money-market
    // sweeps often have no quantity/price columns filled in).
    if (!acct || !name) continue;
    raws.push({
      accountNumber: acct,
      accountName: name,
      symbol,
      description,
      quantity: toNumber(row[iQty]),
      price: toNumber(row[iPrice]),
      value,
    });
  }

  const symbolIndex = new Map<string, SymbolMeta>();
  const positions: Position[] = raws.map((r) => {
    const key = r.symbol;
    if (!symbolIndex.has(key)) {
      symbolIndex.set(key, buildSymbolMeta(r.symbol, r.description));
    }
    const meta = symbolIndex.get(key)!;
    return {
      ...r,
      assetClass: meta.assetClass,
      isCash: meta.isCash,
      fractional: meta.fractional,
    };
  });

  const accountsMap = new Map<string, Account>();
  for (const p of positions) {
    let a = accountsMap.get(p.accountNumber);
    if (!a) {
      const type = inferAccountType(p.accountName);
      a = {
        number: p.accountNumber,
        name: p.accountName,
        type,
        totalValue: 0,
        cashSymbol: "",
        cashValue: 0,
        liquidityPreference: defaultLiquidityPreference(type),
      };
      accountsMap.set(p.accountNumber, a);
    }
    a.totalValue += p.value;
    if (p.isCash) {
      a.cashValue += p.value;
      // Prefer the largest cash-equivalent as the account's canonical cash
      // symbol. In the sample data most accounts have one true money-market
      // sweep (FZFXX, FCASH, SPAXX). If a T-bill fund and a sweep are both
      // marked isCash, we pick the bigger one.
      if (!a.cashSymbol || p.value > a.cashValue - p.value) {
        a.cashSymbol = p.symbol;
      }
    }
  }
  // Second pass to pick cashSymbol correctly (largest cash-marked position).
  for (const a of accountsMap.values()) {
    const cashPositions = positions.filter(
      (p) => p.accountNumber === a.number && p.isCash,
    );
    if (cashPositions.length > 0) {
      const largest = cashPositions.reduce((m, p) =>
        p.value > m.value ? p : m,
      );
      a.cashSymbol = largest.symbol;
    }
  }

  return {
    positions,
    accounts: Array.from(accountsMap.values()).sort((a, b) =>
      b.totalValue - a.totalValue,
    ),
    symbols: Array.from(symbolIndex.values()).sort((a, b) =>
      a.symbol.localeCompare(b.symbol),
    ),
  };
}
