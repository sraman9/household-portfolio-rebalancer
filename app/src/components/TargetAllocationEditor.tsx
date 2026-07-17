import type { AssetClass } from "../domain/types";
import { ALL_ASSET_CLASSES, ASSET_CLASS_COLORS } from "../domain/types";
import { PRESETS } from "../lib/presets";
import { formatMoney, formatPct } from "../lib/format";

interface Props {
  targets: Record<AssetClass, number>;
  onChange: (t: Record<AssetClass, number>) => void;
  totalValue: number;
}

export function TargetAllocationEditor({ targets, onChange, totalValue }: Props) {
  const sum = ALL_ASSET_CLASSES.reduce((s, ac) => s + (targets[ac] || 0), 0);
  const ok = Math.abs(sum - 100) < 0.5;

  function setOne(ac: AssetClass, v: number) {
    onChange({ ...targets, [ac]: Math.max(0, Math.min(100, v)) });
  }

  return (
    <section className="rounded-xl border border-ink-200 bg-white shadow-card">
      <div className="border-b border-ink-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink-950">
            Target allocation
          </h2>
          <p className="text-xs text-ink-500 mt-0.5">
            Percentages must total 100%.
          </p>
        </div>
        <div
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            ok
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-amber-50 text-amber-700 border border-amber-200"
          }`}
        >
          Sum: {sum.toFixed(1)}%
        </div>
      </div>
      <div className="px-6 py-4 border-b border-ink-100">
        <div className="text-xs text-ink-500 mb-2">Load a preset</div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => onChange(p.targets)}
              className="text-xs rounded-md border border-ink-200 bg-white px-2.5 py-1.5 hover:border-ink-400 text-ink-700"
              title={p.description}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-6 space-y-3">
        {ALL_ASSET_CLASSES.map((ac) => {
          const pct = targets[ac] || 0;
          const dollars = totalValue * (pct / 100);
          return (
            <div key={ac} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center">
              <div>
                <div className="flex items-center gap-2 text-sm text-ink-950">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ background: ASSET_CLASS_COLORS[ac] }}
                  />
                  {ac}
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.5}
                  value={pct}
                  onChange={(e) => setOne(ac, parseFloat(e.target.value))}
                  className="w-full mt-1 accent-ink-950"
                />
              </div>
              <div className="w-24 text-right text-xs text-ink-500">
                {formatMoney(dollars)}
              </div>
              <div className="w-20">
                <div className="flex items-center rounded-md border border-ink-200 bg-white overflow-hidden">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={pct}
                    onChange={(e) => setOne(ac, parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 text-sm text-right bg-transparent focus:outline-none"
                  />
                  <span className="pr-2 text-ink-500 text-xs">%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-6 py-3 border-t border-ink-100 flex items-center justify-between text-xs text-ink-500">
        <span>Target sum</span>
        <span className={ok ? "text-emerald-700 font-medium" : "text-amber-700 font-medium"}>
          {formatPct(sum)}
        </span>
      </div>
    </section>
  );
}
