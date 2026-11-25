/**
 * Precision monetary arithmetic in INR using integer paise (1 INR = 100 paise)
 * to prevent floating-point precision errors across financial calculations.
 */

export function toPaise(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

export function fromPaise(paise: number): number {
  if (!Number.isFinite(paise)) return 0;
  return Math.round(paise) / 100;
}

export function roundMoney(amount: number): number {
  return fromPaise(toPaise(amount));
}

export function addMoney(a: number, b: number): number {
  return fromPaise(toPaise(a) + toPaise(b));
}

export function subtractMoney(a: number, b: number): number {
  return fromPaise(toPaise(a) - toPaise(b));
}

export function multiplyMoney(amount: number, multiplier: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(multiplier)) return 0;
  return fromPaise(Math.round(toPaise(amount) * multiplier));
}

export function calculatePercentage(amount: number, percentage: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(percentage)) return 0;
  return fromPaise(Math.round((toPaise(amount) * percentage) / 100));
}

export function sumMoney(amounts: number[]): number {
  const totalPaise = amounts.reduce((acc, value) => acc + toPaise(value), 0);
  return fromPaise(totalPaise);
}

export function minMoney(a: number, b: number): number {
  return toPaise(a) <= toPaise(b) ? roundMoney(a) : roundMoney(b);
}

export function maxMoney(a: number, b: number): number {
  return toPaise(a) >= toPaise(b) ? roundMoney(a) : roundMoney(b);
}

export function compareMoney(a: number, b: number): -1 | 0 | 1 {
  const pa = toPaise(a);
  const pb = toPaise(b);
  if (pa < pb) return -1;
  if (pa > pb) return 1;
  return 0;
}

export function formatINR(
  amount: number,
  options?: { showDecimals?: boolean; compact?: boolean },
): string {
  const safe = Number.isFinite(amount) ? roundMoney(amount) : 0;
  const hasDecimals = toPaise(safe) % 100 !== 0;
  const showDecimals = options?.showDecimals ?? hasDecimals;

  if (options?.compact) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(safe);
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(safe);
}

/**
 * Converts a monetary amount in INR into professional Indian words format.
 * Example: 141600 -> "Indian Rupees One Lakh Forty One Thousand Six Hundred Only"
 */
export function amountToWordsINR(amount: number): string {
  const safe = Number.isFinite(amount) ? roundMoney(amount) : 0;
  if (safe === 0) return "Indian Rupees Zero Only";

  const totalPaise = Math.round(safe * 100);
  const rupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];

  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function convertTwoDigits(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    const t = tens[Math.floor(n / 10)];
    const o = ones[n % 10];
    return o ? `${t} ${o}` : t;
  }

  function convertThreeDigits(n: number): string {
    const h = Math.floor(n / 100);
    const r = n % 100;
    const parts: string[] = [];
    if (h > 0) parts.push(`${ones[h]} Hundred`);
    if (r > 0) parts.push(convertTwoDigits(r));
    return parts.join(" ");
  }

  const parts: string[] = [];
  const crore = Math.floor(rupees / 10000000);
  const remCrore = rupees % 10000000;
  const lakh = Math.floor(remCrore / 100000);
  const remLakh = remCrore % 100000;
  const thousand = Math.floor(remLakh / 1000);
  const remThousand = remLakh % 1000;

  if (crore > 0) {
    const croreWords = crore > 99 ? convertThreeDigits(crore) : convertTwoDigits(crore);
    parts.push(`${croreWords} Crore`);
  }
  if (lakh > 0) {
    parts.push(`${convertTwoDigits(lakh)} Lakh`);
  }
  if (thousand > 0) {
    parts.push(`${convertTwoDigits(thousand)} Thousand`);
  }
  if (remThousand > 0) {
    parts.push(convertThreeDigits(remThousand));
  }

  const rupeeString = parts.filter(Boolean).join(" ");
  let result = `Indian Rupees ${rupeeString || "Zero"}`.trim();
  if (paise > 0) {
    result += ` and ${convertTwoDigits(paise)} Paise`;
  }
  result += " Only";
  return result;
}
