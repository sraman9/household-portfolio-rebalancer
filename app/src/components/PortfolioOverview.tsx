import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { ParsedPortfolio } from "../domain/parse";
import { ALL_ASSET_CLASSES, ASSET_CLASS_COLORS } from "../domain/types";
import { formatMoney, formatPct } from "../lib/format";

interface Props {
  portfolio: ParsedPortfolio;
}

export function PortfolioOverview({ portfolio }: Props) {
  const totalValue = portfolio.accounts.reduce((s, a) => s + a.totalValue, 0);

  const byClass = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of portfolio.positions) {
      map.set(p.assetClass, (map.get(p.assetClass) || 0) + p.value);
    }
    return ALL_ASSET_CLASSES.map((ac) => ({
      name: ac,
      value: map.get(ac) || 0,
      color: ASSET_CLASS_COLORS[ac],
    })).filter((r) => r.value > 0);
  }, [portfolio]);

  const byAccount = portfolio.accounts.map((a) => ({
    ...a,
    pct: totalValue > 0 ? (a.totalValue / totalValue) * 100 : 0,
  }));

  return (
    <section className="rounded-xl border border-ink-200 bg-white shadow-card">
      <div className="border-b border-ink-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink-950">
            Current Portfolio
          </h2>
          <p className="text-xs text-ink-500 mt-0.5">
            Organized by asset class and account.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-ink-500">Total value</div>
          <div className="text-xl font-semibold text-ink-950">
            {formatMoney(totalValue)}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
        <div>
          <h3 className="text-sm font-medium text-ink-950 mb-3">
            Allocation by asset class
          </h3>
          <div className="flex items-center gap-6">
            <div className="w-40 h-40 shrink-0">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={byClass}
                    dataKey="value"
                    innerRadius={40}
                    outerRadius={72}
                    paddingAngle={1}
                    stroke="none"
                  >
                    {byClass.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => formatMoney(Number(v))}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 6,
                      border: "1px solid #d6d7de",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5 text-sm">
              {byClass
                .slice()
                .sort((a, b) => b.value - a.value)
                .map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ background: d.color }}
                    />
                    <span className="flex-1 text-ink-700">{d.name}</span>
                    <span className="font-medium text-ink-950">
                      {formatMoney(d.value)}
                    </span>
                    <span className="w-12 text-right text-ink-500">
                      {formatPct((d.value / totalValue) * 100)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-ink-950 mb-3">
            Accounts ({portfolio.accounts.length})
          </h3>
          <div className="overflow-hidden rounded-md border border-ink-200">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Account</th>
                  <th className="text-left px-3 py-2 font-medium">Type</th>
                  <th className="text-right px-3 py-2 font-medium">Value</th>
                  <th className="text-right px-3 py-2 font-medium">Cash</th>
                  <th className="text-right px-3 py-2 font-medium">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {byAccount.map((a) => (
                  <tr key={a.number}>
                    <td className="px-3 py-2 text-ink-950">{a.name}</td>
                    <td className="px-3 py-2 text-ink-500 capitalize">
                      {a.type}
                    </td>
                    <td className="px-3 py-2 text-right text-ink-950">
                      {formatMoney(a.totalValue)}
                    </td>
                    <td className="px-3 py-2 text-right text-ink-600">
                      {formatMoney(a.cashValue)}
                    </td>
                    <td className="px-3 py-2 text-right text-ink-500">
                      {formatPct(a.pct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
