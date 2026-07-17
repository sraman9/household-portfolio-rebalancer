# Household Portfolio Rebalancer: Submission

## Section A. Written Analysis (Approach)

The core problem is that a broker export gives you a flat, symbol-level view of a household's money, but the user thinks in terms of asset classes and targets that span multiple accounts. The first job was reshaping the data: positions from the CSV are kept as the raw source of truth, and a separate, user-editable mapping table assigns each ticker to an asset class (and flags whether it's a cash-equivalent and whether it trades fractionally). Account-level and asset-class-level views are just derived rollups computed from that mapping on the fly, rather than baked permanently onto each row. This matters because the ticker-to-asset-class mapping is a judgment call the user can change, not a fact the broker provides. If the class lived only on the raw position data, every reclassification would risk silently drifting out of sync with the mapping table.

Modeling the target was the second gap. The user sets a single household-level target across asset classes (e.g., 55% US Equity, 25% International, 20% Bonds), which is naturally what they think in. But that target has to be translated into something executable per account, because cash cannot move between accounts. The algorithm converts the household target into dollar amounts per asset class, then derives a separate target per account that sums exactly to that account's own total value. This makes cash isolation a mathematical property of the design rather than something checked after the fact. No computed plan can imply moving money across accounts, because each account's targets are constructed from its own value alone.

The rebalancing math itself is a straightforward diff: for each account, compare current holdings against that account's derived target, sell where current exceeds target, then buy where current falls short. Sells are generated before buys so the trade list reads the way a person would actually execute it (free cash first, then spend it), and so a simple cash-flow check (starting cash + sells − buys) can catch and flag potential overdrafts.

The main design trade-off is between per-account correctness and household-level correctness. Because each account is rebalanced independently against its own derived target, the household as a whole can temporarily look "off" from certain angles: an asset class might sit at target in one account and above or below it in another, even though every individual account matches its own target exactly. That trade-off is intentional: it's the only way to guarantee cash never needs to cross accounts, which the challenge explicitly required.

## Section B. Architectural Decisions and Edge Case Reasoning

### Architectural Decisions

**Data model.** Positions are the source of truth. Accounts and per-class rollups are derived on the fly from positions, and symbol metadata (asset class, cash flag, fractional flag) lives in a separate `symbols` slice that the user can edit. This split matters because the mapping is a user decision, not a broker fact: editing it must not overwrite the raw import. Keeping positions immutable also lets me recompute the entire plan on every slider change without re-parsing the file.

**Rebalancing logic.** The algorithm is deliberately declarative: given portfolio target percentages, produce a set of per-account per-class dollar targets, then diff against current values. Everything downstream is a straightforward "if target is higher, buy; if lower, sell." I chose this over a greedy "minimize number of trades" approach because it generalizes: the same code works for any target, any set of accounts, any liquidity preference, without special cases. The three-pass structure (portfolio targets, cash water-fill, non-cash proportional) makes cash isolation a mathematical property rather than a runtime check: the per-account targets sum to the account value by construction, so no plan can imply a cash transfer across accounts.

**Liquidity-preference approach.** Preference is a number per account from 0 to 1, exposed as sliders in the UI, defaulted from the inferred account type (1.0 for taxable brokerage, 0.2 for Roth, 0.0 for IRA and 401k, 0.6 for HSA). The cash allocation step is a capped proportional fill, so a large brokerage account with weight 1.0 will absorb the entire household cash target before any spills into a retirement account. If preferences are all zero and there is still cash to place, the algorithm spills by remaining capacity so no dollar gets lost. This generalizes past the single sample described in the challenge: you can invert the preferences and force cash into an IRA if that is what you want, or set several accounts equal and get a proportional split.

### Edge Cases

*This subsection is written by hand, without AI assistance, per the challenge instructions.*

**Edge case 1. An account's required buys exceed its own cash position, and cash cannot cross accounts.**

Initially, AI suggested just throwing an error message at the user saying that they overdrafted - that isn't a complete solution. It then suggested auto-balancing the users buy requests without first getting their input. This would have been a real red-flag - AI should only draft, never decide. The final solution was to a. notify the user of their overdraft, and then b. SUGGEST buying less of certain positions, i.e. $1600 of VXUS instead of $2400 of VXUS. The reduction is calculated proportionally across all the buys in that account, not just the biggest one, so the suggested trim keeps the same ratios as the original plan. The actual trade plan shown to the user never changes because of this, it's just a suggestion, so the user still sees exactly what they asked for and decides for themselves whether to act on it.

**Edge case 2. A position is over-weighted in the account holding it, but rebalancing it in place would push that specific account off its own target, while another account already sits at its class target.**

Each account's target is derived from the household target, then rebalancing happens against that account's own derived target - each account is handled completely separately after that point. Re-balancing account 1 has no effect on account 2. The side-effect of optimizing for account-level correctness is that at certain times, looking at the whole household, the balance may look uneven across accounts, even though each individual account matches its own target. So if account 1 has a derived target of 20% U.S. Equity but currently sits at 40%, we rebalance account 1 down toward that target, and we don't touch account 2, which already sits at a perfect 20% U.S. Equity relative to its own target.

**Edge case 3. A computed trade implies buying a fractional share of a security that does not support fractional trading.**

If we try to buy a fractional share of a security that doesn't support that mechanism, we floor on BUYs so that we never overshoot our target. We also make a note of the excess cash, and inform the user that we performed rounding. Conversely, when SELLing these positions, we use the ceil function so that we always free up the dollars we need.

## Section C. AI Usage Log

**Interaction 1: Overdraft handling.**
I asked the AI to explain what the rebalancing code currently did when an account's required buys exceeded what its own cash plus its own sells could fund. Its first suggestion was to just surface a generic error/warning with no path forward for the user. Its second suggestion was to auto-scale the buy trades down to fit, without the user's input. I rejected both: the first wasn't actionable, and the second had the software silently make a financial decision on the user's behalf. What I kept: a warning that stays purely informational (the actual trade plan is never mutated), but made it actionable by having it name specific buys to trim and by how much, calculated proportionally so the trimmed plan preserves the original ratios.

**Interaction 2: CSV and data reshaping approach.**
I asked the AI to reshape the flat broker CSV export into an asset-class-organized structure. Its first-pass approach baked the asset-class label directly onto each parsed position row at import time. I changed this: since the ticker-to-asset-class mapping is something the user needs to edit later (the broker doesn't provide it), baking it onto immutable position rows would mean every reclassification required rewriting all rows for that ticker, risking drift between the mapping and the raw data. I had it move the mapping into a separate, editable `symbols` table instead, with asset-class rollups computed as derived views.

**Interaction 3: Liquidity-preference defaults.**
I asked the AI to implement the liquidity-preference weighting per account. It proposed defaulting every account to the same preference regardless of account type. I pushed back because that ignores the real-world friction the challenge describes. A taxable brokerage account is more accessible than a retirement account with withdrawal penalties. I had it infer sensible defaults from account type instead (higher preference for taxable brokerage, lower for IRA/401k), while still leaving the values editable as sliders so the tool generalizes beyond the one example in the spec.