/** `?q=`, `?type=`, … into the filter object the query understands. */
export function parseFilters(params: Record<string, string | undefined>) {
  const list = (value: string | undefined) =>
    value
      ? value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : undefined;

  const types = list(params.type)?.filter(
    (value): value is "expense" | "income" | "transfer" =>
      value === "expense" || value === "income" || value === "transfer",
  );

  return {
    search: params.q?.trim() || undefined,
    types: types?.length ? types : undefined,
    accountIds: list(params.account),
    categoryIds: list(params.category),
    minAmount: params.min?.trim() || undefined,
    maxAmount: params.max?.trim() || undefined,
    from: /^\d{4}-\d{2}-\d{2}$/.test(params.from ?? "")
      ? params.from
      : undefined,
    to: /^\d{4}-\d{2}-\d{2}$/.test(params.to ?? "") ? params.to : undefined,
    worth:
      params.worth === "regret" || params.worth === "worth"
        ? params.worth
        : undefined,
  };
}
