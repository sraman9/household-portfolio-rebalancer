Section B. Architectural decisions and edge case reasoning

Architectural decisions

Data model. Positions are the source of truth. Accounts and per-class rollups are derived on the fly from positions, and symbol metadata (asset class, cash flag, fractional flag) lives in a separate `symbols` slice that the user can edit. This split matters because the mapping is a user decision, not a broker fact: editing it must not overwrite the raw import. Keeping positions immutable also lets me recompute the entire plan on every slider change without re-parsing the file.

Rebalancing logic. The algorithm is deliberately declarative: given portfolio target percentages, produce a set of per-account per-class dollar targets, then diff against current values. Everything downstream is a straightforward "if target is higher, buy; if lower, sell." I chose this over a greedy "minimize number of trades" approach because it generalizes: the same code works for any target, any set of accounts, any liquidity preference, without special cases. The three-pass structure (portfolio targets, cash water-fill, non-cash proportional) makes cash isolation a mathematical property rather than a runtime check: the per-account targets sum to the account value by construction, so no plan can imply a cash transfer across accounts.

Liquidity-preference approach. Preference is a number per account from 0 to 1, exposed as sliders in the UI, defaulted from the inferred account type (1.0 for taxable brokerage, 0.2 for Roth, 0.0 for IRA and 401k, 0.6 for HSA). The cash allocation step is a capped proportional fill, so a large brokerage account with weight 1.0 will absorb the entire household cash target before any spills into a retirement account. If preferences are all zero and there is still cash to place, the algorithm spills by remaining capacity so no dollar gets lost. This generalizes past the single sample described in the challenge: you can invert the preferences and force cash into an IRA if that is what you want, or set several accounts equal and get a proportional split.

Edge cases

This subsection is written by hand, without AI assistance, per the challenge instructions.

Edge case 1. An account's required buys exceed its own cash position, and cash cannot cross accounts.

Initially, AI suggested just throwing an error message at the user saying that they overdrafted - that isn't a complete solution. It then suggested auto-balancing the users buy requests without first getting their input. This would have been a real red-flag - AI should only draft, never decide. The final solution was to a. notify the user of their overdraft, and then b. SUGGEST buying less of certain positions, i.e. $1600 of VXUS instead of $2400 of VXUS. The reduction is calculated proportionally across all the buys in that account, not just the biggest one, so the suggested trim keeps the same ratios as the original plan. The actual trade plan shown to the user never changes because of this, it's just a suggestion, so the user still sees exactly what they asked for and decides for themselves whether to act on it.

Edge case 2. A position is over-weighted in the account holding it, but rebalancing it in place would push that specific account off its own target, while another account already sits at its class target.

Each account is handled completely separately. Re-balancing account 1 has no effect on account 2. The side-effect of optimizing for account-level balancing is that at certain times, looking at the whole household, the balance may look off as we try to adjust one account back to it's targets. But if account 1 has a target of 20% U.S. Equity but sits currently at 40%, we would re-balance account 1, and not touch account 2 which contains, in this case, a perfect 20% U.S. Equity - right where it's goal is to be.

Edge case 3. A computed trade implies buying a fractional share of a security that does not support fractional trading.

If we try to buy a fractional share of a security that doesn't support that mechanism, we floor on BUYs so that we never overshoot our target. We also make a note of the excess cash, and inform the user that we performed rounding. Conversely, when SELLing these positions, we use the ceil function so that we always free up the dollars we need.