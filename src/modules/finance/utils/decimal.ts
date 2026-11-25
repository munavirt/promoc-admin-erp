/**
 * Decimal-safe helpers for 2-decimal money/quantity strings (DRF DecimalField values such as "1250.50").
 *
 * Values are held as BigInt hundredths, so no binary floating point is involved. These are used only for
 * input validation and *preview* figures in forms (line taxable amount, allocation totals). Every saved
 * figure shown after a request comes from the Django response; the backend is the calculation authority.
 */

const DECIMAL_RE = /^\d+(\.\d{1,2})?$/;

/** True for a non-negative decimal with at most 2 fraction digits ("12", "12.5", "12.50"). */
export function isDecimal2(value: string): boolean {
  return DECIMAL_RE.test(value.trim());
}

/** "12.5" → 1250n (hundredths). Returns null for anything that isn't a valid 2-dp decimal (negatives included). */
export function toCents(value: string | number | null | undefined): bigint | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!DECIMAL_RE.test(s)) {
    // DRF always returns fixed 2-dp strings; accept a leading "-" only for display of backend values.
    const neg = /^-\d+(\.\d{1,2})?$/.test(s);
    if (!neg) return null;
    const c = toCents(s.slice(1));
    return c === null ? null : -c;
  }
  const [int, frac = ""] = s.split(".");
  return BigInt(int) * 100n + BigInt((frac + "00").slice(0, 2));
}

/** 1250n → "12.50" */
export function centsToDecimal(cents: bigint): string {
  const neg = cents < 0n;
  const abs = neg ? -cents : cents;
  const int = abs / 100n;
  const frac = (abs % 100n).toString().padStart(2, "0");
  return `${neg ? "-" : ""}${int}.${frac}`;
}

/** Round-half-up division of a non-negative BigInt (mirrors Python's ROUND_HALF_UP for positives). */
function divRoundHalfUp(n: bigint, d: bigint): bigint {
  const q = n / d;
  const r = n % d;
  return r * 2n >= d ? q + 1n : q;
}

/** quantity × unit price, rounded half-up to 2 dp (InvoiceCalculationService.round_money). */
export function multiplyCents(qtyCents: bigint, priceCents: bigint): bigint {
  // (q/100) * (p/100) = q*p/10000 → in hundredths: q*p/100
  return divRoundHalfUp(qtyCents * priceCents, 100n);
}

export function sumCents(values: Array<bigint | null | undefined>): bigint {
  return values.reduce<bigint>((t, v) => t + (v ?? 0n), 0n);
}

/** Number for display formatting only (Intl). Never feed the result back into a calculation. */
export function centsToNumber(cents: bigint): number {
  return Number(cents) / 100;
}
