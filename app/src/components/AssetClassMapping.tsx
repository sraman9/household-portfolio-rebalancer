import { useState } from "react";
import type { ParsedPortfolio } from "../domain/parse";
import { ALL_ASSET_CLASSES, type AssetClass } from "../domain/types";
import { formatMoney } from "../lib/format";

interface Props {
  portfolio: ParsedPortfolio;
  onChange: (
    symbol: string,
    patch: Partial<{ assetClass: AssetClass; isCash: boolean; fractional: boolean }>,
  ) => void;
}

export function AssetClassMapping({ portfolio, onChange }: Props) {
  const [expanded, setExpanded] = useState(() =>
    portfolio.symbols.some((s) => s.assetClass === "Other"),
  );

  const rows = portfolio.symbols
    .map((s) => {
      const value = portfolio.positions
        .filter((p) => p.symbol === s.symbol)
        .reduce((v, p) => v + p.value, 0);
      const accounts = new Set(
        portfolio.positions
          .filter((p) => p.symbol === s.symbol)
          .map((p) => p.accountName),
      );
      return { ...s, value, accountCount: accounts.size };
    })
    .sort((a, b) => b.value - a.value);

  const hasOther = rows.some((r) => r.assetClass === "Other");

  return (
    <section className="rounded-xl border border-ink-200 bg-white shadow-card">
      <button
        className="w-full flex items-center justify-between px-6 py-4 border-b border-ink-200 text-left"
        onClick={() => setExpanded((e) => !e)}
      >
        <div>
          <h2 className="text-base font-semibold text-ink-950">
            Ticker to asset-class mapping
          </h2>
          <p className="text-xs text-ink-500 mt-0.5">
            {rows.length} unique symbols. {hasOther ? "Symbols in Other need reclassification." : "All symbols classified."}
          </p>
        </div>
        <span className="text-sm text-ink-500">
          {expanded ? "Hide" : "Edit"}
        </span>
      </button>
      {expanded && (
        <div className="p-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Symbol</th>
                <th className="text-left px-3 py-2 font-medium">Description</th>
                <th className="text-right px-3 py-2 font-medium">Value</th>
                <th className="text-left px-3 py-2 font-medium">Asset class</th>
                <th className="text-center px-3 py-2 font-medium">Cash-equiv?</th>
                <th className="text-center px-3 py-2 font-medium">Fractional?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((r) => (
                <tr key={r.symbol} className={r.assetClass === "Other" ? "bg-amber-50/50" : ""}>
                  <td className="px-3 py-2 font-medium text-ink-950">
                    {r.symbol}
                  </td>
                  <td className="px-3 py-2 text-ink-500 max-w-xs truncate" title={r.description}>
                    {r.description}
                  </td>
                  <td className="px-3 py-2 text-right text-ink-700">
                    {formatMoney(r.value)}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={r.assetClass}
                      onChange={(e) =>
                        onChange(r.symbol, {
                          assetClass: e.target.value as AssetClass,
                          isCash: e.target.value === "Cash & Money Market",
                        })
                      }
                      className="rounded-md border border-ink-200 bg-white px-2 py-1 text-sm"
                    >
                      {ALL_ASSET_CLASSES.map((ac) => (
                        <option key={ac} value={ac}>
                          {ac}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={r.isCash}
                      onChange={(e) => onChange(r.symbol, { isCash: e.target.checked })}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={r.fractional}
                      onChange={(e) => onChange(r.symbol, { fractional: e.target.checked })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
