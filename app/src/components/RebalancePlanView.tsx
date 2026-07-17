import { useState } from "react";
import type { RebalanceResult, AssetClass } from "../domain/types";
import { ALL_ASSET_CLASSES, ASSET_CLASS_COLORS } from "../domain/types";
import { formatMoney, formatQuantity, formatPct } from "../lib/format";

interface Props {
  plan: RebalanceResult;
}

export function RebalancePlanView({ plan }: Props) {
  const totalTradeValue = plan.perAccount.reduce(
    (s, a) => s + a.trades.reduce((t, tr) => t + tr.dollarAmount, 0),
    0,
  );
  const totalTradeCount = plan.perAccount.reduce(
    (s, a) => s + a.trades.length,
    0,
  );

  function downloadCsv() {
    const rows = [
      [
        "Account Number",
        "Account Name",
        "Action",
        "Symbol",
        "Description",
        "Asset Class",
        "Quantity",
        "Price",
        "Dollar Amount",
        "Note",
      ],
    ];
    for (const a of plan.perAccount) {
      for (const t of a.trades) {
        rows.push([
          t.account,
          t.accountName,
          t.action,
          t.symbol,
          `"${t.description.replace(/"/g, '""')}"`,
          t.assetClass,
          t.quantity.toFixed(4),
          t.price.toFixed(2),
          t.dollarAmount.toFixed(2),
          t.note ? `"${t.note.replace(/"/g, '""')}"` : "",
        ]);
      }
    }
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "rebalance-plan.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-xl border border-ink-200 bg-white shadow-card">
      <div className="border-b border-ink-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink-950">
            Rebalance plan
          </h2>
          <p className="text-xs text-ink-500 mt-0.5">
            {totalTradeCount} trades across {plan.perAccount.length} accounts, moving{" "}
            {formatMoney(totalTradeValue)} of capital. Cash never crosses accounts.
          </p>
        </div>
        <button
          onClick={downloadCsv}
          className="rounded-md border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:border-ink-400"
        >
          Export CSV
        </button>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-medium text-ink-950 mb-3">
            Current vs target (portfolio)
          </h3>
          <div className="rounded-md border border-ink-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Asset class</th>
                  <th className="text-right px-3 py-2 font-medium">Current</th>
                  <th className="text-right px-3 py-2 font-medium">Target</th>
                  <th className="text-right px-3 py-2 font-medium">Δ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {ALL_ASSET_CLASSES.map((ac) => {
                  const cur = plan.perAccount.reduce(
                    (s, a) => s + (a.currentByClass[ac] || 0),
                    0,
                  );
                  const tgt = plan.targetDollarsByClass[ac] || 0;
                  const d = tgt - cur;
                  if (cur < 1 && tgt < 1) return null;
                  return (
                    <tr key={ac}>
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-sm"
                            style={{ background: ASSET_CLASS_COLORS[ac] }}
                          />
                          {ac}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-ink-700">
                        {formatMoney(cur)}
                      </td>
                      <td className="px-3 py-2 text-right text-ink-950 font-medium">
                        {formatMoney(tgt)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-medium ${
                          Math.abs(d) < 1
                            ? "text-ink-400"
                            : d > 0
                            ? "text-emerald-700"
                            : "text-red-600"
                        }`}
                      >
                        {d > 0 ? "+" : ""}
                        {formatMoney(d)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {plan.warnings.length > 0 && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
              {plan.warnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-medium text-ink-950 mb-3">
            Per-account summary
          </h3>
          <div className="space-y-3">
            {plan.perAccount.map((a) => {
              const sells = a.trades.filter((t) => t.action === "SELL");
              const buys = a.trades.filter((t) => t.action === "BUY");
              return (
                <div
                  key={a.account.number}
                  className="rounded-md border border-ink-200 p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-ink-950">
                      {a.account.name}
                    </div>
                    <div className="text-xs text-ink-500">
                      {formatMoney(a.account.totalValue)}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-ink-500">
                    <span>
                      <span className="text-red-600">↓</span>{" "}
                      {sells.length} sell{sells.length !== 1 ? "s" : ""} (
                      {formatMoney(
                        sells.reduce((s, t) => s + t.dollarAmount, 0),
                      )}
                      )
                    </span>
                    <span>
                      <span className="text-emerald-700">↑</span>{" "}
                      {buys.length} buy{buys.length !== 1 ? "s" : ""} (
                      {formatMoney(buys.reduce((s, t) => s + t.dollarAmount, 0))}
                      )
                    </span>
                  </div>
                  <MiniBar
                    currentByClass={a.currentByClass}
                    targetByClass={a.targetByClass}
                    total={a.account.totalValue}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-ink-100">
        {plan.perAccount.map((a) => (
          <AccountTrades key={a.account.number} account={a} />
        ))}
      </div>
    </section>
  );
}

function MiniBar({
  currentByClass,
  targetByClass,
  total,
}: {
  currentByClass: Record<AssetClass, number>;
  targetByClass: Record<AssetClass, number>;
  total: number;
}) {
  const rows = ALL_ASSET_CLASSES.filter(
    (ac) => (currentByClass[ac] || 0) > 1 || (targetByClass[ac] || 0) > 1,
  );
  if (total <= 0) return null;
  return (
    <div className="mt-2 space-y-1">
      {rows.map((ac) => {
        const cur = ((currentByClass[ac] || 0) / total) * 100;
        const tgt = ((targetByClass[ac] || 0) / total) * 100;
        return (
          <div key={ac} className="text-[11px] text-ink-500">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-sm"
                  style={{ background: ASSET_CLASS_COLORS[ac] }}
                />
                {ac}
              </span>
              <span>
                {formatPct(cur)} → {formatPct(tgt)}
              </span>
            </div>
            <div className="relative h-1 bg-ink-100 rounded">
              <div
                className="absolute inset-y-0 left-0 rounded bg-ink-400"
                style={{ width: `${Math.min(100, cur)}%` }}
              />
              <div
                className="absolute -top-0.5 h-2 w-0.5 bg-ink-950"
                style={{ left: `${Math.min(100, tgt)}%` }}
                title={`Target ${formatPct(tgt)}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AccountTrades({
  account,
}: {
  account: RebalanceResult["perAccount"][number];
}) {
  const [open, setOpen] = useState(true);
  const totalDollar = account.trades.reduce((s, t) => s + t.dollarAmount, 0);
  return (
    <div className="border-b border-ink-100 last:border-0">
      <button
        className="w-full flex items-center justify-between px-6 py-3 text-left hover:bg-ink-50"
        onClick={() => setOpen((o) => !o)}
      >
        <div>
          <div className="text-sm font-medium text-ink-950">
            {account.account.name}
          </div>
          <div className="text-xs text-ink-500">
            {account.trades.length} trades · {formatMoney(totalDollar)}
          </div>
        </div>
        <span className="text-xs text-ink-500">{open ? "Hide" : "Show"}</span>
      </button>
      {open && account.trades.length > 0 && (
        <div className="px-6 pb-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Action</th>
                <th className="text-left px-3 py-2 font-medium">Symbol</th>
                <th className="text-left px-3 py-2 font-medium">Asset class</th>
                <th className="text-right px-3 py-2 font-medium">Quantity</th>
                <th className="text-right px-3 py-2 font-medium">Price</th>
                <th className="text-right px-3 py-2 font-medium">Dollar amount</th>
                <th className="text-left px-3 py-2 font-medium">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {account.trades.map((t, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                        t.action === "BUY"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {t.action}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium text-ink-950">{t.symbol}</td>
                  <td className="px-3 py-2 text-ink-500">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-sm"
                        style={{ background: ASSET_CLASS_COLORS[t.assetClass] }}
                      />
                      {t.assetClass}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-ink-700">
                    {formatQuantity(t.quantity)}
                  </td>
                  <td className="px-3 py-2 text-right text-ink-500">
                    ${t.price.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right text-ink-950 font-medium">
                    {formatMoney(t.dollarAmount)}
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-500 max-w-xs">
                    {t.note || ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && account.trades.length === 0 && (
        <div className="px-6 pb-4 text-xs text-ink-500">
          No trades needed. This account is already at its per-account target.
        </div>
      )}
    </div>
  );
}
