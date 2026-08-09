"""E3 — the one definition of "expense, attributed to a category".

A split transaction ("supermarket trip" = groceries + household + wine) keeps one row in
`transactions` holding the full amount, and its parts live in `transaction_splits`. So
"how much went to Groceries" can no longer read `transactions.category_id` alone: for a
split row that column is either null or misleading, and the real per-category amounts
are in the side table.

`CATEGORY_SPEND_SOURCE` is a subquery that yields one `(category_id, amount, date,
profile_id, id)` row per *attributable* amount:

- unsplit transactions contribute themselves, exactly as before;
- split transactions contribute their parts instead of themselves.

The parent is excluded by `NOT is_split`, so a split is counted **once** — never both as
a whole and as its parts, which would double every split in every category report.

Money aggregates (balance, safe-to-spend, budgets-by-total, reports totals) deliberately
do **not** use this: they read `transactions` directly, where one money movement is still
exactly one row. That separation is why adding splits didn't require auditing all 23
money queries in this codebase.
"""

# Callers substitute their own WHERE clause against the alias `t`.
CATEGORY_SPEND_SOURCE = """
    SELECT t.id, t.profile_id, t.date, t.transaction_type,
           t.category_id, t.amount
      FROM transactions t
     WHERE NOT t.is_split
    UNION ALL
    SELECT t.id, t.profile_id, t.date, t.transaction_type,
           s.category_id, s.amount
      FROM transaction_splits s
      JOIN transactions t ON t.id = s.transaction_id
"""
