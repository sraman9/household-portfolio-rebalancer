import type { Account } from "../domain/types";
import { formatMoney } from "../lib/format";

interface Props {
  accounts: Account[];
  onChange: (accountNumber: string, value: number) => void;
}

export function LiquidityPreferences({ accounts, onChange }: Props) {
  const totalWeight = accounts.reduce(
    (s, a) => s + Math.max(0, a.liquidityPreference),
    0,
  );

  return (
    <section className="rounded-xl border border-ink-200 bg-white shadow-card">
      <div className="border-b border-ink-200 px-6 py-4">
        <h2 className="text-base font-semibold text-ink-950">
          Liquidity preferences
        </h2>
        <p className="text-xs text-ink-500 mt-0.5">
          Higher weight means "prefer to hold cash here." Cash allocation is
          water-filled by weight, capped at each account's total value.
        </p>
      </div>
      <div className="p-6 space-y-4">
        {accounts.map((a) => {
          const share =
            totalWeight > 0
              ? (Math.max(0, a.liquidityPreference) / totalWeight) * 100
              : 0;
          return (
            <div key={a.number}>
              <div className="flex items-center justify-between text-sm">
                <div>
                  <div className="text-ink-950 font-medium">{a.name}</div>
                  <div className="text-xs text-ink-500 capitalize">
                    {a.type} · {formatMoney(a.totalValue)} total
                  </div>
                </div>
                <div className="text-xs text-ink-500 text-right">
                  weight <span className="font-medium text-ink-950">
                    {a.liquidityPreference.toFixed(2)}
                  </span>
                  {totalWeight > 0 && (
                    <> · <span className="text-ink-500">~{share.toFixed(0)}% of cash</span></>
                  )}
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={a.liquidityPreference}
                onChange={(e) => onChange(a.number, parseFloat(e.target.value))}
                className="w-full mt-2 accent-ink-950"
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
