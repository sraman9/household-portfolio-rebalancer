import type {
  Account,
  AccountRebalancePlan,
  AssetClass,
  Position,
  RebalanceResult,
  SymbolMeta,
  Trade,
} from "./types";
import { ALL_ASSET_CLASSES } from "./types";
import { DEFAULT_ETF_FOR_CLASS } from "./assetClasses";

export interface RebalanceInput {
  accounts: Account[];
  positions: Position[];
  symbols: SymbolMeta[];
  /** Targets as percentages summing to ~100. */
  targets: Record<AssetClass, number>;
}

const EPS = 1e-6;

function zeroByClass(): Record<AssetClass, number> {
  const out = {} as Record<AssetClass, number>;
  for (const ac of ALL_ASSET_CLASSES) out[ac] = 0;
  return out;
}

/**
 * Capped proportional allocation ("water-filling"):
 *
 * Given a `budget` and a list of items with per-item `weight` and `cap`,
 * return an allocation such that:
 *
 *   1) 0 <= alloc[i] <= cap[i]
 *   2) sum(alloc) = min(budget, sum(caps))
 *   3) Among items that are NOT saturated at their cap, alloc[i] is
 *      proportional to weight[i].
 *
 * If total weight is zero for the remaining active items but there is still
 * budget to place, we spill proportional to remaining capacity so the money
 * ends up somewhere valid rather than getting lost.
 *
 * This is what lets a user say "put all cash in the brokerage account" and
 * still have leftover cash flow into the next-most-liquid account when the
 * brokerage runs out of room.
 */
function capProportional<T>(
  items: T[],
  weight: (t: T) => number,
  cap: (t: T) => number,
  budget: number,
  keyOf: (t: T) => string,
): Map<string, number> {
  const alloc = new Map<string, number>();
  for (const it of items) alloc.set(keyOf(it), 0);
  const totalCap = items.reduce((s, it) => s + cap(it), 0);
  let rem = Math.min(budget, totalCap);
  const active = new Set<string>(items.map(keyOf));
  const itemByKey = new Map<string, T>(items.map((it) => [keyOf(it), it]));

  const maxIter = items.length + 3;
  for (let iter = 0; iter < maxIter && rem > EPS && active.size > 0; iter++) {
    let totalW = 0;
    for (const k of active) totalW += Math.max(0, weight(itemByKey.get(k)!));

    if (totalW <= EPS) {
      // Spill by remaining capacity so no budget is lost.
      let totalRoom = 0;
      for (const k of active)
        totalRoom += cap(itemByKey.get(k)!) - (alloc.get(k) || 0);
      if (totalRoom <= EPS) break;
      for (const k of active) {
        const room = cap(itemByKey.get(k)!) - (alloc.get(k) || 0);
        alloc.set(k, (alloc.get(k) || 0) + (rem * room) / totalRoom);
      }
      rem = 0;
      break;
    }

    let filledThisRound = 0;
    const saturated: string[] = [];
    for (const k of active) {
      const w = Math.max(0, weight(itemByKey.get(k)!));
      const tentative = (alloc.get(k) || 0) + (rem * w) / totalW;
      const c = cap(itemByKey.get(k)!);
      if (tentative >= c - EPS) {
        filledThisRound += c - (alloc.get(k) || 0);
        alloc.set(k, c);
        saturated.push(k);
      }
    }
    if (saturated.length === 0) {
      for (const k of active) {
        const w = Math.max(0, weight(itemByKey.get(k)!));
        alloc.set(k, (alloc.get(k) || 0) + (rem * w) / totalW);
      }
      rem = 0;
      break;
    }
    for (const k of saturated) active.delete(k);
    rem -= filledThisRound;
  }
  return alloc;
}

function currentByAccountClass(positions: Position[]): Map<
  string,
  Record<AssetClass, number>
> {
  const out = new Map<string, Record<AssetClass, number>>();
  for (const p of positions) {
    if (!out.has(p.accountNumber)) out.set(p.accountNumber, zeroByClass());
    const rec = out.get(p.accountNumber)!;
    rec[p.assetClass] += p.value;
  }
  return out;
}

/**
 * Round a share quantity to the nearest tradable unit.
 * For fractional-friendly securities we keep 4 decimals (matches how retail
 * brokers display ETF share fractions). For non-fractional securities we
 * round toward zero on BUYs (so we never overshoot the target) and away from
 * zero on SELLs (so we finish freeing the required dollars). This is the
 * safer direction for both sides of a trade.
 */
function roundQuantity(
  q: number,
  action: "BUY" | "SELL",
  fractional: boolean,
): number {
  if (fractional) return Math.round(q * 10000) / 10000;
  if (action === "BUY") return Math.floor(q);
  return Math.ceil(q);
}

export function rebalance(input: RebalanceInput): RebalanceResult {
  const { accounts, positions, targets, symbols } = input;
  const totalValue = accounts.reduce((s, a) => s + a.totalValue, 0);
  const targetPct = { ...targets };
  const sumPct = ALL_ASSET_CLASSES.reduce(
    (s, ac) => s + (targetPct[ac] || 0),
    0,
  );
  // Silently normalize a target that doesn't sum to 100. The UI enforces the
  // constraint before enabling "Compute plan", but this keeps the pure
  // function robust when called from tests or an API caller.
  const normPct = {} as Record<AssetClass, number>;
  for (const ac of ALL_ASSET_CLASSES) {
    normPct[ac] = sumPct > 0 ? (targetPct[ac] || 0) / sumPct : 0;
  }

  const targetDollarsByClass = zeroByClass();
  for (const ac of ALL_ASSET_CLASSES) {
    targetDollarsByClass[ac] = totalValue * normPct[ac];
  }

  const cashTarget = targetDollarsByClass["Cash & Money Market"];

  // Step 1: allocate cash across accounts using liquidity preferences,
  //         respecting each account's total value as a hard cap.
  const cashByAccount = capProportional(
    accounts,
    (a) => a.liquidityPreference,
    (a) => a.totalValue,
    cashTarget,
    (a) => a.number,
  );

  // Step 2: for each non-cash class, allocate its global dollar target across
  //         accounts proportional to each account's remaining (non-cash)
  //         capacity. Because total non-cash target equals total non-cash
  //         capacity (both are totalValue minus cash), this sums exactly to
  //         each account's own capacity and preserves the no-cross-account
  //         cash invariant.
  const totalCapacity = accounts.reduce(
    (s, a) => s + (a.totalValue - (cashByAccount.get(a.number) || 0)),
    0,
  );

  const perAccountTargets = new Map<string, Record<AssetClass, number>>();
  for (const a of accounts) {
    const cashHere = cashByAccount.get(a.number) || 0;
    const capacity = a.totalValue - cashHere;
    const rec = zeroByClass();
    rec["Cash & Money Market"] = cashHere;
    for (const ac of ALL_ASSET_CLASSES) {
      if (ac === "Cash & Money Market") continue;
      rec[ac] =
        totalCapacity > EPS
          ? (targetDollarsByClass[ac] * capacity) / totalCapacity
          : 0;
    }
    perAccountTargets.set(a.number, rec);
  }

  const currentACC = currentByAccountClass(positions);
  const symbolMetaByKey = new Map(symbols.map((s) => [s.symbol, s]));

  // Step 3: generate trades per account. For sells, scale down existing
  //         holdings proportionally so we don't force the user to close a
  //         whole position when a partial trim is enough. For buys, add to
  //         the largest existing holding in that class (concentrated buy is
  //         easier to execute manually than N tiny buys) and fall back to a
  //         default ETF if the class has no representative in this account.
  const perAccount: AccountRebalancePlan[] = [];
  const globalWarnings: string[] = [];

  for (const a of accounts) {
    const cur = currentACC.get(a.number) || zeroByClass();
    const tgt = perAccountTargets.get(a.number)!;
    const delta = zeroByClass();
    for (const ac of ALL_ASSET_CLASSES) delta[ac] = tgt[ac] - cur[ac];

    const trades: Trade[] = [];
    const warnings: string[] = [];

    const accountPositions = positions.filter(
      (p) => p.accountNumber === a.number,
    );

    // SELLS first so realized proceeds are available before we plan buys.
    for (const ac of ALL_ASSET_CLASSES) {
      if (ac === "Cash & Money Market") continue;
      if (delta[ac] >= -EPS) continue;
      const sellDollars = -delta[ac];
      const holdings = accountPositions.filter(
        (p) => p.assetClass === ac && !p.isCash && p.value > 0,
      );
      const totalHeld = holdings.reduce((s, p) => s + p.value, 0);
      if (totalHeld < sellDollars - 0.5) {
        warnings.push(
          `Cannot fully rebalance ${ac}: needs to sell $${sellDollars.toFixed(0)} but only holds $${totalHeld.toFixed(0)}.`,
        );
      }
      for (const p of holdings) {
        if (totalHeld <= EPS) break;
        const share = (p.value / totalHeld) * Math.min(sellDollars, totalHeld);
        if (share < 1) continue; // skip trades under $1
        const price = p.price || (p.quantity > 0 ? p.value / p.quantity : 1);
        const qty = share / (price || 1);
        const meta = symbolMetaByKey.get(p.symbol);
        const fractional = meta?.fractional ?? true;
        const rounded = roundQuantity(qty, "SELL", fractional);
        const actualDollars = fractional ? share : rounded * price;
        trades.push({
          account: a.number,
          accountName: a.name,
          symbol: p.symbol,
          description: p.description,
          action: "SELL",
          assetClass: ac,
          dollarAmount: actualDollars,
          quantity: rounded,
          price,
          note: fractional
            ? undefined
            : `Rounded to whole shares; ~$${(actualDollars - share).toFixed(2)} residual absorbed by cash.`,
        });
      }
    }

    // BUYS after sells.
    for (const ac of ALL_ASSET_CLASSES) {
      if (ac === "Cash & Money Market") continue;
      if (delta[ac] <= EPS) continue;
      const buyDollars = delta[ac];
      const holdings = accountPositions.filter(
        (p) => p.assetClass === ac && !p.isCash && p.value > 0,
      );
      let symbol: string;
      let description: string;
      let price: number;
      let fractional: boolean;
      if (holdings.length > 0) {
        // Concentrate the buy into the largest existing holding for that
        // asset class. Keeps trades human-executable and doesn't create
        // tiny new positions.
        const largest = holdings.reduce((m, p) => (p.value > m.value ? p : m));
        symbol = largest.symbol;
        description = largest.description;
        price =
          largest.price ||
          (largest.quantity > 0 ? largest.value / largest.quantity : 1);
        const meta = symbolMetaByKey.get(largest.symbol);
        fractional = meta?.fractional ?? true;
      } else {
        symbol = DEFAULT_ETF_FOR_CLASS[ac];
        description = `Default ${ac} ETF (${symbol}) — no existing position in this account.`;
        price = 100; // Placeholder for a new symbol; user overrides at execution.
        fractional = true;
        warnings.push(
          `Buying ${symbol} for ${ac} in ${a.name}: no existing position, using default ETF.`,
        );
      }
      const qty = buyDollars / (price || 1);
      const rounded = roundQuantity(qty, "BUY", fractional);
      const actualDollars = fractional ? buyDollars : rounded * price;
      if (actualDollars < 1) continue;
      trades.push({
        account: a.number,
        accountName: a.name,
        symbol,
        description,
        action: "BUY",
        assetClass: ac,
        dollarAmount: actualDollars,
        quantity: rounded,
        price,
        note: fractional
          ? undefined
          : `Rounded to whole shares; ~$${(buyDollars - actualDollars).toFixed(2)} left in cash.`,
      });
    }

    // Sanity check: verify no account is asked to buy more than its
    // (starting cash + realized sells) can cover.
    const cashInflowFromSells = trades
      .filter((t) => t.action === "SELL")
      .reduce((s, t) => s + t.dollarAmount, 0);
    const cashOutflowFromBuys = trades
      .filter((t) => t.action === "BUY")
      .reduce((s, t) => s + t.dollarAmount, 0);
    const startingCash = accountPositions
      .filter((p) => p.isCash)
      .reduce((s, p) => s + p.value, 0);
    const endingCash =
      startingCash + cashInflowFromSells - cashOutflowFromBuys;
    if (endingCash < -1) {
      const shortfall = -endingCash;
      const buyTrades = trades.filter((t) => t.action === "BUY");
      const totalBuys = buyTrades.reduce((s, t) => s + t.dollarAmount, 0);
      let msg = `Plan would overdraw this account by $${shortfall.toFixed(0)}. Cash cannot cross accounts.`;

      if (totalBuys <= 0.5) {
        // Nothing to trim; the shortfall comes entirely from sells that
        // could not be sourced (holdings smaller than the requested sell).
        msg += ` No buy trades were generated here, so the shortfall is caused by insufficient sellable holdings, not by buy sizing.`;
      } else if (shortfall >= totalBuys - 0.5) {
        // Even zeroing every buy would not close the gap.
        msg += ` Even removing every buy ($${totalBuys.toFixed(0)} total) would not close the gap; the required sells could not be sourced from this account's holdings.`;
      } else {
        // A proportional shrink across every BUY brings ending cash to zero
        // while preserving the plan's asset-class ratios. This is only a
        // suggestion for the user; trades[] is deliberately not mutated so
        // the plan stays observational and the UI can show both the
        // requested trades and the recommended trim side-by-side.
        const trims = buyTrades
          .map((t) => {
            const trim = (t.dollarAmount / totalBuys) * shortfall;
            return {
              symbol: t.symbol,
              trim,
              newSize: t.dollarAmount - trim,
            };
          })
          .filter((x) => x.trim >= 1)
          .sort((a, b) => b.trim - a.trim);
        const listed = trims
          .slice(0, 5)
          .map(
            (x) =>
              `${x.symbol} $${x.trim.toFixed(0)}\u2192$${x.newSize.toFixed(0)}`,
          );
        const more = trims.length > 5 ? `, +${trims.length - 5} more` : "";
        if (listed.length > 0) {
          msg += ` To balance, trim buys proportionally: ${listed.join(", ")}${more}.`;
        }
      }

      warnings.push(msg);
    }

    perAccount.push({
      account: a,
      currentByClass: cur,
      targetByClass: tgt,
      deltaByClass: delta,
      trades,
      warnings,
    });
    warnings.forEach((w) => globalWarnings.push(`[${a.name}] ${w}`));
  }

  return {
    totalValue,
    targetDollarsByClass,
    perAccount,
    warnings: globalWarnings,
  };
}
