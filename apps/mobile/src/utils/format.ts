/** 950 -> "950", 1234 -> "1.2k", 15000 -> "15k", 2_400_000 -> "2.4M" */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return trim(n / 1000) + 'k';
  return trim(n / 1_000_000) + 'M';
}

function trim(value: number): string {
  const fixed =
    value >= 10 ? Math.floor(value).toString() : (Math.floor(value * 10) / 10).toFixed(1);
  return fixed.replace(/\.0$/, '');
}
