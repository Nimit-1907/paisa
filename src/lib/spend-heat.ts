/**
 * How dark a day is drawn on the month card's calendar, 0 to 4.
 *
 * 0 is a day with nothing spent; any spending at all is at least 1, so a
 * ₹20 chai is still a mark. The rest rise in quarters of `scale`, the
 * busiest ordinary day (`ordinaryPeak`), and anything past it, the rent,
 * is 4 rather than flattening every other day.
 */
export function heatLevel(spent: number, scale: number): 0 | 1 | 2 | 3 | 4 {
  if (spent <= 0) return 0;
  const quarters = Math.ceil((spent / Math.max(scale, 1)) * 4);
  return Math.min(4, Math.max(1, quarters)) as 1 | 2 | 3 | 4;
}
