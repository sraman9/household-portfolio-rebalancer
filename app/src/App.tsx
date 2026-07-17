import { useMemo, useState } from "react";
import { UploadCard } from "./components/UploadCard";
import { PortfolioOverview } from "./components/PortfolioOverview";
import { AssetClassMapping } from "./components/AssetClassMapping";
import { LiquidityPreferences } from "./components/LiquidityPreferences";
import { TargetAllocationEditor } from "./components/TargetAllocationEditor";
import { RebalancePlanView } from "./components/RebalancePlanView";
import { parseXlsxFile, type ParsedPortfolio } from "./domain/parse";
import { rebalance } from "./domain/rebalance";
import { ALL_ASSET_CLASSES, type AssetClass } from "./domain/types";
import { PRESETS } from "./lib/presets";

function App() {
  const [portfolio, setPortfolio] = useState<ParsedPortfolio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [targets, setTargets] = useState<Record<AssetClass, number>>(
    PRESETS[1].targets,
  );

  // The current portfolio, adjusted for user's live edits to asset-class
  // mapping and liquidity preferences. Recomputed cheaply on each render.
  const rebalanceInput = useMemo(() => {
    if (!portfolio) return null;
    return {
      accounts: portfolio.accounts,
      positions: portfolio.positions,
      symbols: portfolio.symbols,
      targets,
    };
  }, [portfolio, targets]);

  const plan = useMemo(() => {
    if (!rebalanceInput) return null;
    const targetSum = ALL_ASSET_CLASSES.reduce(
      (s, ac) => s + (rebalanceInput.targets[ac] || 0),
      0,
    );
    if (Math.abs(targetSum - 100) > 0.5) return null;
    return rebalance(rebalanceInput);
  }, [rebalanceInput]);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const parsed = await parseXlsxFile(file);
      setPortfolio(parsed);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function updateSymbolMeta(symbol: string, patch: Partial<{ assetClass: AssetClass; isCash: boolean; fractional: boolean }>) {
    if (!portfolio) return;
    setPortfolio({
      ...portfolio,
      symbols: portfolio.symbols.map((s) =>
        s.symbol === symbol ? { ...s, ...patch } : s,
      ),
      positions: portfolio.positions.map((p) => {
        if (p.symbol !== symbol) return p;
        return {
          ...p,
          assetClass: patch.assetClass ?? p.assetClass,
          isCash: patch.isCash ?? p.isCash,
          fractional: patch.fractional ?? p.fractional,
        };
      }),
      accounts: portfolio.accounts.map((a) => ({
        ...a,
        cashValue: portfolio.positions
          .filter((p) => p.accountNumber === a.number)
          .filter((p) =>
            p.symbol === symbol
              ? (patch.isCash ?? p.isCash)
              : p.isCash,
          )
          .reduce((s, p) => s + p.value, 0),
      })),
    });
  }

  function updateAccountLiquidity(accountNumber: string, value: number) {
    if (!portfolio) return;
    setPortfolio({
      ...portfolio,
      accounts: portfolio.accounts.map((a) =>
        a.number === accountNumber ? { ...a, liquidityPreference: value } : a,
      ),
    });
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-ink-950 tracking-tight">
              Household Portfolio Rebalancer
            </h1>
            <p className="text-sm text-ink-500 mt-0.5">
              Reshape a raw broker export into an asset-class view, set a
              target, and get exact per-account trades.
            </p>
          </div>
          {portfolio && (
            <button
              onClick={() => setPortfolio(null)}
              className="text-sm text-ink-600 hover:text-ink-950 underline underline-offset-4"
            >
              Start over
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-8">
        {!portfolio && (
          <UploadCard onFile={handleFile} busy={busy} error={error} />
        )}
        {portfolio && (
          <>
            <PortfolioOverview portfolio={portfolio} />
            <AssetClassMapping
              portfolio={portfolio}
              onChange={updateSymbolMeta}
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TargetAllocationEditor
                targets={targets}
                onChange={setTargets}
                totalValue={portfolio.accounts.reduce(
                  (s, a) => s + a.totalValue,
                  0,
                )}
              />
              <LiquidityPreferences
                accounts={portfolio.accounts}
                onChange={updateAccountLiquidity}
              />
            </div>
            {plan ? (
              <RebalancePlanView plan={plan} />
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 text-sm">
                Target percentages must sum to 100% before a plan is computed.
              </div>
            )}
          </>
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-6 py-8 text-center text-xs text-ink-400">
        Local-only tool. No data leaves your browser.
      </footer>
    </div>
  );
}

export default App;
